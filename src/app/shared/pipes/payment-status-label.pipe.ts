import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/** Локалізований підпис PaymentStatus (Pending, Success, …). */
@Pipe({
  name: 'paymentStatusLabel',
  standalone: true,
  pure: false,
})
export class PaymentStatusLabelPipe implements PipeTransform {
  private translate = inject(TranslateService);

  transform(value: string | null | undefined): string {
    const v = value?.trim();
    if (!v) return '—';
    const key = `ENUM.PAYMENT_STATUS.${v}`;
    const t = this.translate.instant(key);
    return t !== key ? t : v;
  }
}
