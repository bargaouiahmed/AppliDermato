# Docker Deployment (VPS)

## 1) Prepare config files

From project root:

```bash
cp deploy/.env.example deploy/.env
cp deploy/api.env.example deploy/api.env
```

Edit:

- `deploy/.env` (Postgres password + exposed ports)
- `deploy/api.env` (API secrets + URLs + SMTP + OpenRouter)
- `deploy/frontend-env.js` (`appUrl` and `apiUrl`)

## 2) Frontend workflow (manual dist replace)

Use the same approach you described:

- Build Angular where you already have `node_modules` (local machine or VPS).
- Replace the project root `dist/` folder with the new built files.
- Run docker compose.

The `frontend` container serves directly from root `dist/`.

## 3) Start stack on VPS

From project root on VPS:

```bash
docker compose --env-file deploy/.env up -d --build
```

Services:

- Frontend: `http://<vps-ip>:8080` (or `FRONTEND_PORT`)
- API: `http://<vps-ip>:5087` (or `API_PORT`)
- Postgres: internal (`db:5432`)

## 4) Persistent data locations (host disk)

- Uploaded files: `deploy/uploads/` (mounted to `/app/wwwroot`)
- Postgres data: `deploy/postgres-data/`
- API logs: `deploy/api-logs/`
- SQL backups: `deploy/backups/`
- Frontend static files served by nginx: `dist/`

## 5) Database backup / restore

Make scripts executable once:

```bash
chmod +x deploy/scripts/db-backup.sh deploy/scripts/db-restore.sh
```

Backup:

```bash
./deploy/scripts/db-backup.sh
```

Optional custom output filename:

```bash
./deploy/scripts/db-backup.sh deploy/backups/my-backup.sql
```

Restore:

```bash
./deploy/scripts/db-restore.sh deploy/backups/my-backup.sql
```

## 6) Update frontend/API URLs without rebuilding

- Edit `deploy/frontend-env.js` to change Angular runtime URLs.
- Edit `deploy/api.env` keys:
  - `frontend_url`
  - `api_public_url`
  - `cors_allowed_origins`

Then restart:

```bash
docker compose --env-file deploy/.env restart frontend api
```

## Optional Windows scripts

If needed locally on Windows, PowerShell versions are still available:

- `deploy/scripts/db-backup.ps1`
- `deploy/scripts/db-restore.ps1`
