import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentProviders, Provider, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { TranslateLoader, TranslateModule, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { TranslateTestLoader } from './translate-test.loader';

export const componentTestTranslateImports = [
  TranslateModule.forRoot({
    loader: { provide: TranslateLoader, useClass: TranslateTestLoader },
    defaultLanguage: 'uk',
  }),
];

export function componentTestProviders(
  extra: (Provider | EnvironmentProviders)[] = [],
): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(),
    provideHttpClientTesting(),
    provideRouter([{ path: '**', redirectTo: '' }]),
    ...extra,
  ];
}


export async function configureComponentTestBed(
  component: Type<unknown>,
  extra?: { imports?: unknown[]; providers?: (Provider | EnvironmentProviders)[] },
): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [...componentTestTranslateImports, component, ...(extra?.imports ?? [])],
    providers: componentTestProviders(extra?.providers ?? []),
  }).compileComponents();

  const translate = TestBed.inject(TranslateService);
  translate.use('uk');
}

/** Діалог Material: дані + MatDialogRef-заглушка. */
export function matDialogTestProviders<T>(data: T, extra: Provider[] = []): Provider[] {
  return [
    { provide: MAT_DIALOG_DATA, useValue: data },
    {
      provide: MatDialogRef,
      useValue: {
        close: () => undefined,
        afterClosed: () => of(undefined),
      },
    },
    ...extra,
  ];
}
