# Knight’s Path 2.0 review release

## What changes

One-player mode adds a Blue computer opponent with Squire and Knight styles. Its turns use the same exact evaluator and shared-stone rules, show the chosen equation, pause while menus or practice are open, and resume safely after refresh. Existing two-player saves remain compatible. The immediately preceding published revision is `8b610aaf9f38a8c57404e5037a2f62a24dedc1c0`.

The former grid becomes a winding fantasy trail with 34 live numbered stones, forks, separate knights, and a dragon's lair. Legal movement and wall placement now follow the visible road connections. The interface adds a focused turn panel, exact expression feedback, a guided tutorial, progressive Oracle help, practice, reliable saving, and phone map enlargement.

The existing `calculator.html` route remains available. Math validation uses an explicit parser and exact arithmetic; approximate results never qualify a move. Saves use version 3 and protect advanced sessions from the old grid.

Knights can now share numbered stones and are displayed side by side. Each moves independently, while opposing walls continue to block entry. Shared positions restore normally after refresh.

The shared-stone follow-up requires distinct calculation methods when following an opponent to the same destination. Equivalent rearrangements are rejected without spending a turn. If the completed Oracle preset search finds no alternative, a valid repeat is automatically allowed; the UI explains the search scope and the chronicle records the exception. Existing version-3 saves remain compatible. Revision `85458fbad02981534fa5798895961a485aaf63e4` is the immediately preceding published shared-stone version.

The review adjustment removes the upper diagonal connection that bypassed eight moves. Existing trail positions and saved drafts remain compatible. The map is fixed between quests; its numbers are shuffled for a new board.

## Publication configuration

This release was built on `codex/knights-path-redesign` from baseline `c0ddc2fb7eb94d255e299c7e2af8f1afbbb734f9`. Publication was authorized after the shortcut and shared-stone revisions. Keep that baseline as the pre-redesign rollback reference.

The existing GitHub Pages configuration was inspected: legacy branch publishing from `main`, folder `/`, for `akeithhuckaby-create/number-knockout`. The intended public address remains `https://akeithhuckaby-create.github.io/number-knockout/`. GitHub Pages deployment history identifies the currently served revision.

## Authorized release procedure

1. Recheck the repository's current Pages source and any newer changes on `main`.
2. Review and integrate the tested redesign branch while preserving unrelated changes. Record the full pre-release `main` commit as the rollback reference.
3. Run the automated tests and build. Review the generated `dist/` site under `/number-knockout/`.
4. Merge or commit the approved root files to the configured publishing branch, then push through the existing GitHub Pages mechanism. The root is already publishable; do not change Pages to `dist/` or add another hosting service.
5. Wait for the deployment, then check the actual HTTPS website: artwork, calculator route, Oracle worker, tutorial, a move, a dragon encounter, refresh/resume, and phone layout. Record the hosted result with the deployed revision after publication.

## Rollback

Revert the release commit(s) on the publishing branch and push the revert through the same Pages setup. Do not force-reset shared history. If using a merge commit, inspect its parents before selecting a mainline for the revert. Confirm the old site is served after deployment completes.

The old legacy and version-2 save keys are retained by the new app. Version-3 saves are separate and will not be understood by the former grid app. Changing the website origin also changes which browser saves are available.

## Review package

The static ZIP contains the deployable site only. The local review folder also contains the build plan, original artwork, screenshots, and test report. Test fixture pages, dependency caches, repository metadata, and local paths are excluded from the static output.

See [QA](QA.md) for coverage and remaining limitations. Online multiplayer, accounts, cloud sync, installable/offline support, and campaign modes are future work.
