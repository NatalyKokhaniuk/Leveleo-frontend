import { guidListToCsv, invalidGuidsInCsv, parseGuidCsv } from './promotion-optional.util';

const VALID = '550e8400-e29b-41d4-a716-446655440000';

describe('promotion-optional.util', () => {
  it('parseGuidCsv splits by comma and whitespace', () => {
    expect(parseGuidCsv(`${VALID}, ${VALID}`)).toEqual([VALID, VALID]);
    expect(parseGuidCsv('')).toEqual([]);
  });

  it('invalidGuidsInCsv finds bad tokens', () => {
    expect(invalidGuidsInCsv(`${VALID}, not-a-guid`)).toEqual(['not-a-guid']);
    expect(invalidGuidsInCsv(VALID)).toEqual([]);
  });

  it('guidListToCsv joins ids', () => {
    expect(guidListToCsv([VALID, 'x'])).toBe(`${VALID}, x`);
    expect(guidListToCsv(null)).toBe('');
  });
});
