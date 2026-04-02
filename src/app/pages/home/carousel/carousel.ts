import {
  Component,
  signal,
  OnInit,
  OnDestroy,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-carousel',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, MatIconModule],
  templateUrl: './carousel.html',
})
export class CarouselComponent implements OnInit, OnDestroy {

  private platformId = inject(PLATFORM_ID);

  brands = [
    { name: 'Fender', color: 'bg-red-500', link: '/brands/fender' },
    { name: 'Yamaha', color: 'bg-blue-500', link: '/brands/yamaha' },
    { name: 'Roland', color: 'bg-purple-500', link: '/brands/roland' },
    { name: 'Pioneer', color: 'bg-green-500', link: '/brands/pioneer' },
    { name: 'Shure', color: 'bg-yellow-500', link: '/brands/shure' },
    { name: 'Korg', color: 'bg-pink-500', link: '/brands/korg' },
  ];

  currentIndex = signal(0);

  private intervalId: any;
  private paused = false;

  ngOnInit(): void {
    // 🔥 ГОЛОВНЕ — перевірка DOM (browser)
    if (isPlatformBrowser(this.platformId)) {
      this.startAutoSlide();
    }
  }

  ngOnDestroy(): void {
    this.stopAutoSlide();
  }

  // AUTO SLIDE
  startAutoSlide() {
    this.intervalId = setInterval(() => {
      if (!this.paused) {
        this.next();
      }
    }, 2000); // 👈 2 секунди як ти хотіла
  }

  stopAutoSlide() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  // PAUSE ON HOVER
  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  // CONTROLS
  next() {
    this.currentIndex.set(
      (this.currentIndex() + 1) % this.brands.length
    );
  }

  prev() {
    this.currentIndex.set(
      (this.currentIndex() - 1 + this.brands.length) % this.brands.length
    );
  }

  goTo(i: number) {
    this.currentIndex.set(i);
  }
}