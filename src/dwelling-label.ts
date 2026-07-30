const LEVEL_SYMBOLS = ["", "➀", "➁", "➂", "➃", "➄", "➅", "➆"];

export function levelSymbol(level: number): string {
  return LEVEL_SYMBOLS[level] ?? String(level);
}

export function dwellingLabel(
  name: string,
  levels: number | number[],
  variantIndex?: number,
): string {
  const values = Array.isArray(levels) ? levels : [levels];
  const symbols = Array.from(new Set(values), levelSymbol).join("");
  return `${symbols} ${dwellingDisplayName(name, variantIndex)}`;
}

export function dwellingDisplayName(
  name: string,
  variantIndex?: number,
): string {
  return name === "Frigate" && variantIndex === 2
    ? "Gunpowder Warehouse"
    : name;
}
