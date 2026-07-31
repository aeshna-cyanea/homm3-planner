## HotA production planner

This app calculates the cost of one week of
production of your town(s), with an option to display a global total cost.

Buildings in the town panel can be marked as pending. A pending building's one-time-costs panel groups each construction or upgrade with its cost and, for a newly built dwelling, its immediate production of a week's worth of
creatures.

### Todos

- Implement tech requirements
  - show a small warning flag on the card when enabling production with unmet reqs
  - implement controls to auto-add requirements for a given building
- serve creature icons and/or full pictures (saved in repo, but not bundled)
- add controls for special modifiers such as astrological events, grail, and legion artefact
- add parsing of an in-game kingdom overlay (possibly using js screen sharing apis?)

## Development

Install the project dependencies once:

```bash
npm install
```

Start its local server:

```bash
npm run dev
```

Then open <http://127.0.0.1:8000/>.

Vite serves the source files directly during development. `npm run build`
creates the ignored `dist/` deployment artifact, bundles autoComplete.js into a
hashed file under `dist/assets/`, and generates `dist/third-party-licenses.md`.
Use `npm run preview` to inspect the production build locally.

The interface is written in SolidJS TypeScript. Its source is split
by responsibility:

- `src/types.ts` defines the creature data and planner-state shapes.
- `src/catalog.ts` turns the JSON data into the small runtime lookup catalog.
- `src/planner.ts` owns state changes and derived recruitment calculations.
- `src/components/` contains the Solid UI, organized by visible page section.
- `src/persistence.ts` and `src/resources.ts` contain isolated storage and
  resource-cost helpers.

Run `npm run typecheck` for a fast type-only check. Production builds run that
check automatically before Vite bundles the site.

Pushes to `main` run `.github/workflows/deploy-pages.yml`, which installs the
locked dependencies, builds `dist/`, and deploys that artifact. In the GitHub
repository settings, configure Pages to use **GitHub Actions** as its source.

### Offline PWA

After the page has loaded once, its interface, creature data, and
search dependency are cached for use without a network connection. The Vite PWA
plugin generates the service worker and its precache list from the built files,
so asset hashes and cache revisions stay synchronized automatically. Service
workers require HTTPS, except that browsers also allow them on local development
origins such as `127.0.0.1`. The manifest includes 192px, 512px, and scalable
app icons for installation across browser and operating-system surfaces.

### Visual regression tests

The test command first builds `dist/`, then starts Vite's preview server on port
4173. It automatically uses Google Chrome when installed at a standard
Linux path. Set `PLAYWRIGHT_CHROME_PATH` for another location. If no system
Chrome is available, install Playwright's browser with
`npx playwright install chromium`.

Run the responsive layout checks and compare the page with its saved screenshots:

```bash
npm run test:visual
```

After an intentional visual change, refresh the screenshot baselines with
`npm run test:visual:update` and inspect the updated images before committing them.


## Third-party credits

The app icon uses the [Twemoji “European Castle”](https://github.com/twitter/twemoji/blob/master/assets/svg/1f3f0.svg)
graphic, copyright 2019 Twitter, Inc. and other contributors, licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Creature search uses [autoComplete.js](https://github.com/TarekRaafat/autoComplete.js),
licensed under the [Apache License 2.0](https://github.com/TarekRaafat/autoComplete.js/blob/master/LICENSE).

Game data comes from the
[Heroes 3 Wiki](https://heroes.thelazy.net). The data uses HotA
values.
