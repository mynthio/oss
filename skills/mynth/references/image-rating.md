# Image Content Rating

AI classification of image content. Two entry points: rate images during generation (`rating` field) or rate an existing image by URL (`/image/rate`).

Rating labels describe detected content. They do not override the [Mynth Terms of Service](https://mynth.io/legal/terms) or permit otherwise prohibited generation.

## Rating Modes

- Default: omit `mode`, or `{ "mode": "nsfw_sfw" }` — outputs `"sfw"` or `"nsfw"`
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
  url: "https://...",
  // mode optional — defaults to nsfw_sfw
});

result.level; // "sfw" | "nsfw"
result.url;
result.cost;
```

## Rate Existing Images (REST)

`POST /image/rate` — async only. Returns `201` with `taskId` and `estimatedCost`.

```json
{
  "url": "https://example.com/image.jpg"
}
```

Response (201):

```json
{
  "data": {
    "taskId": "tsk_...",
    "estimatedCost": "0.0002"
  }
}
```

Poll `/tasks/:id` for `{ "result": { "url": "...", "level": "sfw" } }` or use the `task.image.rate.completed` webhook. On failure the task is `failed`.
