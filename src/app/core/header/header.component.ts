import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  effect,
  ElementRef,
  HostListener,
  inject,
  NgZone,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { filter, fromEvent, take } from 'rxjs';
import { AuthService } from '../auth/services/auth.service';
import { ThemeService } from '../services/theme.service';
import { AuthButtonsComponent } from './auth-buttons/auth-buttons.component';
import { UserMenuComponent } from './user-menu/user-menu.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    TranslateModule,
    MatButtonModule,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatIconModule,
    MatSlideToggleModule,
    MatTooltipModule,
    CommonModule,
    ReactiveFormsModule,
    UserMenuComponent,
    AuthButtonsComponent,
  ],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  themeService = inject(ThemeService);
  translate = inject(TranslateService);
  router = inject(Router);
  authService = inject(AuthService);
  private elementRef = inject(ElementRef);
  private platformId = inject(PLATFORM_ID);
  private el = inject(ElementRef);
  isMenuOpen = false;
  isHidden = signal(false);
  isFloating = signal(false);
  isSearchOpen = signal(false);
  isSearchButtonDisabled = signal(true);
  private lastScrollTop = 0;
  accumulatedDelta = 0;
  currentLang = signal<string>('uk');
  currentTheme = this.themeService.theme;
  menuItems: Record<string, string> = {
    '/about': 'HEADER.ABOUT',
    '/products': 'HEADER.PRODUCTS',
    '/promotions': 'HEADER.PROMOTIONS',
    '/contacts': 'HEADER.CONTACTS',
  };
  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.translate.onLangChange.subscribe((e) => {
        this.currentLang.set(e.lang);
      });
    }
  }
  fb = new FormBuilder();
  searchForm = this.fb.group({
    searchString: ['', [Validators.required, Validators.minLength(3)]],
  });
  @ViewChild('searchLineInput') searchInputRef!: ElementRef<HTMLInputElement>;
  private ngZone = inject(NgZone);

  get isDark(): boolean {
    return this.themeService.theme() === 'dark';
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  switchLang(lang: string): void {
    this.translate.use(lang);
  }

  home() {
    this.router.navigate(['/']);
  }
  onEnterPress() {
    const query = this.searchForm.get('searchString')?.value;
    if (query && query.length >= 3) {
      this.router.navigate(['/search-results'], {
        queryParams: { searchString: query },
      });
    }
  }
  onSubmitSearchButton() {
    this.router.navigate(['search-results'], {
      queryParams: this.searchForm.value,
    });
    this.isSearchOpen.set(false);
    this.searchForm.reset();
  }
  openFavourite() {
    this.router.navigate(['/favorites']);
  }
  openComparison() {
    this.router.navigate(['/comparison']);
  }

  openSearch() {
    this.isSearchOpen.set(!this.isSearchOpen());

    this.searchForm.reset();
    if (isPlatformBrowser(this.platformId)) {
      this.ngZone.onStable
        .asObservable()
        .pipe(take(1))
        .subscribe(() => {
          this.searchInputRef?.nativeElement.focus();
        });
    }
  }
  get menuItemKeys(): string[] {
    return Object.keys(this.menuItems);
  }
  @HostListener('window:scroll', [])
  onWindowScroll() {
    const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const delta = currentScrollTop - this.lastScrollTop;

    this.accumulatedDelta += delta;

    const threshold = 10;

    if (this.accumulatedDelta > threshold) {
      this.isHidden.set(true);
      this.isFloating.set(false);
      this.accumulatedDelta = 0;
    } else if (this.accumulatedDelta < -threshold) {
      this.isFloating.set(true);
      this.isHidden.set(false);
      this.accumulatedDelta = 0;
    }

    this.lastScrollTop = currentScrollTop <= 0 ? 0 : currentScrollTop;
    this.isSearchOpen.set(false);
  }

  // logout() {
  //   this.authService.logout();
  // }
  constructor() {
    effect(() => {
      this.searchForm.valueChanges.subscribe(() => {
        this.isSearchButtonDisabled.set(!this.searchForm.valid);
      });
    });
    if (isPlatformBrowser(this.platformId)) {
      this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
        window.scrollTo({ top: 0, behavior: 'auto' });
      });
    }

    if (isPlatformBrowser(this.platformId)) {
      fromEvent<MouseEvent>(document, 'click')
        .pipe(
          takeUntilDestroyed(),
          filter((event) => {
            const wrapper =
              this.elementRef.nativeElement.querySelector('#menuWrapper') ||
              this.elementRef.nativeElement;
            return !wrapper.contains(event.target as Node) && this.isMenuOpen;
          }),
        )
        .subscribe(() => (this.isMenuOpen = false));
      fromEvent<MouseEvent>(document, 'click')
        .pipe(
          takeUntilDestroyed(),
          filter((event) => {
            const searchInput =
              this.elementRef.nativeElement.querySelector('#searchInput') ||
              this.elementRef.nativeElement;
            return !searchInput.contains(event.target as Node) && this.isSearchOpen();
          }),
        )
        .subscribe(() => this.isSearchOpen.set(false));
    }
  }
}
