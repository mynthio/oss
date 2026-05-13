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

Response (201):

```json
{
  "taskId": "tsk_...",
  "access": {
    "publicAccessToken": "pat_..."
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
{ "status": "completed" }
```

`GET /tasks/:id/result` — API key or PAT

```json
{
  "id": "tsk_...",
  "type": "image.generate",
  "status": "completed",
  "result": {
    "images": [{ "url": "https://cdn.mynth.io/..." }]
  }
}
```

These polling endpoints are CORS-enabled for browser calls with PATs.

`GET /tasks/:id` — API key only (owner)

Returns full task object including cost, request, timestamps.
