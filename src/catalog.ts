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
      indexDwelling(dwellingCatalog, town.name, dwelling);
      for (const creature of dwelling.variants) {
        indexExternalDwellings(
          externalDwellingCatalog,
          creature,
          town.name,
          dwelling,
        );
      }
    }
  }
  for (const dwelling of data.neutral_dwellings ?? []) {
    indexDwelling(dwellingCatalog, "Neutral", dwelling);
    for (const variant of dwelling.variants) {
      indexExternalDwellings(
        externalDwellingCatalog,
        variant,
        "Neutral",
        dwelling,
      );
    }
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
          dwelling,
          dwellingName: externalDwellingName(catalog, dwelling),
          variant: variantName(variantIndex),
        };
      }
    }
  }

  const neutral = catalog.dwellingCatalog.get(name);
  return neutral?.factionName === "Neutral"
    ? {
        creature: basicCreature(neutral.dwelling),
        factionName: neutral.factionName,
        dwelling: neutral.dwelling,
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
  dwelling: Dwelling,
): void {
  catalog.set(basicCreature(dwelling).name, {
    factionName,
    dwelling,
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
  sourceDwelling: Dwelling,
): void {
  for (const id of creature.external_dwelling_ids ?? []) {
    const externalDwelling = catalog.get(id);
    if (!externalDwelling) {
      throw new Error(`Unknown external dwelling ${id} for ${creature.name}`);
    }
    externalDwelling.recruitments.push({
      creature,
      factionName,
      dwelling: sourceDwelling,
    });
  }
}

function variantName(index: number): CreatureProfile["variant"] {
  if (index === 0) return "Basic";
  return index === 1 ? "Upgraded" : "Second upgrade";
}
