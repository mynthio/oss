# Analyze a Repo for Mynth Migration

Use this when asked whether Mynth can replace existing image-generation code.

## Migration Patterns

- Provider switch statements, model config maps, or fallback logic -> one `model` field, often `"auto"`.
- Queue workers or status proxy endpoints -> Mynth tasks plus PAT browser polling.
- Webhook sync code without provider value -> Mynth webhooks.
- Prompt-to-size heuristics -> `size: "auto"` or explicit aspect-ratio presets.
- Post-processing for output format/quality -> `output`.
- Content rating calls -> `rating`.
- Provider-specific reference/init image plumbing -> `inputs`.

## Analysis Workflow

1. Scan the repo for image generation related code
2. Match only concrete code paths to the patterns above
3. Recommend the smallest integration path from [SKILL.md](../SKILL.md)
4. Present what can be deleted, what must remain, and any behavior that needs product confirmation

## Core Replacement Pattern

1. Server submits with `generateAsync()` or `POST /image/generate`
2. Browser polls `/tasks/:id/status` and `/tasks/:id/result` with the PAT
3. Server syncs durable state from `task.image.generate.completed` webhooks

Do not promise removal of queues or workers if the app uses them for unrelated work, retries with custom semantics, payments, moderation review, or user notifications.
