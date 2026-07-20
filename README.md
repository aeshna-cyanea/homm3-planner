## HotA production planner

The static planner reads `creatures.json` and calculates one week of production
for creature tiers 1–7. Each dwelling cycles through none, basic, and upgraded
creatures. Cove's tier 3 also cycles through its Sea Dog second upgrade.
Relevant tiers show an optional Horde-building toggle. Horde growth is added
before Fort, Citadel, and Castle modifiers are applied to recruitment costs.
External dwellings can be added from a faction's production scheme or by
searching the base dwelling creatures; repeated additions increment one shared
dwelling count.

`creatures.json` contains only the fields used by the planner and groups
dwelling roots by faction, including a `neutral` group. A creature has an
`upgraded_creature` link when another form follows. A dwelling root contains a
`horde_building` object when one applies; its nested upgrades share that
building. The fuller source dataset is preserved in `creatures_big.json`.

Install the project dependencies once:

```bash
npm install
```

Start its local server:

```bash
npm run dev
```

Then open <http://127.0.0.1:8000/>.

`npm run build` creates an ignored `dist/` deployment artifact containing the
app and the pinned autoComplete.js browser build from `node_modules`. The
generated dependency and its Apache 2.0 license are therefore deployed without
being committed to the repository.

Pushes to `main` run `.github/workflows/deploy-pages.yml`, which installs the
locked dependencies, builds `dist/`, and deploys that artifact. In the GitHub
repository settings, configure Pages to use **GitHub Actions** as its source.

### Offline PWA

After the hosted planner has loaded once, its interface, creature data, and
search dependency are cached for use without a network connection. Service
workers require HTTPS, except that browsers also allow them on local development
origins such as `127.0.0.1`. The manifest includes 192px, 512px, and scalable
app icons for installation across browser and operating-system surfaces.

### Visual regression tests

The test command first builds `dist/`, then starts the same Node static server on
port 4173. It automatically uses Google Chrome when installed at a standard
Linux path. Set `PLAYWRIGHT_CHROME_PATH` for another location. If no system
Chrome is available, install Playwright's browser with
`npx playwright install chromium`.

Run the responsive layout checks and compare the page with its saved screenshots:

```bash
npm run test:visual
```

After an intentional visual change, refresh the screenshot baselines with
`npm run test:visual:update` and inspect the updated images before committing them.
