/**
 * Format an authored `iterated` date (an ISO `YYYY-MM-DD` from Sanity's `date` field) into a
 * readable stamp. Pinned to UTC so the server-rendered string is stable regardless of the
 * deploy region's timezone.
 */
export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  // A malformed value (Sanity's `date` field should never emit one, but the API path could)
  // yields an Invalid Date whose formatted string is the literal "Invalid Date" — drop it
  // rather than render garbage in the <time> stamp.
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
