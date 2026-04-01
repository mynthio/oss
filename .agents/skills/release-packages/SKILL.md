---
name: release-packages
description: 'Release packages in the correct order by creating appropriate commits and pushing. Use when the user says to release, publish, deploy packages, ship changes, release sdk, release adapter, or mentions releasing anything in this monorepo. Handles the dependency order: SDK must be released first, then tanstack-adapter (which updates its SDK dependency), then other directories. Each sub-project gets its own commit with a conventional commit message.'
---

# Release Packages

Release packages in this monorepo in the correct dependency order. The SDK (`packages/sdk/`) is the foundation — other packages depend on it. Respect this ordering to avoid broken references.

## Repository Structure

| Directory | Package | Depends On |
| --- | --- | --- |
| `packages/sdk/` | `@mynthio/sdk` | nothing |
| `packages/tanstack-ai-adapter/` | `@mynthio/tanstack-ai-adapter` | `@mynthio/sdk` |
| `examples/` | non-packages | — |

## Pre-Release Checks

Before releasing any package, ALL of the following must pass for that package. Run them from the repo root using `--filter` to target the specific package.

```bash
bun run --filter <package-name> build
bun run --filter <package-name> test
bun run --filter <package-name> typecheck
```

Additionally, run the root-level lint and format checks (these cover the entire repo):

```bash
bun run lint
bun run format:check
```

**If any command fails, stop immediately and report the failure to the user. Do not proceed with the release.**

## Release Order

Always follow this sequence. Do not skip steps.

### 1. Release SDK (if dirty)

Check if `packages/sdk/` has uncommitted changes:

```bash
git status --porcelain packages/sdk/
```

If dirty:

1. **Run pre-release checks** for `@mynthio/sdk`:
   ```bash
   bun run --filter @mynthio/sdk build
   bun run --filter @mynthio/sdk test
   bun run --filter @mynthio/sdk typecheck
   bun run lint
   bun run format:check
   ```
   All must pass. If any fail, stop and report the failure.

2. Stage only files within `packages/sdk/`:
   ```bash
   git add packages/sdk/
   ```
3. Create a commit using the [git-commit skill](../git-commit/SKILL.md). Analyze the diff to produce a good conventional commit message with `sdk` scope (e.g. `feat(sdk): add new image model support`). The commit message becomes part of the changelog, so make it meaningful.
4. Push:
   ```bash
   git push
   ```

Do not touch any other directory at this stage.

### 2. Wait for SDK GitHub Release

After pushing the SDK commit, **stop and tell the user to finish the release in GitHub** (publish the package, create a release, etc.). Wait for the user to manually confirm that the SDK release is complete before continuing to the next step.

### 3. Release Tanstack AI Adapter (if dirty)

Check if `packages/tanstack-ai-adapter/` has uncommitted changes:

```bash
git status --porcelain packages/tanstack-ai-adapter/
```

If dirty:

1. **Fetch and pull** to get the latest state (the SDK release may have changed `package.json` version on remote):
   ```bash
   git fetch origin
   git pull origin $(git branch --show-current)
   ```
2. **Update SDK dependency** — read the current version of `@mynthio/sdk` from `packages/sdk/package.json` and update the `dependencies.@mynthio/sdk` field in `packages/tanstack-ai-adapter/package.json` to match. This ensures the adapter pins to the latest published SDK version.
3. **Update lockfile** — run `bun install` to sync `bun.lock` with the new dependency version:
   ```bash
   bun install
   ```
4. **Run pre-release checks** for `@mynthio/tanstack-ai-adapter` — these run AFTER the SDK version update so we validate against the newest SDK:
   ```bash
   bun run --filter @mynthio/tanstack-ai-adapter build
   bun run --filter @mynthio/tanstack-ai-adapter test
   bun run --filter @mynthio/tanstack-ai-adapter typecheck
   bun run lint
   bun run format:check
   ```
   All must pass. If any fail, stop and report the failure.
5. Stage all changes in `packages/tanstack-ai-adapter/` (both the user's code changes and the dependency bump):
   ```bash
   git add packages/tanstack-ai-adapter/
   ```
6. Create a commit using the [git-commit skill](../git-commit/SKILL.md) with `tanstack-ai-adapter` scope. If the only change is the SDK version bump, use `build(tanstack-ai-adapter): update @mynthio/sdk dependency`. If there are code changes too, describe the primary change and mention the dependency update in the body.
7. Push:
   ```bash
   git push
   ```

### 4. Wait for Adapter GitHub Release

After pushing the adapter commit, **stop and tell the user to finish the release in GitHub**. Wait for confirmation before continuing.

### 5. Release other directories (if dirty)

For any other directories with uncommitted changes (e.g. `examples/`), commit each sub-project separately. Use the [git-commit skill](../git-commit/SKILL.md) with an appropriate scope matching the directory name.

Check for dirty non-package directories:

```bash
git status --porcelain -- ':!packages/'
```

For each dirty directory found:

1. Stage only that directory's files:
   ```bash
   git add <directory>/
   ```
2. Commit using git-commit skill
3. Push

Do not combine changes from different sub-projects into a single commit.

## Commit Message Quality

Commit messages are used in changelogs. Follow Conventional Commits format:

```
<type>(<scope>): <description>
```

- Use present tense, imperative mood ("add feature" not "added feature")
- Keep description under 72 characters
- The scope should match the package or directory name
- Reference the git-commit skill for full details on types and best practices

## Safety Rules

- Never stage or commit files outside the target directory for a given step
- Always push after committing — unreleased commits defeat the purpose
- If `git pull` causes merge conflicts, stop and ask the user to resolve them
- Do not force push
- Never proceed if pre-release checks fail
- Never skip the GitHub release confirmation step
