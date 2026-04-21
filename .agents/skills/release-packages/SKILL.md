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

Before releasing any package, run the repo-level preparation first:

```bash
bun install
bun run format
```

`bun install` keeps `bun.lock` in sync before committing, and `bun run format` should fix normal formatting drift instead of pausing on a check-only failure. If either command fails, stop and report the failure.

Then run ALL of the following checks for that package from the repo root using `--filter` to target the specific package.

```bash
bun run --filter <package-name> build
bun run --filter <package-name> test
bun run --filter <package-name> typecheck
```

Additionally, run the root-level lint check (this covers the entire repo):

```bash
bun run lint
```

**If any command fails, stop immediately and report the failure to the user. Do not proceed with the release.**

If `bun install` or `bun run format` changes files outside the package currently being released, leave those changes for their own package or directory step. `bun.lock` is the exception: include it with the current package commit when it changed because of that package's release preparation.

## Release Order

Always follow this sequence. Do not skip steps.

### 1. Release SDK (if dirty)

Check if `packages/sdk/` has uncommitted changes:

```bash
git status --porcelain packages/sdk/
```

If dirty:

1. **Run repo-level preparation, then pre-release checks** for `@mynthio/sdk`:
   ```bash
   bun install
   bun run format
   bun run --filter @mynthio/sdk build
   bun run --filter @mynthio/sdk test
   bun run --filter @mynthio/sdk typecheck
   bun run lint
   ```
   All must pass. If any fail, stop and report the failure.

2. Stage files within `packages/sdk/`, plus `bun.lock` if it changed:
   ```bash
   git add packages/sdk/
   git add bun.lock
   ```
3. Create a commit using the [git-commit skill](../git-commit/SKILL.md). Analyze the diff to produce a good conventional commit message with `sdk` scope (e.g. `feat(sdk): add new image model support`). The commit message becomes part of the changelog, so make it meaningful.
4. Push:
   ```bash
   git push
   ```

Do not stage any other directory at this stage.

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
3. **Update lockfile and format** — run `bun install` to sync `bun.lock` with the new dependency version, then format the codebase:
   ```bash
   bun install
   bun run format
   ```
4. **Run pre-release checks** for `@mynthio/tanstack-ai-adapter` — these run AFTER the SDK version update so we validate against the newest SDK:
   ```bash
   bun run --filter @mynthio/tanstack-ai-adapter build
   bun run --filter @mynthio/tanstack-ai-adapter test
   bun run --filter @mynthio/tanstack-ai-adapter typecheck
   bun run lint
   ```
   All must pass. If any fail, stop and report the failure.
5. Stage all changes in `packages/tanstack-ai-adapter/` (both the user's code changes and the dependency bump), plus `bun.lock` if it changed:
   ```bash
   git add packages/tanstack-ai-adapter/
   git add bun.lock
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

1. Run repo-level preparation:
   ```bash
   bun install
   bun run format
   ```
   If either command changes files outside the directory currently being released, leave those changes for their own package or directory step. Include `bun.lock` with the current directory commit only if it changed because of that directory's release preparation.
2. Stage only that directory's files, plus `bun.lock` if it belongs to this directory's release:
   ```bash
   git add <directory>/
   git add bun.lock
   ```
3. Commit using git-commit skill
4. Push

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

- Never stage or commit files outside the target directory for a given step, except root `bun.lock` when it changed because of the current package or directory release preparation
- Always push after committing — unreleased commits defeat the purpose
- If `git pull` causes merge conflicts, stop and ask the user to resolve them
- Do not force push
- Never proceed if pre-release checks fail
- Never skip the GitHub release confirmation step
