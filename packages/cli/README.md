# @mynthio/cli

Official [Mynth](https://mynth.io) CLI.

## Install

Globally:

```bash
npm install -g @mynthio/cli
# then
mynth --help
```

Or one-off via `npx`:

```bash
npx @mynthio/cli --help
```

## Usage

```bash
mynth image generate --prompt "A cinematic product photo of a glass keyboard"
mynth image generate -p "A watercolor city skyline" --size 16:9 --count 2
```

Run `mynth --help` for the full command list.

## Development

```bash
cd packages/cli
bun install
bun run dev -- --help   # run from sources
bun run build           # bundle to dist/bin.js
bun run test
bun run typecheck
```

Built on [Effect](https://effect.website) + [`@effect/cli`](https://github.com/Effect-TS/effect/tree/main/packages/cli).
