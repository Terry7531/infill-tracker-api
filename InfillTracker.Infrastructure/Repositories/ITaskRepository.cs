using InfillTracker.Core.Models;

namespace InfillTracker.Infrastructure.Repositories;

public interface ITaskRepository : IRepository<ConstructionTask>
{
    /// <summary>Returns all tasks for a given project, including owner and vendor.</summary>
    Task<IEnumerable<ConstructionTask>> GetByProjectIdAsync(int projectId);

    /// <summary>Returns a single task with its full dependency graph loaded.</summary>
    Task<ConstructionTask?> GetWithDependenciesAsync(int taskId);

    /// <summary>Adds a dependency: <paramref name="taskId"/> will not start until <paramref name="dependsOnTaskId"/> is complete.</summary>
    Task AddDependencyAsync(int taskId, int dependsOnTaskId);

    /// <summary>Removes a previously recorded dependency between two tasks.</summary>
    Task RemoveDependencyAsync(int taskId, int dependsOnTaskId);

    /// <summary>Returns all tasks that are blocking the given task.</summary>
    Task<IEnumerable<ConstructionTask>> GetDependenciesAsync(int taskId);

    /// <summary>Returns all tasks that are waiting for the given task to complete.</summary>
    Task<IEnumerable<ConstructionTask>> GetDependentsAsync(int taskId);
}
