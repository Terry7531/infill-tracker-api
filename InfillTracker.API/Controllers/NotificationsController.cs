using InfillTracker.Infrastructure.Data;
using InfillTracker.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InfillTracker.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NotificationsController : ControllerBase
{
    private readonly NotificationService _notificationService;
    private readonly AppDbContext        _db;

    public NotificationsController(
        NotificationService notificationService,
        AppDbContext db)
    {
        _notificationService = notificationService;
        _db = db;
    }

    // POST api/notifications/send
    /// <summary>
    /// Manually triggers a full notification run (unblocked + overdue).
    /// Returns a summary of emails sent.
    /// </summary>
    [HttpPost("send")]
    public async Task<ActionResult<NotificationRunSummaryDto>> Send(CancellationToken ct)
    {
        var result = await _notificationService.RunAsync(ct);

        return Ok(new NotificationRunSummaryDto(
            result.RanAt,
            result.UnblockedEmailsSent,
            result.OverdueEmailsSent,
            result.TotalEmailsSent));
    }

    // GET api/notifications/logs?take=50
    /// <summary>
    /// Returns the most recent notification log entries for the UI log view.
    /// </summary>
    [HttpGet("logs")]
    public async Task<ActionResult<IEnumerable<NotificationLogDto>>> GetLogs(
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        var logs = await _db.NotificationLogs
            .Include(n => n.Task)
                .ThenInclude(t => t.Project)
            .OrderByDescending(n => n.SentAt)
            .Take(Math.Clamp(take, 1, 200))
            .Select(n => new NotificationLogDto(
                n.Id,
                n.Task.ExcelCode,
                n.Task.TaskName,
                n.Task.Project.Name,
                n.EventType,
                n.SentTo,
                n.SentAt,
                n.Success,
                n.ErrorMessage))
            .ToListAsync(ct);

        return Ok(logs);
    }
}

// ── DTOs ──────────────────────────────────────────────────────────────────────
public record NotificationRunSummaryDto(
    DateTime RanAt,
    int      UnblockedEmailsSent,
    int      OverdueEmailsSent,
    int      TotalEmailsSent);

public record NotificationLogDto(
    int      Id,
    string?  ExcelCode,
    string   TaskName,
    string   ProjectName,
    string   EventType,
    string   SentTo,
    DateTime SentAt,
    bool     Success,
    string?  ErrorMessage);
