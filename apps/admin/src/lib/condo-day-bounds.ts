/** Calendar-day bounds for a condominium IANA timezone, as UTC ISO strings. */
export function condominiumDayBoundsIso(
  timeZone: string,
  now = new Date(),
): { startIso: string; endIso: string } {
  const zone = timeZone.trim() || 'America/Mexico_City';

  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = Number(dateParts.find((part) => part.type === 'year')?.value);
  const month = Number(dateParts.find((part) => part.type === 'month')?.value);
  const day = Number(dateParts.find((part) => part.type === 'day')?.value);

  function wallClock(ms: number) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(ms));

    const map = Object.fromEntries(
      parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]),
    );

    return {
      year: map.year,
      month: map.month,
      day: map.day,
      hour: map.hour,
      minute: map.minute,
      second: map.second,
    };
  }

  let cursor = Date.UTC(year, month - 1, day, 12, 0, 0);
  for (let step = 0; step < 64; step += 1) {
    const wall = wallClock(cursor);
    const dayDelta =
      Date.UTC(year, month - 1, day) - Date.UTC(wall.year, wall.month - 1, wall.day);
    cursor += dayDelta - wall.hour * 3_600_000 - wall.minute * 60_000 - wall.second * 1_000;
    const refined = wallClock(cursor);
    if (
      refined.year === year &&
      refined.month === month &&
      refined.day === day &&
      refined.hour === 0 &&
      refined.minute === 0 &&
      refined.second === 0
    ) {
      break;
    }
  }

  const start = new Date(cursor);
  const end = new Date(cursor + 86_400_000 - 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}
