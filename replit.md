# Brazino Accs

Gerenciador pessoal de contas Roblox — salva credenciais (usuário, senha, email, autenticador, avatar) via extensão de navegador ou manualmente pelo dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/dashboard run dev` — run the dashboard frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Optional env: `API_KEY` — if set, all POST /api/accounts requests must include `X-API-Key: <value>` header

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + TailwindCSS + shadcn/ui

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/accounts.ts` — accounts table schema
- `artifacts/api-server/src/routes/accounts.ts` — accounts API routes
- `artifacts/dashboard/src/` — React frontend
  - `pages/home.tsx` — dashboard with stats + recent accounts
  - `pages/accounts.tsx` — full account list with search
  - `pages/account-detail.tsx` — single account view + edit/delete
  - `components/account-card.tsx` — account card component
  - `components/account-form.tsx` — add/edit account form
  - `components/extension-docs.tsx` — API docs panel for extension integration

## Architecture decisions

- CORS allows all origins (`*`) so the browser extension can POST from any page
- `X-API-Key` header auth is optional — if `API_KEY` env var is set, all `/api/accounts` requests require the header
- Passwords, email, authenticator are stored as plaintext in the DB — encrypt at rest if deploying to production with sensitive data
- The `GET /api/accounts/stats` route must be registered BEFORE `GET /api/accounts/:id` in Express to avoid route shadowing

## Extension Integration

Send a `POST /api/accounts` request with JSON body:
```json
{
  "username": "RobloxUser",      // required
  "password": "...",             // optional
  "email": "...",                // optional
  "authenticator": "...",        // optional
  "avatarUrl": "https://...",    // optional
  "notes": "..."                 // optional
}
```
Include header `X-API-Key: YOUR_KEY` if `API_KEY` env var is configured.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm run typecheck:libs` after changing `lib/*` packages before typechecking artifact packages
- The `/api/accounts/stats` route must come before `/api/accounts/:id` in the router to avoid Express matching "stats" as an id param
- After each OpenAPI spec change, re-run codegen before using the updated types

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
