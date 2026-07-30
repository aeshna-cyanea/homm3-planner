const { test, expect } = require("@playwright/test");

async function addTown(page, town) {
  const search = page.locator("#add-town-search");
  await search.fill(town);
  await page
    .locator(".town-search-result")
    .filter({ hasText: town })
    .click();
}

async function threeFingerTap(locator) {
  await locator.evaluate((target) => {
    const touches = [0, 1, 2].map((identifier) =>
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

test("town controls remain unique, collapsible, removable, and persistent", async ({
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

  await page.locator("#save-state").click();
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
  const townSearch = page.locator("#add-town-search");
  const dwellingCard = page.locator(".add-dwelling-card");
  const dwellingSearch = page.locator("#external-dwelling-search");

  await expect(townControl.locator(".shortcut-key")).toHaveText("T");
  await expect(dwellingCard.locator(".shortcut-key")).toHaveText("/");
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

test("U toggles the next dwelling cost without hijacking text fields", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");

  const app = page.locator(".app-shell");
  const costs = page.locator("#unit-grid .next-dwelling-cost");
  const firstCard = page.locator("#unit-grid .unit-card").first();
  const firstCost = firstCard.locator(".next-dwelling-cost");
  const townSearch = page.locator("#add-town-search");

  await expect(app).toHaveAttribute("data-dwelling-costs", "hidden");
  await expect(costs).toHaveCount(7);
  await expect(firstCost).toBeHidden();

  await townSearch.focus();
  await townSearch.press("u");
  await expect(townSearch).toHaveValue("u");
  await expect(app).toHaveAttribute("data-dwelling-costs", "hidden");
  await townSearch.fill("");
  await townSearch.evaluate((input) => input.blur());

  await page.keyboard.press("u");
  await expect(app).toHaveAttribute("data-dwelling-costs", "shown");
  await expect(
    page.locator("#unit-grid .next-dwelling-cost:visible"),
  ).toHaveCount(7);
  await expect(firstCost.locator(".cost-item b")).toHaveText(["1,000", "5"]);
  await expect(firstCost.locator(".resource-icon-gold")).toHaveCount(1);
  await expect(firstCost.locator(".resource-icon-ore")).toHaveCount(1);

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
  await expect(app).toHaveAttribute("data-dwelling-costs", "hidden");
  await expect(pirateCost).toBeHidden();
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
  await expect(oneTime.locator(".eyebrow")).toHaveText("One-time");
  await expect(oneTime).not.toContainText("Dwelling");

  const oneTimeRows = oneTime.locator(".one-time-cost-row");
  await expect(oneTimeRows).toHaveCount(2);
  await expect(oneTimeRows.locator(".one-time-cost-label")).toHaveText([
    "Construction",
    "Creatures",
  ]);
  await expect(oneTimeRows.nth(0).locator(".cost-item b")).toHaveText([
    "1,000",
    "5",
    "5",
  ]);
  await expect(oneTimeRows.nth(1).locator(".cost-item b")).toHaveText("900");
  await expect(oneTime.locator(".one-time-cost-value")).toHaveCount(2);

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
  await expect(
    globalDialog.locator("#global-results-body").locator("tr").filter({
      hasText: "Archer",
    }).locator("td"),
  ).toHaveText([
    "ArcherTown 1",
    "18 units",
    "100 gold",
    "1,800 gold",
  ]);
  await expect(globalDialog.locator(".results-table th")).toHaveText([
    "Creature",
    "Units",
    "Each",
    "Creature cost",
  ]);
  await globalDialog.getByRole("button", { name: "Close" }).click();

  const panelOrder = await town
    .locator(".results-section")
    .evaluateAll((sections) => sections.map((section) =>
      section.classList.contains("one-time-results-section")
        ? "one-time"
        : "weekly"));
  expect(panelOrder.slice(0, 2)).toEqual(["one-time", "weekly"]);

  await oneTime.getByRole("button", {
    name: "Cancel pending construction",
  }).click();
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
  await expect(oneTimeRows).toHaveCount(1);
  await expect(oneTimeRows.locator(".one-time-cost-label")).toHaveText(
    "Construction",
  );

  await archerAction.press("Shift+Enter");
  await expect(archer).toHaveAttribute("data-stage", "0");
  await expect(archer).toHaveAttribute("data-pending", "false");

  await archerAction.press("Enter");
  await expect(archer).toHaveAttribute("data-stage", "1");
  await archerAction.press("Shift+Enter");
  await expect(archer).toHaveAttribute("data-stage", "1");
  await expect(archer).toHaveAttribute("data-pending", "false");
});

test("pending dwellings are independent per town, transferable, persistent, and faction-scoped", async ({
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
  await expect(castleFirst).toHaveAttribute("data-stage", "0");
  await expect(castleFirst).toHaveAttribute("data-pending", "false");
  await expect(castleThird).toHaveAttribute("data-stage", "0");
  await expect(castleThird).toHaveAttribute("data-pending", "true");
  await expect(coveSecond).toHaveAttribute("data-pending", "true");

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
    .filter({ hasText: "Creatures" });
  await expect(creatureCost.locator(".cost-item b")).toHaveText("1,400");

  await page.locator("#save-state").click();
  await page.reload();

  const restoredTowns = page.locator(".town-section");
  const restoredCastle = restoredTowns.nth(0);
  const restoredCove = restoredTowns.nth(1);
  await expect(
    restoredCastle.locator(".unit-card").nth(2),
  ).toHaveAttribute("data-pending", "true");
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

test("a three-finger touchend gesture toggles a pending dwelling", async ({
  page,
}) => {
  await page.goto("/");

  const card = page.locator(".town-section").first().locator(".unit-card").nth(1);
  const body = card.locator(".production-card-body");

  await threeFingerTap(body);
  await expect(card).toHaveAttribute("data-stage", "0");
  await expect(card).toHaveAttribute("data-pending", "true");

  await threeFingerTap(body);
  await expect(card).toHaveAttribute("data-stage", "-1");
  await expect(card).toHaveAttribute("data-pending", "false");
});
