export function parseFriendlyTime(input: string, fallbackPeriod = "AM") {
  const match = input.trim().match(/^([0-9:]+)\s*(am|pm)?$/i);
  if (!match) return null;
  const raw = match[1],
    period = match[2]?.toUpperCase() ?? fallbackPeriod;
  let hour: number, minute: number;
  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    const p = raw.split(":");
    hour = Number(p[0]);
    minute = Number(p[1]);
  } else if (/^\d{1,4}$/.test(raw)) {
    hour = Number(raw.length <= 2 ? raw : raw.slice(0, -2));
    minute = raw.length <= 2 ? 0 : Number(raw.slice(-2));
  } else return null;
  if (hour < 1 || hour > 12 || minute > 59) return null;
  return {
    period,
    display: `${hour}:${String(minute).padStart(2, "0")} ${period.toLowerCase()}`,
    value: `${String((hour % 12) + (period === "PM" ? 12 : 0)).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}
export function parseFriendlyDate(input: string) {
  const text = input.trim();
  const match =
    text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/) ??
    text.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!match) return null;
  const [, m, d, y] = match,
    year = Number(y),
    month = Number(m),
    day = Number(d),
    date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 2000 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  const mm = m.padStart(2, "0"),
    dd = d.padStart(2, "0");
  return { display: `${mm}-${dd}-${y}`, value: `${y}-${mm}-${dd}` };
}
