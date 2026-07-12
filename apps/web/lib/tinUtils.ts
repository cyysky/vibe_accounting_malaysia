/**
 * Strip non-alphanumeric characters from a TIN and uppercase the result.
 * LHDNM TINs use a 1-2 letter prefix (e.g. "IG" for IGS, "EI" for EIN) plus
 * 8-12 digits, but TIN values may arrive with hyphens or whitespace that
 * the system should normalise before validation or storage.
 */
export function formatTin(tin: string | undefined | null): string {
  return (tin || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/**
 * Lightweight LHDNM TIN format check used for client-side hints before
 * contacting MyInvois. The MyInvois taxpayer endpoint is still the
 * authoritative source — this only catches obviously malformed inputs.
 */
export function isPlausibleLhdnmTin(tin: string | undefined | null): boolean {
  const t = formatTin(tin);
  return /^[A-Z]{0,2}[0-9]{8,12}$/.test(t);
}

/**
 * Heuristic: derive the MyInvois idType from a record. BRN takes priority
 * because BRN validation is more reliable than NRIC for businesses.
 */
export function pickMyInvoisIdType(opts: { brn?: string | null; nric?: string | null; passport?: string | null }): string {
  if (opts.brn) return "BRN";
  if (opts.nric) return "NRIC";
  if (opts.passport) return "PASSPORT";
  return "NRIC";
}

/**
 * Map an idType to the value MyInvois expects. BRN uses its own value;
 * NRIC/PASSPORT typically use the TIN itself when validating.
 */
export function pickMyInvoisIdValue(tin: string, opts: { brn?: string | null }): string {
  return opts.brn ? formatTin(opts.brn) : formatTin(tin);
}
