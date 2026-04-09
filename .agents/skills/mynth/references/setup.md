# Set Up Mynth

## Installation

```bash
# bun
bun add @mynthio/sdk

# pnpm
pnpm add @mynthio/sdk

# npm
npm install @mynthio/sdk
```

## Create SDK Instance

Create a `mynth.ts` file that exports the SDK instance:

```ts
import Mynth from "@mynthio/sdk";

export const mynth = new Mynth();
```

The client reads `MYNTH_API_KEY` from the environment automatically.

## API Key

1. Create an account at [mynth.io](https://mynth.io)
2. Generate an API key (prefix: `mak_`)
3. Set the environment variable:

```env
MYNTH_API_KEY=mak_...
```

## Verify

```ts
import { mynth } from "./mynth";

const task = await mynth.image.generate({ prompt: "a test image" });
console.log(task.urls); // should print image URLs
```
