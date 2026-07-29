import type {
  Catalog,
  CatalogDwelling,
  CatalogExternalDwelling,
  Creature,
  CreatureData,
  CreatureProfile,
  Dwelling,
  HordeBuilding,
  Town,
} from "./types";

export function buildCatalog(data: CreatureData): Catalog {
  if (!Array.isArray(data.towns)) {
    throw new Error("Creature data is missing its towns");
  }

  const dwellingCatalog = new Map<string, CatalogDwelling>();
  const externalDwellingCatalog = new Map<string, CatalogExternalDwelling>(
    Object.entries(data.external_dwellings ?? {}).map(([id, dwelling]) => [
      id,
      { id, ...dwelling, recruitments: [] },
    ]),
  );
  for (const town of data.towns) {
    for (const dwelling of town.dwellings) {
      indexDwelling(dwellingCatalog, town.name, basicCreature(dwelling), dwelling);
      for (const creature of dwelling.variants) {
        indexExternalDwellings(
          externalDwellingCatalog,
          creature,
          town.name,
          dwelling.tier,
          dwelling.growth,
        );
      }
    }
  }
  for (const creature of data.neutral_creatures ?? []) {
    dwellingCatalog.set(creature.name, {
      factionName: "Neutral",
      creature,
      tier: creature.tier,
      growth: creature.growth,
      externalDwellingIds: creature.external_dwelling_ids ?? [],
    });
    indexExternalDwellings(
      externalDwellingCatalog,
      creature,
      "Neutral",
      creature.tier,
      creature.growth,
    );
  }

  return {
    towns: data.towns,
    dwellingCatalog,
    externalDwellingCatalog,
    fortificationBuildings: data.fortification_buildings ?? [],
  };
}

export function townByName(catalog: Catalog, name: string): Town | undefined {
  return catalog.towns.find((town) => town.name === name);
}

export function creatureProfile(
  catalog: Catalog,
  name: string,
): CreatureProfile | undefined {
  for (const town of catalog.towns) {
    for (const dwelling of town.dwellings) {
      const variantIndex = dwelling.variants.findIndex(
        (creature) => creature.name === name,
      );
      if (variantIndex >= 0) {
        return {
          creature: dwelling.variants[variantIndex],
          baseCreature: dwelling.variants[0],
          variants: dwelling.variants,
          variantIndex,
          factionName: town.name,
          tier: dwelling.tier,
          dwellingName: externalDwellingName(catalog, dwelling),
          variant: variantName(variantIndex),
        };
      }
    }
  }

  const neutral = catalog.dwellingCatalog.get(name);
  return neutral?.factionName === "Neutral"
    ? {
        creature: neutral.creature,
        factionName: neutral.factionName,
        tier: neutral.tier,
        dwellingName: neutral.externalDwellingIds[0]
          ? catalog.externalDwellingCatalog.get(neutral.externalDwellingIds[0])?.name
          : undefined,
      }
    : undefined;
}

export function basicCreature(dwelling: Dwelling): Creature {
  return dwelling.variants[0];
}

export function selectedCreature(
  dwelling: Dwelling,
  selection: number,
): Creature | undefined {
  return selection < 0 ? undefined : dwelling.variants[selection];
}

export function hordeBuilding(dwelling: Dwelling): HordeBuilding | undefined {
  return dwelling.horde;
}

export function externalDwellingName(
  catalog: Catalog,
  dwelling: Dwelling,
): string | undefined {
  const id = basicCreature(dwelling).external_dwelling_ids?.[0];
  return id ? catalog.externalDwellingCatalog.get(id)?.name : undefined;
}

export function nextSelection(dwelling: Dwelling, current: number): number {
  return current >= dwelling.variants.length - 1 ? -1 : current + 1;
}

function indexDwelling(
  catalog: Map<string, CatalogDwelling>,
  factionName: string,
  creature: Creature,
  dwelling: Dwelling,
): void {
  catalog.set(creature.name, {
    factionName,
    creature,
    tier: dwelling.tier,
    growth: dwelling.growth,
    externalDwellingIds: Array.from(
      new Set(dwelling.variants.flatMap(
        (variant) => variant.external_dwelling_ids ?? [],
      )),
    ),
  });
}

function indexExternalDwellings(
  catalog: Map<string, CatalogExternalDwelling>,
  creature: Creature,
  factionName: string,
  tier: number,
  growth: number,
): void {
  for (const id of creature.external_dwelling_ids ?? []) {
    const dwelling = catalog.get(id);
    if (!dwelling) {
      throw new Error(`Unknown external dwelling ${id} for ${creature.name}`);
    }
    dwelling.recruitments.push({ creature, factionName, tier, growth });
  }
}

function variantName(index: number): CreatureProfile["variant"] {
  if (index === 0) return "Basic";
  return index === 1 ? "Upgraded" : "Second upgrade";
}
