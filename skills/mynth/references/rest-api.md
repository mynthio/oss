# REST API

Use REST for non-JS apps, mobile backends, or runtimes where the SDK is not appropriate.

- Base URL: `https://api.mynth.io`
- OpenAPI: [https://api.mynth.io/openapi.json](https://api.mynth.io/openapi.json)
- Model catalog: `GET https://api.mynth.io/models` (no auth). Pick the `model` id from here; see "Choose a Model" in [SKILL.md](../SKILL.md)
- API key auth: `Authorization: Bearer mak_...`
- PAT auth for task polling: `Authorization: Bearer pat_...`

## Submit

`POST /image/generate`

```json
{
  "model": "black-forest-labs/flux.2-pro",
  "prompt": "A neon cityscape",
  "size": { "type": "aspect_ratio", "aspect_ratio": "16:9" },
  "count": 1,
  "output": { "format": "webp" },
  "webhook": { "custom": [{ "url": "https://your-app.com/webhook" }] }
}
```

Always send `model`. When it is omitted the API uses `"auto"`, which is experimental.

Optional fields: `negative_prompt`, `magic_prompt`, `inputs`, `rating` (see [image-rating.md](image-rating.md)), `destination` (see [destinations.md](destinations.md)), `metadata`, `generate_public_access_token`.

Every field name is snake_case, and a field the endpoint does not define answers `400 validation_error` naming it. `count` is a whole number from 1 to 20.

Errors are `{ "error": { "code": "insufficient_balance", "message": "..." } }`, with lowercase snake_case codes; `validation_error` adds `error.issues: [{ path, message }]`. Branch on `error.code`, never on `message`.

Response (201):

```json
{
  "data": {
    "task_id": "tsk_...",
    "estimated_cost": "0.03",
    "public_access_token": "pat_..."
  }
}
```

`estimated_cost` is the USD amount reserved for the task; failed images are refunded, so the final cost may be lower.

`public_access_token` is present only when the request sets `"generate_public_access_token": true` (default `false`). Ask for it only when browser code will poll the task.

## Estimate Cost (Dry Run)

`POST /image/generate/estimate` — same request body as `POST /image/generate`. Validates the request and returns the estimated cost without creating a task or charging anything. Use before batch runs to check spend.

```json
{
  "data": { "estimated_cost": "0.03", "currency": "usd", "estimate_kind": "exact" }
}
```

`estimate_kind` is `"exact"` for an explicit model. It is `"upper_bound"` only when the request falls back to `"auto"`, which holds a flat $0.20 per image.

## Account

`GET /me` — API key or OAuth. Returns the authenticated identity: `{ "data": { "user_id": "...", "auth": { "method": "api-key", "api_key": { "id": "...", "name": "...", "key_preview": "mak_..." } } } }`. The `api_key` block is present only with API key auth.

`GET /balance` — API key with the `manage` scope, or OAuth. Returns spendable credits:

```json
{
  "data": { "balance": "12.5", "reserved": "0.2", "available": "12.3", "currency": "usd" }
}
```

`reserved` is held by in-flight tasks; `available` = `balance` - `reserved`. A key's spending limit (`used`, `limit`, `remaining`) is on `GET /me`, not here.

## Poll

`GET /tasks/:id/status` — API key or PAT

```json
{
  "data": {
    "status": "completed"
  }
}
```

`GET /tasks/:id/result` — API key or PAT

```json
{
  "data": {
    "id": "tsk_...",
    "type": "image.generate",
    "status": "completed",
    "result": {
      "model": "black-forest-labs/flux.2-pro",
      "images": [
        {
          "status": "success",
          "id": "img_...",
          "url": "https://cdn.mynth.io/images/img_....webp",
          "mynth_url": "https://cdn.mynth.io/images/img_....webp",
          "size": "1920x1080",
          "format": "webp"
        },
        { "status": "failed", "error": { "code": "restricted_content" } }
      ]
    }
  }
}
```

Check `status` on every image: a completed task can hold failed images. `url` is your storage when a destination was named, or `null` if that upload failed; `mynth_url` always points to the Mynth CDN and is served for 7 days. `/result` has no `errors`; read `GET /tasks/:id` for a failed task.

These polling endpoints are CORS-enabled for browser calls with PATs.

`GET /tasks/:id` — API key only (owner)

Returns `{ "data": ... }` with the full task object: `id`, `type`, `status`, `request`, `result`, `errors`, `cost`, `user_id`, `api_key_id`, `created_at`, `updated_at`. The same object is `data` in every webhook event.

`GET /tasks?limit=20&after=tsk_...` — API key or OAuth (owner)

Lists recent tasks, newest first. With an API key, only tasks created by that key; with OAuth, all of the user's tasks. `limit` is optional (1-100, default 20). `after` is an optional cursor: returns tasks created before that task ID (pass the last ID of the previous page). Returns `{ "data": [...] }` with summary items: `id`, `type`, `status`, `cost`, `created_at`, `updated_at`.

## Upload

`POST /image/upload` — multipart form with `images` file fields, for input images. Up to 10 JPEG/PNG/WEBP files, 1 KB to 10 MB each. URLs are served for 1 day.

Response (200):

```json
{
  "data": {
    "urls": ["https://cdn.mynth.io/..."]
  }
}
```

## Rate

`POST /image/rate` — rate a single existing image by URL. Async only; returns `201` with `task_id` and `estimated_cost`. Mode defaults to `nsfw_sfw`. Request and response shapes: see [image-rating.md](image-rating.md).

## Alt Text

`POST /image/alt` — generate alt text for a single existing image by URL. Async only; returns `201` with `task_id` and `estimated_cost`. Request and response shapes: see [image-alt.md](image-alt.md).

## Remove Background

`POST /image/remove-background` — remove the background from a single existing image by URL. Async only; returns `201` with `task_id`, `estimated_cost`, and, with `generate_public_access_token: true`, a PAT. Request and response shapes: see [image-remove-background.md](image-remove-background.md).

## Upscale

`POST /image/upscale` — enlarge a single existing image by URL. Body needs `url`, `size` (`"2x"` or `"4x"`), and `effort` (`"low"` or `"high"`). Async only; returns `201` with `task_id`, `estimated_cost`, and, with `generate_public_access_token: true`, a PAT. Request and response shapes: see [image-upscale.md](image-upscale.md).

## Review

`POST /image/review` — score one image from 1 to 4 and list its defects. Body: `{ "url", "effort": "high" | "low" }` (default `high`). Async only. Details: https://mynth.io/docs/guides/review-images.md

## Video

`POST /video/generate` — `model` (required, no `auto`) and `prompt`, plus optional `duration`, `resolution`, `audio`, `inputs` (`first_frame`/`last_frame`), `webhook`, `metadata`. One video per request; no `destination` (sending one is a `400 validation_error`). Values the model does not serve fail with `400 validation_error`. `POST /video/generate/estimate` prices the same body. Details: https://mynth.io/docs/guides/generate-video.md

## Webhook Management

`POST /webhooks`, `PUT /webhooks/:id`, `DELETE /webhooks/:id` — manage registered (signed) webhooks. See [webhooks.md](webhooks.md).

`POST /api-keys`, `GET /api-keys`, `PUT /api-keys/:id`, `DELETE /api-keys/:id` — manage API keys (`keys` scope). `spending_limit` is a decimal string (`"25.00"`) and needs `spending_limit_period` (`day`, `week`, `month`).

## Destinations Management

`POST /destinations`, `GET /destinations`, `GET /destinations/:id`, `PUT /destinations/:id`, `DELETE /destinations/:id`, `POST /destinations/:id/test` — manage storage destinations. See [destinations.md](destinations.md).
