# Destinations

Destinations deliver generated images directly to user-owned storage (S3, Cloudflare R2, or Bunny Storage) instead of (or alongside) the Mynth CDN. Use when the app must own its image storage, serve from its own CDN/domain, or avoid re-uploading from Mynth URLs.

## Use a Destination in Generation

Reference the destination by its slug:

```ts
await mynth.image.generate({
  model: "black-forest-labs/flux.2-pro",
  prompt: "A sunset",
  destination: "my-bucket",
});
```

Or set a default for all requests via `new Mynth({ destination: "my-bucket" })` or the `MYNTH_DESTINATION` env var. REST: `"destination": "my-bucket"` in the generate body.

Only `image.generate` and `image.remove_background` accept `destination`; video drops it silently. A name the user does not own fails at create with `400 VALIDATION_ERROR`.

Each delivered image has:

- `url`: the destination URL built from `url_template`, or `null` when the upload failed or no `url_template` is set
- `mynth_url`: always the Mynth CDN URL, served for 7 days

A failed upload does not fail the image or the task. On `image.generate` it shows only as `url: null` next to `mynth_url`, with no error attached. On `image.remove_background` the image also carries `destination`: `{ status: "success", name }` or `{ status: "failed", name, error: { code, message?, provider_response? } }`.

## Manage Destinations

Create in the dashboard or via API. The slug (`name`) is immutable after creation; lowercase letters, digits, and dashes only.

`POST /destinations`

```json
{
  "name": "my-bucket",
  "provider": { "id": "s3", "bucket": "my-bucket", "region": "us-east-1" },
  "secret": { "access_key_id": "...", "secret_access_key": "..." },
  "config": {
    "path_template": "images/{id}",
    "url_template": "https://cdn.my-domain.com/{path}"
  }
}
```

Provider shapes:

- S3: `{ "id": "s3", "bucket", "region", "endpoint?", "force_path_style?" }` with secret `{ access_key_id, secret_access_key }`
- R2: `{ "id": "r2", "account_id", "bucket", "jurisdiction?": "default" | "eu" | "fedramp" }` with secret `{ access_key_id, secret_access_key }`
- Bunny: `{ "id": "bunny", "storage_zone", "region?": "de" | "uk" | "ny" | "la" | "sg" | "se" | "br" | "jh" | "syd" }` with secret `{ password }`

`config.path_template` controls the object key, without the extension (Mynth appends `.webp`/`.png`/`.jpg`). Tokens: `{id}`, `{YYYY}`, `{MM}`, `{DD}`, `{ulid}`, `{uuid}`, `{uuidv4}`, `{uuidv7}`, `{meta.<key>}`. Include `{id}` or `{ulid}`, or images in one request overwrite each other. `config.url_template` (optional) builds the public `url` and must contain `{path}`. Without `url_template`, delivered images report `url: null` — read `mynth_url` instead.

All `/destinations` endpoints need an API key with the `manage` scope, or OAuth:

- `GET /destinations`, `GET /destinations/:id`
- `PUT /destinations/:id` — update `provider`, `config`, and optionally `secret` (slug cannot change)
- `DELETE /destinations/:id`
- `POST /destinations/:id/test` with `{ "path": "test/probe" }` — uploads a small WEBP probe to that exact path (no tokens, no extension) and answers `204`, or `502 DESTINATION_TEST_FAILED`

## CLI

Run `mynth auth login` first; the key it stores has the `manage` scope. Commands address destinations by `id` (see `list`), not the `name` slug. `create` also takes typed flags instead of `--file` (`--provider`, `--bucket`, `--path-template`, `--url-template`, `--secret <file|->`, ...); see `mynth destination create --help`.

```bash
mynth destination list [--json]
mynth destination get <id> [--json]
mynth destination create --file <path|-> [--json]   # JSON: { name, provider, config, secret }
mynth destination update <id> --file <path|-> [--json]  # JSON: { provider, config, secret? } (no name)
mynth destination test <id> [--path <path>] [--json]    # exit 0 = credentials valid
mynth destination delete <id> --yes [--json]
```

`create` validates the `name` slug client-side. `--file -` reads JSON from stdin. `delete` requires `--yes` (no prompt).
