# Contributing

This is a Turborepo monorepo. CI, automated release PRs, GitHub Releases, and npm publishing are handled via GitHub Actions.

## Development

```bash
bun install
bun run lint        # turbo run lint (all packages)
bun run format:check
bun run typecheck
bun run test
bun run build
```

To work on a specific package:

```bash
cd packages/sdk
bun run test
bun run build
```

Open a pull request against `main`.

## Commit Message Rules (Required)

Releases are generated from commit messages, so commits must follow Conventional Commits.

Use one of these types:

- `feat:`
- `fix:`
- `docs:`
- `chore:`
- `refactor:`
- `perf:`
- `test:`
- `build:`
- `ci:`
- `style:`
- `revert:`

Examples:

```text
feat: add async polling retry backoff
fix(convex): handle missing webhook signature header
feat!: remove deprecated image output field
```

Notes:

- Optional scope is supported: `feat(api): ...`
- Breaking changes should use `!` (for example `feat!:`) and/or a `BREAKING CHANGE:` footer
- PR CI validates commit subjects and will fail on invalid commit messages

## Release Process (Maintainers)

This repository uses [Release Please](https://github.com/googleapis/release-please) with a commit-based changelog.

How it works:

1. Changes are merged into `main` with Conventional Commit messages.
2. The `Release` workflow runs and updates/creates a Release Please PR with:
   - patch version bumps for affected packages
   - per-package `CHANGELOG.md` updates
   - release notes draft content
3. When the Release Please PR is merged, the workflow creates GitHub Releases and tags (e.g. `sdk-v1.0.0`).
4. Each released package is published to npm in a separate matrix job.

Important:

- npm publishing uses GitHub Actions OIDC (trusted publishing) and the `npm` environment in GitHub Actions
- Release Please is configured to always publish patch bumps; Conventional Commits still drive changelog grouping and release notes
- If commits do not follow Conventional Commits, changelog quality will be degraded

## Pull Request Checklist

- CI passes
- Commit messages follow Conventional Commits
- User-facing changes include docs/README updates when needed
- Breaking changes are clearly marked
