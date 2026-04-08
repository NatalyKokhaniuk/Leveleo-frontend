export function parseGuidCsv(csv: string): string[] {
  return csv
    .split(/[,;\s\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const GUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export function invalidGuidsInCsv(csv: string): string[] {
  return parseGuidCsv(csv).filter((id) => !GUID_RE.test(id));
}

export function guidListToCsv(ids: string[] | null | undefined): string {
  if (!ids?.length) return '';
  return ids.join(', ');
}
