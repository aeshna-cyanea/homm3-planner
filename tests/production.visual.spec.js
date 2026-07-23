const { test, expect } = require("@playwright/test");
const creatureData = require("../public/creatures.json");

const viewports = [
  { name: "small-phone", width: 320, height: 800 },
  { name: "phone", width: 390, height: 844 },
  { name: "mobile-breakpoint", width: 520, height: 900 },
  { name: "narrow-tablet", width: 600, height: 900 },
  { name: "three-column", width: 900, height: 900 },
  { name: "split-two-column", width: 1100, height: 900 },
];

test("creature data is grouped into town dwellings and neutral creatures", () => {
  expect(Object.keys(creatureData)).toEqual([
    "fortification_buildings", "towns", "neutral_creatures",
  ]);
  expect(creatureData.towns.map((town) => town.name)).toEqual([
    "Castle", "Rampart", "Tower", "Inferno", "Necropolis", "Dungeon",
    "Stronghold", "Fortress", "Conflux", "Cove", "Factory", "Bulwark",
  ]);

  let creatureCount = 0;
  for (const town of creatureData.towns) {
    expect(town).not.toHaveProperty("id");
    expect(Object.keys(town)).toEqual(["name", "dwellings"]);
    for (const dwelling of town.dwellings) {
      expect(Object.keys(dwelling).every((key) => [
        "tier", "growth", "variants", "horde",
      ].includes(key))).toBe(true);
      expect(dwelling.variants.length).toBeGreaterThanOrEqual(2);
      for (const creature of dwelling.variants) {
        expect(Object.keys(creature)).toEqual(["name", "cost"]);
        creatureCount += 1;
      }
    }
  }
  for (const creature of creatureData.neutral_creatures) {
    expect(creature).not.toHaveProperty("variants");
    expect(Object.keys(creature)).toEqual(["name", "tier", "growth", "cost"]);
    creatureCount += 1;
  }
  expect(creatureCount).toBe(189);
});

test("Horde buildings are embedded on town dwellings", () => {
  expect(creatureData).not.toHaveProperty("horde_buildings");
  expect(creatureData).not.toHaveProperty("horde_building_count");

  let hordeBuildingCount = 0;
  for (const town of creatureData.towns) {
    for (const dwelling of town.dwellings) {
      if (dwelling.horde) {
        expect(dwelling.horde).toEqual(
          expect.objectContaining({
            name: expect.any(String),
            cost: expect.any(Object),
            growth_bonus: expect.any(Number),
          }),
        );
        hordeBuildingCount += 1;
      }
      expect(dwelling.variants.every((variant) => !variant.horde)).toBe(true);
    }
  }
  expect(hordeBuildingCount).toBe(16);
});

test("PWA app shell reloads while offline", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.locator("#town-select")).toBeEnabled();
  await expect(page.locator('script[id="vite-plugin-pwa:register-sw"]')).toHaveCount(0);

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBe("manifest.webmanifest");

  const manifestResponse = await page.request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest).toEqual(
    expect.objectContaining({
      id: "./",
      name: "HotA Production Planner",
      start_url: "./index.html",
      display: "browser",
    }),
  );
  expect(manifest.icons).toEqual([
    {
      src: "./icons/android-chrome-192x192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "./icons/android-chrome-512x512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "./icons/castle.svg",
      sizes: "any",
      type: "image/svg+xml",
      purpose: "any",
    },
  ]);

  await page.waitForFunction(function appIsControlledByServiceWorker() {
    return Boolean(navigator.serviceWorker?.controller);
  });

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#town-select")).toBeEnabled();
    await expect(page.locator("#external-dwelling-search")).toBeVisible();
    const cachedIconStatus = await page.evaluate(function fetchCachedIcon() {
      return fetch("./icons/android-chrome-512x512.png").then(function getStatus(response) {
        return response.status;
      });
    });
    expect(cachedIconStatus).toBe(200);
  } finally {
    await context.setOffline(false);
  }
});

for (const viewport of viewports) {
  test(`production planner fits at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/index.html");
    await expect(page.locator("#town-select")).toBeEnabled();
    await expect(page.locator("#town-selection")).toBeVisible();

    const overflow = await page.evaluate(() => {
      const selectors = [
        ".app-shell",
        ".production-scheme-section",
        ".scheme-controls",
        ".fortification-control",
        ".fortification-cycle-button",
      ];
      return selectors.map((selector) => {
        const element = document.querySelector(selector);
        return {
          selector,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        };
      });
    });

    expect(overflow).toEqual(
      overflow.map((measurement) => ({
        ...measurement,
        scrollWidth: measurement.clientWidth,
      })),
    );

    const schemePanel = await page.locator(".production-scheme-section").boundingBox();
    const fortificationButton = await page.locator("#fortification-cycle").boundingBox();
    expect(fortificationButton.y + fortificationButton.height).toBeLessThanOrEqual(
      schemePanel.y + schemePanel.height,
    );

    const firstCard = await page.locator(".unit-slot").nth(0).boundingBox();
    const secondCard = await page.locator(".unit-slot").nth(1).boundingBox();
    const thirdCard = await page.locator(".unit-slot").nth(2).boundingBox();
    const fourthCard = await page.locator(".unit-slot").nth(3).boundingBox();
    const fifthCard = await page.locator(".unit-slot").nth(4).boundingBox();
    const seventhCard = await page.locator(".unit-slot").nth(6).boundingBox();
    const unitGrid = await page.locator("#unit-grid").boundingBox();
    const cardWidths = await page.locator("#unit-grid").evaluate(function cardWidth(grid) {
      function resolvedWidth(customProperty) {
        const probe = document.createElement("span");
        probe.style.cssText =
          "position:absolute;visibility:hidden;width:var(" + customProperty + ")";
        grid.append(probe);
        const width = Number.parseFloat(getComputedStyle(probe).width);
        probe.remove();
        return width;
      }
      return {
        min: resolvedWidth("--unit-card-min-width"),
        max: resolvedWidth("--unit-card-max-width"),
        gap: Number.parseFloat(getComputedStyle(grid).columnGap),
      };
    });
    expect(secondCard.y).toBe(firstCard.y);
    expect(secondCard.x).toBeGreaterThan(firstCard.x);
    expect(firstCard.height).toBe(secondCard.height);
    if (unitGrid.width >= 2 * cardWidths.min + cardWidths.gap) {
      expect(firstCard.width).toBeGreaterThanOrEqual(cardWidths.min - 0.5);
    } else {
      expect(firstCard.width).toBeCloseTo(
        (unitGrid.width - cardWidths.gap) / 2,
        0,
      );
    }
    expect(firstCard.width).toBeLessThanOrEqual(cardWidths.max + 0.5);
    const nameMarginTop = await page.locator(".creature-name").first().evaluate(
      function computedMargin(name) {
        return Number.parseFloat(getComputedStyle(name).marginTop);
      },
    );
    const compactNameSpacing =
      unitGrid.width <= 3 * cardWidths.min + 2 * cardWidths.gap + 0.5;
    expect(nameMarginTop).toBeCloseTo(compactNameSpacing ? 11 : 22, 0);
    expect(fifthCard.y).toBeGreaterThan(firstCard.y);
    if (viewport.width === 900) {
      expect(thirdCard.y).toBe(firstCard.y);
      expect(fourthCard.y).toBe(firstCard.y);
      expect(fifthCard.x - schemePanel.x).toBeCloseTo(
        schemePanel.x + schemePanel.width - (seventhCard.x + seventhCard.width),
        0,
      );
    }
    if (viewport.width === 1100) {
      expect(thirdCard.y).toBe(firstCard.y);
      expect(fourthCard.y).toBeGreaterThan(firstCard.y);
      await expect(page.locator(".results-column")).toHaveCSS("position", "sticky");
    }

    const firstCardBody = await page.locator(".unit-card").nth(0).boundingBox();
    const firstExternalControl = page.locator(".external-dwelling-control").first();
    const firstExternalBox = await firstExternalControl.boundingBox();
    await expect(
      page.locator(".unit-card").first().locator(".external-dwelling-control"),
    ).toHaveCount(1);
    await expect(firstExternalControl.locator(".external-dwelling-icon")).toHaveText("🏠");
    await expect(firstExternalControl.locator(".external-dwelling-input")).toHaveValue("");
    await expect(firstExternalControl.locator(".external-dwelling-input")).toHaveAttribute(
      "placeholder",
      "0",
    );
    expect(firstExternalBox.y).toBeGreaterThan(firstCardBody.y);
    expect(firstExternalBox.y + firstExternalBox.height).toBeLessThanOrEqual(
      firstCardBody.y + firstCardBody.height,
    );
    const dwellingContainment = await page.locator("#unit-grid .unit-card").evaluateAll((cards) =>
      cards.map((card) => {
        const cardBounds = card.getBoundingClientRect();
        const control = card.querySelector(".external-dwelling-control");
        const controlBounds = control.getBoundingClientRect();
        return {
          leftInset: controlBounds.left - cardBounds.left,
          rightInset: cardBounds.right - controlBounds.right,
          internalOverflow: control.scrollWidth - control.clientWidth,
        };
      }),
    );
    for (const measurement of dwellingContainment) {
      expect(measurement.leftInset).toBeGreaterThanOrEqual(-0.5);
      expect(measurement.rightInset).toBeGreaterThanOrEqual(-0.5);
      expect(measurement.internalOverflow).toBeLessThanOrEqual(1);
    }

    const firstHordeSlot = page.locator(".unit-slot.has-horde").first();
    const firstHordeCard = await firstHordeSlot.locator(".unit-card").boundingBox();
    const firstHordeToggle = await firstHordeSlot.locator(".horde-toggle").boundingBox();
    expect(firstHordeToggle.y).toBe(firstHordeCard.y + firstHordeCard.height - 1);
    expect(firstHordeToggle.y + firstHordeToggle.height).toBeGreaterThan(
      firstHordeCard.y + firstHordeCard.height,
    );

    const hordeRowGap = fifthCard.y - (thirdCard.y + thirdCard.height);
    const plainRowGap = seventhCard.y - (fifthCard.y + fifthCard.height);
    expect(plainRowGap).toBeLessThan(hordeRowGap);
    await expect(
      page.locator(".unit-card").first().locator(".production-detail strong"),
    ).toHaveText("14");
    await expect(
      page.locator(".unit-card").first().locator(".cost-detail .cost-item b"),
    ).toHaveText("60");
    await expect(
      page.locator(".unit-card").first().locator(".resource-icon-gold"),
    ).toBeVisible();

    const totalAmount = await page.locator(".resource-total strong").first().boundingBox();
    const totalIcon = await page.locator(".resource-total .resource-icon").first().boundingBox();
    expect(totalIcon.y).toBe(totalAmount.y);
    expect(totalIcon.height).toBe(totalAmount.height);

    const firstCostAmount = await page.locator(".cost-item b").first().boundingBox();
    const firstCostIcon = await page.locator(".cost-item .resource-icon").first().boundingBox();
    expect(firstCostIcon.y + firstCostIcon.height).toBeLessThanOrEqual(
      firstCostAmount.y + firstCostAmount.height,
    );
    expect(firstCostIcon.y).toBeLessThan(firstCostAmount.y + firstCostAmount.height);

    const emptyCard = page.locator(".unit-card").nth(2);
    await expect(emptyCard.locator(".creature-name")).toHaveText("Griffin");
    await expect(emptyCard.locator(".detail-prompt")).toHaveCount(0);
    await expect(emptyCard.locator(".inactive-details")).toHaveCount(0);
    await expect(emptyCard.locator(".production-detail strong")).toHaveText("7");
    await expect(emptyCard.locator(".cost-detail .cost-item b")).toHaveText("200");
    await expect(emptyCard.locator(".creature-details .resource-icon-gold")).toBeVisible();

    if (viewport.width === 600) {
      await page.locator("#fortification-cycle").click();
      await expect(page.locator("#fortification-cycle")).toHaveAttribute(
        "data-fortification",
        "citadel",
      );
      const citadelGrowth = await page
        .locator("#fortification-detail .fortification-growth")
        .boundingBox();
      const citadelCost = await page
        .locator("#fortification-detail .fortification-cost")
        .boundingBox();
      const cycleButton = await page.locator("#fortification-cycle").boundingBox();
      expect(citadelCost.x).toBeGreaterThanOrEqual(cycleButton.x);
      expect(citadelCost.x + citadelCost.width).toBeLessThanOrEqual(
        cycleButton.x + cycleButton.width,
      );
      expect(citadelCost.y).toBeGreaterThanOrEqual(citadelGrowth.y);

      await page.locator("#fortification-cycle").click();
      const castleCostItems = page.locator("#fortification-detail .cost-item");
      const firstCastleCost = await castleCostItems.first().boundingBox();
      const lastCastleCost = await castleCostItems.last().boundingBox();
      expect(lastCastleCost.y).toBe(firstCastleCost.y);
      await page.locator("#fortification-cycle").click();
    }

    await expect(page).toHaveScreenshot(`production-${viewport.name}.png`, {
      animations: "disabled",
      fullPage: true,
    });
  });
}

test("fortification button cycles without overflowing at 528px", async ({ page }) => {
  await page.setViewportSize({ width: 528, height: 900 });
  await page.goto("/index.html");
  await expect(page.locator("#town-select")).toBeEnabled();

  const button = page.locator("#fortification-cycle");
  await expect(page.locator('input[name="fortification"]')).toHaveCount(0);
  await expect(button.locator(".fortification-cycle-icon")).toHaveCount(0);
  let stableWidth;
  for (const level of [
    { id: "fort", name: "Fort", next: "Citadel" },
    { id: "citadel", name: "Citadel", next: "Castle" },
    { id: "castle", name: "Castle", next: "Fort" },
  ]) {
    await expect(button).toHaveAttribute("data-fortification", level.id);
    await expect(button.locator("#fortification-name")).toHaveText(level.name);
    await expect(button).toHaveAttribute("title", "Select " + level.next);
    const dimensions = await button.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
    stableWidth ??= dimensions.clientWidth;
    expect(dimensions.clientWidth).toBe(stableWidth);
    await button.click();
  }
  await expect(button).toHaveAttribute("data-fortification", "fort");
});

test("recruitment column follows desktop scrolling only", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto("/index.html");
  await expect(page.locator("#town-select")).toBeEnabled();

  const resultsColumn = page.locator(".results-column");
  await expect(resultsColumn).toHaveCSS("position", "sticky");
  await page.evaluate(() => window.scrollTo(0, 700));
  const desktopBox = await resultsColumn.boundingBox();
  expect(desktopBox.y).toBe(22);

  await page.setViewportSize({ width: 600, height: 600 });
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect(resultsColumn).toHaveCSS("position", "static");
  const singleColumnBox = await resultsColumn.boundingBox();
  expect(singleColumnBox.y).toBeGreaterThan(22);
});

test("Factory centers its final pair in the three-column layout", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/index.html");
  await page.locator("#town-select").selectOption("Factory");

  const grid = await page.locator("#unit-grid").boundingBox();
  const seventhCard = await page.locator(".unit-slot").nth(6).boundingBox();
  const eighthCard = await page.locator(".unit-slot").nth(7).boundingBox();
  expect(eighthCard.y).toBe(seventhCard.y);
  expect(seventhCard.x - grid.x).toBeCloseTo(
    grid.x + grid.width - (eighthCard.x + eighthCard.width),
    0,
  );
});

test("card columns respond to scheme width rather than viewport width", async ({ page }) => {
  await page.setViewportSize({ width: 1010, height: 700 });
  await page.goto("/index.html");
  const singleColumnScheme = await page.locator(".scheme-section").first().boundingBox();
  const singleFirst = await page.locator(".unit-slot").first().boundingBox();
  const singleFourth = await page.locator(".unit-slot").nth(3).boundingBox();
  expect(singleFourth.y).toBe(singleFirst.y);

  await page.setViewportSize({ width: 1100, height: 700 });
  const splitScheme = await page.locator(".scheme-section").first().boundingBox();
  const splitFirst = await page.locator(".unit-slot").first().boundingBox();
  const splitThird = await page.locator(".unit-slot").nth(2).boundingBox();
  const splitFourth = await page.locator(".unit-slot").nth(3).boundingBox();
  expect(splitScheme.width).toBeLessThan(singleColumnScheme.width);
  expect(splitThird.y).toBe(splitFirst.y);
  expect(splitFourth.y).toBeGreaterThan(splitFirst.y);

  await page.setViewportSize({ width: 1440, height: 700 });
  const wideFirst = await page.locator(".unit-slot").first().boundingBox();
  const wideFourth = await page.locator(".unit-slot").nth(3).boundingBox();
  expect(wideFourth.y).toBe(wideFirst.y);
});

test("recruitment wraps before the scheme drops below three columns", async ({ page }) => {
  await page.goto("/index.html");

  await page.setViewportSize({ width: 1050, height: 700 });
  const wrappedInputs = await page.locator(".planner-inputs").boundingBox();
  const wrappedResults = await page.locator(".results-column").boundingBox();
  expect(wrappedResults.y).toBeGreaterThan(wrappedInputs.y + wrappedInputs.height);

  await page.setViewportSize({ width: 1060, height: 700 });
  const splitInputs = await page.locator(".planner-inputs").boundingBox();
  const splitResults = await page.locator(".results-column").boundingBox();
  const firstCard = await page.locator(".unit-slot").first().boundingBox();
  const thirdCard = await page.locator(".unit-slot").nth(2).boundingBox();
  expect(splitResults.y).toBe(splitInputs.y);
  expect(thirdCard.y).toBe(firstCard.y);
});

test("wrapped creature names do not collide with dwelling controls", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/index.html");
  await page.locator("#town-select").selectOption("Factory");

  await page.locator(".unit-card-cycle").first().click();
  await page.locator(".unit-card-cycle").nth(6).click();
  await page.locator(".unit-card-cycle").nth(6).click();

  for (const slotIndex of [0, 6]) {
    const slot = page.locator(".unit-slot").nth(slotIndex);
    const name = await slot.locator(".creature-name").boundingBox();
    const details = await slot.locator(".creature-details").boundingBox();
    const controls = await slot.locator(".external-dwelling-control").boundingBox();
    expect(name.height).toBeGreaterThan(24);
    expect(controls.y - (details.y + details.height)).toBeGreaterThanOrEqual(4);
  }
});

test("external dwellings add to base growth and reset independently", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/index.html");
  await page.locator("#town-select").selectOption("Inferno");

  const firstSlot = page.locator(".unit-slot").first();
  const count = firstSlot.locator(".external-dwelling-input");
  const externalResults = page.locator("#external-results-section");
  await expect(externalResults).toBeHidden();

  await firstSlot.locator('[data-external-action="increment"]').click();
  await expect(count).toHaveValue("1");
  await expect(firstSlot.locator(".production-detail strong")).toHaveText("16");
  await expect(externalResults).toBeVisible();
  await expect(page.locator("#external-resource-totals")).toHaveText("750 gold");
  await expect(page.locator("#external-results-body tr")).toHaveCount(1);
  const externalRow = page.locator("#external-results-body tr").first();
  await expect(externalRow.locator("td").nth(0)).toContainText(
    "ImpTier 1 · Basic · 1 external dwelling",
  );
  await expect(externalRow.locator("td").nth(1)).toHaveText("15 units");
  await expect(externalRow.locator("td").nth(2)).toHaveText("50 gold");
  await expect(externalRow.locator("td").nth(3)).toHaveText("750 gold");
  const weeklyBox = await page.locator(".results-column > .results-section").first().boundingBox();
  const externalBox = await externalResults.boundingBox();
  expect(externalBox.x).toBe(weeklyBox.x);
  expect(externalBox.y).toBeGreaterThan(weeklyBox.y + weeklyBox.height);

  await firstSlot.locator(".unit-card-cycle").click();
  await expect(firstSlot.locator(".creature-name")).toHaveText("Familiar");
  await expect(page.locator("#external-results-body tr").first()).toContainText("Imp");
  await expect(page.locator("#external-resource-totals")).toHaveText("750 gold");

  await page.locator("#fortification-cycle").click();
  await expect(page.locator("#fortification-cycle")).toHaveAttribute(
    "data-fortification",
    "citadel",
  );
  await expect(firstSlot.locator(".production-detail strong")).toHaveText("24");
  await expect(page.locator("#external-results-body tr").first()).toContainText("15 units");

  await count.fill("3");
  await count.press("Tab");
  await expect(count).toHaveValue("3");
  await expect(firstSlot.locator(".production-detail strong")).toHaveText("27");
  await expect(page.locator("#external-results-body tr").first()).toContainText("45 units");
  await expect(page.locator("#external-resource-totals")).toHaveText("2,250 gold");
  await expect(externalResults).toHaveScreenshot("external-recruitment-panel.png", {
    animations: "disabled",
  });

  await firstSlot.locator('[data-external-action="reset"]').click();
  await expect(count).toHaveValue("");
  await expect(count).toHaveAttribute("placeholder", "0");
  await expect(firstSlot.locator(".production-detail strong")).toHaveText("22");
  await expect(externalResults).toBeHidden();
});

test("external dwelling cards stay synchronized across towns", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/index.html");

  const externalGrid = page.locator("#external-dwelling-grid");
  await expect(externalGrid.locator(".external-dwelling-card")).toHaveCount(0);
  await expect(externalGrid.locator(".add-dwelling-card")).toHaveCount(1);
  await expect(externalGrid.locator(".add-dwelling-card")).toContainText("Add a dwelling");
  await expect(externalGrid.locator("#external-dwelling-search")).toHaveAttribute(
    "placeholder",
    "press / to search",
  );

  await page.locator("#town-select").selectOption("Inferno");
  const schemeSlot = page.locator("#unit-grid .unit-slot").first();
  await schemeSlot.locator('[data-external-action="increment"]').click();

  const externalCard = externalGrid.locator(".external-dwelling-card");
  await expect(externalCard).toHaveCount(1);
  await expect(externalCard.locator(".creature-name")).toHaveText("Imp");
  await expect(externalCard.locator(".external-card-count-input")).toHaveValue("1");
  await expect(externalCard.locator(".external-remove-icon")).toHaveCount(1);
  await expect(
    externalCard.locator('[data-external-card-action="decrement"]'),
  ).toBeDisabled();
  await expect(externalCard.locator('[data-external-action="reset"]')).toHaveCount(0);
  await expect(externalCard.locator(".production-detail strong")).toHaveText("15");

  await externalCard.locator('[data-external-card-action="increment"]').click();
  await expect(schemeSlot.locator(".external-dwelling-input")).toHaveValue("2");
  await expect(externalCard.locator(".external-card-count-input")).toHaveValue("2");
  await expect(externalCard.locator(".production-detail strong")).toHaveText("30");
  const externalCardBox = await externalCard.boundingBox();
  const addCardBox = await externalGrid.locator(".add-dwelling-card").boundingBox();
  expect(addCardBox.y).toBeCloseTo(externalCardBox.y, 1);
  expect(addCardBox.height).toBeCloseTo(externalCardBox.height, 1);
  await expect(page.locator(".external-dwellings-section")).toHaveScreenshot(
    "external-dwelling-cards.png",
    { animations: "disabled" },
  );

  await externalCard.locator('[data-external-card-action="decrement"]').click();
  await expect(externalCard.locator(".external-card-count-input")).toHaveValue("1");
  await expect(schemeSlot.locator(".external-dwelling-input")).toHaveValue("1");
  await externalCard.locator(".external-card-count-input").fill("0");
  await externalCard.locator(".external-card-count-input").press("Tab");
  await expect(externalCard.locator(".external-card-count-input")).toHaveValue("1");

  await page.locator("#town-select").selectOption("Castle");
  await expect(externalCard.locator(".creature-name")).toHaveText("Imp");
  await expect(page.locator("#external-results-body")).toContainText("Imp");

  await externalCard.locator(".external-remove-button").click();
  await expect(externalGrid.locator(".external-dwelling-card")).toHaveCount(0);
  await expect(page.locator("#external-results-section")).toBeHidden();

  await page.locator("#town-select").selectOption("Inferno");
  await expect(
    page.locator("#unit-grid .unit-slot").first().locator(".external-dwelling-input"),
  ).toHaveValue("");
});

test("external dwelling cards fill at most four columns", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/index.html");

  for (let slotIndex = 0; slotIndex < 5; slotIndex += 1) {
    await page
      .locator("#unit-grid .unit-slot")
      .nth(slotIndex)
      .locator('[data-external-action="increment"]')
      .click();
  }

  const cards = page.locator("#external-dwelling-grid .external-dwelling-slot");
  await expect(cards).toHaveCount(6);
  const boxes = await cards.evaluateAll((slots) =>
    slots.map((slot) => {
      const bounds = slot.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width };
    }),
  );
  expect(boxes[0].y).toBe(boxes[3].y);
  expect(boxes[4].y).toBeGreaterThan(boxes[0].y);
  expect(boxes[0].x).toBeLessThan(boxes[1].x);
  expect(boxes[0].width).toBeCloseTo(boxes[3].width, 0);
});

test("creature search adds and increments external dwellings", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/index.html");

  const externalGrid = page.locator("#external-dwelling-grid");
  let searchInput = externalGrid.locator("#external-dwelling-search");
  await searchInput.fill("Familiar");
  await expect(page.locator(".external-dwelling-dropdown .external-search-result")).toHaveCount(0);
  await expect(page.locator(".external-dwelling-dropdown .no-results")).toBeVisible();
  await searchInput.fill("Imp");
  const impOption = page
    .locator(".external-dwelling-dropdown .external-search-result")
    .filter({ hasText: "Imp" });
  await expect(impOption).toBeVisible();
  await expect(impOption).toContainText("Tier 1");
  await expect(page.locator(".external-dwelling-dropdown")).toHaveScreenshot(
    "external-dwelling-search-dropdown.png",
    { animations: "disabled" },
  );
  await impOption.click();

  const impCard = externalGrid.locator('.external-dwelling-card[data-creature-name="Imp"]');
  await expect(impCard).toHaveCount(1);
  await expect(impCard.locator(".external-card-count-input")).toHaveValue("1");

  searchInput = externalGrid.locator("#external-dwelling-search");
  await searchInput.press("Enter");
  await expect(impCard.locator(".external-card-count-input")).toHaveValue("1");
  await searchInput.fill("Imp");
  await searchInput.press("Enter");
  await expect(impCard).toHaveCount(1);
  await expect(impCard.locator(".external-card-count-input")).toHaveValue("2");

  searchInput = externalGrid.locator("#external-dwelling-search");
  await searchInput.fill("Azure Dragon");
  const azureOption = page
    .locator(".external-dwelling-dropdown .external-search-result")
    .filter({ hasText: "Azure Dragon" });
  await expect(azureOption).toBeVisible();
  await azureOption.click();
  await expect(
    externalGrid.locator('.external-dwelling-card[data-creature-name="Azure Dragon"]'),
  ).toHaveCount(1);
});

test("slash focuses creature search without hijacking text entry", async ({ page }) => {
  await page.goto("/index.html");

  const searchInput = page.locator("#external-dwelling-search");
  await page.keyboard.press("/");
  await expect(searchInput).toBeFocused();

  await searchInput.fill("Imp");
  await searchInput.press("/");
  await expect(searchInput).toHaveValue("Imp/");
});

test("creature search opens above and reverses when space below is limited", async ({
  page,
}) => {
  await page.setViewportSize({ width: 600, height: 500 });
  await page.goto("/index.html");

  const externalGrid = page.locator("#external-dwelling-grid");
  const searchInput = externalGrid.locator("#external-dwelling-search");
  await searchInput.evaluate((input) => {
    const bounds = input.getBoundingClientRect();
    window.scrollBy(0, bounds.bottom - (window.innerHeight - 16));
  });
  await searchInput.fill("Dragon");

  const dropdown = page.locator(".external-dwelling-dropdown");
  const results = dropdown.locator(".external-search-result");
  await expect(dropdown).toHaveClass(/is-above/);
  expect(await results.count()).toBeGreaterThan(1);
  await expect(results.last().locator("strong")).toHaveText("Green Dragon");

  const inputBox = await searchInput.boundingBox();
  const dropdownBox = await dropdown.boundingBox();
  expect(dropdownBox.y).toBeGreaterThanOrEqual(0);
  expect(dropdownBox.y + dropdownBox.height).toBeLessThan(inputBox.y);

  const firstResultBox = await results.first().boundingBox();
  const lastResultBox = await results.last().boundingBox();
  expect(firstResultBox.y).toBeLessThan(lastResultBox.y);
  expect(lastResultBox.y).toBeGreaterThanOrEqual(dropdownBox.y);
  expect(lastResultBox.y + lastResultBox.height).toBeLessThanOrEqual(
    dropdownBox.y + dropdownBox.height,
  );

  const visualResultNames = await results.evaluateAll((items) =>
    items
      .map((item) => ({
        name: item.querySelector("strong").textContent,
        top: item.getBoundingClientRect().top,
      }))
      .sort((left, right) => left.top - right.top)
      .map((item) => item.name),
  );
  const topmostResultName = visualResultNames[0];
  const nearestResultName = visualResultNames.at(-1);
  expect(topmostResultName).toBe(await results.first().locator("strong").innerText());
  expect(nearestResultName).toBe(await results.last().locator("strong").innerText());
  expect(nearestResultName).toBe("Green Dragon");
  expect(topmostResultName).not.toBe(nearestResultName);

  await searchInput.press("ArrowDown");
  await expect(results.last()).toHaveAttribute("aria-selected", "true");
  await searchInput.press("Enter");
  const addedCard = externalGrid.locator(".external-dwelling-card");
  await expect(addedCard).toHaveAttribute("data-creature-name", nearestResultName);
  await expect(addedCard).not.toHaveAttribute("data-creature-name", topmostResultName);

  await searchInput.evaluate((input) => {
    const bounds = input.getBoundingClientRect();
    window.scrollBy(0, bounds.bottom - (window.innerHeight - 16));
  });
  await searchInput.fill("Dragon");
  await expect(dropdown).toHaveClass(/is-above/);
  await results.last().click();
  await expect(addedCard.locator(".external-card-count-input")).toHaveValue("2");
});

test("creature search keeps its opening side while result height changes", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 500 });
  await page.goto("/index.html");

  const searchInput = page.locator("#external-dwelling-search");
  const dropdown = page.locator(".external-dwelling-dropdown");
  await searchInput.evaluate((input) => {
    const bounds = input.getBoundingClientRect();
    window.scrollBy(0, bounds.bottom - (window.innerHeight - 120));
  });

  await searchInput.fill("Green Dragon");
  await expect(dropdown).not.toHaveClass(/is-above/);
  await searchInput.fill("Dragon");
  await expect(dropdown).not.toHaveClass(/is-above/);

  let inputBox = await searchInput.boundingBox();
  let dropdownBox = await dropdown.boundingBox();
  expect(dropdownBox.y).toBeGreaterThan(inputBox.y + inputBox.height);
  expect(dropdownBox.y + dropdownBox.height).toBeLessThanOrEqual(500);

  await searchInput.press("Escape");
  await expect(dropdown).toBeHidden();
  await searchInput.fill("Dragon");
  await expect(dropdown).toHaveClass(/is-above/);
  await searchInput.fill("Green Dragon");
  await expect(dropdown).toHaveClass(/is-above/);

  inputBox = await searchInput.boundingBox();
  dropdownBox = await dropdown.boundingBox();
  expect(dropdownBox.y + dropdownBox.height).toBeLessThan(inputBox.y);
});

test("ordered dwelling variants drive stages and share Horde buildings", async ({ page }) => {
  await page.goto("/index.html");

  const griffinSlot = page.locator(".unit-slot").nth(2);
  await griffinSlot.locator(".unit-card-cycle").click();
  await griffinSlot.locator(".unit-card-cycle").click();
  await expect(griffinSlot.locator(".creature-name")).toHaveText("Royal Griffin");
  await expect(griffinSlot.locator(".unit-card")).toHaveAttribute("data-stage", "1");
  await griffinSlot.locator(".horde-toggle").click();
  await expect(griffinSlot.locator(".production-detail strong")).toHaveText("10");

  await page.locator("#town-select").selectOption("Cove");
  const pirateSlot = page.locator(".unit-slot").nth(2);
  for (const name of ["Pirate", "Corsair", "Sea Dog"]) {
    await pirateSlot.locator(".unit-card-cycle").click();
    await expect(pirateSlot.locator(".creature-name")).toHaveText(name);
  }
  await expect(pirateSlot.locator(".unit-card")).toHaveAttribute("data-stage", "2");
});

test("planner state persists across reloads", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator(".add-dwelling-card #external-dwelling-search")).toBeVisible();
  await expect(page.locator("#town-select")).toBeEnabled();
  await expect(page.locator("#town-select")).toHaveValue("Castle");
  await expect(page.locator(".unit-slot").first().locator(".creature-name")).toHaveText(
    "Pikeman",
  );
  await expect(page.locator(".unit-slot").nth(1).locator(".unit-card")).toHaveAttribute(
    "data-stage",
    "-1",
  );
  await page.locator("#fortification-cycle").click();
  await page.locator("#fortification-cycle").click();
  await expect(page.locator("#fortification-cycle")).toHaveAttribute(
    "data-fortification",
    "castle",
  );

  const thirdSlot = page.locator(".unit-slot").nth(2);
  await thirdSlot.locator(".unit-card-cycle").click();
  await thirdSlot.locator('[data-external-action="increment"]').click();
  await thirdSlot.locator('[data-external-action="increment"]').click();
  await thirdSlot.locator(".horde-toggle").click();

  await expect(thirdSlot.locator(".creature-name")).toHaveText("Griffin");
  await expect(thirdSlot.locator(".external-dwelling-input")).toHaveValue("2");
  await expect(thirdSlot.locator(".horde-checkbox")).toBeChecked();
  await page.locator("#save-state").click();

  const savedState = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("hota-production-planner-state")),
  );
  expect(savedState.townPlans).toHaveLength(1);
  expect(savedState.townPlans[0]).toEqual(
    expect.objectContaining({
      id: "town-1",
      town: "Castle",
      fortification: "castle",
    }),
  );
  expect(savedState.externalDwellings).toEqual([
    { basicCreature: "Griffin", count: 2 },
  ]);

  await page.reload();
  await expect(page.locator("#town-select")).toHaveValue("Castle");
  await expect(page.locator("#fortification-cycle")).toHaveAttribute(
    "data-fortification",
    "castle",
  );
  await expect(page.locator(".unit-slot").nth(2).locator(".creature-name")).toHaveText(
    "Griffin",
  );
  await expect(
    page.locator(".unit-slot").nth(2).locator(".external-dwelling-input"),
  ).toHaveValue("2");
  await expect(page.locator(".unit-slot").nth(2).locator(".horde-checkbox")).toBeChecked();
  await expect(page.locator("#external-results-section")).toBeVisible();
  await expect(
    page.locator("#external-dwelling-grid .external-dwelling-card"),
  ).toHaveAttribute("data-count", "2");

  await page.locator("#fortification-cycle").click();
  await page.locator(".unit-slot").nth(2).locator(".unit-card-cycle").click();
  await page.locator(".unit-slot").nth(2).locator('[data-external-action="increment"]').click();
  await page.locator("#reset-scheme").click();
  await expect(page.locator("#town-select")).toHaveValue("Castle");
  await expect(page.locator("#fortification-cycle")).toHaveAttribute(
    "data-fortification",
    "castle",
  );
  await expect(page.locator(".unit-slot").nth(2).locator(".creature-name")).toHaveText(
    "Griffin",
  );
  await expect(
    page.locator(".unit-slot").nth(2).locator(".external-dwelling-input"),
  ).toHaveValue("2");
  await expect(page.locator(".unit-slot").nth(2).locator(".horde-checkbox")).toBeChecked();

  await page.reload();
  await expect(page.locator("#town-select")).toHaveValue("Castle");
  await expect(page.locator("#fortification-cycle")).toHaveAttribute(
    "data-fortification",
    "castle",
  );
  await expect(
    page.locator(".unit-slot").nth(2).locator(".external-dwelling-input"),
  ).toHaveValue("2");
});

test("multi-resource creature costs have visible separators", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/index.html");
  await page.locator("#town-select").selectOption("Factory");

  const dreadnoughtCard = page.locator(".unit-card").nth(7);
  await dreadnoughtCard.locator(".unit-card-cycle").click();
  const dreadnoughtCosts = dreadnoughtCard.locator(".cost-detail .cost-item");
  await expect(dreadnoughtCosts).toHaveCount(2);
  await expect(dreadnoughtCosts.first().locator("b")).toHaveText("2,200");
  await expect(dreadnoughtCosts.last().locator("b")).toHaveText("1");
  await expect(dreadnoughtCard.locator(".cost-separator")).toHaveText(",");
  await expect(dreadnoughtCard.locator(".resource-icon-gold")).toBeVisible();
  await expect(dreadnoughtCard.locator(".resource-icon-crystal")).toBeVisible();
  await expect(dreadnoughtCard).toHaveScreenshot("factory-dreadnought-cost.png", {
    animations: "disabled",
  });
});

test("all resource costs use embedded wiki icons", async ({ page }) => {
  await page.goto("/index.html");

  const fortificationButton = page.locator("#fortification-cycle");
  await fortificationButton.click();
  for (const resource of ["gold", "ore"]) {
    await expect(fortificationButton.locator(`.resource-icon-${resource}`)).toBeVisible();
  }
  await fortificationButton.click();
  for (const resource of ["gold", "wood", "ore"]) {
    await expect(fortificationButton.locator(`.resource-icon-${resource}`)).toBeVisible();
  }

  const creatureResources = [
    ["Castle", "gem"],
    ["Rampart", "crystal"],
    ["Inferno", "mercury"],
    ["Dungeon", "sulfur"],
  ];
  for (const [town, resource] of creatureResources) {
    await page.locator("#town-select").selectOption(town);
    const tierSevenCard = page.locator(".unit-card").nth(6);
    await tierSevenCard.locator(".unit-card-cycle").click();
    await expect(tierSevenCard.locator(`.resource-icon-${resource}`)).toBeVisible();
  }

  for (const resource of ["gold", "wood", "ore", "mercury", "sulfur", "crystal", "gem"]) {
    const embeddedImage = await page.evaluate(
      (name) => getComputedStyle(document.documentElement).getPropertyValue(`--resource-${name}`),
      resource,
    );
    expect(embeddedImage).toContain("data:image/png;base64,");
  }
});
