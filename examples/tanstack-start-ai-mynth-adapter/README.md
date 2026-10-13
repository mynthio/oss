# TanStack Start AI + Mynth Adapter Demo

This example is a minimal image-generation app built around the official TanStack AI streaming pattern from the [Image Generation guide](https://tanstack.com/ai/latest/docs/media/image-generation):

- Server route: `generateImage({ ..., stream: true })` + `toServerSentEventsResponse(...)`
- Client hook: `useGenerateImage({ connection: fetchServerSentEvents(...) })`

The UI is intentionally tiny:

- one textarea for the prompt
- one model selector built from `MYNTH_IMAGE_MODELS` and the display names in `MYNTH_IMAGE_MODEL_META`
- one image per request
- one grid that accumulates generated images in `localStorage`

## Local package wiring

The example uses the adapter from this repo through the pnpm workspace:

```json
{
  "@mynthio/tanstack-ai-adapter": "workspace:*"
}
```

Build the adapter once before starting the app, from the repo root: `pnpm build`.

## Environment

Set your Mynth API key before running the app, in the shell or in `.env.local`:

```bash
MYNTH_API_KEY=mak_your_key_here
```

## Run

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```

## Files to look at

- `src/routes/index.tsx` for the shadcn UI and `useGenerateImage`
- `src/routes/api/generate/image.ts` for the streaming route, which validates the requested model with `isMynthImageModel`
