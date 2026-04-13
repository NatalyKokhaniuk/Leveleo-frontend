import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import localeUk from '@angular/common/locales/uk';
import {
  ApplicationConfig,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';

registerLocaleData(localeUk, 'uk-UA');
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { AuthService } from './core/auth/services/auth.service';
import { DocumentTitleService } from './core/services/document-title.service';
import { ComparisonStateService } from './core/comparison/comparison-state.service';
import { FavoritesStateService } from './core/favorites/favorites-state.service';
import { CartStateService } from './core/shopping-cart/cart-state.service';
import { httpInterceptor } from './core/interceptors/interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withFetch(), withInterceptors([httpInterceptor])),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    { provide: LOCALE_ID, useValue: 'uk-UA' },

    provideTranslateService({
      fallbackLang: 'uk',
      loader: provideTranslateHttpLoader({
        prefix: '/assets/i18n/',
        suffix: '.json',
      }),
    }),
    provideAppInitializer(() => {
      inject(DocumentTitleService);
      return Promise.resolve();
    }),
    provideAppInitializer(() => {
      const auth = inject(AuthService);
      return firstValueFrom(auth.restoreSession());
    }),
    provideAppInitializer(() => {
      const fav = inject(FavoritesStateService);
      return firstValueFrom(fav.hydrateAfterAuthRestore());
    }),
    provideAppInitializer(() => {
      const cart = inject(CartStateService);
      return firstValueFrom(cart.hydrateAfterAuthRestore());
    }),
    provideAppInitializer(() => {
      const cmp = inject(ComparisonStateService);
      return firstValueFrom(cmp.hydrateAfterAuthRestore());
    }),
  ],
};
