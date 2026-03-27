# REST API

## Base URL

```
https://api.mynth.io
```

OpenAPI spec: [https://api.mynth.io/openapi](https://api.mynth.io/openapi)

## Authentication

```
Authorization: Bearer mak_...
```

PATs use: `Authorization: Bearer pat_...`

## Generate Image

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

Response (201):

```json
{
  "taskId": "tsk_...",
  "access": {
    "publicAccessToken": "pat_..."
  }
}
```

Disable PAT generation: set `access.pat.enabled: false` in body.

## Task Status

`GET /tasks/:id/status` — API key or PAT

```json
{ "status": "completed" }
```

## Task Results

`GET /tasks/:id/results` — API key or PAT

```json
{
  "images": [
    { "url": "https://cdn.mynth.io/...", "size": { "width": 1024, "height": 576 } }
  ]
}
```

## Task Details

`GET /tasks/:id` — API key only (owner)

Returns full task object including cost, request, timestamps.

## CORS

`/tasks/:id/status` and `/tasks/:id/results` allow all origins. Safe to call from browser with PAT.
