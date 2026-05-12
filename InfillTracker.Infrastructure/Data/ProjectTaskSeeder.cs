using InfillTracker.Core.Models;
using InfillTracker.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OfficeOpenXml;
using System.Reflection;

namespace InfillTracker.Infrastructure.Data;

/// <summary>
/// Seeds the standard infill construction tasks for a new project by reading
/// directly from <c>Infill_Tasks.xlsx</c> — the spreadsheet is the single
/// source of truth for task definitions and dependency relationships.
///
/// To add, remove, or rename a task: edit the spreadsheet only. No C# changes needed.
/// To map a new column: add one entry to <see cref="ColumnMap"/> and one property
/// assignment in <see cref="MapRowToTask"/>. That's the only change ever required here.
///
/// Two-pass strategy
/// ─────────────────
/// Pass 1  Read every data row → insert ConstructionTask entities with
///         ExcelCode populated. No dependencies yet.
/// Pass 2  Build a code→Id lookup from the saved rows, then parse the
///         dependency column and insert TaskDependency rows.
///         Any unrecognised dependency code throws <see cref="InvalidOperationException"/>
///         so typos are caught before the project is committed to the database.
/// </summary>
public class ProjectTaskSeeder
{
    // ── Column header names exactly as they appear in the spreadsheet ─────────
    // If a column is renamed in the xlsx, update the VALUE on the right only.
    // Never change the dictionary keys — they are referenced in MapRowToTask.
    private static readonly Dictionary<string, string> ColumnMap = new()
    {
        ["Stage"]      = "Project Stages",
        ["Code"]       = "Task ID",
        ["Name"]       = "Task",
        ["Deps"]       = "Trigger Task ID(s) To Start Task",
        ["ToDoList"]   = "To Do List",
        ["Completed"]  = "Completed (Yes / No)",
        ["Timeline"]   = "Typical Task Timeline From Start",
        ["Storage"]    = "Storage Location",
        ["Template"]   = "Template Document",
        ["InvoiceNum"] = "Invoice Number",
        ["Payment"]    = "Payment Method",
        ["Cost"]       = "Cost",
    };

    // Rows whose Task ID matches XY00 (e.g. DE00, C00) are section-header rows
    // in the spreadsheet, not actionable tasks — they are skipped during seeding.
    private static bool IsSectionHeader(string code)
        => System.Text.RegularExpressions.Regex.IsMatch(code, @"^[A-Z]+00$");

    private readonly AppDbContext _db;
    private readonly ILogger<ProjectTaskSeeder> _logger;

    public ProjectTaskSeeder(AppDbContext db, ILogger<ProjectTaskSeeder> logger)
    {
        _db     = db;
        _logger = logger;
    }

    // ─────────────────────────────────────────────────────────────────────────
    public async Task SeedTasksForProjectAsync(int projectId)
    {
        if (await _db.Tasks.AnyAsync(t => t.ProjectId == projectId))
        {
            _logger.LogInformation(
                "Project {ProjectId} already has tasks — skipping seed.", projectId);
            return;
        }

        var xlsxPath = ResolveSpreadsheetPath();
        _logger.LogInformation(
            "Seeding project {ProjectId} from {Path}", projectId, xlsxPath);

        // EPPlus requires a license context (NonCommercial is free).
        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;

        using var package = new ExcelPackage(new FileInfo(xlsxPath));

        var ws = package.Workbook.Worksheets[0]
            ?? throw new InvalidOperationException(
                "Infill_Tasks.xlsx contains no worksheets.");

        // ── Discover column positions by matching header names ─────────────
        var colIndex = BuildColumnIndex(ws);

        // ── Read all data rows into a flat list of string dictionaries ─────
        var rawRows = ReadRawRows(ws, colIndex);

        if (rawRows.Count == 0)
            throw new InvalidOperationException(
                "No task rows found in Infill_Tasks.xlsx. " +
                "Verify the spreadsheet has not been emptied or restructured.");

        // ── Pass 1: insert all tasks ───────────────────────────────────────
        var tasks = rawRows
            .Select(row => MapRowToTask(row, projectId))
            .ToList();

        await _db.Tasks.AddRangeAsync(tasks);
        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Pass 1 complete — inserted {Count} tasks for project {ProjectId}.",
            tasks.Count, projectId);

        // ── Pass 2: wire up dependencies ───────────────────────────────────
        // Build ExcelCode → integer Id lookup (scoped to this project only)
        var codeLookup = await _db.Tasks
            .Where(t => t.ProjectId == projectId && t.ExcelCode != null)
            .ToDictionaryAsync(t => t.ExcelCode!, t => t.Id);

        // BuildDependencies throws if any code in the Deps column is not found
        var dependencies = BuildDependencies(rawRows, codeLookup, projectId);

        await _db.TaskDependencies.AddRangeAsync(dependencies);
        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Pass 2 complete — inserted {Count} dependencies for project {ProjectId}.",
            dependencies.Count, projectId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Resolve the spreadsheet path relative to the executing assembly so it
    // works in development (bin/Debug) and in a published deployment.
    // ─────────────────────────────────────────────────────────────────────────
    private static string ResolveSpreadsheetPath()
    {
        var dir  = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location)
                   ?? AppContext.BaseDirectory;
        var path = Path.Combine(dir, "Data", "SeedData", "Infill_Tasks.xlsx");

        if (!File.Exists(path))
            throw new FileNotFoundException(
                $"Seed spreadsheet not found at '{path}'. " +
                "Ensure Infill_Tasks.xlsx is set to " +
                "<CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory> " +
                "in InfillTracker.Infrastructure.csproj.", path);

        return path;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Walk the header row, match each cell text against ColumnMap values,
    // and return a lookup of internal key → 1-based column number.
    // Throws immediately if any required column header is not found.
    // ─────────────────────────────────────────────────────────────────────────
    private static Dictionary<string, int> BuildColumnIndex(ExcelWorksheet ws)
    {
        int headerRow = FindHeaderRow(ws);

        // Map every cell in the header row: header text → column number
        var sheetHeaders = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (int col = 1; col <= ws.Dimension.End.Column; col++)
        {
            var text = ws.Cells[headerRow, col].Text.Trim();
            if (!string.IsNullOrEmpty(text))
                sheetHeaders[text] = col;
        }

        // Validate all ColumnMap entries exist in the sheet
        var missing = ColumnMap
            .Where(kvp => !sheetHeaders.ContainsKey(kvp.Value))
            .Select(kvp => $"  '{kvp.Value}' (internal key: '{kvp.Key}')")
            .ToList();

        if (missing.Count > 0)
            throw new InvalidOperationException(
                "Infill_Tasks.xlsx is missing the following required column(s):\n" +
                string.Join("\n", missing) + "\n" +
                "If a column was renamed in the spreadsheet, update the corresponding " +
                "VALUE in ProjectTaskSeeder.ColumnMap to match the new header text.");

        // Return a simplified lookup: internal key → column number
        return ColumnMap.ToDictionary(
            kvp => kvp.Key,
            kvp => sheetHeaders[kvp.Value]);
    }

    private static int FindHeaderRow(ExcelWorksheet ws)
    {
        int maxSearch = Math.Min(ws.Dimension.End.Row, 10);
        for (int row = 1; row <= maxSearch; row++)
            for (int col = 1; col <= ws.Dimension.End.Column; col++)
                if (ws.Cells[row, col].Text.Trim() == "Task ID")
                    return row;

        throw new InvalidOperationException(
            "Cannot find the header row in Infill_Tasks.xlsx. " +
            "Expected a cell containing 'Task ID' within the first 10 rows.");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Read all data rows into a plain list of string dictionaries.
    // The stage label is carried forward from the last non-empty Stage cell
    // because the spreadsheet uses sparse/merged stage cells.
    // ─────────────────────────────────────────────────────────────────────────
    private static List<Dictionary<string, string>> ReadRawRows(
        ExcelWorksheet ws, Dictionary<string, int> colIndex)
    {
        int headerRow     = FindHeaderRow(ws);
        var rows          = new List<Dictionary<string, string>>();
        string lastStage  = string.Empty;

        for (int row = headerRow + 1; row <= ws.Dimension.End.Row; row++)
        {
            // Stage cell is sparse — carry the last known value forward
            var stageCell = ws.Cells[row, colIndex["Stage"]].Text.Trim();
            if (!string.IsNullOrWhiteSpace(stageCell))
                lastStage = stageCell;

            var code = ws.Cells[row, colIndex["Code"]].Text.Trim();

            // Skip blank rows and section-header rows (DE00, C00, etc.)
            if (string.IsNullOrWhiteSpace(code) || IsSectionHeader(code))
                continue;

            rows.Add(new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Stage"]      = lastStage,
                ["Code"]       = code,
                ["Name"]       = ws.Cells[row, colIndex["Name"]].Text.Trim(),
                ["Deps"]       = ws.Cells[row, colIndex["Deps"]].Text.Trim(),
                ["ToDoList"]   = ws.Cells[row, colIndex["ToDoList"]].Text.Trim(),
                ["Completed"]  = ws.Cells[row, colIndex["Completed"]].Text.Trim(),
                ["Timeline"]   = ws.Cells[row, colIndex["Timeline"]].Text.Trim(),
                ["Storage"]    = ws.Cells[row, colIndex["Storage"]].Text.Trim(),
                ["Template"]   = ws.Cells[row, colIndex["Template"]].Text.Trim(),
                ["InvoiceNum"] = ws.Cells[row, colIndex["InvoiceNum"]].Text.Trim(),
                ["Payment"]    = ws.Cells[row, colIndex["Payment"]].Text.Trim(),
                ["Cost"]       = ws.Cells[row, colIndex["Cost"]].Text.Trim(),
            });
        }

        return rows;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Map one raw-row dictionary → ConstructionTask entity.
    //
    // Adding a new spreadsheet column to the model:
    //   1. Add an entry to ColumnMap above (key + matching header text).
    //   2. Add the ReadRawRows dictionary entry for that key.
    //   3. Add one property assignment here.  That's it.
    // ─────────────────────────────────────────────────────────────────────────
    private static ConstructionTask MapRowToTask(
        Dictionary<string, string> row, int projectId) => new()
    {
        ProjectId           = projectId,
        ExcelCode           = row["Code"],
        ProjectStage        = NullIfEmpty(row["Stage"]),
        TaskName            = row["Name"],
        ToDoList            = NullIfEmpty(row["ToDoList"]),
        IsCompleted         = row["Completed"].Equals("yes", StringComparison.OrdinalIgnoreCase),
        TypicalTimelineDays = ParseInt(row["Timeline"]),
        StorageLocation     = NullIfEmpty(row["Storage"]),
        TemplateDocument    = NullIfEmpty(row["Template"]),
        InvoiceNumber       = NullIfEmpty(row["InvoiceNum"]),
        PaymentMethod       = NullIfEmpty(row["Payment"]),
        Cost                = ParseDecimal(row["Cost"]),
        // TaskOwnerId and VendorId stay null at seed time —
        // they are assigned later through the API drop-down selectors.
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Build TaskDependency rows from the raw dependency strings.
    //
    // Throws InvalidOperationException (aborting the entire seed) if any
    // dependency code in the spreadsheet cannot be resolved to a known task.
    // This is intentional — a bad code means a broken dependency graph and
    // the project should not be created in an inconsistent state.
    // ─────────────────────────────────────────────────────────────────────────
    private static List<TaskDependency> BuildDependencies(
        List<Dictionary<string, string>> rawRows,
        Dictionary<string, int> codeLookup,
        int projectId)
    {
        var deps   = new List<TaskDependency>();
        var errors = new List<string>();

        foreach (var row in rawRows)
        {
            var depsRaw = row["Deps"];

            if (string.IsNullOrWhiteSpace(depsRaw) ||
                depsRaw.Equals("N/A", StringComparison.OrdinalIgnoreCase))
                continue;

            if (!codeLookup.TryGetValue(row["Code"], out int taskId))
                continue; // Should never happen — task was just inserted in Pass 1

            // The Deps cell may hold multiple comma-separated codes: "DE03, DE04, DE05"
            foreach (var raw in depsRaw.Split(',', StringSplitOptions.RemoveEmptyEntries))
            {
                var depCode = raw.Trim();
                if (string.IsNullOrEmpty(depCode)) continue;

                if (!codeLookup.TryGetValue(depCode, out int depTaskId))
                {
                    errors.Add(
                        $"  Task '{row["Code"]}' (\"{row["Name"]}\") references " +
                        $"dependency '{depCode}' which does not match any Task ID in the spreadsheet.");
                    continue;
                }

                deps.Add(new TaskDependency
                {
                    TaskId          = taskId,
                    DependsOnTaskId = depTaskId,
                });
            }
        }

        if (errors.Count > 0)
            throw new InvalidOperationException(
                $"Seed aborted for project {projectId} — " +
                $"{errors.Count} unrecognised dependency code(s) in Infill_Tasks.xlsx:\n" +
                string.Join("\n", errors) + "\n\n" +
                "Correct the spreadsheet and retry creating the project.");

        return deps;
    }

    // ── Parsing helpers ───────────────────────────────────────────────────────
    private static string? NullIfEmpty(string value)
        => string.IsNullOrWhiteSpace(value) ? null : value;

    private static int? ParseInt(string value)
        => double.TryParse(value, out var d) ? (int?)Convert.ToInt32(d) : null;

    private static decimal? ParseDecimal(string value)
        => decimal.TryParse(value, out var d) ? d : null;
}
