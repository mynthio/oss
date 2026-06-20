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
    "access": {
      "publicAccessToken": "pat_..."
    }
  }
}
```

PAT generation is enabled by default. Disable it with:

```json
{ "access": { "pat": { "enabled": false } } }
```

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

## Webhook Management

`POST /webhook`, `PUT /webhook/:id`, `DELETE /webhook/:id` — manage registered (signed) webhooks. See [webhooks.md](webhooks.md).

## Destinations Management

`POST /destinations`, `GET /destinations`, `GET /destinations/:id`, `PUT /destinations/:id`, `DELETE /destinations/:id`, `POST /destinations/:id/test` — manage storage destinations. See [destinations.md](destinations.md).
