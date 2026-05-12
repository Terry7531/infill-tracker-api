using InfillTracker.Core.Models;
using InfillTracker.Infrastructure.Data;
using InfillTracker.Infrastructure.Repositories;
using InfillTracker.Infrastructure.Services;
using InfillTracker.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ── EF Core — SQL Server locally, PostgreSQL on Railway ──────────────────────
var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");

builder.Services.AddDbContext<AppDbContext>(options =>
{
    if (!string.IsNullOrEmpty(databaseUrl))
    {
        // Railway provides DATABASE_URL as a full PostgreSQL connection string
        // Convert from postgres://user:pass@host:port/db to Npgsql format
        var uri      = new Uri(databaseUrl);
        var userInfo = uri.UserInfo.Split(':');
        var npgsqlConn = $"Host={uri.Host};Port={uri.Port};" +
                         $"Database={uri.AbsolutePath.TrimStart('/')};" +
                         $"Username={userInfo[0]};Password={userInfo[1]};" +
                         $"SSL Mode=Require;Trust Server Certificate=true";

        options.UseNpgsql(npgsqlConn,
            npg => npg.MigrationsAssembly("InfillTracker.Infrastructure"));
    }
    else
    {
        // Local development — use SQL Server / LocalDB
        options.UseSqlServer(
            builder.Configuration.GetConnectionString("DefaultConnection"),
            sql => sql.MigrationsAssembly("InfillTracker.Infrastructure"));
    }
});

// ── ASP.NET Core Identity ─────────────────────────────────────────────────────
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequiredLength         = 8;
    options.Password.RequireDigit           = true;
    options.Password.RequireUppercase       = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.DefaultLockoutTimeSpan  = TimeSpan.FromMinutes(15);
    options.Lockout.AllowedForNewUsers      = true;
    options.User.RequireUniqueEmail         = true;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

// ── JWT Authentication stored in HttpOnly cookie ──────────────────────────────
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException(
        "Jwt:Key is not configured in appsettings.json. " +
        "Add a secure random string of at least 32 characters.");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme    = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer           = true,
        ValidateAudience         = true,
        ValidateLifetime         = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer              = builder.Configuration["Jwt:Issuer"],
        ValidAudience            = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey         = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(jwtKey)),
        ClockSkew                = TimeSpan.Zero,
    };

    // Read JWT from HttpOnly cookie — never from JS-accessible storage
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = ctx =>
        {
            ctx.Token = ctx.Request.Cookies["infilltracker_auth"];
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

// ── Repositories ──────────────────────────────────────────────────────────────
builder.Services.AddScoped<IRepository<Project>,   Repository<Project>>();
builder.Services.AddScoped<IRepository<TaskOwner>, Repository<TaskOwner>>();
builder.Services.AddScoped<IRepository<Vendor>,    Repository<Vendor>>();
builder.Services.AddScoped<ITaskRepository,        TaskRepository>();

// ── Seeder + Notification services ───────────────────────────────────────────
builder.Services.AddScoped<ProjectTaskSeeder>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddHostedService<NotificationBackgroundService>();

// ── Controllers + Swagger ─────────────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
        opts.JsonSerializerOptions.PropertyNamingPolicy = null);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
    c.SwaggerDoc("v1", new() { Title = "InfillTracker API", Version = "v1" }));

// ── CORS — must allow credentials for HttpOnly cookie to be sent ──────────────
var allowedOrigins = new List<string> { "http://localhost:3000" };
var railwayUiUrl   = Environment.GetEnvironmentVariable("UI_URL");
if (!string.IsNullOrEmpty(railwayUiUrl))
    allowedOrigins.Add(railwayUiUrl.TrimEnd('/'));

builder.Services.AddCors(options =>
    options.AddPolicy("ReactUI", policy =>
        policy
            .WithOrigins(allowedOrigins.ToArray())
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials()));

var app = builder.Build();

// ── Migrate + seed on startup ─────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db          = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    var config      = scope.ServiceProvider.GetRequiredService<IConfiguration>();
    var logger      = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    await db.Database.MigrateAsync();
    await IdentitySeeder.SeedAsync(userManager, roleManager, config, logger);
}

// ── Middleware pipeline ───────────────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("ReactUI");
app.UseAuthentication();   // must come before UseAuthorization
app.UseAuthorization();
app.MapControllers();

app.Run();
