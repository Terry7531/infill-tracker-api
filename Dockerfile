# ── Build stage ───────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project files and restore dependencies
COPY InfillTracker.Core/InfillTracker.Core.csproj           InfillTracker.Core/
COPY InfillTracker.Infrastructure/InfillTracker.Infrastructure.csproj InfillTracker.Infrastructure/
COPY InfillTracker.API/InfillTracker.API.csproj             InfillTracker.API/
RUN dotnet restore InfillTracker.API/InfillTracker.API.csproj

# Copy everything and build
COPY . .
RUN dotnet publish InfillTracker.API/InfillTracker.API.csproj \
    -c Release -o /app/publish --no-restore

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Copy published output
COPY --from=build /app/publish .

# Copy the seed spreadsheet (needed by ProjectTaskSeeder at runtime)
COPY --from=build /src/InfillTracker.Infrastructure/Data/SeedData/Infill_Tasks.xlsx \
     ./Data/SeedData/Infill_Tasks.xlsx

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "InfillTracker.API.dll"]
