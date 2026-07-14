/** Split "Residencial Las Palmas" → primary name first, then type line. */
export function splitCondominiumName(name: string): { line1: string; line2: string | null } {
  const trimmed = name.trim();
  const space = trimmed.indexOf(' ');
  if (space === -1) {
    return { line1: trimmed, line2: null };
  }
  const prefix = trimmed.slice(0, space);
  const rest = trimmed.slice(space + 1).trim();
  if (!rest) {
    return { line1: prefix, line2: null };
  }
  // Invert: "Las Palmas" as hero, "Residencial" as supporting line.
  return {
    line1: rest,
    line2: prefix,
  };
}
