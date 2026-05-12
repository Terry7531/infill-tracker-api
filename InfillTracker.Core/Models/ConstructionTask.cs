namespace InfillTracker.Core.Models;

public class ConstructionTask
{
    public int Id { get; set; }

    // ── Foreign Keys ──────────────────────────────────────────────
    public int ProjectId { get; set; }

    public int? TaskOwnerId { get; set; }

    public int? VendorId { get; set; }

    // ── Task Identity ─────────────────────────────────────────────
    /// <summary>
    /// The original spreadsheet code (e.g. "DE01", "C06"). Stored so the seeder
    /// can resolve dependency codes to integer IDs after the first insert pass.
    /// Also useful for cross-referencing tasks with the original Excel template.
    /// </summary>
    public string? ExcelCode { get; set; }

    /// <summary>Phase or stage grouping within the project (e.g. "Foundation", "Framing").</summary>
    public string? ProjectStage { get; set; }

    public string TaskName { get; set; } = string.Empty;

    // ── Work Details ──────────────────────────────────────────────
    /// <summary>Free-text notes or checklist items for this task.</summary>
    public string? ToDoList { get; set; }

    public bool IsCompleted { get; set; } = false;

    // ── Timeline ──────────────────────────────────────────────────
    /// <summary>Expected number of days from task start to finish.</summary>
    public int? TypicalTimelineDays { get; set; }

    public DateOnly? OwnerStartDate { get; set; }

    public DateOnly? FinishDate { get; set; }

    public int? TotalActualDays { get; set; }

    // ── Financial ─────────────────────────────────────────────────
    public decimal? Cost { get; set; }

    public string? InvoiceNumber { get; set; }

    public string? PaymentMethod { get; set; }

    // ── Documents ─────────────────────────────────────────────────
    /// <summary>Path, URL, or label describing where physical/digital documents are stored.</summary>
    public string? StorageLocation { get; set; }

    /// <summary>Filename or URL of a template document associated with this task.</summary>
    public string? TemplateDocument { get; set; }

    // ── Navigation Properties ─────────────────────────────────────
    public Project Project { get; set; } = null!;

    public TaskOwner? TaskOwner { get; set; }

    public Vendor? Vendor { get; set; }

    /// <summary>Tasks that THIS task depends on (must be completed before this task starts).</summary>
    public ICollection<TaskDependency> Dependencies { get; set; } = new List<TaskDependency>();

    /// <summary>Tasks that are waiting on THIS task to complete.</summary>
    public ICollection<TaskDependency> Dependents { get; set; } = new List<TaskDependency>();
}
