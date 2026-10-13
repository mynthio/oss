---
name: release-packages
description: "Release packages by creating appropriate commits and pushing. Use when the user says to release, publish, deploy packages, ship changes, release sdk, release adapter, release cli, or mentions releasing anything in this monorepo. Every package (SDK, CLI, TanStack AI adapter) is independent and releases on its own; each sub-project gets its own commit with a conventional commit message."
---

# Release Packages

Release the packages in the repository.

# Before

Run the lint and test checks for packages you're releasing in that batch. Run the format command to format packages before release.

# Independence

Packages do not depend on each other, so they release in parallel and in any order. None of them waits for another to be published first. Do not add a dependency between packages to share code.

# Release process

Create commits following conventional commit patterns. Note that changelogs are generated form commits, include useful changelog information if it makes sense. Each package should have it's own commits, do not commit more than one package changes in single commit.

Push commits straight to main, if not instructed differently in user prompt.

This will trigger release please pipelines.

Using `gh` CLI you have all the rights to finish the release process, including merge and approvals. Use it to check the pipeline status. If all pipelines are sucesfull, finish the release process by merging the PRs and waiting for release to happen. Verify that all passed and new version is published to npm.

Always pull latest changes to keep repo in sync after merges.

# Tanstack Adapter

The adapter calls the Mynth API itself and keeps its own model table (`src/model-meta.ts`). Before releasing it, run `pnpm --filter @mynthio/tanstack-ai-adapter check:models`. It compares the table with the live catalog at `https://api.mynth.io/models`. When it reports a difference, stop and report it to the user rather than editing the adapter: the package must not be changed without explicit instructions.

A change to the API that the adapter uses (request fields, task responses, errors) needs an adapter change too, as it does for the SDK.

# Rest of the changes

Skills, or README changes does not need a release process. For this changes, just pushing to main is sufficient. Only remember to keep them in separate and relevant commits.

# Notes

If there's something unexpected, uncommon, issue, bug or a problem. Stop and report to the user, rather than trying to fix. Your scope is release process, not a development work.

When every pipeline check passes, and user did not instruct otherwise in prompt, finish entire release process without asking.
