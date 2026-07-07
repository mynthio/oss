# Image Alt Text

AI-generated short alt text for existing image URLs. Use this for accessibility labels, image inventories, and generated-content metadata.

## Generate Alt Text (SDK)

```ts
const result = await mynth.image.alt({
  urls: ["https://example.com/image.jpg"], // 1-10 URLs
});

result.getAltTexts(); // [{ status: "success", url: "...", alt: "..." }]
result.getErrors(); // failed items with error codes
```

Use `altAsync()` when you want to create the task now and wait later.

```ts
const taskAsync = await mynth.image.altAsync({
  urls: ["https://example.com/image.jpg"],
});

const result = await taskAsync.wait();
console.log(result.results);
```

## Generate Alt Text (REST)

`POST /image/alt` - synchronous by default.

```json
{
  "urls": ["https://example.com/image.jpg"],
  "sync": true
}
```

Response (200, completed):

```json
{
  "data": {
    "task": { "id": "tsk_...", "status": "completed", "cost": "0.01" },
    "results": [{ "status": "success", "url": "https://...", "alt": "A concise image description." }]
  }
}
```

With `"sync": false` (or if the sync wait times out), responds 202 with `{ "data": { "task": { "id": "tsk_...", "status": "pending" } } }`; poll `/tasks/:id/result` or use the `task.image.alt.completed` webhook.
