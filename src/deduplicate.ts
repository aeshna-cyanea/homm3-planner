export function deduplicateBy<T, Key>(
  values: T[],
  keyFor: (value: T) => Key,
): T[] {
  const seen = new Set<Key>();
  return values.filter((value) => {
    const key = keyFor(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
