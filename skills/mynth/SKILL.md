---
name: mynth
description: >
  Mynth unified image generation API. Use when working with image generation,
  adding image generation to an app, migrating to Mynth, switching between image
  providers, or setting up Mynth. Triggers on: "mynth", "image generation",
  "add image gen", "migrate to mynth", "switch to mynth", "multi-model image",
  "unified image API", "replace image provider".
---

# Mynth Image Generation

Mynth is a unified API for image generation across multiple models and providers.

## Guides

| Task                               | Reference                                                     |
| ---------------------------------- | ------------------------------------------------------------- |
| Analyze a repo for Mynth migration | [analyze-repo.md](references/analyze-repo.md)                 |
| Set up Mynth in a project          | [setup.md](references/setup.md)                               |
| Use the SDK (JS/TS with server)    | [sdk-usage.md](references/sdk-usage.md)                       |
| Use the REST API (non-JS, mobile)  | [rest-api.md](references/rest-api.md)                         |
| Use with Tanstack Start/AI         | [tanstack-ai.md](references/tanstack-ai.md)                   |
| Use with Convex                    | [convex.md](references/convex.md)                             |
| Client-side polling with PATs      | [public-access-tokens.md](references/public-access-tokens.md) |
| Set up webhooks                    | [webhooks.md](references/webhooks.md)                         |

## Choosing an Integration

1. **JS/TS repo with a server** → SDK (`@mynthio/sdk`)
2. **Non-JS or mobile** → REST API (see [OpenAPI spec](https://api.mynth.io/openapi))
3. **Tanstack Start or `@tanstack/ai`** → Tanstack adapter (`@mynthio/tanstack-ai-adapter`)
4. **Convex backend** → Convex helper (`@mynthio/sdk/convex`)

## How Mynth Works

1. **Submit** a generation request — returns a task ID and a PAT (public access token)
2. **Poll** task status and results from the browser using the PAT (CORS enabled)
3. **Sync** results to your database via webhooks

Mynth manages providers, retries, and processing internally. No queue infrastructure needed on your side.
