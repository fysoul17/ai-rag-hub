/** Truncate a UUID/ID to a short display form. */
export function shortId(id: string, length = 8): string {
  return id.slice(0, length);
}
