# Knight’s Path

A math adventure for one or two players. Challenge a computer opponent or play with a friend on one device. Use three dice to make exact numbers, follow a branching trail, place and break walls, and race to the dragon.

## Run and verify

Use a current Node.js version with its built-in test runner. No dependency installation is needed.

```sh
npm run dev
npm test
npm run build
```

The preview runs at `http://127.0.0.1:3457/number-knockout/`. The original `calculator.html` address opens Oracle practice. Serve the site over HTTP or HTTPS; opening files directly is not supported because the app uses JavaScript modules and a worker.

`npm run build` creates a standalone static site in `dist/`. To preview that exact output:

```sh
KNIGHTS_PORT=3458 node scripts/dev.mjs --dist
```

The repository root is also directly publishable through the existing GitHub Pages setup. See [Release notes](docs/RELEASE.md) for the authorized publication procedure and rollback references.

## Included

- One-player mode: you control Gold and the computer controls Blue. Choose Squire for a friendly race or Knight for tactical wall placement.

- 34 individually numbered stones on a winding, branching trail with two approaches to the lair.
- Exact arithmetic, separate identities for duplicate dice, free powers and roots, a token editor, undo, and keyboard controls.
- Move, build, break, pass, dragon victory, draw, and alternating-first-player rematches.
- Shared stones, distinct calculations when following another knight, and an automatic exception when the Oracle finds no different method.
- Five guided lessons, three-stage Oracle hints, and independent practice dice.
- Browser autosave, validated restoration, old-save protection, sound, increased contrast, and reduced motion.
- An enlargable map and a native target selector for smaller screens.

There are no accounts, cloud saves, analytics, runtime dependencies, external fonts, online matchmaking, or service worker. Sharing opens the game for a new solo or same-device session. Saves belong to the browser and website origin where the game was played.

## Design and rules

The arithmetic draws from National Number Knockout; the adventure and victory rules are specific to Knight’s Path. See [Math](docs/MATH.md), [Trail rules](docs/RULES.md), [Artwork](docs/ASSETS.md), and [QA](docs/QA.md).

The trail is defined once in `src/route.js`. Both rendering and legal movement use those connections. Math, state transitions, storage, the editor, and the solver are separate modules. The browser test fixture pages in `.qa/` are local-only and are excluded from Git and the release output.
