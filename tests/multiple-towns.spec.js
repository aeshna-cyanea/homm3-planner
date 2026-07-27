const { test, expect } = require("@playwright/test");

async function addTown(page, town) {
  const search = page.locator("#add-town-search");
  await search.fill(town);
  await page
    .locator(".town-search-result")
    .filter({ hasText: town })
    .click();
}

test("towns have independent schemes and external bonuses apply to every match", async ({
  page,
}) => {
  await page.goto("/");

  await addTown(page, "Inferno");
  await addTown(page, "Castle");

  const towns = page.locator(".town-section");
  await expect(towns).toHaveCount(3);
  await expect(towns.locator("h2")).toHaveText(["Castle 1", "Inferno", "Castle 2"]);
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
    "Castle 1 · Castle 2 · External dwellings",
  );
  await expect(pikeman.locator("td").nth(1)).toHaveText("51 units");
  await expect(pikeman.locator("td").nth(3)).toHaveText("3,060 gold");
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
  await expect(firstTown.locator(".town-layout")).toBeHidden();
  await firstTown.getByRole("button", { name: "Expand" }).click();
  await expect(firstTown.locator(".town-layout")).toBeVisible();

  await page.locator("#save-state").click();
  await page.reload();
  await expect(page.locator(".town-section")).toHaveCount(2);
  await expect(page.locator("#town-select-town-2")).toHaveValue("Cove");

  await page
    .locator(".town-section")
    .nth(1)
    .getByRole("button", { name: "Remove Cove" })
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
  await expect(page.locator(".town-section").nth(1).locator("h2")).toHaveText("Cove");
  await expect(search).toHaveValue("");
});

test("P opens global totals without hijacking form fields", async ({ page }) => {
  await page.goto("/");

  const dialog = page.locator(".global-total-dialog");
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
