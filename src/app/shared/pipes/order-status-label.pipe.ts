import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/** Локалізований підпис OrderStatus (Pending, Processing, …). */
@Pipe({
  name: 'orderStatusLabel',
  standalone: true,
  pure: false,
})
export class OrderStatusLabelPipe implements PipeTransform {
  private translate = inject(TranslateService);

  transform(value: string | null | undefined): string {
    const v = value?.trim();
    if (!v) return '—';
    const key = `ENUM.ORDER_STATUS.${v}`;
    const t = this.translate.instant(key);
    return t !== key ? t : v;
  }
}
