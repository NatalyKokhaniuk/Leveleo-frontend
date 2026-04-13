import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';

const BRAND = 'Leveleo';

/**
 * Вкладка браузера: «Leveleo» на головній, «404» на /internal-server-error,
 * «Leveleo — …» на інших (через route data або {@link setLeveleoPage}).
 */
@Injectable({ providedIn: 'root' })
export class DocumentTitleService {
  private title = inject(Title);
  private translate = inject(TranslateService);
  private router = inject(Router);

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.applyFromRoute());

    this.translate.onLangChange.subscribe(() => this.applyFromRoute());

    queueMicrotask(() => this.applyFromRoute());
  }

  /** Динамічна назва сторінки (товар, список з заголовком тощо). */
  setLeveleoPage(pageName: string): void {
    const name = pageName?.trim();
    if (!name) {
      this.applyFromRoute();
      return;
    }
    this.title.setTitle(`${BRAND} - ${name}`);
  }

  private applyFromRoute(): void {
    let r = this.router.routerState.snapshot.root;
    while (r.firstChild) {
      r = r.firstChild;
    }
    const mode = r.data['docTitle'] as string | undefined;
    if (mode === 'brand') {
      this.title.setTitle(BRAND);
      return;
    }
    if (mode === '404') {
      this.title.setTitle('404');
      return;
    }
    const key = r.data['docTitleKey'] as string | undefined;
    if (key) {
      const suffix = this.translate.instant(key);
      if (suffix && suffix !== key) {
        this.title.setTitle(`${BRAND} - ${suffix}`);
        return;
      }
    }
    this.title.setTitle(BRAND);
  }
}
