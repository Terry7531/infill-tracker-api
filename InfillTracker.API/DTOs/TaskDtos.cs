namespace InfillTracker.API.DTOs;

// ── Read (summary — used in list views) ──────────────────────────
public record TaskSummaryDto(
    int Id,
    int ProjectId,
    string? ProjectStage,
    string? ExcelCode,
    string TaskName,
    bool IsCompleted,
    string? TaskOwnerName,
    string? VendorName,
    DateOnly? OwnerStartDate,
    DateOnly? FinishDate,
    int? TypicalTimelineDays,
    int DependencyCount,
    int DependentCount
);

// ── Read (detail — used for single task view with full dependency info) ──
public record TaskDetailDto(
    int Id,
    int ProjectId,
    string? ProjectStage,
    string TaskName,
    string? ToDoList,
    bool IsCompleted,
    int? TaskOwnerId,
    string? TaskOwnerName,
    int? VendorId,
    string? VendorName,
    int? TypicalTimelineDays,
    DateOnly? OwnerStartDate,
    DateOnly? FinishDate,
    int? TotalActualDays,
    decimal? Cost,
    string? InvoiceNumber,
    string? PaymentMethod,
    string? StorageLocation,
    string? TemplateDocument,
    IEnumerable<TaskRefDto> Dependencies,   // tasks blocking this one
    IEnumerable<TaskRefDto> Dependents      // tasks waiting on this one
);

// ── Lightweight reference used inside TaskDetailDto ───────────────
public record TaskRefDto(
    int Id,
    string TaskName,
    bool IsCompleted
);

// ── Create ────────────────────────────────────────────────────────
public record CreateTaskDto(
    int ProjectId,
    string? ProjectStage,
    string TaskName,
    string? ToDoList,
    bool IsCompleted,
    int? TaskOwnerId,
    int? VendorId,
    int? TypicalTimelineDays,
    DateOnly? OwnerStartDate,
    DateOnly? FinishDate,
    int? TotalActualDays,
    decimal? Cost,
    string? InvoiceNumber,
    string? PaymentMethod,
    string? StorageLocation,
    string? TemplateDocument
);

// ── Update ────────────────────────────────────────────────────────
public record UpdateTaskDto(
    string? ProjectStage,
    string TaskName,
    string? ToDoList,
    bool IsCompleted,
    int? TaskOwnerId,
    int? VendorId,
    int? TypicalTimelineDays,
    DateOnly? OwnerStartDate,
    DateOnly? FinishDate,
    int? TotalActualDays,
    decimal? Cost,
    string? InvoiceNumber,
    string? PaymentMethod,
    string? StorageLocation,
    string? TemplateDocument
);

// ── Add / Remove dependency ───────────────────────────────────────
public record TaskDependencyDto(
    int DependsOnTaskId
);
