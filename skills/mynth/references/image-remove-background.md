# Image Remove Background

Removes the background from an existing image and returns a transparent image. Mynth picks the model, so the request has no `model` field. Use this for product cutouts, catalog images, and design assets.

## Remove Background (SDK)

```ts
const result = await mynth.image.removeBackground({
  url: "https://example.com/product.jpg",
});

result.image.url; // destination URL, or the Mynth URL without a destination
result.image.mynthUrl;
result.image.format; // "png" | "webp"
result.image.width; // 1024
result.image.height; // 768
result.cost;
```

The result keeps the format the provider returned. Set `output.format` to always get `png` or `webp`; `jpg` is not accepted because it has no transparency. The request also takes a local `file`, `destination`, `webhook`, and `metadata`, the same as `generate()`:

```ts
const result = await mynth.image.removeBackground({
  file,
  output: { format: "webp" },
  destination: "bunny-prod",
  metadata: { productId: "sku_1" },
});

result.metadata.productId;
```

Use `removeBackgroundAsync()` to create the task now and wait later. With `generate_public_access_token: true` it also returns a Public Access Token for browser polling:

```ts
const taskAsync = await mynth.image.removeBackgroundAsync({
  url: "https://example.com/product.jpg",
  generate_public_access_token: true,
});

return { id: taskAsync.id, token: taskAsync.access.publicAccessToken };
```

## Remove Background (REST)

`POST /image/remove-background` — async only. Returns `201` with `task_id`, `estimated_cost`, and `public_access_token` when the request sets `generate_public_access_token: true`.

```json
{
  "url": "https://example.com/product.jpg",
  "output": { "format": "png" },
  "generate_public_access_token": true
}
```

Response (201):

```json
{
  "data": {
    "task_id": "tsk_...",
    "estimated_cost": "0.02",
    "public_access_token": "pat_..."
  }
}
```

Poll `/tasks/:id` for the result, or use the `task.image.remove_background.completed` webhook. On failure the task is `failed`.

```json
{
  "result": {
    "image": {
      "id": "img_...",
      "url": "https://cdn.mynth.io/...",
      "mynth_url": "https://cdn.mynth.io/...",
      "size": "1024x768",
      "format": "png"
    }
  }
}
```

A failed destination upload sets `image.url` to `null`; `image.mynth_url` (`image.mynthUrl` in the SDK) is always set.
