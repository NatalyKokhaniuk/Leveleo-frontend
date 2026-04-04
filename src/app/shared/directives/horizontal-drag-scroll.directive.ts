import { Directive, ElementRef, HostListener, inject } from '@angular/core';

const INTERACTIVE =
  'button, a[href], a[routerLink], input, textarea, select, label, mat-icon, [mat-icon-button], .mat-mdc-icon-button, .mat-mdc-button-base, [mat-sort-header], .mat-sort-header, .cdk-column-actions button';

/**
 * Горизонтальний скрол контейнера перетягуванням (grab / grabbing).
 * Pointer capture — працює, коли курсор виходить за межі таблиці під час перетягування.
 */
@Directive({
  selector: '[appHorizontalDragScroll]',
  standalone: true,
  host: {
    class: 'horizontal-drag-scroll-host',
  },
})
export class HorizontalDragScrollDirective {
  private el = inject(ElementRef<HTMLElement>);
  private active = false;
  private capturedId: number | null = null;

  @HostListener('pointerdown', ['$event'])
  onPointerDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest(INTERACTIVE)) {
      return;
    }
    this.active = true;
    this.capturedId = e.pointerId;
    const host = this.el.nativeElement;
    host.classList.add('horizontal-drag-scroll--dragging');
    try {
      host.setPointerCapture(e.pointerId);
    } catch {
      this.active = false;
      this.capturedId = null;
      host.classList.remove('horizontal-drag-scroll--dragging');
      return;
    }
    e.preventDefault();
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(e: PointerEvent): void {
    if (!this.active || this.capturedId !== e.pointerId) return;
    this.el.nativeElement.scrollLeft -= e.movementX;
  }

  @HostListener('pointerup', ['$event'])
  onPointerUp(e: PointerEvent): void {
    this.finishDrag(e);
  }

  @HostListener('pointercancel', ['$event'])
  onPointerCancel(e: PointerEvent): void {
    this.finishDrag(e);
  }

  private finishDrag(e: PointerEvent): void {
    if (!this.active || this.capturedId !== e.pointerId) return;
    this.active = false;
    this.capturedId = null;
    const host = this.el.nativeElement;
    host.classList.remove('horizontal-drag-scroll--dragging');
    try {
      host.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }
}
