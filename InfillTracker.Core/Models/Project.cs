namespace InfillTracker.Core.Models;

public class Project
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Address { get; set; }

    // Navigation
    public ICollection<ConstructionTask> Tasks { get; set; } = new List<ConstructionTask>();
}
