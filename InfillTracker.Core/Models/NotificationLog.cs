namespace InfillTracker.Core.Models;

/// <summary>
/// Records every notification email that has been sent.
/// Used to prevent duplicate emails for the same event on the same day.
/// </summary>
public class NotificationLog
{
    public int Id { get; set; }

    public int TaskId { get; set; }

    /// <summary>"Unblocked" or "Overdue"</summary>
    public string EventType { get; set; } = string.Empty;

    /// <summary>Email address the notification was sent to.</summary>
    public string SentTo { get; set; } = string.Empty;

    public DateTime SentAt { get; set; } = DateTime.UtcNow;

    /// <summary>True = delivered successfully, False = send failed.</summary>
    public bool Success { get; set; }

    public string? ErrorMessage { get; set; }

    // Navigation
    public ConstructionTask Task { get; set; } = null!;
}
