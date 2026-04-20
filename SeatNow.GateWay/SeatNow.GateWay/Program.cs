using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Logging;
using Microsoft.IdentityModel.Tokens;
using Ocelot.DependencyInjection;
using Ocelot.Middleware;

// IdentityModelEventSource.ShowPII = true; // Disabled for security

var builder = WebApplication.CreateBuilder(args);

builder.Configuration
    .SetBasePath(builder.Environment.ContentRootPath)
    .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
    .AddJsonFile("ocelot.json", optional: false, reloadOnChange: true)
    .AddEnvironmentVariables();

builder.Services.AddCors(options =>
{
    options.AddPolicy("GatewayCors", policy =>
    {
        policy.SetIsOriginAllowed(origin => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddHealthChecks();

var jwtSecret = builder.Configuration["JWT_ACCESS_SECRET"];
if (string.IsNullOrWhiteSpace(jwtSecret))
{
    throw new InvalidOperationException("JWT_ACCESS_SECRET is missing.");
}

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = "GatewayJwt";
        options.DefaultChallengeScheme = "GatewayJwt";
    })
    .AddJwtBearer("GatewayJwt", options =>
    {
        options.UseSecurityTokenValidators = true; // Use old but stable JwtSecurityTokenHandler
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidIssuer = "seatnow-auth-service",
            ValidAudience = "seatnow-client",
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSecret)
            ),
            ClockSkew = TimeSpan.FromSeconds(30),
            ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 }
        };
        options.MapInboundClaims = false; // Disable claim mapping for consistency
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                if (context.Request.Method == "OPTIONS")
                {
                    context.NoResult();
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddOcelot(builder.Configuration);

var app = builder.Build();

app.UseCors("GatewayCors");

// Handle preflight OPTIONS requests explicitly for development
app.Use(async (context, next) =>
{
    if (context.Request.Method == "OPTIONS")
    {
        context.Response.Headers.Add("Access-Control-Allow-Origin", context.Request.Headers["Origin"]);
        context.Response.Headers.Add("Access-Control-Allow-Headers", "*");
        context.Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        context.Response.Headers.Add("Access-Control-Allow-Credentials", "true");
        context.Response.StatusCode = 200;
        await context.Response.WriteAsync("OK");
        return;
    }
    await next();
});

app.UseRouting();

app.UseWebSockets();

app.UseAuthentication();
app.UseAuthorization();

app.UseEndpoints(endpoints =>
{
    endpoints.MapHealthChecks("/health", new HealthCheckOptions
    {
        ResponseWriter = async (context, report) =>
        {
            context.Response.ContentType = "application/json";
            var response = new
            {
                status = report.Status.ToString().ToUpper() == "HEALTHY" ? "UP" : "DOWN",
                service = "gateway-ocelot",
                timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                details = new { gateway = report.Status.ToString().ToLower() }
            };
            await context.Response.WriteAsJsonAsync(response);
        }
    });
});

await app.UseOcelot();

app.Run();
