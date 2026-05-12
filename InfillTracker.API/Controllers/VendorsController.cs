using InfillTracker.API.DTOs;
using InfillTracker.Core.Models;
using InfillTracker.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace InfillTracker.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VendorsController : ControllerBase
{
    private readonly IRepository<Vendor> _vendors;

    public VendorsController(IRepository<Vendor> vendors) => _vendors = vendors;

    // GET api/vendors  — used to populate drop-down lists in the UI
    [HttpGet]
    public async Task<ActionResult<IEnumerable<VendorDto>>> GetAll()
    {
        var vendors = await _vendors.GetAllAsync();
        return Ok(vendors.Select(v => new VendorDto(v.Id, v.Name, v.ContactInfo, v.PhoneNumber, v.Email)));
    }

    // GET api/vendors/5
    [HttpGet("{id}")]
    public async Task<ActionResult<VendorDto>> GetById(int id)
    {
        var v = await _vendors.GetByIdAsync(id);
        return v is null ? NotFound() : Ok(new VendorDto(v.Id, v.Name, v.ContactInfo, v.PhoneNumber, v.Email));
    }

    // POST api/vendors
    [HttpPost]
    public async Task<ActionResult<VendorDto>> Create([FromBody] CreateVendorDto dto)
    {
        var vendor = new Vendor
        {
            Name        = dto.Name,
            ContactInfo = dto.ContactInfo,
            PhoneNumber = dto.PhoneNumber,
            Email       = dto.Email
        };

        await _vendors.AddAsync(vendor);

        var result = new VendorDto(vendor.Id, vendor.Name, vendor.ContactInfo, vendor.PhoneNumber, vendor.Email);
        return CreatedAtAction(nameof(GetById), new { id = vendor.Id }, result);
    }

    // PUT api/vendors/5
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateVendorDto dto)
    {
        var vendor = await _vendors.GetByIdAsync(id);
        if (vendor is null) return NotFound();

        vendor.Name        = dto.Name;
        vendor.ContactInfo = dto.ContactInfo;
        vendor.PhoneNumber = dto.PhoneNumber;
        vendor.Email       = dto.Email;

        await _vendors.UpdateAsync(vendor);
        return NoContent();
    }

    // DELETE api/vendors/5
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var vendor = await _vendors.GetByIdAsync(id);
        if (vendor is null) return NotFound();

        await _vendors.DeleteAsync(id);
        return NoContent();
    }
}
