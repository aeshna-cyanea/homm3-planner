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
./serve_production.sh
```

Then open <http://127.0.0.1:8000/production.html>.

### Offline single-file build

Regenerate the standalone planner after changing the HTML, CSS, JavaScript, or
creature data:

```bash
npm run build:standalone
```

The generated `index.html` contains all styles, logic, HotA creature data, and
the pinned Tom Select search dependency.

To regenerate it automatically before each commit, enable the repository's
tracked Git hooks once after cloning:

```bash
git config core.hooksPath .githooks
```

The visual-test commands also build the standalone file automatically.

### Visual regression tests

The test harness automatically uses Google Chrome when it is installed at a
standard Linux path. Set `PLAYWRIGHT_CHROME_PATH` for another location. If no
system Chrome is available, install Playwright's browser with
`npx playwright install chromium`.

Run the responsive layout checks and compare the page with its saved screenshots:

```bash
npm run test:visual
```

After an intentional visual change, refresh the screenshot baselines with
`npm run test:visual:update` and inspect the updated images before committing them.
