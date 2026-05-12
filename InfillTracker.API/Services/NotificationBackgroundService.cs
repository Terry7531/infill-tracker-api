using InfillTracker.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace InfillTracker.API.Services;

/// <summary>
/// Hosted background service that fires the NotificationService once per day
/// at the configured time (default 07:00 local time).
///
/// Configure the run time in appsettings.json:
///   "Notifications": { "DailyRunTime": "07:00" }
/// </summary>
public class NotificationBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration       _config;
    private readonly ILogger<NotificationBackgroundService> _logger;

    public NotificationBackgroundService(
        IServiceScopeFactory scopeFactory,
        IConfiguration config,
        ILogger<NotificationBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _config       = config;
        _logger       = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Notification background service started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            var delay = TimeUntilNextRun();
            _logger.LogInformation(
                "Next notification run scheduled in {Hours}h {Minutes}m.",
                (int)delay.TotalHours, delay.Minutes);

            await Task.Delay(delay, stoppingToken);

            if (stoppingToken.IsCancellationRequested) break;

            await RunNotificationsAsync(stoppingToken);
        }
    }

    private async Task RunNotificationsAsync(CancellationToken ct)
    {
        try
        {
            // NotificationService depends on AppDbContext which is scoped,
            // so we must create a new scope for each background execution.
            using var scope   = _scopeFactory.CreateScope();
            var service = scope.ServiceProvider
                               .GetRequiredService<NotificationService>();

            var result = await service.RunAsync(ct);

            _logger.LogInformation(
                "Scheduled notification run complete — " +
                "{Unblocked} unblocked + {Overdue} overdue = {Total} emails sent.",
                result.UnblockedEmailsSent,
                result.OverdueEmailsSent,
                result.TotalEmailsSent);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            // Log and continue — don't let one failed run crash the service
            _logger.LogError(ex, "Error during scheduled notification run.");
        }
    }

    /// <summary>
    /// Calculates how long to wait until the next configured run time.
    /// Defaults to 07:00 if not configured.
    /// </summary>
    private TimeSpan TimeUntilNextRun()
    {
        var timeStr = _config["Notifications:DailyRunTime"] ?? "07:00";

        if (!TimeSpan.TryParse(timeStr, out var runTime))
            runTime = new TimeSpan(7, 0, 0);

        var now  = DateTime.Now;
        var next = DateTime.Today.Add(runTime);

        // If today's run time has already passed, schedule for tomorrow
        if (next <= now)
            next = next.AddDays(1);

        return next - now;
    }
}
