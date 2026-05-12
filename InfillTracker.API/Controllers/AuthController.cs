using InfillTracker.Core.Models;
using InfillTracker.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace InfillTracker.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IConfiguration _config;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        IConfiguration config)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _config = config;
    }

    // POST api/auth/signin
    [HttpPost("signin")]
    [AllowAnonymous]
    public async Task<ActionResult<SignInResponseDto>> SignIn(
        [FromBody] SignInRequestDto dto)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email);
        if (user is null)
            return Unauthorized(new { message = "Invalid email or password." });

        var result = await _signInManager.CheckPasswordSignInAsync(
            user, dto.Password, lockoutOnFailure: true);

        if (result.IsLockedOut)
            return Unauthorized(new { message = "Account locked. Try again later." });

        if (!result.Succeeded)
            return Unauthorized(new { message = "Invalid email or password." });

        var roles = await _userManager.GetRolesAsync(user);
        var token = GenerateJwt(user, roles);

        // Set JWT in HttpOnly cookie — JS cannot read this, protects against XSS
        Response.Cookies.Append("infilltracker_auth", token, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,          // HTTPS only
            SameSite = SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddHours(
                double.Parse(_config["Jwt:ExpiryHours"] ?? "8"))
        });

        return Ok(new SignInResponseDto(
            user.Id,
            user.FullName,
            user.Email!,
            roles.FirstOrDefault() ?? IdentitySeeder.RoleUser,
            user.MustChangePassword));
    }

    // POST api/auth/signout
    [HttpPost("signout")]
    [Authorize]
    public IActionResult SignOutUser()
    {
        Response.Cookies.Delete("infilltracker_auth");
        return NoContent();
    }

    // GET api/auth/me  — called on app load to restore session
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<SignInResponseDto>> Me()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await _userManager.FindByIdAsync(userId!);
        if (user is null) return Unauthorized();

        var roles = await _userManager.GetRolesAsync(user);

        return Ok(new SignInResponseDto(
            user.Id,
            user.FullName,
            user.Email!,
            roles.FirstOrDefault() ?? IdentitySeeder.RoleUser,
            user.MustChangePassword));
    }

    // POST api/auth/change-password
    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword(
        [FromBody] ChangePasswordDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await _userManager.FindByIdAsync(userId!);
        if (user is null) return Unauthorized();

        var result = await _userManager.ChangePasswordAsync(
            user, dto.CurrentPassword, dto.NewPassword);

        if (!result.Succeeded)
        {
            var errors = result.Errors.Select(e => e.Description).ToList();
            return BadRequest(new { errors });
        }

        // Clear the forced-change flag
        user.MustChangePassword = false;
        await _userManager.UpdateAsync(user);

        return NoContent();
    }

    // ── JWT generation ────────────────────────────────────────────────────────
    private string GenerateJwt(ApplicationUser user, IList<string> roles)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiry = DateTime.UtcNow.AddHours(
            double.Parse(_config["Jwt:ExpiryHours"] ?? "8"));

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Email,          user.Email!),
            new(ClaimTypes.Name,           user.FullName),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        foreach (var role in roles)
            claims.Add(new Claim(ClaimTypes.Role, role));

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: expiry,
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

// ── DTOs ──────────────────────────────────────────────────────────────────────
public record SignInRequestDto(string Email, string Password);

public record SignInResponseDto(
    string Id,
    string FullName,
    string Email,
    string Role,
    bool MustChangePassword);

public record ChangePasswordDto(string CurrentPassword, string NewPassword);