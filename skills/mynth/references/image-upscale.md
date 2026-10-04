# Image Upscale

Enlarges an existing image 2x or 4x. Mynth picks the model, so the request has no `model` field and no prompt. Upscaling is in beta: the request shape is settled, but the models behind each effort may change.

## Upscale (SDK)

```ts
const result = await mynth.image.upscale({
  url: "https://example.com/product.jpg",
  size: "2x",
  effort: "low",
});

result.image.url; // destination URL, or the Mynth URL without a destination
result.image.mynthUrl;
result.image.format; // "png" | "jpg" | "webp"
result.image.width; // 2048
result.image.height; // 1536
result.cost;
```

`size` and `effort` are both required:

- `size`: `"2x"` or `"4x"`, or `{ type: "scale", factor: 2 | 4 }`.
- `effort`: `"low"` is fast and sharp, for product shots and images that are already clean. `"high"` rebuilds fine detail such as small text, skin, and fur. It sets the price, so there is no default. Do not pick it for the user; `high` can also change a person's likeness on old or damaged photos.

The upscaled image can be at most 4096x4096 pixels. A larger request is accepted at create, then the task fails with `OUTPUT_TOO_LARGE` and is not charged. Read `result.image.size` for the real dimensions; they can be a few pixels off the source times the factor.

The result keeps the format the provider returned. Set `output.format` to always get `png`, `jpg`, or `webp`. The request also takes a local `file`, `destination`, `webhook`, and `metadata`, the same as `generate()`:

```ts
const result = await mynth.image.upscale({
  file,
  size: "4x",
  effort: "high",
  output: { format: "webp" },
  destination: "bunny-prod",
  metadata: { productId: "sku_1" },
});

result.metadata.productId;
```

Use `upscaleAsync()` to create the task now and wait later. It returns a Public Access Token for browser polling:

```ts
const taskAsync = await mynth.image.upscaleAsync({
  url: "https://example.com/product.jpg",
  size: "2x",
  effort: "low",
});

return { id: taskAsync.id, access: taskAsync.access };
```

## Upscale (REST)

`POST /image/upscale` — async only. Returns `201` with `taskId`, `estimatedCost`, and a PAT unless `access.pat.enabled` is `false`.

```json
{
  "url": "https://example.com/product.jpg",
  "size": "2x",
  "effort": "low",
  "output": { "format": "png" }
}
```

Response (201):

```json
{
  "data": {
    "taskId": "tsk_...",
    "estimatedCost": "0.03",
    "access": { "publicAccessToken": "pat_..." }
  }
}
```

Poll `/tasks/:id` for the result, or use the `task.image.upscale.completed` webhook. On failure the task is `failed`.

```json
{
  "result": {
    "image": {
      "id": "img_...",
      "url": "https://cdn.mynth.io/...",
      "mynth_url": "https://cdn.mynth.io/...",
      "size": "2048x1536",
      "format": "png"
    }
  }
}
```

A failed destination upload sets `image.url` to `null`; `image.mynth_url` (`image.mynthUrl` in the SDK) is always set.
