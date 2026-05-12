namespace InfillTracker.Core.Models;

public class TaskOwner
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? PhoneNumber { get; set; }

    public string? Email { get; set; }

    // Navigation
    public ICollection<ConstructionTask> Tasks { get; set; } = new List<ConstructionTask>();
}
