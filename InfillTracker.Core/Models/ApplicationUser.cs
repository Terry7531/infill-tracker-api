using Microsoft.AspNetCore.Identity;

namespace InfillTracker.Core.Models;

/// <summary>
/// Extends ASP.NET Core Identity's IdentityUser with app-specific fields.
/// </summary>
public class ApplicationUser : IdentityUser
{
    /// <summary>Full display name shown in the NavBar.</summary>
    public string FullName { get; set; } = string.Empty;

    /// <summary>
    /// Forces the user to change their password on next login.
    /// Set to true for all newly created accounts.
    /// </summary>
    public bool MustChangePassword { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
