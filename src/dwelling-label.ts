const LEVEL_SYMBOLS = ["", "➀", "➁", "➂", "➃", "➄", "➅", "➆"];

export function levelSymbol(level: number): string {
  return LEVEL_SYMBOLS[level] ?? String(level);
}

export function dwellingLabel(name: string, levels: number | number[]): string {
  const values = Array.isArray(levels) ? levels : [levels];
  const symbols = Array.from(new Set(values), levelSymbol).join("");
  return `${symbols} ${name}`;
}
