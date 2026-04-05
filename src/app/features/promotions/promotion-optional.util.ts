import { OptionalJson } from './promotion.types';

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

export function optionalGuidList(ids: string[]): OptionalJson<string[]> {
  return ids.length > 0 ? { hasValue: true, value: ids } : { hasValue: false, value: null };
}

export function optionalJsonToCsv(opt: OptionalJson<string[]> | undefined): string {
  if (!opt?.hasValue || !opt.value?.length) {
    return '';
  }
  return opt.value.join(', ');
}
