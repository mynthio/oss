# Public Access Tokens (PAT)

PATs are short-lived JWTs scoped to one task. They are safe to send to browser code for polling, but not for creating tasks or reading other tasks.

## Flow

Server:

```ts
import { mynth } from "./mynth";

const taskAsync = await mynth.image.generateAsync({
  model: "black-forest-labs/flux.2-pro",
  prompt: "A sunset",
  generate_public_access_token: true,
});

// Send both to the client
const taskId = taskAsync.id;
const pat = taskAsync.access.publicAccessToken;
```

Browser:

```ts
const status = await fetch(`https://api.mynth.io/tasks/${taskId}/status`, {
  headers: { Authorization: `Bearer ${pat}` },
})
  .then((r) => r.json())
  .then((body) => body.data);

if (status.status === "completed") {
  const task = await fetch(`https://api.mynth.io/tasks/${taskId}/result`, {
    headers: { Authorization: `Bearer ${pat}` },
  })
    .then((r) => r.json())
    .then((body) => body.data);

  console.log(task.result.images); // check each image's `status`
}
```

`image.generateAsync()`, `image.removeBackgroundAsync()`, `image.upscaleAsync()`, and `video.generateAsync()` return a PAT; rate, alt, and review do not. Treat it as optional: if signing fails the task is still created without one, so fall back to server-side polling. A PAT is issued only when the request sets `generate_public_access_token: true` (default `false`); over REST it comes back as `data.public_access_token`. Leave it out when only server-side polling or webhooks are used.

## Safety

- PATs are scoped to a single task ID only
- Cannot access `GET /tasks/:id` (full details — API key only)
- Cannot access other tasks
- CORS allows browser calls on task status/result endpoints
- Expire one hour after they are issued (`401 token_expired`). Long video renders can outlive them; use a webhook or server-side polling for those
