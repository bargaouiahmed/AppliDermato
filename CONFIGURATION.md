# Environment Configuration

## Frontend

Angular swaps environment files at build/serve time.

- Default dev / Cloudflare tunnel: `cd Frontend && npm start`
- Explicit Cloudflare tunnel dev: `cd Frontend && npm run start:tunnel`
- Fully local frontend/API dev: `cd Frontend && npm run start:local`
- Production build: `cd Frontend && npm run build:prod`

Current public domains:

- Frontend: `https://generalisto.softsolution.site`
- API: `https://gen-api.softsolution.site`

The tunnel and production frontend environments both send API requests to `https://gen-api.softsolution.site`.

Frontend environment files:

- `src/environments/environment.ts`: default public Cloudflare frontend/API.
- `src/environments/environment.local.ts`: fully local frontend/API.
- `src/environments/environment.tunnel.ts`: Cloudflare tunnel frontend/API.
- `src/environments/environment.prod.ts`: production frontend/API.

## Backend

The API reads public URL settings from `api/appsettings.json`, with `.env` / process environment variables taking priority.

Supported overrides:

- `frontend_url`: public frontend base URL.
- `api_public_url`: public API base URL.
- `cors_allowed_origins`: comma-separated browser origins allowed by CORS.
- `openrouter_http_referer`: referer sent to OpenRouter; defaults to the frontend URL.

For Cloudflare tunnels, the intended values are:

```env
frontend_url=https://generalisto.softsolution.site
api_public_url=https://gen-api.softsolution.site
cors_allowed_origins=https://generalisto.softsolution.site
openrouter_http_referer=https://generalisto.softsolution.site
```
