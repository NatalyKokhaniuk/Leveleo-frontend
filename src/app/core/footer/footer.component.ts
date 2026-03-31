import { isPlatformBrowser, NgClass } from '@angular/common';
import { Component, HostListener, inject, PLATFORM_ID, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [MatIcon, NgClass],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  platformId = inject(PLATFORM_ID);
  showScrollTop = signal(false);
  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.showScrollTop.set(window.scrollY > 300);
  }
  scrollToTop() {
    if (!isPlatformBrowser(this.platformId)) return;

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }
}
