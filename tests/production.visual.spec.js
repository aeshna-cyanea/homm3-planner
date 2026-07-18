const { test, expect } = require("@playwright/test");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const standaloneUrl = pathToFileURL(
  path.resolve(__dirname, "..", "production-standalone.html"),
).href;

const viewports = [
  { name: "small-phone", width: 320, height: 800 },
  { name: "phone", width: 390, height: 844 },
  { name: "mobile-breakpoint", width: 520, height: 900 },
  { name: "narrow-tablet", width: 600, height: 900 },
  { name: "three-column", width: 900, height: 900 },
  { name: "split-two-column", width: 1100, height: 900 },
];

for (const viewport of viewports) {
  test(`production planner fits at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/production.html");
    await expect(page.locator("#town-select")).toBeEnabled();
    await expect(page.locator("#town-selection")).toBeVisible();

    const overflow = await page.evaluate(() => {
      const selectors = [
        ".app-shell",
        ".control-panel",
        ".fortification-control",
        ".radio-group",
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

    const controlPanel = await page.locator(".control-panel").boundingBox();
    const radioGroup = await page.locator(".radio-group").boundingBox();
    expect(radioGroup.y + radioGroup.height).toBeLessThanOrEqual(
      controlPanel.y + controlPanel.height,
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
        minHeight: resolvedWidth("--unit-card-min-height"),
        maxHeight: resolvedWidth("--unit-card-max-height"),
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
    expect(firstCard.height).toBeGreaterThanOrEqual(cardWidths.minHeight - 0.5);
    expect(firstCard.height).toBeLessThanOrEqual(cardWidths.maxHeight + 0.5);
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
      expect(fifthCard.x - controlPanel.x).toBeCloseTo(
        controlPanel.x + controlPanel.width - (seventhCard.x + seventhCard.width),
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
    await expect(page.locator(".unit-card").first().locator(".production-detail")).toHaveText(
      "14 per week",
    );
    await expect(page.locator(".unit-card").first().locator(".cost-detail")).toHaveText(
      "60 gold each",
    );
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
    await expect(emptyCard.locator(".inactive-details")).toHaveText(
      "(7 per week, 200 gold each)",
    );
    await expect(emptyCard.locator(".inactive-details .resource-icon-gold")).toBeVisible();

    await expect(page.locator("#citadel-detail .fortification-growth")).toHaveText(
      "1.5x growth, rounded down",
    );
    if (viewport.width === 600) {
      const citadelGrowth = await page
        .locator("#citadel-detail .fortification-growth")
        .boundingBox();
      const citadelCost = await page.locator("#citadel-detail .fortification-cost").boundingBox();
      expect(citadelCost.y).toBeGreaterThan(citadelGrowth.y);

      const castleCostItems = page.locator("#castle-detail .cost-item");
      const firstCastleCost = await castleCostItems.first().boundingBox();
      const lastCastleCost = await castleCostItems.last().boundingBox();
      expect(lastCastleCost.y).toBe(firstCastleCost.y);
    }

    await expect(page).toHaveScreenshot(`production-${viewport.name}.png`, {
      animations: "disabled",
      fullPage: true,
    });
  });
}

test("recruitment column follows desktop scrolling only", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto("/production.html");
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
  await page.goto("/production.html");
  await page.locator("#town-select").selectOption("factory");

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
  await page.goto("/production.html");
  const singleColumnScheme = await page.locator(".scheme-section").boundingBox();
  const singleFirst = await page.locator(".unit-slot").first().boundingBox();
  const singleFourth = await page.locator(".unit-slot").nth(3).boundingBox();
  expect(singleFourth.y).toBe(singleFirst.y);

  await page.setViewportSize({ width: 1100, height: 700 });
  const splitScheme = await page.locator(".scheme-section").boundingBox();
  const splitFirst = await page.locator(".unit-slot").first().boundingBox();
  const splitThird = await page.locator(".unit-slot").nth(2).boundingBox();
  const splitFourth = await page.locator(".unit-slot").nth(3).boundingBox();
  expect(splitScheme.width).toBeLessThan(singleColumnScheme.width);
  expect(splitThird.y).toBe(splitFirst.y);
  expect(splitFourth.y).toBeGreaterThan(splitFirst.y);
  expect(splitFirst.height).toBeLessThan(singleFirst.height);

  await page.setViewportSize({ width: 1440, height: 700 });
  const wideFirst = await page.locator(".unit-slot").first().boundingBox();
  const wideFourth = await page.locator(".unit-slot").nth(3).boundingBox();
  expect(wideFourth.y).toBe(wideFirst.y);
  expect(wideFirst.height).toBeGreaterThan(splitFirst.height);
});

test("recruitment wraps before the scheme drops below three columns", async ({ page }) => {
  await page.goto("/production.html");

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
  await page.goto("/production.html");
  await page.locator("#town-select").selectOption("factory");

  await page.locator(".unit-card").first().click();
  await page.locator(".unit-card").nth(6).click();
  await page.locator(".unit-card").nth(6).click();

  for (const slotIndex of [0, 6]) {
    const slot = page.locator(".unit-slot").nth(slotIndex);
    const name = await slot.locator(".creature-name").boundingBox();
    const details = await slot.locator(".creature-details").boundingBox();
    const controls = await slot.locator(".external-dwelling-control").boundingBox();
    expect(name.height).toBeGreaterThan(24);
    expect(details.y + details.height).toBeLessThanOrEqual(controls.y);
  }
});

test("external dwellings add to base growth and reset independently", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/production.html");
  await page.locator("#town-select").selectOption("inferno");

  const firstSlot = page.locator(".unit-slot").first();
  const count = firstSlot.locator(".external-dwelling-input");
  const externalResults = page.locator("#external-results-section");
  await expect(externalResults).toBeHidden();

  await firstSlot.locator('[data-external-action="increment"]').click();
  await expect(count).toHaveValue("1");
  await expect(firstSlot.locator(".production-detail")).toHaveText("16 per week");
  await expect(externalResults).toBeVisible();
  await expect(page.locator("#external-resource-totals")).toHaveText("750 gold");
  await expect(page.locator("#external-results-body tr")).toHaveCount(1);
  await expect(page.locator("#external-results-body tr").first()).toContainText(
    "ImpTier 1 · Basic · 1 external dwelling15 units50 gold750 gold",
  );
  const weeklyBox = await page.locator(".results-column > .results-section").first().boundingBox();
  const externalBox = await externalResults.boundingBox();
  expect(externalBox.x).toBe(weeklyBox.x);
  expect(externalBox.y).toBeGreaterThan(weeklyBox.y + weeklyBox.height);

  await firstSlot.locator(".unit-card").click();
  await expect(firstSlot.locator(".creature-name")).toHaveText("Familiar");
  await expect(page.locator("#external-results-body tr").first()).toContainText("Imp");
  await expect(page.locator("#external-resource-totals")).toHaveText("750 gold");

  await page.locator('label:has(input[name="fortification"][value="citadel"])').click();
  await expect(firstSlot.locator(".production-detail")).toHaveText("24 per week");
  await expect(page.locator("#external-results-body tr").first()).toContainText("15 units");

  await count.fill("3");
  await count.press("Tab");
  await expect(count).toHaveValue("3");
  await expect(firstSlot.locator(".production-detail")).toHaveText("27 per week");
  await expect(page.locator("#external-results-body tr").first()).toContainText("45 units");
  await expect(page.locator("#external-resource-totals")).toHaveText("2,250 gold");
  await expect(externalResults).toHaveScreenshot("external-recruitment-panel.png", {
    animations: "disabled",
  });

  await firstSlot.locator('[data-external-action="reset"]').click();
  await expect(count).toHaveValue("");
  await expect(count).toHaveAttribute("placeholder", "0");
  await expect(firstSlot.locator(".production-detail")).toHaveText("22 per week");
  await expect(externalResults).toBeHidden();
});

for (const [surface, url] of [
  ["hosted page", "/production.html"],
  ["standalone file URL", standaloneUrl],
]) {
  test(`planner state persists across ${surface} reloads`, async ({ page }) => {
    await page.goto(url);
    await expect(page.locator("#town-select")).toBeEnabled();
    await expect(page.locator("#town-select")).toHaveValue("castle");
    await expect(page.locator(".unit-slot").first().locator(".creature-name")).toHaveText(
      "Pikeman",
    );
    await expect(page.locator(".unit-slot").nth(1).locator(".state-label")).toHaveText("None");
    await page.locator('label:has(input[name="fortification"][value="castle"])').click();

    const thirdSlot = page.locator(".unit-slot").nth(2);
    await thirdSlot.locator(".unit-card").click();
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
    expect(savedState.town).toBe("castle");
    expect(savedState.fortification).toBe("castle");

    await page.reload();
    await expect(page.locator("#town-select")).toHaveValue("castle");
    await expect(
      page.locator('input[name="fortification"][value="castle"]'),
    ).toBeChecked();
    await expect(page.locator(".unit-slot").nth(2).locator(".creature-name")).toHaveText(
      "Griffin",
    );
    await expect(
      page.locator(".unit-slot").nth(2).locator(".external-dwelling-input"),
    ).toHaveValue("2");
    await expect(page.locator(".unit-slot").nth(2).locator(".horde-checkbox")).toBeChecked();
    await expect(page.locator("#external-results-section")).toBeVisible();

    await page.locator('label:has(input[name="fortification"][value="fort"])').click();
    await page.locator(".unit-slot").nth(2).locator(".unit-card").click();
    await page.locator(".unit-slot").nth(2).locator('[data-external-action="increment"]').click();
    await page.locator("#reset-scheme").click();
    await expect(page.locator("#town-select")).toHaveValue("castle");
    await expect(page.locator('input[name="fortification"][value="castle"]')).toBeChecked();
    await expect(page.locator(".unit-slot").nth(2).locator(".creature-name")).toHaveText(
      "Griffin",
    );
    await expect(
      page.locator(".unit-slot").nth(2).locator(".external-dwelling-input"),
    ).toHaveValue("2");
    await expect(page.locator(".unit-slot").nth(2).locator(".horde-checkbox")).toBeChecked();

    await page.reload();
    await expect(page.locator("#town-select")).toHaveValue("castle");
    await expect(page.locator('input[name="fortification"][value="castle"]')).toBeChecked();
    await expect(
      page.locator(".unit-slot").nth(2).locator(".external-dwelling-input"),
    ).toHaveValue("2");
  });
}

test("multi-resource creature costs have visible separators", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/production.html");
  await page.locator("#town-select").selectOption("factory");

  const dreadnoughtCard = page.locator(".unit-card").nth(7);
  await dreadnoughtCard.click();
  await expect(dreadnoughtCard.locator(".creature-details")).toContainText(
    "2,200 gold, 1 crystal each",
  );
  await expect(dreadnoughtCard.locator(".resource-icon-gold")).toBeVisible();
  await expect(dreadnoughtCard.locator(".resource-icon-crystal")).toBeVisible();
  await expect(dreadnoughtCard).toHaveScreenshot("factory-dreadnought-cost.png", {
    animations: "disabled",
  });
});

test("all resource costs use embedded wiki icons", async ({ page }) => {
  await page.goto("/production.html");

  for (const resource of ["gold", "wood", "ore"]) {
    await expect(page.locator(`.fortification-control .resource-icon-${resource}`).first()).toBeVisible();
  }

  const creatureResources = [
    ["castle", "gem"],
    ["rampart", "crystal"],
    ["inferno", "mercury"],
    ["dungeon", "sulfur"],
  ];
  for (const [town, resource] of creatureResources) {
    await page.locator("#town-select").selectOption(town);
    const tierSevenCard = page.locator(".unit-card").nth(6);
    await tierSevenCard.click();
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
