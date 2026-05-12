using InfillTracker.Core.Models;
using InfillTracker.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace InfillTracker.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = IdentitySeeder.RoleAdministrator)]
public class AdminController : ControllerBase
{
    private readonly UserManager<ApplicationUser>  _userManager;
    private readonly RoleManager<IdentityRole>     _roleManager;

    public AdminController(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole>    roleManager)
    {
        _userManager = userManager;
        _roleManager = roleManager;
    }

    // GET api/admin/users
    [HttpGet("users")]
    public async Task<ActionResult<IEnumerable<UserSummaryDto>>> GetUsers()
    {
        var users = _userManager.Users
            .OrderBy(u => u.FullName)
            .ToList();

        var result = new List<UserSummaryDto>();
        foreach (var u in users)
        {
            var roles = await _userManager.GetRolesAsync(u);
            result.Add(new UserSummaryDto(
                u.Id,
                u.FullName,
                u.Email!,
                roles.FirstOrDefault() ?? IdentitySeeder.RoleUser,
                u.MustChangePassword,
                u.CreatedAt,
                u.LockoutEnd.HasValue && u.LockoutEnd > DateTimeOffset.UtcNow));
        }

        return Ok(result);
    }

    // POST api/admin/users
    [HttpPost("users")]
    public async Task<ActionResult<UserSummaryDto>> CreateUser(
        [FromBody] CreateUserDto dto)
    {
        // Validate role
        if (dto.Role != IdentitySeeder.RoleUser &&
            dto.Role != IdentitySeeder.RoleAdministrator)
            return BadRequest(new { errors = new[] { "Role must be 'User' or 'Administrator'." } });

        var user = new ApplicationUser
        {
            UserName           = dto.Email.Trim(),
            Email              = dto.Email.Trim(),
            EmailConfirmed     = true,
            FullName           = dto.FullName.Trim(),
            MustChangePassword = true,   // always force change on first login
            CreatedAt          = DateTime.UtcNow,
        };

        var result = await _userManager.CreateAsync(user, dto.InitialPassword);
        if (!result.Succeeded)
        {
            var errors = result.Errors.Select(e => e.Description).ToList();
            return BadRequest(new { errors });
        }

        await _userManager.AddToRoleAsync(user, dto.Role);

        return CreatedAtAction(nameof(GetUsers), new UserSummaryDto(
            user.Id,
            user.FullName,
            user.Email!,
            dto.Role,
            true,
            user.CreatedAt,
            false));
    }

    // POST api/admin/users/{id}/reset-password
    [HttpPost("users/{id}/reset-password")]
    public async Task<IActionResult> ResetPassword(
        string id, [FromBody] ResetPasswordDto dto)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user is null) return NotFound();

        // Remove existing password and set new one
        var token  = await _userManager.GeneratePasswordResetTokenAsync(user);
        var result = await _userManager.ResetPasswordAsync(user, token, dto.NewPassword);

        if (!result.Succeeded)
        {
            var errors = result.Errors.Select(e => e.Description).ToList();
            return BadRequest(new { errors });
        }

        // Force change on next login
        user.MustChangePassword = true;
        await _userManager.UpdateAsync(user);

        return NoContent();
    }

    // DELETE api/admin/users/{id}
    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(string id)
    {
        // Prevent deleting yourself
        var requesterId = User.FindFirst(
            System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (id == requesterId)
            return BadRequest(new { errors = new[] { "You cannot delete your own account." } });

        var user = await _userManager.FindByIdAsync(id);
        if (user is null) return NotFound();

        await _userManager.DeleteAsync(user);
        return NoContent();
    }
}

// ── DTOs ──────────────────────────────────────────────────────────────────────
public record UserSummaryDto(
    string   Id,
    string   FullName,
    string   Email,
    string   Role,
    bool     MustChangePassword,
    DateTime CreatedAt,
    bool     IsLockedOut);

public record CreateUserDto(
    string FullName,
    string Email,
    string InitialPassword,
    string Role);

public record ResetPasswordDto(string NewPassword);
