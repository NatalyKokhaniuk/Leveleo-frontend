import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CategoryService } from '../../../features/categories/category.service';
import { CategoryResponseDto } from '../../../features/categories/category.types';
import { categoryLocalizedName } from '../../../features/categories/category-display-i18n';
import { NewsletterService } from '../../../features/newsletter/newsletter.service';
import { ThemeService } from '../../services/theme.service';

/**
 * Підвал сайту. Селектор `app-site-footer` (раніше `app-footer`).
 * Посилання «Каталог» будуються з кореневих категорій API + переклади.
 */
@Component({
  selector: 'app-site-footer',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TranslateModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './site-footer.component.html',
  styleUrl: './site-footer.component.scss',
})
export class SiteFooterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private newsletter = inject(NewsletterService);
  private snack = inject(MatSnackBar);
  private categoryService = inject(CategoryService);
  private themeService = inject(ThemeService);
  translate = inject(TranslateService);

  /** Як у хедері: світла/темна тема → відповідний логотип. */
  currentTheme = this.themeService.theme;

  year = new Date().getFullYear();
  subscribeSubmitting = signal(false);

  subscribeForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  /** Мовний ключ для перерахунку підписів каталогу. */
  private lang = signal(this.translate.currentLang || 'uk');

  /** Кореневі активні категорії з API. */
  private rootCategories = signal<CategoryResponseDto[]>([]);

  /** Посилання каталогу: один фільтр — шлях `/products/category/:slug`. */
  catalogLinks = computed(() => {
    const l = this.lang();
    return [...this.rootCategories()]
      .sort((a, b) =>
        categoryLocalizedName(a, l).localeCompare(categoryLocalizedName(b, l), undefined, {
          sensitivity: 'base',
        }),
      )
      .map((c) => ({
        name: categoryLocalizedName(c, l),
        slug: c.slug,
        link: ['/products', 'category', c.slug],
      }));
  });

  readonly infoLinks = [
    { label: 'FOOTER.ABOUT', link: '/contacts' },
    { label: 'FOOTER.DELIVERY', link: '/delivery' },
    { label: 'FOOTER.RETURN', link: '/returns' },
    { label: 'FOOTER.CONTACTS', link: '/terms' },
  ];

  goHome(): void {
    this.router.navigate(['/']);
  }

  ngOnInit(): void {
    this.translate.onLangChange.subscribe(() => {
      this.lang.set(this.translate.currentLang || 'uk');
    });

    this.categoryService.getAll().subscribe({
      next: (list) => {
        const roots = list
          .filter((c) => c.isActive && (c.parentId == null || String(c.parentId).trim() === ''))
          .sort((a, b) => a.name.localeCompare(b.name));
        this.rootCategories.set(roots);
      },
      error: () => this.rootCategories.set([]),
    });
  }

  onSubscribe(): void {
    if (this.subscribeForm.invalid) {
      this.subscribeForm.markAllAsTouched();
      return;
    }
    const raw = this.subscribeForm.get('email')?.value;
    const email = typeof raw === 'string' ? raw.trim() : '';
    if (!email) {
      return;
    }

    this.subscribeSubmitting.set(true);
    this.newsletter.subscribe({ email, source: this.newsletterSourceFromRoute() }).subscribe({
      next: (res) => {
        this.subscribeSubmitting.set(false);
        this.subscribeForm.reset();
        const msg =
          res.message && res.message.trim().length > 0
            ? res.message
            : this.translate.instant('FOOTER.NEWSLETTER_SUCCESS');
        this.snack.open(msg, 'OK', { duration: 6000 });
      },
      error: (err: unknown) => {
        this.subscribeSubmitting.set(false);
        let msg = this.translate.instant('FOOTER.NEWSLETTER_ERROR');
        if (err instanceof HttpErrorResponse && err.error && typeof err.error === 'object') {
          const body = err.error as { message?: string };
          if (typeof body.message === 'string' && body.message.trim().length > 0) {
            msg = body.message;
          }
        }
        this.snack.open(msg, 'OK', { duration: 6000 });
      },
    });
  }

  private newsletterSourceFromRoute(): string {
    const path = this.router.url.split('?')[0].split('#')[0];
    if (!path || path === '/') {
      return 'home';
    }
    return path.replace(/^\//, '').replace(/\//g, '_') || 'home';
  }
}
