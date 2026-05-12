using InfillTracker.API.DTOs;
using InfillTracker.Core.Models;
using InfillTracker.Infrastructure.Data;
using InfillTracker.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InfillTracker.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProjectsController : ControllerBase
{
    private readonly IRepository<Project> _projects;
    private readonly AppDbContext _db;
    private readonly ProjectTaskSeeder _seeder;

    public ProjectsController(
        IRepository<Project> projects,
        AppDbContext db,
        ProjectTaskSeeder seeder)
    {
        _projects = projects;
        _db       = db;
        _seeder   = seeder;
    }

    // GET api/projects
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ProjectDto>>> GetAll()
    {
        var projects = await _db.Projects
            .Select(p => new ProjectDto(
                p.Id,
                p.Name,
                p.Address,
                p.Tasks.Count))
            .ToListAsync();

        return Ok(projects);
    }

    // GET api/projects/5
    [HttpGet("{id}")]
    public async Task<ActionResult<ProjectDto>> GetById(int id)
    {
        var p = await _db.Projects
            .Where(p => p.Id == id)
            .Select(p => new ProjectDto(p.Id, p.Name, p.Address, p.Tasks.Count))
            .FirstOrDefaultAsync();

        return p is null ? NotFound() : Ok(p);
    }

    // POST api/projects
    /// <summary>
    /// Creates a new project and immediately seeds the standard infill
    /// construction tasks (with dependencies) from Infill_Tasks.xlsx.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ProjectDto>> Create([FromBody] CreateProjectDto dto)
    {
        var project = new Project
        {
            Name    = dto.Name,
            Address = dto.Address
        };

        await _projects.AddAsync(project);

        // Reads Infill_Tasks.xlsx at runtime — no hardcoded tasks in C#.
        // Throws if the spreadsheet has missing columns or bad dependency codes.
        await _seeder.SeedTasksForProjectAsync(project.Id);

        var taskCount = await _db.Tasks.CountAsync(t => t.ProjectId == project.Id);
        var result    = new ProjectDto(project.Id, project.Name, project.Address, taskCount);

        return CreatedAtAction(nameof(GetById), new { id = project.Id }, result);
    }

    // PUT api/projects/5
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateProjectDto dto)
    {
        var project = await _projects.GetByIdAsync(id);
        if (project is null) return NotFound();

        project.Name    = dto.Name;
        project.Address = dto.Address;

        await _projects.UpdateAsync(project);
        return NoContent();
    }

    // DELETE api/projects/5
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var project = await _projects.GetByIdAsync(id);
        if (project is null) return NotFound();

        await _projects.DeleteAsync(id);
        return NoContent();
    }
}
