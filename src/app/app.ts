import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { FooterComponent } from './core/footer/footer/footer';
import { ScrollToTopComponent } from './core/footer/footer.component';
import { HeaderComponent } from './core/header/header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, ScrollToTopComponent],
  templateUrl: './app.html',
})
export class App implements OnInit {
  private translate = inject(TranslateService);

  async ngOnInit(): Promise<void> {
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
    // Сесію відновлює лише provideAppInitializer у app.config (один POST /auth/refresh-token).
    // Другий виклик restoreSession() тут спричиняв подвійне оновлення при ротації refresh у cookie.
  }
}
