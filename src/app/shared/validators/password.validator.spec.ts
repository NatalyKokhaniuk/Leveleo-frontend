import { FormControl } from '@angular/forms';
import { getPasswordStrength, strongPasswordValidator } from './password.validator';

describe('password.validator', () => {
  it('getPasswordStrength evaluates rules', () => {
    const weak = getPasswordStrength('abc');
    expect(weak.minLength).toBe(false);
    expect(weak.hasDigit).toBe(false);

    const strong = getPasswordStrength('Abcdef1!');
    expect(strong.minLength).toBe(true);
    expect(strong.hasUppercase).toBe(true);
    expect(strong.hasLowercase).toBe(true);
    expect(strong.hasDigit).toBe(true);
    expect(strong.hasSpecial).toBe(true);
  });

  it('strongPasswordValidator returns errors for weak password', () => {
    const c = new FormControl('weak');
    const errors = strongPasswordValidator()(c);
    expect(errors).not.toBeNull();
    expect(errors?.['minLength']).toBe(true);
  });

  it('strongPasswordValidator passes strong password', () => {
    const c = new FormControl('Str0ng!pass');
    expect(strongPasswordValidator()(c)).toBeNull();
  });

  it('strongPasswordValidator ignores empty (required elsewhere)', () => {
    const c = new FormControl('');
    expect(strongPasswordValidator()(c)).toBeNull();
  });
});
