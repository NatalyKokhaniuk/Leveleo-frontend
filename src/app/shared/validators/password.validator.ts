import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export interface PasswordStrengthResult {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
}

export function getPasswordStrength(password: string): PasswordStrengthResult {
  return {
    minLength:    password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasDigit:     /[0-9]/.test(password),
    hasSpecial:   /[^A-Za-z0-9]/.test(password),
  };
}

export function strongPasswordValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = control.value ?? '';
    if (!value) return null; // required validator handles empty

    const s = getPasswordStrength(value);
    const errors: ValidationErrors = {};

    if (!s.minLength)    errors['minLength']    = true;
    if (!s.hasUppercase) errors['hasUppercase'] = true;
    if (!s.hasLowercase) errors['hasLowercase'] = true;
    if (!s.hasDigit)     errors['hasDigit']     = true;
    if (!s.hasSpecial)   errors['hasSpecial']   = true;

    return Object.keys(errors).length ? errors : null;
  };
}
