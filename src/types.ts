export const RESOURCES = [
  "gold",
  "wood",
  "ore",
  "mercury",
  "sulfur",
  "crystal",
  "gem",
] as const;

export type Resource = (typeof RESOURCES)[number];
export type Cost = Partial<Record<Resource, number>>;
export type Fortification = "fort" | "citadel" | "castle";

export interface Damage {
  min: number;
  max: number;
}

export interface Creature {
  id: string;
  name: string;
  level: number;
  attack: number;
  defense: number;
  damage: Damage;
  health: number;
  speed: number;
  ai_value: number;
  cost: Cost;
  special: string;
  wiki_url: string;
  external_dwelling_ids?: string[];
}

export interface HordeBuilding {
  id: string;
  name: string;
  growth_bonus: number;
  cost: Cost;
  wiki_url: string;
}

export interface Dwelling {
  level: number;
  growth: number;
  building_cost?: Cost;
  upgrade_costs?: Cost[];
  variants: Creature[];
  horde?: HordeBuilding;
}

export interface Town {
  name: string;
  dwellings: Dwelling[];
}

export interface ExternalDwellingDefinition {
  name: string;
}

export interface FortificationBuilding {
  id: Exclude<Fortification, "fort">;
  name: string;
  cost: Cost;
  growth_multiplier: number;
  growth_rounding?: "floor";
}

export interface CreatureData {
  schema_version: number;
  ruleset: string;
  source_url: string;
  external_dwelling_source_url: string;
  external_dwellings: Record<string, ExternalDwellingDefinition>;
  horde_building_source_url: string;
  creature_count: number;
  fortification_building_count: number;
  fortification_buildings: FortificationBuilding[];
  towns: Town[];
  neutral_dwellings: Dwelling[];
}

export interface CatalogDwelling {
  factionName: string;
  dwelling: Dwelling;
  externalDwellingIds: string[];
}

export interface ExternalRecruitment {
  factionName: string;
  creature: Creature;
  dwelling: Dwelling;
}

export interface CatalogExternalDwelling extends ExternalDwellingDefinition {
  id: string;
  recruitments: ExternalRecruitment[];
}

export interface Catalog {
  towns: Town[];
  dwellingCatalog: Map<string, CatalogDwelling>;
  externalDwellingCatalog: Map<string, CatalogExternalDwelling>;
  fortificationBuildings: FortificationBuilding[];
}

export interface CreatureProfile {
  creature: Creature;
  baseCreature?: Creature;
  variants?: Creature[];
  variantIndex?: number;
  factionName: string;
  dwelling: Dwelling;
  dwellingName?: string;
  variant?: "Basic" | "Upgraded" | "Second upgrade";
}

export interface TownPlan {
  id: string;
  label: string;
  town: string;
  fortification: Fortification;
  selections: number[];
  hordeEnabled: boolean[];
  pendingDwelling: number | null;
}

export interface ExternalDwelling {
  id: string;
  count: number;
}

export interface PlannerState {
  townPlans: TownPlan[];
  externalDwellings: ExternalDwelling[];
}

export interface SavedDwelling {
  basicCreature: string | null;
  selectedCreature: string | null;
  hordeEnabled: boolean;
}

export interface SavedTownPlan {
  id: string;
  label?: string;
  town: string;
  fortification: Fortification;
  dwellings: SavedDwelling[];
  pendingDwelling?: string | null;
}

export interface SavedPlannerState {
  townPlans: SavedTownPlan[];
  externalDwellings: ExternalDwelling[];
}

export interface RecruitmentRow {
  name: string;
  detail: string;
  detailParts?: string[];
  production: number;
  unitCost: Cost;
  weeklyCost: Cost;
}

export interface PendingDwellingCosts {
  construction: Cost;
  creatures?: Cost;
}

export interface ExternalDwellingCard {
  id: string;
  name: string;
  count: number;
  recruitments: Array<
    ExternalRecruitment & { production: number; unitCost: Cost }
  >;
  production: number;
}

export type CostEntry = [resource: Resource, amount: number];
