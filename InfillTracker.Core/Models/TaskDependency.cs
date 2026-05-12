namespace InfillTracker.Core.Models;

/// <summary>
/// Self-referencing many-to-many join table.
/// A row (TaskId=5, DependsOnTaskId=3) means Task 5 cannot start until Task 3 is complete.
/// </summary>
public class TaskDependency
{
    /// <summary>The task that has the dependency (the "downstream" / blocked task).</summary>
    public int TaskId { get; set; }

    /// <summary>The task that must be completed first (the "upstream" / blocking task).</summary>
    public int DependsOnTaskId { get; set; }

    // Navigation
    public ConstructionTask Task { get; set; } = null!;

    public ConstructionTask DependsOnTask { get; set; } = null!;
}
