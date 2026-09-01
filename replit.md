# Bigram AI

Bigram AI is a transparent, from-scratch conversational model that learns word-to-word transitions as users teach it.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/bigram-ai run dev` — run the web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

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
- `artifacts/api-server/src/routes/brain.ts` — model, chat, snapshot, and GitHub settings routes
- `lib/db/src/schema/brain.ts` — persistent model state, messages, snapshots, and backup settings
- `lib/api-spec/openapi.yaml` — source of truth for the generated API client and Zod contracts

## Architecture decisions

- The model is intentionally a word-level bigram model: it learns only token frequencies and adjacent-token transition counts, with no pretrained weights or external AI calls.
- PostgreSQL stores the live model state and conversation history so learning survives server restarts; snapshots also write complete JSON files locally.
- A five-minute server-side timer creates a snapshot while the API process is active. GitHub is represented as an explicit backup boundary and never claims remote success without an authorized connection.
- The frontend uses generated API hooks so the chat, metrics, snapshot history, and backup settings all consume the same contract.

## Product

Users can teach the model in a live chat, see vocabulary/bigram/message counts grow, inspect timestamped snapshots, save a snapshot immediately, and configure a future GitHub destination.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The GitHub panel stays marked “not connected” until a GitHub integration is authorized; local snapshots remain available in the meantime.
- Keep `lib/api-spec/openapi.yaml` and generated clients in sync by running the API codegen command after contract changes.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
