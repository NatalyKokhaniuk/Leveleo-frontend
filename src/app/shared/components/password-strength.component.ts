import { NgClass } from '@angular/common';
import { Component, Input, OnChanges, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { getPasswordStrength, PasswordStrengthResult } from '../validators/password.validator';


@Component({
  selector: 'app-password-strength',
  standalone: true,
  imports: [NgClass, MatIconModule, TranslateModule],
  template: `
    @if (show()) {
      <ul class="password-hints">
        @for (rule of rules; track rule.key) {
          <li class="hint-item" [ngClass]="rule.met ? 'hint-ok' : 'hint-fail'">
            <mat-icon class="hint-icon">
              {{ rule.met ? 'check_circle' : 'radio_button_unchecked' }}
            </mat-icon>
            <span>{{ rule.labelKey | translate }}</span>
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      .password-hints {
        list-style: none;
        margin: 4px 0 8px;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .hint-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.78rem;
        transition: color 200ms ease;
      }
      .hint-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }
      .hint-ok {
        color: var(--color-success);
      }
      .hint-fail {
        color: var(--color-text-secondary);
      }
    `,
  ],
})
export class PasswordStrengthComponent implements OnChanges {
  @Input() password = '';
  @Input() touched = false;

  show = signal(false);

  rules: { key: keyof PasswordStrengthResult; labelKey: string; met: boolean }[] = [
    { key: 'minLength', labelKey: 'AUTH.PASS_HINT_LENGTH', met: false },
    { key: 'hasUppercase', labelKey: 'AUTH.PASS_HINT_UPPERCASE', met: false },
    { key: 'hasLowercase', labelKey: 'AUTH.PASS_HINT_LOWERCASE', met: false },
    { key: 'hasDigit', labelKey: 'AUTH.PASS_HINT_DIGIT', met: false },
    { key: 'hasSpecial', labelKey: 'AUTH.PASS_HINT_SPECIAL', met: false },
  ];

  ngOnChanges(): void {
    // Показуємо підказки щойно користувач почав вводити
    if (this.password?.length > 0 || this.touched) {
      this.show.set(true);
    }
    if (this.password) {
      const strength = getPasswordStrength(this.password);
      this.rules = this.rules.map((r) => ({ ...r, met: strength[r.key] }));
    }
  }
}
