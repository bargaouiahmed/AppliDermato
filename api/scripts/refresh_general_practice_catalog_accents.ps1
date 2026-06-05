Set-Location -Path (Join-Path $PSScriptRoot "..")

dotnet run --project ".\api.csproj" -- --refresh-general-practice-catalog-accents
