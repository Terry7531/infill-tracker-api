using InfillTracker.Core.Models;
using InfillTracker.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SendGrid;
using SendGrid.Helpers.Mail;

namespace InfillTracker.Infrastructure.Services;

/// <summary>
/// Detects tasks that are newly unblocked or overdue and sends notification
/// emails via SendGrid to the assigned Task Owner and the admin address.
///
/// Duplicate prevention: a notification is only sent once per (TaskId, EventType,
/// recipient, calendar day) combination. This means re-running the service on
/// the same day will not re-send already-delivered emails.
/// </summary>
public class NotificationService
{
    private readonly AppDbContext    _db;
    private readonly IConfiguration  _config;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(
        AppDbContext db,
        IConfiguration config,
        ILogger<NotificationService> logger)
    {
        _db     = db;
        _config = config;
        _logger = logger;
    }

    // ─────────────────────────────────────────────────────────────────────────
    /// <summary>
    /// Runs both checks (unblocked + overdue) and returns a summary of what
    /// was processed. Called by both the background scheduler and the manual
    /// API trigger.
    /// </summary>
    public async Task<NotificationRunResult> RunAsync(CancellationToken ct = default)
    {
        var result = new NotificationRunResult { RanAt = DateTime.UtcNow };

        var unblockedCount = await SendUnblockedNotificationsAsync(ct);
        var overdueCount   = await SendOverdueNotificationsAsync(ct);

        result.UnblockedEmailsSent = unblockedCount;
        result.OverdueEmailsSent   = overdueCount;

        _logger.LogInformation(
            "Notification run complete — {Unblocked} unblocked, {Overdue} overdue emails sent.",
            unblockedCount, overdueCount);

        return result;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Unblocked: tasks that are incomplete, have an owner with an email, all
    // dependencies are complete, and we haven't notified today.
    // ─────────────────────────────────────────────────────────────────────────
    private async Task<int> SendUnblockedNotificationsAsync(CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;

        var candidates = await _db.Tasks
            .Where(t =>
                !t.IsCompleted &&
                t.TaskOwner != null &&
                t.TaskOwner.Email != null &&
                t.Dependencies.All(d => d.DependsOnTask.IsCompleted))
            .Include(t => t.TaskOwner)
            .Include(t => t.Project)
            .Include(t => t.Dependencies).ThenInclude(d => d.DependsOnTask)
            .ToListAsync(ct);

        int sent = 0;
        foreach (var task in candidates)
        {
            var recipients = BuildRecipients(task.TaskOwner!.Email!);
            foreach (var email in recipients)
            {
                if (await AlreadySentTodayAsync(task.Id, "Unblocked", email, today)) continue;

                var success = await SendEmailAsync(
                    to:      email,
                    subject: $"[InfillTracker] Task Ready to Start — {task.ExcelCode}: {task.TaskName}",
                    html:    BuildUnblockedHtml(task),
                    ct:      ct);

                await LogAsync(task.Id, "Unblocked", email, success, null);
                if (success) sent++;
            }
        }
        return sent;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Overdue: started tasks where Today > StartDate + TypicalTimelineDays
    // ─────────────────────────────────────────────────────────────────────────
    private async Task<int> SendOverdueNotificationsAsync(CancellationToken ct)
    {
        var today     = DateOnly.FromDateTime(DateTime.UtcNow);
        var todayFull = DateTime.UtcNow.Date;

        var candidates = await _db.Tasks
            .Where(t =>
                !t.IsCompleted &&
                t.OwnerStartDate != null &&
                t.TypicalTimelineDays != null &&
                t.TaskOwner != null &&
                t.TaskOwner.Email != null)
            .Include(t => t.TaskOwner)
            .Include(t => t.Project)
            .ToListAsync(ct);

        int sent = 0;
        foreach (var task in candidates)
        {
            // Calculate expected finish date
            var expectedFinish = task.OwnerStartDate!.Value
                .AddDays(task.TypicalTimelineDays!.Value);

            if (today <= expectedFinish) continue; // not overdue yet

            int daysLate = today.DayNumber - expectedFinish.DayNumber;

            var recipients = BuildRecipients(task.TaskOwner!.Email!);
            foreach (var email in recipients)
            {
                if (await AlreadySentTodayAsync(task.Id, "Overdue", email, todayFull)) continue;

                var success = await SendEmailAsync(
                    to:      email,
                    subject: $"[InfillTracker] Task Overdue ({daysLate}d) — {task.ExcelCode}: {task.TaskName}",
                    html:    BuildOverdueHtml(task, daysLate),
                    ct:      ct);

                await LogAsync(task.Id, "Overdue", email, success, null);
                if (success) sent++;
            }
        }
        return sent;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────
    private List<string> BuildRecipients(string ownerEmail)
    {
        var list = new List<string> { ownerEmail };
        var admin = _config["Notifications:AdminEmail"];
        if (!string.IsNullOrWhiteSpace(admin) && admin != ownerEmail)
            list.Add(admin);
        return list;
    }

    private async Task<bool> AlreadySentTodayAsync(
        int taskId, string eventType, string email, DateTime today)
    {
        var tomorrow = today.AddDays(1);
        return await _db.NotificationLogs.AnyAsync(n =>
            n.TaskId    == taskId &&
            n.EventType == eventType &&
            n.SentTo    == email &&
            n.SentAt    >= today &&
            n.SentAt    <  tomorrow &&
            n.Success);
    }

    private async Task LogAsync(
        int taskId, string eventType, string email, bool success, string? error)
    {
        _db.NotificationLogs.Add(new NotificationLog
        {
            TaskId       = taskId,
            EventType    = eventType,
            SentTo       = email,
            SentAt       = DateTime.UtcNow,
            Success      = success,
            ErrorMessage = error,
        });
        await _db.SaveChangesAsync();
    }

    private async Task<bool> SendEmailAsync(
        string to, string subject, string html, CancellationToken ct)
    {
        var apiKey   = _config["SendGrid:ApiKey"];
        var fromAddr = _config["SendGrid:FromEmail"] ?? "notifications@infilltracker.com";
        var fromName = _config["SendGrid:FromName"]  ?? "InfillTracker";

        if (string.IsNullOrWhiteSpace(apiKey) || apiKey == "YOUR_SENDGRID_API_KEY")
        {
            _logger.LogWarning(
                "SendGrid API key not configured. Skipping email to {To}. " +
                "Set SendGrid:ApiKey in appsettings.json.", to);
            return false;
        }

        try
        {
            var client  = new SendGridClient(apiKey);
            var from    = new EmailAddress(fromAddr, fromName);
            var toAddr  = new EmailAddress(to);
            var msg     = MailHelper.CreateSingleEmail(from, toAddr, subject, null, html);
            var response = await client.SendEmailAsync(msg, ct);

            if ((int)response.StatusCode >= 400)
            {
                var body = await response.Body.ReadAsStringAsync(ct);
                _logger.LogError("SendGrid error {Status} for {To}: {Body}",
                    response.StatusCode, to, body);
                return false;
            }
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception sending email to {To}", to);
            return false;
        }
    }

    // ── Email HTML templates ──────────────────────────────────────────────────
    private static string BuildUnblockedHtml(ConstructionTask task) => $"""
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
          <div style="background:#1B3A4B;padding:20px 24px;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">✦ Task Ready to Start</h1>
            <p style="color:rgba(255,255,255,.7);margin:4px 0 0;font-size:13px">InfillTracker Notification</p>
          </div>
          <div style="background:#fff;border:1px solid #E2E6EA;border-top:none;padding:24px;border-radius:0 0 8px 8px">
            <p style="color:#4A5568;margin:0 0 16px">All dependencies for the following task are now complete — it is ready to start:</p>
            <div style="background:#F8F9FA;border-left:4px solid #C9841A;padding:14px 16px;border-radius:4px;margin-bottom:20px">
              <p style="margin:0 0 4px">
                <span style="font-family:monospace;background:rgba(201,132,26,.1);color:#C9841A;padding:2px 8px;border-radius:3px;font-size:13px;font-weight:700">{task.ExcelCode}</span>
              </p>
              <p style="margin:4px 0 0;font-size:17px;font-weight:600;color:#1A202C">{task.TaskName}</p>
              <p style="margin:6px 0 0;font-size:13px;color:#718096">Project: <strong>{task.Project.Name}</strong></p>
              {(task.TypicalTimelineDays.HasValue ? $"<p style='margin:4px 0 0;font-size:13px;color:#718096'>Estimated duration: <strong>{task.TypicalTimelineDays} days</strong></p>" : "")}
            </div>
            <p style="color:#718096;font-size:13px;margin:0">Log in to InfillTracker to start this task and update its details.</p>
          </div>
          <p style="color:#ADB5BD;font-size:11px;text-align:center;margin-top:12px">InfillTracker · Automated Notification</p>
        </div>
        """;

    private static string BuildOverdueHtml(ConstructionTask task, int daysLate) => $"""
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
          <div style="background:#C53030;padding:20px 24px;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">⚠ Task Overdue by {daysLate} Day{(daysLate == 1 ? "" : "s")}</h1>
            <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:13px">InfillTracker Notification</p>
          </div>
          <div style="background:#fff;border:1px solid #E2E6EA;border-top:none;padding:24px;border-radius:0 0 8px 8px">
            <p style="color:#4A5568;margin:0 0 16px">The following task has exceeded its estimated timeline:</p>
            <div style="background:#FFF5F5;border-left:4px solid #E53E3E;padding:14px 16px;border-radius:4px;margin-bottom:20px">
              <p style="margin:0 0 4px">
                <span style="font-family:monospace;background:rgba(229,62,62,.1);color:#C53030;padding:2px 8px;border-radius:3px;font-size:13px;font-weight:700">{task.ExcelCode}</span>
                <span style="background:#FEE2E2;color:#991B1B;font-size:11px;font-weight:700;padding:2px 8px;border-radius:100px;margin-left:8px">{daysLate}d OVERDUE</span>
              </p>
              <p style="margin:4px 0 0;font-size:17px;font-weight:600;color:#1A202C">{task.TaskName}</p>
              <p style="margin:6px 0 0;font-size:13px;color:#718096">Project: <strong>{task.Project.Name}</strong></p>
              <p style="margin:4px 0 0;font-size:13px;color:#718096">Started: <strong>{task.OwnerStartDate}</strong> · Est. {task.TypicalTimelineDays} days</p>
              {(task.TaskOwner != null ? $"<p style='margin:4px 0 0;font-size:13px;color:#718096'>Owner: <strong>{task.TaskOwner.Name}</strong></p>" : "")}
            </div>
            <p style="color:#718096;font-size:13px;margin:0">Log in to InfillTracker to review this task and update its status.</p>
          </div>
          <p style="color:#ADB5BD;font-size:11px;text-align:center;margin-top:12px">InfillTracker · Automated Notification</p>
        </div>
        """;
}

// ── Result DTO returned by RunAsync ──────────────────────────────────────────
public class NotificationRunResult
{
    public DateTime RanAt              { get; set; }
    public int      UnblockedEmailsSent { get; set; }
    public int      OverdueEmailsSent   { get; set; }
    public int      TotalEmailsSent     => UnblockedEmailsSent + OverdueEmailsSent;
}
