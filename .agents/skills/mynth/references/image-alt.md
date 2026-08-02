# Image Alt Text

AI-generated short alt text for an existing image URL. Use this for accessibility labels, image inventories, and generated-content metadata.

## Generate Alt Text (SDK)

```ts
const result = await mynth.image.alt({
  url: "https://example.com/image.jpg",
});

result.alt;
result.url;
result.cost;
```

Use `altAsync()` when you want to create the task now and wait later.

```ts
const taskAsync = await mynth.image.altAsync({
  url: "https://example.com/image.jpg",
});

const result = await taskAsync.wait();
console.log(result.alt);
```

## Generate Alt Text (REST)

`POST /image/alt` — async only. Returns `201` with `taskId` and `estimatedCost`.

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
    "estimatedCost": "0.0004"
  }
}
```

Poll `/tasks/:id` for `{ "result": { "url": "...", "alt": "..." } }` or use the `task.image.alt.completed` webhook. On failure the task is `failed`.
