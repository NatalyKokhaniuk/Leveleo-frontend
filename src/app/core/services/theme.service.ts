import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
 
export type Theme = 'light' | 'dark';
 
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
 
  // signal — реактивний стан теми
  theme = signal<Theme>('light');
 
  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Зчитуємо збережену тему з localStorage
      const saved = localStorage.getItem('theme') as Theme | null;
      const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark' : 'light';
      this.applyTheme(saved ?? preferred);
    }
  }
 
  toggleTheme(): void {
    this.applyTheme(this.theme() === 'light' ? 'dark' : 'light');
  }
 
  private applyTheme(theme: Theme): void {
    this.theme.set(theme);
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    }
  }
}
