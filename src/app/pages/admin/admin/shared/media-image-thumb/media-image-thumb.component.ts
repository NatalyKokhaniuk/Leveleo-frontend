import {
  Component,
  inject,
  Input,
  OnChanges,
  signal,
  SimpleChanges,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MediaService } from '../../../../../core/services/media.service';

/** Превʼю зображення за ключем у сховищі (pre-signed URL). */
@Component({
  selector: 'app-media-image-thumb',
  standalone: true,
  imports: [MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="flex items-center justify-start min-h-10">
      @if (loading()) {
        <mat-spinner diameter="22"></mat-spinner>
      } @else if (url()) {
        <img
          [src]="url()!"
          alt=""
          class="h-10 w-10 shrink-0 object-contain rounded-lg border border-solid"
          style="border-color: var(--color-outline-variant)"
        />
      } @else if (keyTrimmed()) {
        <mat-icon class="opacity-50">broken_image</mat-icon>
      }
    </div>
  `,
})
export class MediaImageThumbComponent implements OnChanges {
  @Input() imageKey: string | null | undefined;

  private media = inject(MediaService);

  url = signal<string | null>(null);
  loading = signal(false);
  keyTrimmed = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['imageKey']) {
      this.fetch();
    }
  }

  private fetch(): void {
    const raw = this.imageKey?.trim() ?? '';
    this.keyTrimmed.set(raw || null);
    if (!raw) {
      this.url.set(null);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.media.getSignedUrl(raw).subscribe({
      next: (r) => {
        this.url.set(r.url);
        this.loading.set(false);
      },
      error: () => {
        this.url.set(null);
        this.loading.set(false);
      },
    });
  }
}
