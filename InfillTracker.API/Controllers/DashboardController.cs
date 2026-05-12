using InfillTracker.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InfillTracker.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _db;

    public DashboardController(AppDbContext db) => _db = db;

    // GET api/dashboard/summary
    /// <summary>
    /// Returns a summary card for every project — completion %, task counts,
    /// delayed task count, and last activity date.
    /// </summary>
    [HttpGet("summary")]
    public async Task<ActionResult<IEnumerable<ProjectSummaryDto>>> GetSummary(
        CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var projects = await _db.Projects
            .Include(p => p.Tasks)
                .ThenInclude(t => t.Dependencies)
                    .ThenInclude(d => d.DependsOnTask)
            .OrderBy(p => p.Name)
            .ToListAsync(ct);

        var summaries = projects.Select(p =>
        {
            var tasks       = p.Tasks.ToList();
            var total       = tasks.Count;
            var completed   = tasks.Count(t => t.IsCompleted);
            var inProgress  = tasks.Count(t => t.OwnerStartDate != null && !t.IsCompleted);
            var pct         = total > 0 ? (int)Math.Round((double)completed / total * 100) : 0;

            var delayed = tasks.Count(t =>
                !t.IsCompleted &&
                t.OwnerStartDate != null &&
                t.TypicalTimelineDays != null &&
                today > t.OwnerStartDate.Value.AddDays(t.TypicalTimelineDays.Value));

            var unblocked = tasks.Count(t =>
                !t.IsCompleted &&
                t.Dependencies.All(d => d.DependsOnTask.IsCompleted));

            var lastActivity = tasks
                .Where(t => t.FinishDate != null || t.OwnerStartDate != null)
                .Select(t => t.FinishDate ?? t.OwnerStartDate)
                .Where(d => d != null)
                .OrderByDescending(d => d)
                .FirstOrDefault();

            return new ProjectSummaryDto(
                p.Id, p.Name, p.Address,
                total, completed, inProgress, unblocked, delayed,
                pct, lastActivity);
        }).ToList();

        return Ok(summaries);
    }

    // GET api/dashboard/my-tasks?ownerId=3
    /// <summary>
    /// Returns all incomplete tasks assigned to a given TaskOwner across
    /// all projects, ordered by overdue first then by TypicalTimelineDays.
    /// </summary>
    [HttpGet("my-tasks")]
    public async Task<ActionResult<IEnumerable<MyTaskDto>>> GetMyTasks(
        [FromQuery] int ownerId,
        CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var tasks = await _db.Tasks
            .Where(t => t.TaskOwnerId == ownerId && !t.IsCompleted)
            .Include(t => t.Project)
            .Include(t => t.TaskOwner)
            .Include(t => t.Dependencies).ThenInclude(d => d.DependsOnTask)
            .ToListAsync(ct);

        var dtos = tasks.Select(t =>
        {
            int? delayDays = null;
            if (t.OwnerStartDate != null && t.TypicalTimelineDays != null)
            {
                var expected = t.OwnerStartDate.Value.AddDays(t.TypicalTimelineDays.Value);
                var diff     = today.DayNumber - expected.DayNumber;
                if (diff > 0) delayDays = diff;
            }

            bool isUnblocked = t.Dependencies.All(d => d.DependsOnTask.IsCompleted);

            return new MyTaskDto(
                t.Id,
                t.ProjectId,
                t.Project.Name,
                t.ExcelCode,
                t.TaskName,
                t.ProjectStage,
                t.OwnerStartDate,
                t.TypicalTimelineDays,
                t.IsCompleted,
                isUnblocked,
                delayDays);
        })
        // Delayed first, then unblocked ready, then by timeline days
        .OrderByDescending(t => t.DelayDays.HasValue)
        .ThenByDescending(t => t.IsUnblocked)
        .ThenBy(t => t.TypicalTimelineDays ?? int.MaxValue)
        .ToList();

        return Ok(dtos);
    }

    // GET api/dashboard/owners
    /// <summary>Lightweight owner list for the "My Tasks" selector.</summary>
    [HttpGet("owners")]
    public async Task<ActionResult<IEnumerable<OwnerPickerDto>>> GetOwners(
        CancellationToken ct = default)
    {
        var owners = await _db.TaskOwners
            .OrderBy(o => o.Name)
            .Select(o => new OwnerPickerDto(o.Id, o.Name))
            .ToListAsync(ct);

        return Ok(owners);
    }
}

// ── DTOs ──────────────────────────────────────────────────────────────────────
public record ProjectSummaryDto(
    int      Id,
    string   Name,
    string?  Address,
    int      TotalTasks,
    int      CompletedTasks,
    int      InProgressTasks,
    int      UnblockedTasks,
    int      DelayedTasks,
    int      PercentComplete,
    DateOnly? LastActivity);

public record MyTaskDto(
    int      Id,
    int      ProjectId,
    string   ProjectName,
    string?  ExcelCode,
    string   TaskName,
    string?  ProjectStage,
    DateOnly? OwnerStartDate,
    int?     TypicalTimelineDays,
    bool     IsCompleted,
    bool     IsUnblocked,
    int?     DelayDays);

public record OwnerPickerDto(int Id, string Name);
