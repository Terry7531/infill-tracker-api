using InfillTracker.API.DTOs;
using InfillTracker.Core.Models;
using InfillTracker.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace InfillTracker.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TasksController : ControllerBase
{
    private readonly ITaskRepository _tasks;

    public TasksController(ITaskRepository tasks) => _tasks = tasks;

    // GET api/tasks/project/5
    [HttpGet("project/{projectId}")]
    public async Task<ActionResult<IEnumerable<TaskSummaryDto>>> GetByProject(int projectId)
    {
        var tasks = await _tasks.GetByProjectIdAsync(projectId);

        var dtos = tasks.Select(t => new TaskSummaryDto(
            t.Id,
            t.ProjectId,
            t.ProjectStage,
            t.ExcelCode,
            t.TaskName,
            t.IsCompleted,
            t.TaskOwner?.Name,
            t.Vendor?.Name,
            t.OwnerStartDate,
            t.FinishDate,
            t.TypicalTimelineDays,
            t.Dependencies.Count,
            t.Dependents.Count));

        return Ok(dtos);
    }

    // GET api/tasks/5
    [HttpGet("{id}")]
    public async Task<ActionResult<TaskDetailDto>> GetById(int id)
    {
        var t = await _tasks.GetWithDependenciesAsync(id);
        if (t is null) return NotFound();

        return Ok(new TaskDetailDto(
            t.Id,
            t.ProjectId,
            t.ProjectStage,
            t.TaskName,
            t.ToDoList,
            t.IsCompleted,
            t.TaskOwnerId,
            t.TaskOwner?.Name,
            t.VendorId,
            t.Vendor?.Name,
            t.TypicalTimelineDays,
            t.OwnerStartDate,
            t.FinishDate,
            t.TotalActualDays,
            t.Cost,
            t.InvoiceNumber,
            t.PaymentMethod,
            t.StorageLocation,
            t.TemplateDocument,
            t.Dependencies.Select(d => new TaskRefDto(d.DependsOnTaskId, d.DependsOnTask.TaskName, d.DependsOnTask.IsCompleted)),
            t.Dependents.Select(d => new TaskRefDto(d.TaskId, d.Task.TaskName, d.Task.IsCompleted))
        ));
    }

    // POST api/tasks
    [HttpPost]
    public async Task<ActionResult<TaskSummaryDto>> Create([FromBody] CreateTaskDto dto)
    {
        var task = new ConstructionTask
        {
            ProjectId           = dto.ProjectId,
            ProjectStage        = dto.ProjectStage,
            TaskName            = dto.TaskName,
            ToDoList            = dto.ToDoList,
            IsCompleted         = dto.IsCompleted,
            TaskOwnerId         = dto.TaskOwnerId,
            VendorId            = dto.VendorId,
            TypicalTimelineDays = dto.TypicalTimelineDays,
            OwnerStartDate      = dto.OwnerStartDate,
            FinishDate          = dto.FinishDate,
            TotalActualDays     = dto.TotalActualDays,
            Cost                = dto.Cost,
            InvoiceNumber       = dto.InvoiceNumber,
            PaymentMethod       = dto.PaymentMethod,
            StorageLocation     = dto.StorageLocation,
            TemplateDocument    = dto.TemplateDocument,
        };

        await _tasks.AddAsync(task);

        return CreatedAtAction(nameof(GetById), new { id = task.Id },
            new TaskSummaryDto(task.Id, task.ProjectId, task.ProjectStage, task.ExcelCode, task.TaskName,
                               task.IsCompleted, null, null, task.OwnerStartDate, task.FinishDate,
                               task.TypicalTimelineDays, 0, 0));
    }

    // PUT api/tasks/5
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateTaskDto dto)
    {
        var task = await _tasks.GetByIdAsync(id);
        if (task is null) return NotFound();

        task.ProjectStage        = dto.ProjectStage;
        task.TaskName            = dto.TaskName;
        task.ToDoList            = dto.ToDoList;
        task.IsCompleted         = dto.IsCompleted;
        task.TaskOwnerId         = dto.TaskOwnerId;
        task.VendorId            = dto.VendorId;
        task.TypicalTimelineDays = dto.TypicalTimelineDays;
        task.OwnerStartDate      = dto.OwnerStartDate;
        task.FinishDate          = dto.FinishDate;
        task.TotalActualDays     = dto.TotalActualDays;
        task.Cost                = dto.Cost;
        task.InvoiceNumber       = dto.InvoiceNumber;
        task.PaymentMethod       = dto.PaymentMethod;
        task.StorageLocation     = dto.StorageLocation;
        task.TemplateDocument    = dto.TemplateDocument;

        await _tasks.UpdateAsync(task);
        return NoContent();
    }

    // PATCH api/tasks/5/start
    /// <summary>
    /// Marks the task as started by setting OwnerStartDate = today.
    /// </summary>
    [HttpPatch("{id}/start")]
    public async Task<IActionResult> Start(int id)
    {
        var task = await _tasks.GetByIdAsync(id);
        if (task is null) return NotFound();

        task.OwnerStartDate = DateOnly.FromDateTime(DateTime.Now);
        await _tasks.UpdateAsync(task);
        return NoContent();
    }

    // PATCH api/tasks/5/undo-start
    /// <summary>
    /// Undoes Start: clears OwnerStartDate, FinishDate, and IsCompleted.
    /// A task cannot be complete if it was never started.
    /// </summary>
    [HttpPatch("{id}/undo-start")]
    public async Task<IActionResult> UndoStart(int id)
    {
        var task = await _tasks.GetByIdAsync(id);
        if (task is null) return NotFound();

        task.OwnerStartDate = null;
        task.FinishDate     = null;
        task.IsCompleted    = false;
        await _tasks.UpdateAsync(task);
        return NoContent();
    }

    // PATCH api/tasks/5/complete
    /// <summary>
    /// Marks the task complete. Smart logic: if OwnerStartDate is null the
    /// task is auto-started (set to today) so the task is never in an
    /// inconsistent completed-but-not-started state.
    /// </summary>
    [HttpPatch("{id}/complete")]
    public async Task<IActionResult> MarkComplete(int id)
    {
        var task = await _tasks.GetByIdAsync(id);
        if (task is null) return NotFound();

        var today = DateOnly.FromDateTime(DateTime.Now);

        if (task.OwnerStartDate is null)
            task.OwnerStartDate = today;

        task.IsCompleted = true;
        task.FinishDate  = today;
        await _tasks.UpdateAsync(task);
        return NoContent();
    }

    // PATCH api/tasks/5/undo-complete
    /// <summary>
    /// Undoes Complete: clears IsCompleted and FinishDate, leaving
    /// OwnerStartDate intact so the task remains in "started" state.
    /// </summary>
    [HttpPatch("{id}/undo-complete")]
    public async Task<IActionResult> UndoComplete(int id)
    {
        var task = await _tasks.GetByIdAsync(id);
        if (task is null) return NotFound();

        task.IsCompleted = false;
        task.FinishDate  = null;
        await _tasks.UpdateAsync(task);
        return NoContent();
    }

    // DELETE api/tasks/5
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var task = await _tasks.GetByIdAsync(id);
        if (task is null) return NotFound();

        await _tasks.DeleteAsync(id);
        return NoContent();
    }


    // GET api/tasks/project/5/unblocked
    /// <summary>
    /// Returns all incomplete tasks for a project whose every dependency is
    /// already completed — i.e. the tasks that are ready to be worked on now.
    /// Ordered by TypicalTimelineDays ascending (shortest first).
    /// </summary>
    [HttpGet("project/{projectId}/unblocked")]
    public async Task<ActionResult<IEnumerable<TaskSummaryDto>>> GetUnblocked(int projectId)
    {
        var tasks = await _tasks.GetByProjectIdAsync(projectId);

        var unblocked = tasks
            .Where(t =>
                !t.IsCompleted &&
                t.Dependencies.All(d => d.DependsOnTask.IsCompleted))
            .OrderBy(t => t.TypicalTimelineDays ?? int.MaxValue)
            .Select(t => new TaskSummaryDto(
                t.Id,
                t.ProjectId,
                t.ProjectStage,
                t.ExcelCode,
                t.TaskName,
                t.IsCompleted,
                t.TaskOwner?.Name,
                t.Vendor?.Name,
                t.OwnerStartDate,
                t.FinishDate,
                t.TypicalTimelineDays,
                t.Dependencies.Count,
                t.Dependents.Count))
            .ToList();

        return Ok(unblocked);
    }

    // ── Dependency endpoints ──────────────────────────────────────────────────

    // GET api/tasks/5/dependencies
    [HttpGet("{id}/dependencies")]
    public async Task<ActionResult<IEnumerable<TaskRefDto>>> GetDependencies(int id)
    {
        var deps = await _tasks.GetDependenciesAsync(id);
        return Ok(deps.Select(t => new TaskRefDto(t.Id, t.TaskName, t.IsCompleted)));
    }

    // GET api/tasks/5/dependents
    [HttpGet("{id}/dependents")]
    public async Task<ActionResult<IEnumerable<TaskRefDto>>> GetDependents(int id)
    {
        var dependents = await _tasks.GetDependentsAsync(id);
        return Ok(dependents.Select(t => new TaskRefDto(t.Id, t.TaskName, t.IsCompleted)));
    }

    // POST api/tasks/5/dependencies
    [HttpPost("{id}/dependencies")]
    public async Task<IActionResult> AddDependency(int id, [FromBody] TaskDependencyDto dto)
    {
        await _tasks.AddDependencyAsync(id, dto.DependsOnTaskId);
        return NoContent();
    }

    // DELETE api/tasks/5/dependencies/3
    [HttpDelete("{id}/dependencies/{dependsOnTaskId}")]
    public async Task<IActionResult> RemoveDependency(int id, int dependsOnTaskId)
    {
        await _tasks.RemoveDependencyAsync(id, dependsOnTaskId);
        return NoContent();
    }
}
