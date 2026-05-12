using InfillTracker.Core.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace InfillTracker.Infrastructure.Data;

public class AppDbContext : IdentityDbContext<ApplicationUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // ── DbSets ────────────────────────────────────────────────────
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ConstructionTask> Tasks => Set<ConstructionTask>();
    public DbSet<TaskDependency> TaskDependencies => Set<TaskDependency>();
    public DbSet<TaskOwner> TaskOwners => Set<TaskOwner>();
    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<NotificationLog> NotificationLogs => Set<NotificationLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ── Project ───────────────────────────────────────────────
        modelBuilder.Entity<Project>(entity =>
        {
            entity.ToTable("Projects");
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Name).IsRequired().HasMaxLength(200);
            entity.Property(p => p.Address).HasMaxLength(400);
        });

        // ── TaskOwner ─────────────────────────────────────────────
        modelBuilder.Entity<TaskOwner>(entity =>
        {
            entity.ToTable("TaskOwners");
            entity.HasKey(o => o.Id);
            entity.Property(o => o.Name).IsRequired().HasMaxLength(150);
            entity.Property(o => o.PhoneNumber).HasMaxLength(30);
            entity.Property(o => o.Email).HasMaxLength(200);
        });

        // ── Vendor ────────────────────────────────────────────────
        modelBuilder.Entity<Vendor>(entity =>
        {
            entity.ToTable("Vendors");
            entity.HasKey(v => v.Id);
            entity.Property(v => v.Name).IsRequired().HasMaxLength(200);
            entity.Property(v => v.ContactInfo).HasMaxLength(300);
            entity.Property(v => v.PhoneNumber).HasMaxLength(30);
            entity.Property(v => v.Email).HasMaxLength(200);
        });

        // ── ConstructionTask ──────────────────────────────────────
        modelBuilder.Entity<ConstructionTask>(entity =>
        {
            entity.ToTable("Tasks");
            entity.HasKey(t => t.Id);
            entity.Property(t => t.ExcelCode).HasMaxLength(20);
            entity.HasIndex(t => new { t.ProjectId, t.ExcelCode })
                  .IsUnique().HasFilter("[ExcelCode] IS NOT NULL");
            entity.Property(t => t.TaskName).IsRequired().HasMaxLength(300);
            entity.Property(t => t.ProjectStage).HasMaxLength(150);
            entity.Property(t => t.ToDoList).HasColumnType("text");
            entity.Property(t => t.InvoiceNumber).HasMaxLength(100);
            entity.Property(t => t.PaymentMethod).HasMaxLength(100);
            entity.Property(t => t.StorageLocation).HasMaxLength(500);
            entity.Property(t => t.TemplateDocument).HasMaxLength(500);
            entity.Property(t => t.Cost).HasPrecision(18, 2);

            entity.HasOne(t => t.Project)
                  .WithMany(p => p.Tasks)
                  .HasForeignKey(t => t.ProjectId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(t => t.TaskOwner)
                  .WithMany(o => o.Tasks)
                  .HasForeignKey(t => t.TaskOwnerId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(t => t.Vendor)
                  .WithMany(v => v.Tasks)
                  .HasForeignKey(t => t.VendorId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // ── TaskDependency ────────────────────────────────────────
        modelBuilder.Entity<TaskDependency>(entity =>
        {
            entity.ToTable("TaskDependencies");
            entity.HasKey(td => new { td.TaskId, td.DependsOnTaskId });

            entity.HasOne(td => td.Task)
                  .WithMany(t => t.Dependencies)
                  .HasForeignKey(td => td.TaskId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(td => td.DependsOnTask)
                  .WithMany(t => t.Dependents)
                  .HasForeignKey(td => td.DependsOnTaskId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ── NotificationLog ───────────────────────────────────────
        modelBuilder.Entity<NotificationLog>(entity =>
        {
            entity.ToTable("NotificationLogs");
            entity.HasKey(n => n.Id);
            entity.Property(n => n.EventType).IsRequired().HasMaxLength(50);
            entity.Property(n => n.SentTo).IsRequired().HasMaxLength(200);
            entity.Property(n => n.ErrorMessage).HasMaxLength(500);
            entity.HasOne(n => n.Task)
                  .WithMany()
                  .HasForeignKey(n => n.TaskId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(n => new { n.TaskId, n.EventType, n.SentTo, n.SentAt });
        });
    }
}