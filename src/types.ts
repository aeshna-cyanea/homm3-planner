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
  growth: number;
  ai_value: number;
  cost: Cost;
  special: string;
  wiki_url: string;
}

export interface HordeBuilding {
  id: string;
  name: string;
  growth_bonus: number;
  cost: Cost;
  wiki_url: string;
}

export interface Dwelling {
  tier: number;
  growth: number;
  variants: Creature[];
  horde?: HordeBuilding;
}

export interface Town {
  name: string;
  dwellings: Dwelling[];
}

export interface NeutralCreature extends Creature {
  tier: number;
  growth: number;
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
  horde_building_source_url: string;
  creature_count: number;
  fortification_building_count: number;
  fortification_buildings: FortificationBuilding[];
  towns: Town[];
  neutral_creatures: NeutralCreature[];
}

export interface CatalogDwelling {
  factionName: string;
  creature: Creature;
  tier: number;
  growth: number;
}

export interface Catalog {
  towns: Town[];
  dwellingCatalog: Map<string, CatalogDwelling>;
  fortificationBuildings: FortificationBuilding[];
}

export interface CreatureProfile {
  creature: Creature;
  baseCreature?: Creature;
  variants?: Creature[];
  variantIndex?: number;
  factionName: string;
  tier: number;
  variant?: "Basic" | "Upgraded" | "Second upgrade";
}

export interface TownPlan {
  id: string;
  label: string;
  town: string;
  fortification: Fortification;
  selections: number[];
  hordeEnabled: boolean[];
}

export interface ExternalDwelling {
  basicCreature: string;
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
}

export interface SavedPlannerState {
  townPlans: SavedTownPlan[];
  externalDwellings: ExternalDwelling[];
}

export interface RecruitmentRow {
  name: string;
  detail: string;
  production: number;
  unitCost: Cost;
  weeklyCost: Cost;
}

export interface ExternalDwellingCard {
  creatureName: string;
  count: number;
  creature: Creature;
  factionName: string;
  tier: number;
  production: number;
}

export type CostEntry = [resource: Resource, amount: number];
