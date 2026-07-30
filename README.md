## HotA production planner

The static planner reads `public/creatures.json` and calculates one week of
production across any number of towns. Each town has its own production scheme
and recruitment subtotal, and its default label can be renamed with the pencil
beside it. The global-total dialog aggregates every town plus recruitment at
external dwellings, along with any pending one-time costs. Press `T` to add a
town or `P` to open the global total.
Press `U` outside a text field to show or hide the construction or upgrade cost
for each dwelling's next variant. Creature names open a compact reference dialog
with their statistics, special abilities, recruitment cost, and Heroes 3 Wiki
source. Clicking the dialog cycles through that dwelling's variants; upgraded
values that differ from the base creature are shown in green.

Each dwelling cycles through none, basic, and upgraded creatures. Cove's level 3
also cycles through its Sea Dog second upgrade. Relevant dwellings show an optional
Horde-building toggle. Horde growth is added before Fort, Citadel, and Castle
modifiers are applied to recruitment costs. External dwellings can be added
from a faction's production scheme or by searching the base dwelling creatures;
repeated additions increment one shared dwelling count, and their growth bonus
applies to every matching town.

Middle-click a dwelling, three-finger tap it, or press `Shift+Enter` while its
card is focused to advance it provisionally. A town can have multiple pending
dwellings. Its blue one-time-costs panel groups each construction or upgrade
with its cost and, for a newly built base dwelling, one unmodified week of its
creatures. Click a pending card normally to confirm its advancement, or use that
entry's close button (or repeat the pending gesture) to cancel and revert it.
The panel's bottom actions confirm or cancel every pending dwelling in that
town. Pending dwellings are included when state is saved and are cleared when
their town's faction changes.

`public/creatures.json` preserves the full creature statistics and source links
in the structure used by the planner. Towns are identified by their names and
contain dwellings with shared `level` and `growth` values plus an ordered
`variants` list. A dwelling has an optional `horde` object when one applies.
Non-upgradable neutral creatures are stored as single-variant dwellings under
`neutral_dwellings`, so growth remains a property of the dwelling rather than
the creature. The data comes from the Heroes 3 Wiki pages for the
[creature list](https://heroes.thelazy.net/index.php/List_of_creatures) and
[Horde buildings](https://heroes.thelazy.net/index.php/Horde_building).
Building and upgrade costs for every faction come from the current
[Heroes 3 Wiki faction creature-dwelling tables](https://heroes.thelazy.net/index.php/Castle_creature_dwellings).
When a table provides costs for multiple rulesets, the data uses its HotA
values.

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

The interface is written in SolidJS and strict TypeScript. Its source is split
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
