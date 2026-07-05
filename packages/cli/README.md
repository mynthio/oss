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

### Tasks

Async workflows: fire a generation with `--async`, do other work, then wait for the result.

```bash
task_id=$(mynth image generate -p "A neon koi pond" --async --json | jq -r .taskId)
mynth task wait "$task_id" --json          # blocks until completed/failed, prints like sync generate
mynth task wait "$task_id" --timeout 600   # wait up to 10 minutes (default: 300s)
mynth task get "$task_id"                  # fetch once, no waiting
mynth task list --limit 10                 # recent tasks, newest first
mynth task list --after tsk_...            # next page: tasks created before that ID
```

`task wait` exits non-zero if the task fails or the timeout is reached.

### Documentation

Fetch one page as Markdown or retrieve the complete documentation index:

```bash
mynth docs get guides/async-and-polling
mynth docs list
```

Add `--json` to any documentation command for machine-readable output:

```bash
mynth docs get reference/webhooks --json
mynth docs list --json
```

`docs get` accepts a documentation path with an optional leading slash. Do not include the `.md`
suffix. Documentation commands do not require Mynth authentication.

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

Built with focused TypeScript CLI libraries: [`commander`](https://github.com/tj/commander.js),
[`chalk`](https://github.com/chalk/chalk), [`ora`](https://github.com/sindresorhus/ora), and
[`zod`](https://github.com/colinhacks/zod).
