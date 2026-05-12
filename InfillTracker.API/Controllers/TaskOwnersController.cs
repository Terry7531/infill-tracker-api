using InfillTracker.API.DTOs;
using InfillTracker.Core.Models;
using InfillTracker.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace InfillTracker.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TaskOwnersController : ControllerBase
{
    private readonly IRepository<TaskOwner> _owners;

    public TaskOwnersController(IRepository<TaskOwner> owners) => _owners = owners;

    // GET api/taskowners  — used to populate drop-down lists in the UI
    [HttpGet]
    public async Task<ActionResult<IEnumerable<TaskOwnerDto>>> GetAll()
    {
        var owners = await _owners.GetAllAsync();
        return Ok(owners.Select(o => new TaskOwnerDto(o.Id, o.Name, o.PhoneNumber, o.Email)));
    }

    // GET api/taskowners/5
    [HttpGet("{id}")]
    public async Task<ActionResult<TaskOwnerDto>> GetById(int id)
    {
        var o = await _owners.GetByIdAsync(id);
        return o is null ? NotFound() : Ok(new TaskOwnerDto(o.Id, o.Name, o.PhoneNumber, o.Email));
    }

    // POST api/taskowners
    [HttpPost]
    public async Task<ActionResult<TaskOwnerDto>> Create([FromBody] CreateTaskOwnerDto dto)
    {
        var owner = new TaskOwner
        {
            Name        = dto.Name,
            PhoneNumber = dto.PhoneNumber,
            Email       = dto.Email
        };

        await _owners.AddAsync(owner);

        var result = new TaskOwnerDto(owner.Id, owner.Name, owner.PhoneNumber, owner.Email);
        return CreatedAtAction(nameof(GetById), new { id = owner.Id }, result);
    }

    // PUT api/taskowners/5
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateTaskOwnerDto dto)
    {
        var owner = await _owners.GetByIdAsync(id);
        if (owner is null) return NotFound();

        owner.Name        = dto.Name;
        owner.PhoneNumber = dto.PhoneNumber;
        owner.Email       = dto.Email;

        await _owners.UpdateAsync(owner);
        return NoContent();
    }

    // DELETE api/taskowners/5
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var owner = await _owners.GetByIdAsync(id);
        if (owner is null) return NotFound();

        await _owners.DeleteAsync(id);
        return NoContent();
    }
}
