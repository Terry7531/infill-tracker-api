using InfillTracker.Core.Models;
using InfillTracker.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace InfillTracker.Infrastructure.Repositories;

public class TaskRepository : Repository<ConstructionTask>, ITaskRepository
{
    public TaskRepository(AppDbContext context) : base(context) { }

    public async Task<IEnumerable<ConstructionTask>> GetByProjectIdAsync(int projectId)
        => await _context.Tasks
            .Where(t => t.ProjectId == projectId)
            .Include(t => t.TaskOwner)
            .Include(t => t.Vendor)
            .Include(t => t.Dependencies)
                .ThenInclude(d => d.DependsOnTask)
            .Include(t => t.Dependents)
            .OrderBy(t => t.ProjectStage)
            .ThenBy(t => t.Id)
            .ToListAsync();

    public async Task<ConstructionTask?> GetWithDependenciesAsync(int taskId)
        => await _context.Tasks
            .Where(t => t.Id == taskId)
            .Include(t => t.TaskOwner)
            .Include(t => t.Vendor)
            .Include(t => t.Dependencies)
                .ThenInclude(d => d.DependsOnTask)
            .Include(t => t.Dependents)
                .ThenInclude(d => d.Task)
            .FirstOrDefaultAsync();

    public async Task AddDependencyAsync(int taskId, int dependsOnTaskId)
    {
        var exists = await _context.TaskDependencies
            .AnyAsync(d => d.TaskId == taskId && d.DependsOnTaskId == dependsOnTaskId);

        if (!exists)
        {
            _context.TaskDependencies.Add(new TaskDependency
            {
                TaskId = taskId,
                DependsOnTaskId = dependsOnTaskId
            });
            await _context.SaveChangesAsync();
        }
    }

    public async Task RemoveDependencyAsync(int taskId, int dependsOnTaskId)
    {
        var dep = await _context.TaskDependencies
            .FirstOrDefaultAsync(d => d.TaskId == taskId && d.DependsOnTaskId == dependsOnTaskId);

        if (dep is not null)
        {
            _context.TaskDependencies.Remove(dep);
            await _context.SaveChangesAsync();
        }
    }

    public async Task<IEnumerable<ConstructionTask>> GetDependenciesAsync(int taskId)
        => await _context.TaskDependencies
            .Where(d => d.TaskId == taskId)
            .Select(d => d.DependsOnTask)
            .ToListAsync();

    public async Task<IEnumerable<ConstructionTask>> GetDependentsAsync(int taskId)
        => await _context.TaskDependencies
            .Where(d => d.DependsOnTaskId == taskId)
            .Select(d => d.Task)
            .ToListAsync();
}
