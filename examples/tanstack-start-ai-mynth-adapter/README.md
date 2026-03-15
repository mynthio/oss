# TanStack Start AI + Mynth Adapter Demo

This example is a minimal image-generation app built around the official TanStack AI streaming pattern from the [Image Generation guide](https://tanstack.com/ai/latest/docs/guides/image-generation.md):

- Server route: `generateImage({ ..., stream: true })` + `toServerSentEventsResponse(...)`
- Client hook: `useGenerateImage({ connection: fetchServerSentEvents(...) })`

The UI is intentionally tiny:

- one textarea for the prompt
- one model selector sourced from `MYNTH_IMAGE_MODELS`
- one image per request
- one grid that accumulates generated images

## Local package wiring

This example installs the OSS packages from the local repo instead of npm:

```json
{
  "@mynthio/sdk": "file:../../packages/sdk",
  "@mynthio/tanstack-ai-adapter": "file:../../packages/tanstack-ai-adapter"
}
```

## Environment

Set your Mynth API key before running the app:

```bash
export MYNTH_API_KEY=mak_your_key_here
```

## Run

```bash
bun install
bun --bun run dev
```

## Build

```bash
bun --bun run build
```

## Test

```bash
bun --bun run test
```

## Files to look at

- `src/routes/index.tsx` for the shadcn UI and `useGenerateImage`
- `src/routes/api/generate/image.ts` for the streaming route
- `src/lib/image-demo.ts` for the small image helpers used by the UI and tests
