using System.Net.Mail;
using api;
using api.Src.Admin.Services;
using api.Src.AiChat.Services;
using api.Src.Auth.Services;
using api.Src.Auth.Services.Auth;
using api.Src.Configuration;
using api.Src.ConsultationSpace.ConduiteSection.Realtime;
using api.Src.ConsultationSpace.ConduiteSection.Services;
using api.Src.ConsultationSpace.DocumentsSection.Services;
using api.Src.ConsultationSpace.ExamSection.Realtime;
using api.Src.ConsultationSpace.ExamSection.Services;
using api.Src.ConsultationSpace.InterrogationSection.Services;
using api.Src.Messaging.Realtime;
using api.Src.Messaging.Services;
using api.Src.PatientSpace.Services;
using api.Src.Profile.Services;
using api.Src.Realtime;
using api.Src.SelfCheckin.Services;
using api.Src.Smtp.Services;
using api.Src.Statistics.Services;
using api.Src.Suggestions.Realtime;
using api.Src.Suggestions.Services;
using api.Src.Subscription.CronJobs;
using api.Src.Subscription.Services;
using api.Src.TechAssistance.Realtime;
using api.Src.TechAssistance.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection.AuthenticatedEncryption;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Quartz;
using Serilog;

var builder = WebApplication.CreateBuilder(args);
var seedGeneralPracticeCatalogOnly = args.Any(arg =>
    string.Equals(arg, "--seed-general-practice-catalog", StringComparison.OrdinalIgnoreCase));
var refreshGeneralPracticeCatalogAccentsOnly = args.Any(arg =>
    string.Equals(arg, "--refresh-general-practice-catalog-accents", StringComparison.OrdinalIgnoreCase));

// Add services to the container.
var envFilePath = new[]
{
    Path.Combine(builder.Environment.ContentRootPath, ".env"),
    Path.Combine(builder.Environment.ContentRootPath, "api", ".env"),
    Path.Combine(Directory.GetCurrentDirectory(), ".env"),
    Path.Combine(Directory.GetCurrentDirectory(), "api", ".env")
}
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .FirstOrDefault(File.Exists);

if (envFilePath is not null)
{
    DotNetEnv.Env.Load(envFilePath);
}
else
{
    DotNetEnv.Env.Load();
}
builder.Configuration.AddEnvironmentVariables();
var publicUrls = PublicUrlSettingsReader.Read(builder.Configuration, builder.Environment);
var connectionString = Environment.GetEnvironmentVariable("db_conn_str") ?? throw new Exception("Database connection string not found in environment variables.");
builder.Services.AddNpgsqlDataSource(connectionString, b=>b.EnableDynamicJson());
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql());
builder.Services.AddSingleton(publicUrls);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // read secret from config and fail fast with a helpful message if missing
        var secret = Environment.GetEnvironmentVariable("jwt_secret_key") ?? throw new InvalidOperationException("Configuration key 'AppSettings:SecretKey' is missing.");

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = Environment.GetEnvironmentVariable("jwt_issuer") ?? throw new InvalidOperationException("jwt_issuer not found in environment variables."),
            ValidAudience = Environment.GetEnvironmentVariable("jwt_audience") ?? throw new InvalidOperationException("jwt_audience not found in environment variables."),
            IssuerSigningKey = new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(secret))
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;

                if (!string.IsNullOrWhiteSpace(accessToken) &&
                    (path.StartsWithSegments(WaitingRoomHub.HubPath) ||
                     path.StartsWithSegments(InternalMessagingHub.HubPath) ||
                     path.StartsWithSegments(ConsultationAiHub.HubPath) ||
                     path.StartsWithSegments(ExamRealtimeHub.HubPath) ||
                     path.StartsWithSegments(SuggestionHub.HubPath) ||
                     path.StartsWithSegments(TechAssistanceHub.HubPath)))
                {
                    context.Token = accessToken;
                }

                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddControllers();
builder.Services.AddSignalR();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ISmtpService, SmtpService>();
builder.Services.AddScoped<IProfileService, ProfileService>();
builder.Services.AddScoped<IAdminService, AdminService>();
builder.Services.AddScoped<IPatientService, PatientService>();
builder.Services.AddScoped<IInterrogatoireService, InterrogatoireService>();
builder.Services.AddScoped<IExamService, ExamService>();
builder.Services.AddScoped<IConduiteService, ConduiteService>();
builder.Services.AddScoped<IConduitePrintService, ConduitePrintService>();
builder.Services.AddScoped<IConsultationLettreConfrereAiService, ConsultationLettreConfrereAiService>();
builder.Services.AddScoped<IConsultationDocumentsService, ConsultationDocumentsService>();
builder.Services.AddScoped<ISubscriptionService, SubscriptionService>();
builder.Services.AddScoped<IAutoDailyNewsService, AutoDailyNewsService>();
builder.Services.AddScoped<api.Src.AgendaSpace.Services.AgendaService>();
builder.Services.AddScoped<ISelfCheckinService, SelfCheckinService>();
builder.Services.AddScoped<IStatisticsService, StatisticsService>();
builder.Services.AddScoped<InternalMessagingService>();
builder.Services.AddScoped<IAiChatService, AiChatService>();
builder.Services.AddScoped<SuggestionService>();
builder.Services.AddScoped<TechAssistanceService>();
builder.Services.AddSingleton<IWaitingRoomNotifier, WaitingRoomNotifier>();
builder.Services.AddSingleton<IConsultationAiNotifier, ConsultationAiNotifier>();
builder.Services.AddSingleton<IExamRealtimeNotifier, ExamRealtimeNotifier>();
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .Enrich.FromLogContext()
    .WriteTo.File(
        path: "logs/subscription-job-.log",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 30,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss} [{Level}] {Message:lj}{NewLine}{Exception}")
    .WriteTo.File(
        path: "logs/ai-chat-.log",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 7,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} [{Level}] {SourceContext} {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

builder.Services.AddQuartz(q =>
{
    q.AddJob<CleanUpJob>(opts => opts.WithIdentity(new JobKey("CleanUpJob")));
    q.AddTrigger(opts => opts.ForJob("CleanUpJob").WithIdentity("CleanUpJob-trigger")
    .WithCronSchedule("0 0 0 * * ?")); // every day at midnight

    q.AddJob<SuperAdminDailyNewsGenerationJob>(opts => opts.WithIdentity(new JobKey("SuperAdminDailyNewsGenerationJob")));
    q.AddTrigger(opts => opts.ForJob("SuperAdminDailyNewsGenerationJob").WithIdentity("SuperAdminDailyNewsGenerationJob-trigger")
        .WithCronSchedule("0 5 0 * * ?")); // every day at 00:05

    q.AddJob<SuperAdminDailyNewsPropagationJob>(opts => opts.WithIdentity(new JobKey("SuperAdminDailyNewsPropagationJob")));
    q.AddTrigger(opts => opts.ForJob("SuperAdminDailyNewsPropagationJob").WithIdentity("SuperAdminDailyNewsPropagationJob-trigger")
        .WithCronSchedule("0 10 0 * * ?")); // every day at 00:10
});
builder.Services.AddQuartzHostedService(opt => { opt.WaitForJobsToComplete = true; });
builder.Services.AddCors(options =>
{
    options.AddPolicy("ConfiguredCors", policy =>
    {
        policy.WithOrigins(publicUrls.CorsOrigins.ToArray())
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()
              .WithExposedHeaders("X-New-Access-Token", "X-New-Refresh-Token");
    });
});

builder.Host.UseSerilog();
var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.Use(async (context, next) =>
{
    var origin = context.Request.Headers.Origin.ToString();
    if (!publicUrls.IsCorsOriginAllowed(origin))
    {
        await next();
        return;
    }

    context.Response.OnStarting(() =>
    {
        context.Response.Headers["Access-Control-Allow-Origin"] = origin;
        context.Response.Headers["Access-Control-Allow-Credentials"] = "true";
        context.Response.Headers["Access-Control-Expose-Headers"] = "X-New-Access-Token, X-New-Refresh-Token";
        context.Response.Headers.Append("Vary", "Origin");
        return Task.CompletedTask;
    });

    if (HttpMethods.IsOptions(context.Request.Method))
    {
        var requestedHeaders = context.Request.Headers["Access-Control-Request-Headers"].ToString();
        context.Response.Headers["Access-Control-Allow-Origin"] = origin;
        context.Response.Headers["Access-Control-Allow-Credentials"] = "true";
        context.Response.Headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
        context.Response.Headers["Access-Control-Allow-Headers"] = string.IsNullOrWhiteSpace(requestedHeaders)
            ? "Authorization, Content-Type"
            : requestedHeaders;
        context.Response.Headers["Access-Control-Max-Age"] = "86400";
        context.Response.Headers.Append("Vary", "Origin");
        context.Response.StatusCode = StatusCodes.Status204NoContent;
        return;
    }

    await next();
});

app.UseCors("ConfiguredCors");
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = context =>
    {
        var path = context.Context.Request.Path.Value ?? string.Empty;
        if (path.StartsWith("/exploration-documents/", StringComparison.OrdinalIgnoreCase))
        {
            context.Context.Response.Headers["Cache-Control"] = "public, max-age=31536000, immutable";
        }
    }
});
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers().RequireCors("ConfiguredCors");
app.MapHub<WaitingRoomHub>(WaitingRoomHub.HubPath).RequireCors("ConfiguredCors");
app.MapHub<InternalMessagingHub>(InternalMessagingHub.HubPath).RequireCors("ConfiguredCors");
app.MapHub<ConsultationAiHub>(ConsultationAiHub.HubPath).RequireCors("ConfiguredCors");
app.MapHub<ExamRealtimeHub>(ExamRealtimeHub.HubPath).RequireCors("ConfiguredCors");
app.MapHub<SuggestionHub>(SuggestionHub.HubPath).RequireCors("ConfiguredCors");
app.MapHub<TechAssistanceHub>(TechAssistanceHub.HubPath).RequireCors("ConfiguredCors");
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    // dbContext.Database.Migrate();
    var authService = scope.ServiceProvider.GetRequiredService<IAuthService>();
    await authService.EnsureSuperAdminExists();
    var cleanUpService = scope.ServiceProvider.GetRequiredService<ISubscriptionService>();
    await cleanUpService.CleanDatabase();

    var interrogatoireService = scope.ServiceProvider.GetRequiredService<IInterrogatoireService>();
    if (refreshGeneralPracticeCatalogAccentsOnly)
    {
        await interrogatoireService.RefreshGeneralPracticeTreatmentCatalogAccentsForAllCabinets();
    }
    else
    {
        await interrogatoireService.SeedGeneralPracticeTreatmentCatalogForAllCabinets();
    }
}

if (seedGeneralPracticeCatalogOnly || refreshGeneralPracticeCatalogAccentsOnly)
{
    return;
}

app.Run();
