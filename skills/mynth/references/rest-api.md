# REST API

Use REST for non-JS apps, mobile backends, or runtimes where the SDK is not appropriate.

- Base URL: `https://api.mynth.io`
- OpenAPI: [https://api.mynth.io/openapi](https://api.mynth.io/openapi)
- API key auth: `Authorization: Bearer mak_...`
- PAT auth for task polling: `Authorization: Bearer pat_...`

## Submit

`POST /image/generate`

```json
{
  "prompt": "A neon cityscape",
  "model": "auto",
  "size": { "type": "aspect_ratio", "aspectRatio": "16:9" },
  "count": 1,
  "output": { "format": "webp", "quality": 80 },
  "webhook": { "custom": [{ "url": "https://your-app.com/webhook" }] }
}
```

Optional fields: `negative_prompt`, `magic_prompt`, `inputs`, `rating` (see [image-rating.md](image-rating.md)), `destination` (see [destinations.md](destinations.md)), `metadata`.

Response (201):

```json
{
  "data": {
    "taskId": "tsk_...",
    "estimatedCost": "0.03",
    "access": {
      "publicAccessToken": "pat_..."
    }
  }
}
```

`estimatedCost` is the USD amount reserved for the task; failed images are refunded, so the final cost may be lower.

PAT generation is enabled by default. Disable it with:

```json
{ "access": { "pat": { "enabled": false } } }
```

## Estimate Cost (Dry Run)

`POST /image/generate/estimate` — same request body as `POST /image/generate`. Validates the request and returns the estimated cost without creating a task or charging anything. Use before batch runs to check spend.

```json
{
  "data": { "estimatedCost": "0.03", "currency": "usd", "estimateKind": "exact" }
}
```

`estimateKind` is `"exact"` when the model is pinned, or `"upper_bound"` for `model: "auto"` (a flat per-image ceiling is reserved until a concrete model is selected).

## Account

`GET /me` — API key or OAuth. Returns the authenticated identity: `{ "data": { "userId": "...", "auth": { "method": "api-key", "apiKey": { "id": "...", "name": "...", "keyPreview": "mak_..." } } } }`. The `apiKey` block is present only with API key auth.

`GET /balance` — API key or OAuth. Returns spendable credits:

```json
{
  "data": {
    "balance": "12.5",
    "reserved": "0.2",
    "available": "12.3",
    "currency": "usd",
    "apiKey": {
      "spendingLimit": "50",
      "spendingLimitPeriod": "month",
      "usedInPeriod": "3.2",
      "remainingInPeriod": "46.8"
    }
  }
}
```

`reserved` is held by in-flight tasks; `available` = `balance` - `reserved`. The `apiKey` block appears only when the authenticating API key has a spending limit configured.

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
      "model": "black-forest-labs/flux.2-dev",
      "images": [
        {
          "status": "success",
          "url": "https://cdn.mynth.io/...",
          "mynth_url": "https://cdn.mynth.io/...",
          "cost": "0.01",
          "size": "1920x1080"
        }
      ]
    }
  }
}
```

`url` is `null` when the image was delivered only to a user destination; `mynth_url` always points to the Mynth CDN.

These polling endpoints are CORS-enabled for browser calls with PATs.

`GET /tasks/:id` — API key only (owner)

Returns `{ "data": ... }` with the full task object including cost, request, timestamps.

`GET /tasks?limit=20&after=tsk_...` — API key or OAuth (owner)

Lists recent tasks, newest first. With an API key, only tasks created by that key; with OAuth, all of the user's tasks. `limit` is optional (1-100, default 20). `after` is an optional cursor: returns tasks created before that task ID (pass the last ID of the previous page). Returns `{ "data": [...] }` with summary items: `id`, `type`, `status`, `cost`, `createdAt`, `updatedAt`.

## Upload

`POST /image/upload` — multipart form with `images` file fields, for input images.

Response (200):

```json
{
  "data": {
    "urls": ["https://cdn.mynth.io/..."]
  }
}
```

## Rate

`POST /image/rate` — rate existing images by URL. Synchronous by default (`"sync": true`); returns 200 with results, or 202 with a pending task when `"sync": false`. Request and response shapes: see [image-rating.md](image-rating.md).

## Alt Text

`POST /image/alt` — generate alt text for existing images by URL. Synchronous by default (`"sync": true`); returns 200 with results, or 202 with a pending task when `"sync": false`. Request and response shapes: see [image-alt.md](image-alt.md).

## Webhook Management

`POST /webhook`, `PUT /webhook/:id`, `DELETE /webhook/:id` — manage registered (signed) webhooks. See [webhooks.md](webhooks.md).

## Destinations Management

`POST /destinations`, `GET /destinations`, `GET /destinations/:id`, `PUT /destinations/:id`, `DELETE /destinations/:id`, `POST /destinations/:id/test` — manage storage destinations. See [destinations.md](destinations.md).
