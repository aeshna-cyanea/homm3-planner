const { test, expect } = require("@playwright/test");

async function addTown(page, town) {
  const search = page.locator("#add-town-search");
  await search.fill(town);
  await page
    .locator(".town-search-result")
    .filter({ hasText: town })
    .click();
}

async function twoFingerTap(locator) {
  await locator.evaluate((target) => {
    const touches = [0, 1].map((identifier) =>
      new Touch({
        identifier,
        target,
        clientX: 30 + identifier * 12,
        clientY: 30,
        pageX: 30 + identifier * 12,
        pageY: 30,
        screenX: 30 + identifier * 12,
        screenY: 30,
      }));

    target.dispatchEvent(new TouchEvent("touchstart", {
      bubbles: true,
      cancelable: true,
      touches,
      targetTouches: touches,
      changedTouches: touches,
    }));

    for (let index = 0; index < touches.length; index += 1) {
      const remaining = touches.slice(index + 1);
      target.dispatchEvent(new TouchEvent("touchend", {
        bubbles: true,
        cancelable: true,
        touches: remaining,
        targetTouches: remaining,
        changedTouches: [touches[index]],
      }));
    }
  });
}

test("towns have independent schemes and external bonuses apply to every match", async ({
  page,
}) => {
  await page.goto("/");

  await addTown(page, "Inferno");
  await addTown(page, "Castle");

  const towns = page.locator(".town-section");
  await expect(towns).toHaveCount(3);
  await expect(towns.locator("h2")).toHaveText(["Town 1", "Town 2", "Town 3"]);
  await expect(towns.locator(".town-section-header .eyebrow")).toHaveText([
    "Castle",
    "Inferno",
    "Castle",
  ]);
  await expect(page.locator("#add-town-search")).toHaveValue("");

  const firstCastle = towns.nth(0);
  const inferno = towns.nth(1);
  const secondCastle = towns.nth(2);
  await expect(inferno.locator("select").first()).toHaveValue("Inferno");
  await expect(secondCastle.locator("select").first()).toHaveValue("Castle");

  await firstCastle
    .locator('.unit-slot:first-child [data-external-action="increment"]')
    .click();
  await expect(
    firstCastle.locator(".unit-slot").first().locator(".production-detail strong"),
  ).toHaveText("15");
  await expect(
    secondCastle.locator(".unit-slot").first().locator(".production-detail strong"),
  ).toHaveText("15");
  await expect(
    inferno.locator(".unit-slot").first().locator(".production-detail strong"),
  ).toHaveText("15");

  await secondCastle.locator(".fortification-cycle-button").click();
  await expect(
    secondCastle.locator(".unit-slot").first().locator(".production-detail strong"),
  ).toHaveText("22");

  await expect(page.locator("#external-results-body tr")).toHaveCount(1);
  await expect(page.locator("#external-results-body tr td").nth(1)).toHaveText(
    "14 units",
  );

  await page.locator("#open-global-total").click();
  const dialog = page.locator(".global-total-dialog");
  await expect(dialog).toBeVisible();
  const pikeman = dialog.locator("tbody tr").filter({ hasText: "Pikeman" });
  await expect(pikeman.locator("td").nth(0)).toContainText(
    "Town 1 · Town 3 · External dwellings",
  );
  await expect(pikeman.locator("td").nth(1)).toHaveText("51 units");
  await expect(pikeman.locator("td").nth(3)).toHaveText("2,220 gold");
  await expect(dialog).toHaveScreenshot("global-total-dialog.png", {
    animations: "disabled",
  });
});

test("town controls remain unique, collapsible, removable, and autosaved", async ({
  page,
}) => {
  await page.goto("/");
  await addTown(page, "Cove");

  const towns = page.locator(".town-section");
  await expect(towns).toHaveCount(2);

  const duplicateIds = await page.locator("[id]").evaluateAll((elements) => {
    const ids = elements.map((element) => element.id);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  expect(duplicateIds).toEqual([]);

  const firstTown = towns.first();
  await firstTown.getByRole("button", { name: "Collapse" }).click();
  await expect(firstTown.locator(".production-scheme-section")).toBeHidden();
  await expect(firstTown.locator(".results-column")).toBeHidden();
  await expect(firstTown.locator(".town-section-header")).toBeVisible();
  await firstTown.getByRole("button", { name: "Expand" }).click();
  await expect(firstTown.locator(".production-scheme-section")).toBeVisible();
  await expect(firstTown.locator(".results-column")).toBeVisible();

  await page.reload();
  await expect(page.locator(".town-section")).toHaveCount(2);
  await expect(page.locator("#town-select-town-2")).toHaveValue("Cove");

  await page
    .locator(".town-section")
    .nth(1)
    .getByRole("button", { name: "Remove Town 2" })
    .click();
  await expect(page.locator(".town-section")).toHaveCount(1);
  await expect(page.locator(".remove-town-button")).toHaveCount(0);
});

test("T focuses town search and Enter confirms keyboard selection", async ({
  page,
}) => {
  await page.goto("/");

  const search = page.locator("#add-town-search");
  const results = page.locator(".town-search-result");
  await expect(search).toHaveAttribute("aria-controls", /.+/);
  await page.keyboard.press("t");
  await expect(search).toBeFocused();
  await expect(results).toHaveCount(12);
  await expect(page.locator(".town-search-dropdown")).toHaveScreenshot(
    "town-search-dropdown.png",
    { animations: "disabled" },
  );

  await search.pressSequentially("Cov");
  await expect(results).toHaveCount(1);
  await expect(results).toHaveText("Cove");
  await search.press("ArrowDown");
  await expect(results).toHaveAttribute("aria-selected", "true");
  await search.press("Enter");

  await expect(page.locator(".town-section")).toHaveCount(2);
  const addedTown = page.locator(".town-section").nth(1);
  await expect(addedTown.locator("h2")).toHaveText("Town 2");
  await expect(addedTown.locator(".town-section-header .eyebrow")).toHaveText("Cove");
  await expect(search).toHaveValue("");
});

test("add controls show keycaps and their full surfaces focus the search", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const townControl = page.locator(".add-town-control");
  const townLabel = page.locator(".planner-controls-heading .add-town-label");
  const townSearch = page.locator("#add-town-search");
  const dwellingCard = page.locator(".add-dwelling-card");
  const dwellingSearch = page.locator("#external-dwelling-search");

  await expect(townLabel.locator(".shortcut-key")).toHaveText("T");
  await expect(dwellingCard.locator(".shortcut-key")).toHaveText("/");
  await expect(page.locator("#save-state .shortcut-key")).toHaveText("S");
  await expect(page.locator("#save-state")).toHaveAttribute(
    "aria-keyshortcuts",
    "s",
  );
  await expect(page.locator("#reset-scheme .shortcut-key")).toHaveText("R");
  await expect(page.locator("#reset-scheme")).toHaveAttribute(
    "aria-keyshortcuts",
    "r",
  );
  await expect(page.locator(".building-costs-button .shortcut-key")).toHaveText("U");
  await expect(page.locator(".global-total-button .shortcut-key")).toHaveText("P");
  await expect(townSearch).toHaveAttribute("placeholder", "Search towns");
  await expect(dwellingSearch).toHaveAttribute("placeholder", "Search creatures");

  const dwellingCardBox = await dwellingCard.boundingBox();
  await dwellingCard.click({
    position: { x: 5, y: dwellingCardBox.height - 5 },
  });
  await expect(dwellingSearch).toBeFocused();

  const townControlBox = await townControl.boundingBox();
  await townControl.click({
    position: { x: townControlBox.width - 5, y: 5 },
  });
  await expect(townSearch).toBeFocused();
});

test("reset restores the default when no state was explicitly saved", async ({
  page,
}) => {
  await page.goto("/");

  const townSelect = page.locator("#town-select");
  await townSelect.selectOption("Inferno");
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem("hota-production-planner-autosave"))
      ?.townPlans?.[0]?.town,
  )).toBe("Inferno");

  await page.reload();
  await expect(townSelect).toHaveValue("Inferno");

  await page.locator("#reset-scheme").click();
  await expect(townSelect).toHaveValue("Castle");
  await page.reload();
  await expect(townSelect).toHaveValue("Castle");
});

test("reset restores the explicit save while reload restores the latest autosave", async ({
  page,
}) => {
  await page.goto("/");

  const townSelect = page.locator("#town-select");
  await townSelect.selectOption("Inferno");
  await page.keyboard.press("s");
  await townSelect.selectOption("Factory");

  await page.reload();
  await expect(townSelect).toHaveValue("Factory");

  await page.keyboard.press("r");
  await expect(townSelect).toHaveValue("Inferno");
  await page.reload();
  await expect(townSelect).toHaveValue("Inferno");
});

test("controls default to the header and both display preferences persist", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const app = page.locator(".planner-app");
  const controls = page.locator(".planner-controls");
  const townList = page.locator(".town-list");
  const costsButton = page.locator("#toggle-building-costs");
  const globalTotalButton = page.locator("#open-global-total");
  const moveButton = page.locator("#move-planner-controls");

  await expect(app).toHaveAttribute("data-controls-position", "header");
  await expect(app).toHaveAttribute("data-building-costs", "hidden");
  await expect(costsButton).toHaveAccessibleName("Show construction costs");
  await expect(moveButton).toHaveAccessibleName("Move controls to footer");

  const headerLayout = await page.evaluate(() => {
    const controls = document.querySelector(".planner-controls").getBoundingClientRect();
    const towns = document.querySelector(".town-list").getBoundingClientRect();
    const costs = document.querySelector("#toggle-building-costs").getBoundingClientRect();
    const total = document.querySelector("#open-global-total").getBoundingClientRect();
    return {
      controlsAboveTowns: controls.bottom < towns.top,
      costsLeftOfTotal: costs.right <= total.left,
    };
  });
  expect(headerLayout).toEqual({
    controlsAboveTowns: true,
    costsLeftOfTotal: true,
  });

  const relocation = await moveButton.evaluate((button) => {
    const controls = document.querySelector(".planner-controls");
    const content = document.querySelector(".planner-content");
    const previousContentTop = content.getBoundingClientRect().top;
    button.click();
    const contentAnimation = content.getAnimations().find(
      (animation) => animation.animationName === "relocate-planner-content",
    );
    const timing = contentAnimation.effect.getTiming();
    contentAnimation.currentTime = 0;
    const delayedContentTop = content.getBoundingClientRect().top;
    contentAnimation.currentTime = timing.delay + timing.duration / 2;
    const halfwayContentTop = content.getBoundingClientRect().top;
    const offset = Number.parseFloat(
      content.style.getPropertyValue("--planner-content-offset-y"),
    );
    return {
      controlAnimations: controls.getAnimations()
        .map((animation) => animation.animationName),
      contentAnimation: contentAnimation.animationName,
      delay: timing.delay,
      duration: timing.duration,
      previousContentTop,
      delayedContentTop,
      halfwayContentTop,
      finalContentTop: previousContentTop - offset,
    };
  });
  expect(relocation.controlAnimations).toContain("relocate-planner-controls");
  expect(relocation.contentAnimation).toBe("relocate-planner-content");
  expect(relocation.delay).toBe(80);
  expect(relocation.duration).toBe(420);
  expect(relocation.delayedContentTop).toBeCloseTo(
    relocation.previousContentTop,
    0,
  );
  expect(relocation.halfwayContentTop).toBeLessThan(
    relocation.previousContentTop,
  );
  expect(relocation.halfwayContentTop).toBeGreaterThan(
    relocation.finalContentTop,
  );
  await expect(app).toHaveAttribute("data-controls-position", "footer");
  await expect(moveButton).toHaveAccessibleName("Move controls to header");
  await expect(controls).not.toHaveClass(/is-relocating/);
  await expect(page.locator(".planner-content")).not.toHaveClass(/is-relocating/);

  const footerLayout = await page.evaluate(() => {
    const controls = document.querySelector(".planner-controls").getBoundingClientRect();
    const external = document.querySelector(".external-layout").getBoundingClientRect();
    return controls.top > external.bottom;
  });
  expect(footerLayout).toBe(true);

  await costsButton.click();
  await expect(app).toHaveAttribute("data-building-costs", "shown");
  await expect(costsButton).toHaveAccessibleName("Hide construction costs");
  await expect(costsButton).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => JSON.parse(
    localStorage.getItem("hota-production-planner-preferences"),
  ))).toEqual({
    showBuildingCosts: true,
    controlsPosition: "footer",
  });

  await page.reload();
  await expect(app).toHaveAttribute("data-controls-position", "footer");
  await expect(app).toHaveAttribute("data-building-costs", "shown");
  await expect(controls).toBeVisible();
  await expect(globalTotalButton).toBeVisible();

  await moveButton.click();
  await costsButton.click();
  await page.reload();
  await expect(app).toHaveAttribute("data-controls-position", "header");
  await expect(app).toHaveAttribute("data-building-costs", "hidden");
});

test("moving controls respects reduced-motion preferences", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const result = await page.locator("#move-planner-controls").evaluate((button) => {
    const controls = document.querySelector(".planner-controls");
    const content = document.querySelector(".planner-content");
    const previousContentTop = content.getBoundingClientRect().top;
    button.click();
    return {
      contentMovedUp: content.getBoundingClientRect().top < previousContentTop,
      controlAnimations: controls.getAnimations().length,
      contentAnimations: content.getAnimations().length,
    };
  });

  expect(result).toEqual({
    contentMovedUp: true,
    controlAnimations: 0,
    contentAnimations: 0,
  });
});

test("adding a town smoothly scrolls to the new town", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.__newTownScroll = null;
    Element.prototype.scrollIntoView = function (options) {
      if (!this.matches(".town-section")) return;
      window.__newTownScroll = {
        id: this.getAttribute("data-town-id"),
        behavior: options?.behavior,
        block: options?.block,
      };
    };
  });

  await addTown(page, "Cove");

  await expect
    .poll(() => page.evaluate(() => window.__newTownScroll))
    .toEqual({
      id: "town-2",
      behavior: "smooth",
      block: "start",
    });
});

test("town labels can be edited independently from their type and persist", async ({
  page,
}) => {
  await page.goto("/");

  const town = page.locator(".town-section").first();
  await town.getByRole("button", { name: "Rename Town 1" }).click();

  const labelInput = town.getByRole("textbox", { name: "Town name" });
  await expect(labelInput).toBeFocused();
  await expect(labelInput).toHaveValue("Town 1");
  await labelInput.fill("Home Base");
  await labelInput.press("Enter");

  await expect(town.locator("h2")).toHaveText("Home Base");
  await page.locator("#town-select").selectOption("Inferno");
  await expect(town.locator(".town-section-header .eyebrow")).toHaveText("Inferno");
  await expect(town.locator("h2")).toHaveText("Home Base");
  await expect(town.locator(".result-context")).toHaveText(
    "Home Base · Inferno · Fort",
  );

  await page.locator("#save-state").click();
  await page.reload();
  await expect(page.locator(".town-section h2")).toHaveText("Home Base");
  await expect(page.locator("#town-select")).toHaveValue("Inferno");
});

test("P toggles global totals without hijacking form fields", async ({ page }) => {
  await page.goto("/");

  const dialog = page.locator(".global-total-dialog");
  await expect(page.locator("#add-town-search")).toHaveAttribute(
    "aria-controls",
    /.+/,
  );
  await page.keyboard.press("p");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("p");
  await expect(dialog).toBeHidden();
  await page.keyboard.press("p");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  const search = page.locator("#external-dwelling-search");
  await search.focus();
  await search.press("p");
  await expect(search).toHaveValue("p");
  await expect(dialog).toBeHidden();

  const townSearch = page.locator("#add-town-search");
  await townSearch.focus();
  await townSearch.press("t");
  await expect(townSearch).toHaveValue("t");
});

test("U toggles building costs without hijacking text fields", async ({
  page,
}) => {
  await page.setViewportSize({ width: 350, height: 800 });
  await page.goto("/");

  const app = page.locator(".app-shell");
  const costs = page.locator("#unit-grid .next-dwelling-cost");
  const firstCard = page.locator("#unit-grid .unit-card").first();
  const firstCost = firstCard.locator(".next-dwelling-cost");
  const fortificationCost = page.locator(".fortification-cost");
  const townSearch = page.locator("#add-town-search");

  await expect(app).toHaveAttribute("data-building-costs", "hidden");
  await expect(costs).toHaveCount(7);
  await expect(firstCost).toBeHidden();
  await page.locator("#fortification-cycle").click();
  await expect(fortificationCost).toBeHidden();

  await townSearch.focus();
  await townSearch.press("u");
  await expect(townSearch).toHaveValue("u");
  await expect(app).toHaveAttribute("data-building-costs", "hidden");
  await townSearch.fill("");
  await townSearch.evaluate((input) => input.blur());

  await page.keyboard.press("u");
  await expect(app).toHaveAttribute("data-building-costs", "shown");
  await expect(
    page.locator("#unit-grid .next-dwelling-cost:visible"),
  ).toHaveCount(7);
  await expect(firstCost.locator(".cost-item b")).toHaveText(["1,000", "5"]);
  await expect(firstCost.locator(".resource-icon-gold")).toHaveCount(1);
  await expect(firstCost.locator(".resource-icon-ore")).toHaveCount(1);
  await expect(fortificationCost.locator(".cost-item b")).toHaveText([
    "5,000",
    "10",
    "10",
  ]);

  await firstCard.locator(".unit-card-cycle-action").press("Enter");
  await expect(firstCard).toHaveAttribute("data-stage", "1");
  await expect(firstCost).toHaveText("No further upgrade");

  await firstCard.locator(".unit-card-cycle-action").press("Enter");
  await expect(firstCard).toHaveAttribute("data-stage", "-1");
  await expect(firstCost.locator(".cost-item b")).toHaveText(["500", "10"]);

  await page.locator("#town-select").selectOption("Cove");
  const pirateCard = page.locator("#unit-grid .unit-card").nth(2);
  const pirateCost = pirateCard.locator(".next-dwelling-cost");

  await pirateCard.locator(".unit-card-cycle-action").press("Enter");
  await expect(pirateCost.locator(".cost-item b")).toHaveText(["1,500", "5"]);
  await pirateCard.locator(".unit-card-cycle-action").press("Enter");
  await expect(pirateCost.locator(".cost-item b")).toHaveText([
    "3,000", "5", "5", "5", "5", "5", "5",
  ]);
  await pirateCard.locator(".unit-card-cycle-action").press("Enter");
  await expect(pirateCard).toHaveAttribute("data-stage", "2");
  await expect(pirateCost).toHaveText("No further upgrade");

  const pageWidth = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(pageWidth.document).toBeLessThanOrEqual(pageWidth.viewport);

  await page.keyboard.press("u");
  await expect(app).toHaveAttribute("data-building-costs", "hidden");
  await expect(pirateCost).toBeHidden();
  await expect(fortificationCost).toBeHidden();
});

test("pending fortifications advance, total, persist, and clear with faction changes", async ({
  page,
}) => {
  await page.goto("/");

  const town = page.locator(".town-section").first();
  const fortification = town.locator(".fortification-cycle-button");
  const oneTime = town.locator("[data-one-time-costs]");
  const firstProduction = town
    .locator(".unit-card")
    .first()
    .locator(".production-detail strong");

  await expect(fortification).toHaveAttribute("data-fortification", "fort");
  await expect(fortification).toHaveAttribute("data-pending", "false");
  await expect(fortification.locator(".fortification-cost")).toBeHidden();

  await fortification.click({ button: "middle" });
  await expect(fortification).toHaveAttribute("data-fortification", "citadel");
  await expect(fortification).toHaveAttribute("data-pending", "true");
  await expect(fortification.locator(".fortification-pending-clock")).toBeVisible();
  await expect(firstProduction).toHaveText("21");
  await expect(oneTime.locator(".one-time-cost-label")).toHaveText(
    "Building Citadel",
  );
  await expect(oneTime.locator(".one-time-cost-value .cost-item b")).toHaveText([
    "2,500",
    "5",
  ]);
  await expect(oneTime.locator(".one-time-subtotal .cost-item b")).toHaveText([
    "2,500",
    "5",
  ]);

  await page.locator("#open-global-total").click();
  const globalDialog = page.locator(".global-total-dialog");
  const citadelLineItem = globalDialog
    .locator(".results-cost-line-item")
    .filter({ hasText: "Building Citadel" });
  await expect(citadelLineItem.locator(".results-line-item-cost .cost-item b"))
    .toHaveText(["2,500", "5"]);
  await expect(
    globalDialog.locator("#global-resource-totals .resource-total"),
  ).toHaveText(["3,760 gold", "5 ore"]);
  await globalDialog.getByRole("button", { name: "Close" }).click();

  await fortification.click();
  await expect(fortification).toHaveAttribute("data-fortification", "citadel");
  await expect(fortification).toHaveAttribute("data-pending", "false");
  await expect(oneTime).toHaveCount(0);

  await fortification.press("Shift+Enter");
  await expect(fortification).toHaveAttribute("data-fortification", "castle");
  await expect(fortification).toHaveAttribute("data-pending", "true");
  await expect(firstProduction).toHaveText("28");
  await expect(oneTime.locator(".one-time-cost-label")).toHaveText(
    "Building Castle",
  );

  await oneTime.getByRole("button", { name: "Cancel building Castle" }).click();
  await expect(fortification).toHaveAttribute("data-fortification", "citadel");
  await expect(fortification).toHaveAttribute("data-pending", "false");
  await fortification.press("Shift+Enter");

  await page.locator("#save-state").click();
  const savedState = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("hota-production-planner-state")));
  expect(savedState.townPlans[0].pendingFortification).toBe("castle");
  await page.reload();

  await expect(fortification).toHaveAttribute("data-fortification", "castle");
  await expect(fortification).toHaveAttribute("data-pending", "true");
  await expect(oneTime.locator(".one-time-cost-label")).toHaveText(
    "Building Castle",
  );

  await town.locator("select").first().selectOption("Inferno");
  await expect(fortification).toHaveAttribute("data-fortification", "citadel");
  await expect(fortification).toHaveAttribute("data-pending", "false");
  await expect(oneTime).toHaveCount(0);

  const secondDwelling = town.locator(".unit-card").nth(1);
  await fortification.press("Shift+Enter");
  await secondDwelling.locator(".production-card-body").click({ button: "middle" });
  await expect(oneTime.locator(".one-time-cost-group")).toHaveCount(2);
  await oneTime.getByRole("button", { name: "Cancel all" }).click();
  await expect(fortification).toHaveAttribute("data-fortification", "citadel");
  await expect(fortification).toHaveAttribute("data-pending", "false");
  await expect(secondDwelling).toHaveAttribute("data-stage", "-1");
  await expect(oneTime).toHaveCount(0);

  await fortification.press("Shift+Enter");
  await secondDwelling.locator(".production-card-body").click({ button: "middle" });
  await oneTime.getByRole("button", { name: "Confirm all" }).click();
  await expect(fortification).toHaveAttribute("data-fortification", "castle");
  await expect(fortification).toHaveAttribute("data-pending", "false");
  await expect(secondDwelling).toHaveAttribute("data-stage", "0");
  await expect(secondDwelling).toHaveAttribute("data-pending", "false");
  await expect(oneTime).toHaveCount(0);

  await fortification.press("Shift+Enter");
  await expect(fortification).toHaveAttribute("data-fortification", "castle");
  await expect(fortification).toHaveAttribute("data-pending", "false");
});

test("pending construction advances, confirms, cancels, and uses compact one-time rows", async ({
  page,
}) => {
  await page.goto("/");

  const town = page.locator(".town-section").first();
  const cards = town.locator(".unit-card");
  const archer = cards.nth(1);
  const archerBody = archer.locator(".production-card-body");
  const archerAction = archer.locator(".unit-card-cycle-action");
  const oneTime = town.locator("[data-one-time-costs]");
  const weeklyDetail = town
    .locator("#results-body tr")
    .first()
    .locator("td")
    .first()
    .locator("small");
  const weeklyCreatureName = town
    .locator("#results-body .results-creature-name")
    .first();
  const cardCreatureName = cards.first().locator(".creature-name");

  await expect(oneTime).toHaveCount(0);
  await expect(weeklyDetail).toHaveText("➀ · Basic");
  await expect(weeklyDetail).not.toContainText("Guardhouse");
  await expect(weeklyDetail).toHaveAttribute("aria-label", "➀ · Basic");
  await expect(weeklyDetail.locator(".results-detail-part")).toHaveText([
    "➀ · Basic",
  ]);
  await expect(weeklyCreatureName).toHaveCSS("overflow-wrap", "normal");
  await expect(weeklyCreatureName).toHaveCSS("word-break", "normal");
  await expect(weeklyCreatureName).toHaveCSS("hyphens", "none");
  await expect(cardCreatureName).toHaveCSS("overflow-wrap", "normal");
  await expect(cardCreatureName).toHaveCSS("word-break", "normal");
  await expect(cardCreatureName).toHaveCSS("hyphens", "none");
  await archerBody.click({ button: "middle" });

  await expect(archer).toHaveAttribute("data-stage", "0");
  await expect(archer).toHaveAttribute("data-pending", "true");
  await expect(archer.locator(".pending-clock")).toBeVisible();
  await expect(oneTime).toBeVisible();
  await expect(oneTime.locator(".eyebrow")).toHaveText("One-time costs");
  await expect(oneTime).not.toContainText("Dwelling");

  const oneTimeRows = oneTime.locator(".one-time-cost-row");
  await expect(oneTimeRows).toHaveCount(2);
  await expect(oneTimeRows.locator(".one-time-cost-label")).toHaveText([
    "Building Archers' Tower",
    "➁ Archer ×9",
  ]);
  await expect(oneTimeRows.nth(0).locator(".cost-item b")).toHaveText([
    "1,000",
    "5",
    "5",
  ]);
  await expect(oneTimeRows.nth(1).locator(".cost-item b")).toHaveText("900");
  await expect(oneTime.locator(".one-time-cost-value")).toHaveCount(2);
  await expect(oneTime.locator(".one-time-subtotal .cost-item b")).toHaveText([
    "1,900",
    "5",
    "5",
  ]);
  const entryClose = oneTime.getByRole("button", {
    name: "Cancel building Archers' Tower",
  });
  await expect(entryClose).toHaveCSS("width", "18px");
  const [dwellingCostBox, entryCloseBox] = await Promise.all([
    oneTimeRows.nth(0).locator(".one-time-cost-value").boundingBox(),
    entryClose.boundingBox(),
  ]);
  expect(entryCloseBox.x).toBeGreaterThan(
    dwellingCostBox.x + dwellingCostBox.width,
  );
  const creaturePriceBox = await oneTimeRows
    .nth(1)
    .locator(".one-time-cost-value")
    .boundingBox();
  expect(creaturePriceBox.x + creaturePriceBox.width).toBeCloseTo(
    dwellingCostBox.x + dwellingCostBox.width,
    0,
  );
  await expect(oneTime.getByRole("button", { name: "Confirm all" })).toBeVisible();
  await expect(oneTime.getByRole("button", { name: "Cancel all" })).toBeVisible();

  await page.locator("#open-global-total").click();
  const globalDialog = page.locator(".global-total-dialog");
  await expect(globalDialog.locator("h2")).toHaveText("Global total");
  await expect(globalDialog.locator(".eyebrow")).toHaveText(
    "Weekly + one-time",
  );
  await expect(globalDialog.locator(".result-context")).toContainText(
    "Includes pending one-time costs",
  );
  await expect(
    globalDialog.locator("#global-resource-totals .resource-total"),
  ).toHaveText(["3,640 gold", "5 wood", "5 ore"]);
  const archerRows = globalDialog
    .locator("#global-results-body tr:not(.results-cost-line-item)")
    .filter({ hasText: "Archer" });
  await expect(archerRows).toHaveCount(2);
  const oneTimeArcherRow = archerRows.filter({ hasText: "One-time" });
  await expect(oneTimeArcherRow).toHaveClass(/results-one-time-creature/);
  await expect(oneTimeArcherRow.locator("td")).toHaveText([
    "ArcherTown 1 · One-time",
    "9 units",
    "100 gold",
    "900 gold",
  ]);
  await expect(
    archerRows.filter({ hasNotText: "One-time" }).locator("td"),
  ).toHaveText([
    "ArcherTown 1",
    "9 units",
    "100 gold",
    "900 gold",
  ]);
  const buildingLineItem = globalDialog
    .locator("#global-results-body .results-cost-line-item")
    .filter({ hasText: "Building Archers' Tower" });
  await expect(buildingLineItem.locator(".results-line-item-name")).toHaveText(
    "Building Archers' Tower",
  );
  await expect(buildingLineItem.locator("td").first().locator("small")).toHaveText(
    "Town 1",
  );
  await expect(buildingLineItem.locator(".results-not-applicable")).toHaveText([
    "—",
    "—",
  ]);
  await expect(
    buildingLineItem.locator(".results-line-item-cost .cost-item b"),
  ).toHaveText(["1,000", "5", "5"]);
  await expect(globalDialog.locator(".results-table th")).toHaveText([
    "Item",
    "Units",
    "Each",
    "Cost",
  ]);
  await globalDialog.getByRole("button", { name: "Close" }).click();

  const panelOrder = await town
    .locator(".results-section")
    .evaluateAll((sections) => sections.map((section) =>
      section.classList.contains("one-time-results-section")
        ? "one-time"
        : "weekly"));
  expect(panelOrder.slice(0, 2)).toEqual(["one-time", "weekly"]);

  await entryClose.click();
  await expect(archer).toHaveAttribute("data-stage", "-1");
  await expect(archer).toHaveAttribute("data-pending", "false");
  await expect(oneTime).toHaveCount(0);

  await page.locator("#open-global-total").click();
  await expect(globalDialog.locator("h2")).toHaveText("Global weekly total");
  await expect(
    globalDialog.locator("#global-resource-totals .resource-total"),
  ).toHaveText(["840 gold"]);
  await globalDialog.getByRole("button", { name: "Close" }).click();

  await archerAction.press("Shift+Enter");
  await expect(archer).toHaveAttribute("data-stage", "0");
  await expect(archer).toHaveAttribute("data-pending", "true");

  await archerAction.press("Enter");
  await expect(archer).toHaveAttribute("data-stage", "0");
  await expect(archer).toHaveAttribute("data-pending", "false");

  await archerAction.press("Shift+Enter");
  await expect(archer).toHaveAttribute("data-stage", "1");
  await expect(archer).toHaveAttribute("data-pending", "true");
  await expect(oneTime.locator(".eyebrow")).toHaveText("One-time costs");
  await expect(oneTimeRows).toHaveCount(1);
  await expect(oneTimeRows.locator(".one-time-cost-label")).toHaveText(
    "Upgrading Archers' Tower",
  );

  await page.locator("#open-global-total").click();
  const upgradingLineItem = globalDialog
    .locator("#global-results-body .results-cost-line-item")
    .filter({ hasText: "Upgrading Archers' Tower" });
  await expect(upgradingLineItem.locator(".results-line-item-name")).toHaveText(
    "Upgrading Archers' Tower",
  );
  await expect(
    upgradingLineItem.locator(".results-line-item-cost .cost-item b"),
  ).toHaveText(["1,000", "5", "5"]);
  await globalDialog.getByRole("button", { name: "Close" }).click();

  await oneTime.getByRole("button", { name: "Confirm all" }).click();
  await expect(archer).toHaveAttribute("data-stage", "1");
  await expect(archer).toHaveAttribute("data-pending", "false");
  await expect(oneTime).toHaveCount(0);

  await archerAction.press("Shift+Enter");
  await expect(archer).toHaveAttribute("data-stage", "1");
  await expect(archer).toHaveAttribute("data-pending", "false");
});

test("a many-resource one-time subtotal stays on one line", async ({ page }) => {
  for (const width of [1280, 350]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.locator(".town-section select").first().selectOption("Inferno");

    const cards = page.locator(".town-section").first().locator(".unit-card");
    for (const dwellingIndex of [5, 6]) {
      await cards
        .nth(dwellingIndex)
        .locator(".production-card-body")
        .click({ button: "middle" });
    }

    const subtotal = page.locator(".one-time-subtotal");
    await expect(subtotal.locator(".cost-item")).toHaveCount(6);
    await expect(subtotal.locator(".cost-item b")).toHaveText([
      "23,500",
      "10",
      "20",
      "24",
      "3",
      "3",
    ]);
    const layout = await subtotal.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      itemTops: [...element.querySelectorAll(".cost-item")].map(
        (item) => item.getBoundingClientRect().top,
      ),
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect(new Set(layout.itemTops.map(Math.round)).size).toBe(1);
  }
});

test("multiple pending dwellings are independent, individually cancelable, persistent, and faction-scoped", async ({
  page,
}) => {
  await page.goto("/");
  await addTown(page, "Cove");

  const towns = page.locator(".town-section");
  const castle = towns.nth(0);
  const cove = towns.nth(1);
  const castleFirst = castle.locator(".unit-card").nth(0);
  const castleThird = castle.locator(".unit-card").nth(2);
  const coveSecond = cove.locator(".unit-card").nth(1);

  await castleFirst.locator(".production-card-body").click({ button: "middle" });
  await coveSecond.locator(".production-card-body").click({ button: "middle" });
  await expect(page.locator(".unit-card[data-pending=true]")).toHaveCount(2);
  await expect(page.locator("[data-one-time-costs]")).toHaveCount(2);

  await castleThird.locator(".production-card-body").click({ button: "middle" });
  await expect(castleFirst).toHaveAttribute("data-stage", "1");
  await expect(castleFirst).toHaveAttribute("data-pending", "true");
  await expect(castleThird).toHaveAttribute("data-stage", "0");
  await expect(castleThird).toHaveAttribute("data-pending", "true");
  await expect(coveSecond).toHaveAttribute("data-pending", "true");
  await expect(page.locator(".unit-card[data-pending=true]")).toHaveCount(3);

  const castleOneTime = castle.locator("[data-one-time-costs]");
  await expect(castleOneTime.locator(".one-time-cost-group")).toHaveCount(2);
  await expect(
    castleOneTime.locator(".one-time-cost-group .one-time-cost-label"),
  ).toHaveText([
    "Upgrading Guardhouse",
    "Building Griffin Tower",
    "➂ Griffin ×7",
  ]);

  await castleOneTime.getByRole("button", {
    name: "Cancel upgrading Guardhouse",
  }).click();
  await expect(castleFirst).toHaveAttribute("data-stage", "0");
  await expect(castleFirst).toHaveAttribute("data-pending", "false");
  await expect(castleThird).toHaveAttribute("data-pending", "true");
  await expect(coveSecond).toHaveAttribute("data-pending", "true");

  await castleFirst.locator(".production-card-body").click({ button: "middle" });
  await expect(castleFirst).toHaveAttribute("data-stage", "1");
  await expect(castleFirst).toHaveAttribute("data-pending", "true");
  await expect(castleOneTime.locator(".one-time-cost-group")).toHaveCount(2);

  await castleOneTime.getByRole("button", { name: "Cancel all" }).click();
  await expect(castleFirst).toHaveAttribute("data-stage", "0");
  await expect(castleFirst).toHaveAttribute("data-pending", "false");
  await expect(castleThird).toHaveAttribute("data-stage", "-1");
  await expect(castleThird).toHaveAttribute("data-pending", "false");
  await expect(castleOneTime).toHaveCount(0);
  await expect(coveSecond).toHaveAttribute("data-pending", "true");

  await castleFirst.locator(".production-card-body").click({ button: "middle" });
  await castleThird.locator(".production-card-body").click({ button: "middle" });
  await expect(castleOneTime.locator(".one-time-cost-group")).toHaveCount(2);

  await castle.locator(".fortification-cycle-button").click();
  await castle.locator(".fortification-cycle-button").click();
  await castleThird.locator('[data-external-action="increment"]').click();
  await castle
    .locator(".unit-slot")
    .nth(2)
    .locator(".horde-toggle")
    .click();
  const griffinDetail = castle
    .locator("[data-town-results] tbody tr")
    .filter({ hasText: "Griffin" })
    .locator("td")
    .first()
    .locator("small");
  await expect(griffinDetail).toHaveAttribute(
    "aria-label",
    "➂ · Basic · Griffin Bastion",
  );
  await expect(griffinDetail.locator(".results-detail-part")).toHaveText([
    "➂ · Basic",
    "Griffin Bastion",
  ]);
  await expect(
    griffinDetail.locator(".results-detail-part").last(),
  ).toHaveCSS("white-space", "nowrap");
  await expect(griffinDetail).toHaveCSS("overflow", "hidden");
  const creatureCost = castle
    .locator("[data-one-time-costs] .one-time-cost-row")
    .filter({ hasText: "➂ Griffin ×7" });
  await expect(creatureCost.locator(".cost-item b")).toHaveText("1,400");

  await page.locator("#save-state").click();
  const savedState = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("hota-production-planner-state")));
  expect(savedState.townPlans[0].pendingDwellings).toEqual([
    "Pikeman",
    "Griffin",
  ]);
  await page.reload();

  const restoredTowns = page.locator(".town-section");
  const restoredCastle = restoredTowns.nth(0);
  const restoredCove = restoredTowns.nth(1);
  await expect(
    restoredCastle.locator(".unit-card").nth(0),
  ).toHaveAttribute("data-pending", "true");
  await expect(
    restoredCastle.locator(".unit-card").nth(2),
  ).toHaveAttribute("data-pending", "true");
  await expect(
    restoredCastle.locator(".one-time-cost-group"),
  ).toHaveCount(2);
  await expect(
    restoredCove.locator(".unit-card").nth(1),
  ).toHaveAttribute("data-pending", "true");

  await restoredCastle.locator("select").first().selectOption("Inferno");
  await expect(
    restoredCastle.locator(".unit-card[data-pending=true]"),
  ).toHaveCount(0);
  await expect(restoredCastle.locator("[data-one-time-costs]")).toHaveCount(0);
  await expect(
    restoredCove.locator(".unit-card").nth(1),
  ).toHaveAttribute("data-pending", "true");
});

test("a two-finger touchend gesture toggles pending buildings", async ({
  page,
}) => {
  await page.goto("/");

  const fortification = page.locator(".fortification-cycle-button").first();
  await twoFingerTap(fortification);
  await expect(fortification).toHaveAttribute("data-fortification", "citadel");
  await expect(fortification).toHaveAttribute("data-pending", "true");

  await twoFingerTap(fortification);
  await expect(fortification).toHaveAttribute("data-fortification", "fort");
  await expect(fortification).toHaveAttribute("data-pending", "false");

  const card = page.locator(".town-section").first().locator(".unit-card").nth(1);
  const body = card.locator(".production-card-body");

  await twoFingerTap(body);
  await expect(card).toHaveAttribute("data-stage", "0");
  await expect(card).toHaveAttribute("data-pending", "true");

  await twoFingerTap(body);
  await expect(card).toHaveAttribute("data-stage", "-1");
  await expect(card).toHaveAttribute("data-pending", "false");
});
