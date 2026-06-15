# Image Content Rating

AI classification of image content. Two entry points: rate images during generation (`rating` field) or rate existing images by URL (`/image/rate`).

## Rating Modes

- Default: `{ "mode": "nsfw_sfw" }` — outputs `"sfw"` or `"nsfw"`
- Custom: 2-7 levels with descriptions

```json
{
  "mode": "custom",
  "levels": [
    { "value": "safe", "description": "No explicit content" },
    { "value": "mature", "description": "Adult themes, no nudity" },
    { "value": "explicit", "description": "Contains nudity or graphic content" }
  ]
}
```

## Rate During Generation

Pass `rating` in the generate request. `true` is shorthand for the default mode.

```ts
const task = await mynth.image.generate({
  prompt: "A sunset",
  rating: true, // or { mode: "nsfw_sfw" } or { mode: "custom", levels: [...] }
});

task.getImages()[0].rating; // { status: "success", level: "sfw" } | { status: "failed", error: { code } }
```

With custom levels and `as const`, the SDK narrows `level` to your level values.

## Rate Existing Images (SDK)

```ts
const result = await mynth.image.rate({
  urls: ["https://..."], // 1-10 URLs
  mode: "nsfw_sfw",
});

result.getRatings(); // [{ status: "success", url: "...", level: "sfw" }]
result.getErrors(); // failed items with error codes
```

## Rate Existing Images (REST)

`POST /image/rate` — synchronous by default.

```json
{
  "urls": ["https://example.com/image.jpg"],
  "mode": "nsfw_sfw",
  "sync": true
}
```

Response (200, completed):

```json
{
  "data": {
    "task": { "id": "tsk_...", "status": "completed", "cost": "0.01" },
    "results": [{ "status": "success", "url": "https://...", "level": "sfw" }]
  }
}
```

With `"sync": false` (or if the sync wait times out), responds 202 with `{ "data": { "task": { "id": "tsk_...", "status": "pending" } } }`; poll `/tasks/:id/result` or use the `task.image.rate.completed` webhook.
