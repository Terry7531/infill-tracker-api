namespace InfillTracker.API.DTOs;

// ── Read ──────────────────────────────────────────────────────────
public record TaskOwnerDto(
    int Id,
    string Name,
    string? PhoneNumber,
    string? Email
);

// ── Create ────────────────────────────────────────────────────────
public record CreateTaskOwnerDto(
    string Name,
    string? PhoneNumber,
    string? Email
);

// ── Update ────────────────────────────────────────────────────────
public record UpdateTaskOwnerDto(
    string Name,
    string? PhoneNumber,
    string? Email
);
