# Window Mirror

A small KDE/KWin viewer that displays a snapshot of the first open window whose
title contains `vcmi`. It refreshes when opened, whenever it regains focus,
when the **Refresh** button is clicked, or when **F5** is pressed.

## Requirements (Arch Linux)

```bash
sudo pacman -S python-pyqt6 python-dbus python-gobject
```

The viewer asks KWin for its window list directly, so it can locate matching
XWayland or native Wayland windows by title.

## Install

Run this once:

```bash
./install.sh
```

The installer creates a venv with a **copied** Python interpreter and installs
the KDE desktop entry that grants that specific executable access to KWin's
restricted screenshot interface. A normal symlink-based venv is not sufficient
for this permission check.

## Run

```bash
./run.sh
```

You can also launch **Window Mirror** from KDE's application menu. Running
`vcmi_viewer.py` directly with the system Python will not have screenshot
permission.

For a command-line capture test:

```bash
./run.sh --capture-once /tmp/vcmi.png
```

The image is captured on demand rather than streamed continuously. It uses
KWin's compositor screenshot interface to capture accelerated rendering
directly, without activating, raising, or otherwise disturbing the VCMI window.

## HotA production planner

The static planner reads `creatures.json` and calculates one week of production
for creature tiers 1–7. Each dwelling cycles through none, basic, and upgraded
creatures. Cove's tier 3 also cycles through its Sea Dog second upgrade.
Relevant tiers show an optional Horde-building toggle. Horde growth is added
before Fort, Citadel, and Castle modifiers are applied to recruitment costs.

Start its local server:

```bash
./serve_production.sh
```

Then open <http://127.0.0.1:8000/production.html>.

### Offline single-file build

Regenerate the standalone planner after changing the HTML, CSS, JavaScript, or
creature data:

```bash
./build_standalone.py
```

The ignored, generated `production-standalone.html` contains all styles, logic,
and HotA data. It can be opened directly or shared as one offline file.

To regenerate it automatically before each commit, enable the repository's
tracked Git hooks once after cloning:

```bash
git config core.hooksPath .githooks
```

The visual-test commands also build the standalone file automatically.

### Visual regression tests

Install the project-local test dependency once:

```bash
npm install
```

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
