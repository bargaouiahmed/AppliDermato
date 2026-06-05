Set-Location -Path (Join-Path $PSScriptRoot "..")

dotnet run --project ".\api.csproj" -- --seed-general-practice-catalog
