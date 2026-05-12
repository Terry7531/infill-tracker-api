using InfillTracker.Core.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace InfillTracker.Infrastructure.Data;

/// <summary>
/// Seeds the two application roles (User, Administrator) and the initial
/// Administrator account configured in appsettings.json on first run.
/// </summary>
public static class IdentitySeeder
{
    public const string RoleUser          = "User";
    public const string RoleAdministrator = "Administrator";

    public static async Task SeedAsync(
        UserManager<ApplicationUser>  userManager,
        RoleManager<IdentityRole>     roleManager,
        IConfiguration                config,
        ILogger                       logger)
    {
        // ── Seed roles ────────────────────────────────────────────────────────
        foreach (var role in new[] { RoleUser, RoleAdministrator })
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
                logger.LogInformation("Created role: {Role}", role);
            }
        }

        // ── Seed initial admin account ────────────────────────────────────────
        var adminEmail    = config["AdminSeed:Email"];
        var adminPassword = config["AdminSeed:Password"];
        var adminName     = config["AdminSeed:FullName"] ?? "Administrator";

        if (string.IsNullOrWhiteSpace(adminEmail) ||
            string.IsNullOrWhiteSpace(adminPassword) ||
            adminEmail == "admin@yourdomain.com")
        {
            logger.LogWarning(
                "AdminSeed:Email or AdminSeed:Password not configured in appsettings.json. " +
                "Initial administrator account was NOT created. " +
                "Set these values and restart the application.");
            return;
        }

        var existing = await userManager.FindByEmailAsync(adminEmail);
        if (existing is not null)
        {
            logger.LogInformation(
                "Admin account {Email} already exists — skipping seed.", adminEmail);
            return;
        }

        var admin = new ApplicationUser
        {
            UserName            = adminEmail,
            Email               = adminEmail,
            EmailConfirmed      = true,
            FullName            = adminName,
            MustChangePassword  = true,   // forced password change on first login
            CreatedAt           = DateTime.UtcNow,
        };

        var result = await userManager.CreateAsync(admin, adminPassword);
        if (!result.Succeeded)
        {
            var errors = string.Join(", ", result.Errors.Select(e => e.Description));
            logger.LogError(
                "Failed to create admin account {Email}: {Errors}", adminEmail, errors);
            return;
        }

        await userManager.AddToRoleAsync(admin, RoleAdministrator);
        logger.LogInformation(
            "Initial administrator account created: {Email} " +
            "(MustChangePassword = true)", adminEmail);
    }
}
