namespace InfillTracker.API.DTOs;

// ── Read ──────────────────────────────────────────────────────────
public record ProjectDto(
    int Id,
    string Name,
    string? Address,
    int TaskCount
);

// ── Create ────────────────────────────────────────────────────────
public record CreateProjectDto(
    string Name,
    string? Address
);

// ── Update ────────────────────────────────────────────────────────
public record UpdateProjectDto(
    string Name,
    string? Address
);
