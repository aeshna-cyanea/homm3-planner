const TIER_SYMBOLS = ["", "➀", "➁", "➂", "➃", "➄", "➅", "➆"];

export function tierSymbol(tier: number): string {
  return TIER_SYMBOLS[tier] ?? String(tier);
}

export function dwellingLabel(name: string, tiers: number | number[]): string {
  const values = Array.isArray(tiers) ? tiers : [tiers];
  const symbols = Array.from(new Set(values), tierSymbol).join("");
  return `${symbols} ${name}`;
}
