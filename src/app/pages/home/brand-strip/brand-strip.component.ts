import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, fromEvent, of } from 'rxjs';
import { brandLocalizedName } from '../../../features/brands/brand-display-i18n';
import { BrandService } from '../../../features/brands/brand.service';
import { BrandResponseDto } from '../../../features/brands/brand.types';

/** Детерміновані «випадкові» іконки для бренду (поки без логотипів з API). */
const BRAND_ICON_POOL = [
  'store',
  'music_note',
  'piano',
  'album',
  'mic',
  'headphones',
  'speaker',
  'graphic_eq',
  'nightlife',
  'library_music',
  'audiotrack',
  'radio',
  'queue_music',
  'interests',
];

@Component({
  selector: 'app-home-brand-strip',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, MatIconModule, MatButtonModule],
  templateUrl: './brand-strip.component.html',
  styleUrl: './brand-strip.component.scss',
})
export class HomeBrandStripComponent implements OnInit {
  private brandsApi = inject(BrandService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  private lang = signal(this.translate.currentLang || 'uk');
  brands = signal<BrandResponseDto[]>([]);
  loading = signal(true);
  expanded = signal(false);

  /** Скільки карток у одному рядку залежно від ширини вікна. */
  rowCount = signal(5);

  /** Відповідає grid-cols-2 / sm:3 / md:4 / lg:5 / xl:6 у шаблоні. */
  private updateRowCount(): void {
    if (typeof window === 'undefined') {
      return;
    }
    const w = window.innerWidth;
    if (w < 640) {
      this.rowCount.set(2);
    } else if (w < 768) {
      this.rowCount.set(3);
    } else if (w < 1024) {
      this.rowCount.set(4);
    } else if (w < 1280) {
      this.rowCount.set(5);
    } else {
      this.rowCount.set(6);
    }
  }

  visibleBrands = computed(() => {
    const list = this.brands();
    const n = this.rowCount();
    if (this.expanded() || list.length <= n) {
      return list;
    }
    return list.slice(0, n);
  });

  showToggle = computed(() => this.brands().length > this.rowCount());

  ngOnInit(): void {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((e) => {
      this.lang.set(e.lang);
    });

    this.updateRowCount();
    if (typeof window !== 'undefined') {
      fromEvent(window, 'resize')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.updateRowCount());
    }

    this.brandsApi
      .getAll()
      .pipe(
        catchError(() => of([] as BrandResponseDto[])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((list) => {
        const active = [...list].filter((b) => b != null).sort((a, b) => a.name.localeCompare(b.name));
        this.brands.set(active);
        this.loading.set(false);
      });
  }

  label(brand: BrandResponseDto): string {
    return brandLocalizedName(brand, this.lang());
  }

  iconFor(brand: BrandResponseDto, index: number): string {
    let h = 0;
    for (let i = 0; i < brand.id.length; i++) {
      h += brand.id.charCodeAt(i);
    }
    return BRAND_ICON_POOL[(h + index * 7) % BRAND_ICON_POOL.length];
  }

  toggle(): void {
    this.expanded.update((v) => !v);
  }
}
