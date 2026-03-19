import { isPlatformBrowser } from '@angular/common';
import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from './core/auth/services/auth.service';
import { FooterComponent } from './core/footer/footer.component';
import { HeaderComponent } from './core/header/header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.html',
})
export class App implements OnInit {
  private translate = inject(TranslateService);
  private platformId = inject(PLATFORM_ID);
  private authService = inject(AuthService);

  ngOnInit(): void {
    // Мова: читаємо збережену або беремо з браузера
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('lang') : null;
    const browserLang = this.translate.getBrowserLang();
    const lang = saved ?? (browserLang?.match(/en|uk/) ? browserLang : 'uk');
    this.translate.use(lang);

    this.translate.onLangChange.subscribe((e) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('lang', e.lang);
      }
    });
    if (isPlatformBrowser(this.platformId)) {
      this.authService.refreshToken().subscribe({
        next: () => {
          console.log('Refresh token succeeded');
          this.authService.restoreSession().subscribe({
            next: () => {
              console.log(this.authService.currentUser());
            },
          });
        },
        error: () => console.warn('Refresh token failed'),
      });
    }

    // Відновлення сесії відбувається в APP_INITIALIZER (app.config.ts),
    // тому тут нічого додатково робити не потрібно.
  }
}
