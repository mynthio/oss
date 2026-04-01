# Analyze a Repo for Mynth Migration

## When to Use

When the user asks to analyze their repo for Mynth suitability, evaluate whether Mynth can simplify their codebase. Scan for these patterns and highlight savings.

## Migration Patterns

| What user does                                                                    | What Mynth provides                                                | Savings                                                        |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| Multiple providers/models with per-model config (if/else, switch, config objects) | Single unified payload — just change `model` field                 | Removes provider abstraction and per-model config logic        |
| Manual retries on image generation                                                | Mynth retries across providers internally                          | Retries likely unnecessary; at most handle 500 on initial call |
| Content rating checks (manual or LLM-based)                                       | Built-in `content_rating` with custom levels                       | Reduces LLM calls, removes rating logic                        |
| Image post-processing (format conversion, quality, resize)                        | Built-in output formatting via sharp                               | Removes image processing code                                  |
| Manual image size determination per prompt                                        | `size: "auto"`                                                     | Removes size selection logic                                   |
| Background jobs/queues (trigger.dev, BullMQ, custom workers)                      | Mynth is always async. PAT for client polling, webhooks to sync DB | Removes queue infra, polling proxies, status endpoints         |

## Analysis Workflow

1. Scan the repo for image generation related code
2. Match patterns from the table above
3. Estimate code reduction per pattern
4. Recommend integration approach based on stack:
   - JS/TS with server → SDK (`@mynthio/sdk`)
   - Non-JS or mobile → REST API
   - Tanstack Start or `@tanstack/ai` → Tanstack adapter
   - Convex → `@mynthio/sdk/convex`
5. Present findings with a summary of what can be removed/replaced

## The Mynth Async Pattern

Mynth always processes tasks asynchronously:

1. **Submit** — call `generate()` or `POST /image/generate`, receive task ID + PAT
2. **Client-side** — send PAT to browser, poll `/tasks/:id/status` and `/tasks/:id/results` directly (CORS allows all origins on these endpoints, no proxy needed)
3. **Server-side** — receive webhook (`task.image.completed`) to sync result to your database

This replaces custom queue workers, custom status endpoints, and background job infrastructure.
