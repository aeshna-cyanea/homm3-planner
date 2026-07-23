## HotA production planner

The static planner reads `public/creatures.json` and calculates one week of production
for creature tiers 1–7. Each dwelling cycles through none, basic, and upgraded
creatures. Cove's tier 3 also cycles through its Sea Dog second upgrade.
Relevant tiers show an optional Horde-building toggle. Horde growth is added
before Fort, Citadel, and Castle modifiers are applied to recruitment costs.
External dwellings can be added from a faction's production scheme or by
searching the base dwelling creatures; repeated additions increment one shared
dwelling count.

`public/creatures.json` contains only the fields used by the planner. Towns are
identified by their names and contain dwellings with shared `tier` and `growth`
values plus an ordered `variants` list. A dwelling has an optional `horde`
object when one applies. Non-upgradable neutral creatures are stored as flat
records under `neutral_creatures`. The fuller source dataset is preserved in
`creatures_big.json`.

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

Pushes to `main` run `.github/workflows/deploy-pages.yml`, which installs the
locked dependencies, builds `dist/`, and deploys that artifact. In the GitHub
repository settings, configure Pages to use **GitHub Actions** as its source.

### Offline PWA

After the hosted planner has loaded once, its interface, creature data, and
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


### Third-party credits

The app icon uses the [Twemoji “European Castle”](https://github.com/twitter/twemoji/blob/master/assets/svg/1f3f0.svg)
graphic, copyright 2019 Twitter, Inc. and other contributors, licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Creature search uses [autoComplete.js](https://github.com/TarekRaafat/autoComplete.js),
licensed under the [Apache License 2.0](https://github.com/TarekRaafat/autoComplete.js/blob/master/LICENSE).
