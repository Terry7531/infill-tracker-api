namespace InfillTracker.API.DTOs;

// ── Read ──────────────────────────────────────────────────────────
public record VendorDto(
    int Id,
    string Name,
    string? ContactInfo,
    string? PhoneNumber,
    string? Email
);

// ── Create ────────────────────────────────────────────────────────
public record CreateVendorDto(
    string Name,
    string? ContactInfo,
    string? PhoneNumber,
    string? Email
);

// ── Update ────────────────────────────────────────────────────────
public record UpdateVendorDto(
    string Name,
    string? ContactInfo,
    string? PhoneNumber,
    string? Email
);
