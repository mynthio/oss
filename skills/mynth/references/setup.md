# Set Up Mynth

Use this for a JS/TS app with server-side code.

```bash
bun add @mynthio/sdk
```

```env
MYNTH_API_KEY=mak_...
```

Create a small server-only client module:

```ts
import Mynth from "@mynthio/sdk";

export const mynth = new Mynth();
```

The SDK reads `MYNTH_API_KEY` automatically. Pass `{ apiKey, baseUrl }` only when the project already centralizes secrets or needs a proxy/test base URL.

Do not expose the API key to browser code. For browser polling, start the task on the server and return the task ID plus `task.access.publicAccessToken`; see [public-access-tokens.md](public-access-tokens.md).
