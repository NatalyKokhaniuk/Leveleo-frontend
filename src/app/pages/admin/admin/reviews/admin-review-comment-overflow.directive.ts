import { Directive, ElementRef, effect, inject, input, OnDestroy, output } from '@angular/core';

/**
 * Після накладання однорядкового clamp на host вимірює вертикальне переповнення
 * і повідомляє, чи варто показувати «…ще» / «сховати».
 */
@Directive({
  standalone: true,
  selector: '[appAdminReviewCommentOverflow]',
})
export class AdminReviewCommentOverflowDirective implements OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);

  clamped = input(false);
  overflow = output<boolean>();

  private ro?: ResizeObserver;

  constructor() {
    const el = this.host.nativeElement;
    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(el);

    effect(() => {
      this.clamped();
      requestAnimationFrame(() => this.measure());
    });
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
  }

  private measure(): void {
    const el = this.host.nativeElement;
    if (!this.clamped()) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    const over = el.scrollHeight > el.clientHeight + 1;
    this.overflow.emit(over);
  }
}
