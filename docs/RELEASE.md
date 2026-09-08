# Knight’s Path 2.0 review release

## What changes

The former grid becomes a winding fantasy trail with 34 live numbered stones, forks, separate knights, and a dragon's lair. Legal movement and wall placement now follow the visible road connections. The interface adds a focused turn panel, exact expression feedback, a guided tutorial, progressive Oracle help, practice, reliable saving, and phone map enlargement.

The existing `calculator.html` route remains available. Math validation uses an explicit parser and exact arithmetic; approximate results never qualify a move. Saves use version 3 and protect advanced sessions from the old grid.

## Current publication state

This review was built on `codex/knights-path-redesign` from baseline `c0ddc2f`. It has not been pushed or merged into the publishing branch.

The existing GitHub Pages configuration was inspected: legacy branch publishing from `main`, folder `/`, for `akeithhuckaby-create/number-knockout`. The intended public address remains `https://akeithhuckaby-create.github.io/number-knockout/`. The existing public site remains unchanged until release approval.

## Release after approval

1. Recheck the repository's current Pages source and any newer changes on `main`.
2. Review and integrate the tested redesign branch while preserving unrelated changes. Record the full pre-release `main` commit as the rollback reference.
3. Run the automated tests and build. Review the generated `dist/` site under `/number-knockout/`.
4. Merge or commit the approved root files to the configured publishing branch, then push through the existing GitHub Pages mechanism. The root is already publishable; do not change Pages to `dist/` or add another hosting service.
5. Wait for the deployment, then check the actual HTTPS website: artwork, calculator route, Oracle worker, tutorial, a move, a dragon encounter, refresh/resume, and phone layout. This hosted check has not yet been performed for this release.

## Rollback

Revert the release commit(s) on the publishing branch and push the revert through the same Pages setup. Do not force-reset shared history. If using a merge commit, inspect its parents before selecting a mainline for the revert. Confirm the old site is served after deployment completes.

The old legacy and version-2 save keys are retained by the new app. Version-3 saves are separate and will not be understood by the former grid app. Changing the website origin also changes which browser saves are available.

## Review package

The static ZIP contains the deployable site only. The local review folder also contains the build plan, original artwork, screenshots, and test report. Test fixture pages, dependency caches, repository metadata, and local paths are excluded from the static output.

See [QA](QA.md) for coverage and remaining limitations. Online multiplayer, accounts, cloud sync, installable/offline support, and campaign modes are future work.
