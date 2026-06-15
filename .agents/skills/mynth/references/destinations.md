# Destinations

Destinations deliver generated images directly to user-owned storage (S3, Cloudflare R2, or Bunny Storage) instead of (or alongside) the Mynth CDN. Use when the app must own its image storage, serve from its own CDN/domain, or avoid re-uploading from Mynth URLs.

## Use a Destination in Generation

Reference the destination by its slug:

```ts
await mynth.image.generate({
  prompt: "A sunset",
  destination: "my-bucket",
});
```

Or set a default for all requests via `new Mynth({ destination: "my-bucket" })` or the `MYNTH_DESTINATION` env var. REST: `"destination": "my-bucket"` in the generate body.

In results, each image gets a `destination` field — `{ status: "success", name }` or `{ status: "failed", name, error: { code, message?, provider_response? } }` — plus:

- `url`: the destination URL built from `url_template`, or `null` when no `url_template` is set
- `mynth_url`: always the Mynth CDN URL

Delivery failure does not fail the generation task; check `destination.status` per image.

## Manage Destinations

Create in the dashboard or via API. The slug (`name`) is immutable after creation; lowercase letters, digits, and dashes only.

`POST /destinations`

```json
{
  "name": "my-bucket",
  "provider": { "id": "s3", "bucket": "my-bucket", "region": "us-east-1" },
  "secret": { "access_key_id": "...", "secret_access_key": "..." },
  "config": {
    "path_template": "/images/{id}",
    "url_template": "https://cdn.my-domain.com/{path}"
  }
}
```

Provider shapes:

- S3: `{ "id": "s3", "bucket", "region", "endpoint?", "force_path_style?" }` with secret `{ access_key_id, secret_access_key }`
- R2: `{ "id": "r2", "account_id", "bucket", "jurisdiction?": "default" | "eu" | "fedramp" }` with secret `{ access_key_id, secret_access_key }`
- Bunny: `{ "id": "bunny", "storage_zone", "region?": "de" | "uk" | "ny" | "la" | "sg" | "se" | "br" | "jh" | "syd" }` with secret `{ password }`

`config.path_template` controls the object path; `config.url_template` (optional) builds the public `url` and must contain `{path}`. Without `url_template`, delivered images report `url: null` — read `mynth_url` instead.

Other endpoints (API key auth):

- `GET /destinations`, `GET /destinations/:id`
- `PUT /destinations/:id` — update `provider`, `config`, and optionally `secret` (slug cannot change)
- `DELETE /destinations/:id`
- `POST /destinations/:id/test` with `{ "path": "test/upload.txt" }` — verifies credentials by uploading a test file
