FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY AppliGeneraliste.sln ./
COPY api/api.csproj api/
RUN dotnet restore api/api.csproj

COPY api/. api/
WORKDIR /src/api
RUN dotnet publish api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish ./

EXPOSE 8080
ENTRYPOINT ["dotnet", "api.dll"]
