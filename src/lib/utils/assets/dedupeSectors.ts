// A sector name can exist in more than one classification standard (e.g. a
// provider "ALPHA" sector and a user-created "USER" one share the name
// "Information Technology"). The pickers are single-select and persist by name,
// so a name must appear only once. Collapse duplicates by name, preferring the
// provider (ALPHA) entry, which keeps a stable code and group for the survivor.
export function dedupeSectorsByName<
  T extends { name: string; standard: string },
>(sectors: T[]): T[] {
  const byName = new Map<string, T>()
  for (const sector of sectors) {
    const existing = byName.get(sector.name)
    if (
      !existing ||
      (existing.standard !== "ALPHA" && sector.standard === "ALPHA")
    ) {
      byName.set(sector.name, sector)
    }
  }
  return Array.from(byName.values())
}
