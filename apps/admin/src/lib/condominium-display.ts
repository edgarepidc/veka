/** Split "Residencial Las Palmas" → two lines for compact sidebar headers. */
export function splitCondominiumName(name: string): { line1: string; line2: string | null } {
  const trimmed = name.trim();
  const space = trimmed.indexOf(' ');
  if (space === -1) {
    return { line1: trimmed, line2: null };
  }
  return {
    line1: trimmed.slice(0, space),
    line2: trimmed.slice(space + 1).trim() || null,
  };
}
