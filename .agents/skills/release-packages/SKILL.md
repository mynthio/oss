---
name: release-packages
description: "Release packages in the correct order by creating appropriate commits and pushing. Use when the user says to release, publish, deploy packages, ship changes, release sdk, release adapter, or mentions releasing anything in this monorepo. Handles the dependency order: SDK must be released first, then tanstack-adapter (which updates its SDK dependency), then other directories. Each sub-project gets its own commit with a conventional commit message."
---

# Release Packages

Release the packages in the repository.

# Before

Run the lint and test checks for packages you're releasing in that batch. Run the format command to format packages before release.

# Order

Packages that does not depend on SDK can be release in parallel, while packages that depends on SDK needs to be release after SDK version is published.

# Release process

Create commits following conventional commit patterns. Note that changelogs are generated form commits, include useful changelog information if it makes sense. Each package should have it's own commits, do not commit more than one package changes in single commit.

Push commits straight to main, if not instructed differently in user prompt.

This will trigger release please pipelines.

Using `gh` CLI you have all the rights to finish the release process, including merge and approvals. Use it to check the pipeline status. If all pipelines are sucesfull, finish the release process by merging the PRs and waiting for release to happen. Verify that all passed and new version is published to npm.

Always pull latest changes to keep repo in sync after merges.

# SDK dependent packages

For all packages that depends on SDK release process is same, but first you need to pull changes, and update the SDK version in the target package package.json file. We always use fixed versions, and we always should use fixed version.

Then run required checks and release the package. The package might be not compatible with new SDK, in such case, TS/Tests errors skip this package and report it to user at the end.

# Tanstack Adapter

Before release Tanstack Adapter package check if it doesn't need a sync with Mynth SDK. If nothing has changed that affects Tanstack Adapter, skip the release process for this package, or ask user on how to proceed.

# Rest of the changes

Skills, or README changes does not need a release process. For this changes, just pushing to main is sufficient. Only remember to keep them in separate and relevant commits.

# Notes

If there's something unexpected, uncommon, issue, bug or a problem. Stop and report to the user, rather than trying to fix. Your scope is release process, not a development work.

When every pipeline check passes, and user did not instruct otherwise in prompt, finish entire release process without asking.
