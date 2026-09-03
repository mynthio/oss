# @mynthio/cli

Official [Mynth](https://mynth.io) CLI: generate, analyze, and deliver images from your terminal,
your CI, or an agent.

## Install

```bash
npm install -g @mynthio/cli
mynth --help
```

Or run it once without installing:

```bash
npx @mynthio/cli --help
```

## Authentication

Three sources, in precedence order:

```bash
export MYNTH_API_KEY=mak_...   # 1. environment — wins over everything below
mynth config set api-key -     # 2. stored key (reads stdin), kept in the system keychain
mynth auth login               # 3. OAuth device login
```

`mynth auth status` reports how this machine is authenticated without calling the API.
`mynth whoami` verifies the credentials against the API and prints the key's scopes and spending
limit, so a revoked key fails there rather than mid-run.

Credentials go to the system keychain when one is available, and otherwise to a `0600` file under
`$XDG_CONFIG_HOME/mynth`. Set `MYNTH_NO_KEYCHAIN=1` to force the file (useful in containers).

## Generating images

```bash
mynth image generate -p "A cinematic product photo of a glass keyboard"
mynth image generate -p "A watercolor city skyline" --size 16:9 --count 2 -o ./out
mynth image generate -p "A neon koi pond" --magic-prompt --format png
```

| Flag                      | Purpose                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `-p, --prompt`            | Prompt. Optional: some models (virtual try-on) work best from inputs alone.                                         |
| `-n, --negative`          | Negative prompt.                                                                                                    |
| `--magic-prompt`          | Let Mynth expand the prompt before generating. Off by default.                                                      |
| `-m, --model`             | Model ID. Defaults to `auto`. See `mynth models list`.                                                              |
| `-s, --size`              | Preset or aspect ratio: `square`, `landscape`, `16:9`, `16:9_4k`, `auto`, …                                         |
| `-c, --count`             | Images per request.                                                                                                 |
| `-f, --format`            | `png`, `jpg`, or `webp`.                                                                                            |
| `-i, --input`             | Input image as `[role:]path-or-url`, repeatable. Roles: `auto`, `person`, `garment`, `pose`, `source`, `reference`. |
| `-o, --output-dir`        | Download the results into this directory.                                                                           |
| `--destination`           | Deliver to a configured storage destination. Defaults to `MYNTH_DESTINATION`.                                       |
| `--content-rating`        | Classify each image `sfw`/`nsfw`. Use `--level` for custom levels.                                                  |
| `--webhook-url`           | Deliver this task's events to a URL (repeatable).                                                                   |
| `--no-dashboard-webhooks` | Skip dashboard-configured webhooks for this task.                                                                   |
| `--metadata`              | Inline JSON attached to the task.                                                                                   |

Local paths passed to `-i` are uploaded first; `https://` inputs are used as-is.

### Cost before you spend it

```bash
mynth balance                                              # balance, reserved, available, key limit
mynth image generate -p "A neon koi pond" -c 10 --dry-run   # validate + price, generate nothing
```

Estimates for `--model auto` are an upper bound. Add `--json` to either command for machine-readable
output.

## Analyzing images

Every analysis command takes one URL or one local file, and waits for the result:

```bash
mynth image rate https://cdn.example.com/product.webp
mynth image rate ./shot.png -l kids="Safe for children" -l adults="Adults only"
mynth image alt ./product.webp --json
mynth image review ./shot.png             # score 1-4, findings, strengths
mynth image review ./shot.png --effort low  # faster, cheaper triage panel
```

Custom rating levels come from repeated `--level value=description`, `--levels-file`, or
`--levels-json` — one source at a time, 2 to 7 levels.

## Tasks

Fire a generation, do other work, then collect the result:

```bash
task_id=$(mynth image generate -p "A neon koi pond" --async --json | jq -r .taskId)
mynth task wait "$task_id" --json      # blocks; prints the same shape as a sync generate
mynth task wait "$task_id" --timeout 600
mynth task get "$task_id"              # fetch once
mynth task result "$task_id"           # just the result payload
mynth task list --limit 10             # newest first
mynth task list --after tsk_...        # next page
```

`--async --json` also returns a short-lived public access token, so browser or CI code can poll the
task without your API key.

`task wait` exits non-zero when the task fails or the timeout is hit.

## Destinations

Deliver generated images straight to your own storage. Secrets are read from a file or stdin, never
from the command line, so they stay out of shell history and `ps`.

```bash
# Bunny — a single-field secret may be passed bare
printf 'my-storage-password' | mynth destination create bunny-prod \
  --provider bunny --storage-zone my-zone --region de \
  --path-template 'images/{id}' --url-template 'https://cdn.example.com/{path}' \
  --secret -

# S3 or R2 — JSON secret
mynth destination create s3-prod \
  --provider s3 --bucket my-bucket --region us-east-1 \
  --path-template 'images/{id}' --secret ./s3-secret.json

mynth destination test dst_...        # verify credentials with a probe upload
mynth destination list
mynth destination delete dst_... --yes
```

`--file <path|->` still accepts a complete JSON body instead of the typed flags.
Then use it: `mynth image generate -p "..." --destination bunny-prod`.

## Webhooks

```bash
mynth webhook create --url https://example.com/hooks/mynth -e task.completed -e task.failed
mynth webhook create --url https://example.com/hooks/mynth -e all --api-key-id key_...
mynth webhook delete whk_... --yes
```

The signing secret is printed once, on create, and cannot be retrieved again.

By default a webhook only receives tasks created with an **API key** — that matches where webhooks
are actually consumed, on a server. Pass `--oauth-events` to also receive tasks created by OAuth
sessions (this CLI, the playground).

## Documentation

```bash
mynth docs get guides/async-and-polling
mynth docs list
mynth docs get reference/webhooks --json
```

Paths take an optional leading slash and must not include the `.md` suffix. Documentation commands
need no authentication.

## Exit codes

Distinct exit codes so scripts and agents can branch without parsing error messages:

| Code | Meaning                                                              |
| ---- | -------------------------------------------------------------------- |
| 0    | Success                                                              |
| 1    | Error (network, server, or unexpected failure)                       |
| 2    | Usage error (invalid arguments, flags, or request)                   |
| 3    | Authentication error (missing, invalid, or under-scoped credentials) |
| 4    | Insufficient credits (account balance or API key spending limit)     |
| 5    | Blocked by content moderation                                        |
| 6    | Rate limited                                                         |

`task wait` reports the awaited task's outcome the same way: a moderation block exits 5, any other
failure exits 1.

## Environment

| Variable              | Effect                                                     |
| --------------------- | ---------------------------------------------------------- |
| `MYNTH_API_KEY`       | API key; takes precedence over stored credentials          |
| `MYNTH_DESTINATION`   | Default `--destination` for image generation               |
| `MYNTH_DEBUG=1`       | Print stack traces and error causes to stderr              |
| `MYNTH_NO_KEYCHAIN=1` | Store credentials in a file instead of the system keychain |
| `MYNTH_API_URL`       | Override the API base URL                                  |
| `MYNTH_DOCS_URL`      | Override the documentation base URL                        |

## Development

```bash
cd packages/cli
bun install
bun run dev -- --help   # run from source
bun run build           # bundle to dist/bin.js
bun run test
bun run typecheck
```

### Layout

```
src/
  bin.ts          entry point: parse argv, map errors to exit codes
  program.ts      command tree and help formatting
  app.ts          the config/session/api/docs bundle every command receives
  config.ts       environment and build-time constants
  errors.ts       error types and the exit-code contract
  api/            one module per API resource, over a shared fetch client
  auth/           credential storage, OAuth device flow, session resolution
  commands/       one module per command; they only orchestrate
  output/         printing, tables, spinners, and shared result renderers
  utils/          parsing, file, download, and concurrency helpers
```

Commands hold argument parsing and rendering; `api/` holds the wire format; nothing in `api/` knows
about Commander. Built with [`commander`](https://github.com/tj/commander.js),
[`chalk`](https://github.com/chalk/chalk), [`ora`](https://github.com/sindresorhus/ora), and
[`zod`](https://github.com/colinhacks/zod).
