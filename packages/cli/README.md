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

The CLI always authenticates with an API key. `auth login` is a convenience that creates one for
you:

```bash
mynth auth login                            # browser login, then creates and stores an API key
mynth auth login --scopes generate,manage   # narrow the created key
mynth config set api-key -                  # or store a key you already have, from stdin
export MYNTH_API_KEY=mak_...                # or supply one per-process; wins over a stored key
```

`auth login` opens a device login, then exchanges that short-lived session for a long-lived API key
named `mynth-cli (hostname)`. **Only the API key is stored** — no OAuth tokens ever reach disk.

Your browser is opened automatically when the CLI is running interactively on a desktop. It is not
opened over SSH, in CI, in a container, or when output is piped — the login URL is always printed as
well, so those cases still work. `--no-browser` disables it outright.

This matters for unattended use. A browser session expires (7 days, or 2 days idle) and its refresh
token rotates on every use, which races when several commands run at once. An API key does neither,
and it can be inspected, limited, or revoked from the [dashboard](https://mynth.io/dashboard).

Since the key does not expire, set a spending limit on it in the dashboard if it will live on a
shared or long-lived machine.

```bash
mynth auth status    # how this machine is authenticated; no API call
mynth whoami         # verified against the API, so a revoked key fails here not mid-run
mynth auth logout    # revokes the key it created, then clears the file
```

Credentials live in `$XDG_CONFIG_HOME/mynth/credentials.json` (default `~/.config`), written `0600`.
The file holds the key and its id, nothing else — a key's name, scopes and spending limit can be
changed in the dashboard at any time, so `whoami` reads them live rather than caching a copy that
could disagree. `auth logout` revokes keys the CLI created; a key you supplied yourself is only
removed locally.

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

## API keys

`auth login` creates a key for the machine you're on. For an app or a deploy target, create one
explicitly:

```bash
mynth api-key create my-app                       # generate scope
mynth api-key create my-app --json | jq -r .key   # capture it for a .env
mynth api-key list
mynth api-key delete key_... --yes
```

The key is printed once and cannot be retrieved again.

Keys created from the CLI only get the `generate` scope. That's what an app needs to call the image
API; `manage` and `keys` have to come from the
[dashboard](https://mynth.io/dashboard), because the API refuses scope escalation from a CLI
session. Registering webhooks and destinations for that app is done with _your_ credentials, so the
app's key doesn't need `manage`.

Set a spending limit on app keys in the dashboard — it's the cheapest way to bound a leaked key.

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
  auth/           credential file, device login, API key minting
  commands/       one module per command; they only orchestrate
  output/         printing, tables, spinners, and shared result renderers
  utils/          parsing, file, download, and concurrency helpers
```

Commands hold argument parsing and rendering; `api/` holds the wire format; nothing in `api/` knows
about Commander. Built with [`commander`](https://github.com/tj/commander.js),
[`chalk`](https://github.com/chalk/chalk), [`ora`](https://github.com/sindresorhus/ora), and
[`zod`](https://github.com/colinhacks/zod).
