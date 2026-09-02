# Bigram AI

Bigram AI is a transparent, from-scratch conversational model that learns word-to-word transitions as users teach it.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/bigram-ai run dev` — run the web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string for the shared model cache
- Production account persistence also requires `SESSION_SECRET`; non-Replit hosts
  use `GITHUB_TOKEN` for the fixed private snapshots repository

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/bigram-ai/src/App.tsx` — responsive chat and model observability workspace
- `artifacts/api-server/src/lib/brain-service.ts` — tokenizer, bigram learner, generator, snapshots, and scheduler
- `artifacts/api-server/src/lib/auth-service.ts` — GitHub-backed accounts, password hashing, sessions, and per-account chat files
- `artifacts/api-server/src/routes/auth.ts` — local account session, signup, login, and logout routes
- `artifacts/api-server/src/routes/admin.ts` — administrator-only account moderation and AI conversation review routes
- `artifacts/bigram-ai/src/pages/admin.tsx` — responsive administrator control room
- `artifacts/api-server/src/routes/brain.ts` — model, chat, snapshot, and GitHub settings routes
- `lib/db/src/schema/brain.ts` — persistent model state, messages, snapshots, and private backup state
- `lib/api-spec/openapi.yaml` — source of truth for the generated API client and Zod contracts

## Architecture decisions

- The model is intentionally a word-level bigram model: it learns only token frequencies and adjacent-token transition counts, with no pretrained weights or external AI calls.
- PostgreSQL stores the live shared model cache so learning survives server restarts; model snapshots also write complete JSON files locally and to the private `Bigram-Learning-AI-Snapshots` repository.
- Account records and user-facing chats are stored only in the private GitHub repository. Account files contain salted password hashes, and each user chat lives under `snapshots/<account-name>/`.
- A five-minute server-side timer creates a snapshot while the API process is active. Before every chat, the API loads the latest private GitHub model snapshot so the shared vocabulary and transitions stay current, then writes the signed-in user's chat separately.
- Local username/password accounts are independent of Clerk, Replit Auth, Replit OAuth, and GitHub OAuth login.
- Administrator access is stored on account records and enforced on the backend. Admins can review only direct AI chats and group rooms that include Little Brain; user-only rooms are never returned.
- Banning an account invalidates its server-checked sessions, blocks future login, deletes its direct AI history, and removes its messages from shared rooms. The repository-owner account is the initial administrator.
- The frontend uses generated API hooks so the chat, metrics, snapshot history, and backup status all consume the same contract.

## Product

Users first acknowledge the model disclaimer, then create or sign into a local account before teaching the shared model in a private chat. They can see vocabulary/bigram/message counts grow, inspect timestamped snapshots, and save a snapshot immediately. The GitHub destination is fixed and is not editable from the UI.
Administrators also have an `/admin` control room for reviewing AI-involving conversations, account status, bans, and username-based administrator promotion.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The Sources tab links only to the imported source repository. Snapshot files and conversation memory stay in the separate private backup repository.
- Keep `lib/api-spec/openapi.yaml` and generated clients in sync by running the API codegen command after contract changes.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
