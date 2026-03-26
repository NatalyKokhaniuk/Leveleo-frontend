import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-carousel',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, MatIconModule],
  templateUrl: './carousel.html',
})
export class CarouselComponent {

  brands = [
    { name: 'Fender', color: 'bg-red-500', link: '/brands/fender' },
    { name: 'Yamaha', color: 'bg-blue-500', link: '/brands/yamaha' },
    { name: 'Roland', color: 'bg-purple-500', link: '/brands/roland' },
    { name: 'Pioneer', color: 'bg-green-500', link: '/brands/pioneer' },
    { name: 'Shure', color: 'bg-yellow-500', link: '/brands/shure' },
    { name: 'Korg', color: 'bg-pink-500', link: '/brands/korg' },
  ];

  currentIndex = signal(0);

  next() {
    if (this.currentIndex() < this.brands.length - 1) {
      this.currentIndex.update(v => v + 1);
    } else {
      this.currentIndex.set(0);
    }
  }

  prev() {
    if (this.currentIndex() > 0) {
      this.currentIndex.update(v => v - 1);
    } else {
      this.currentIndex.set(this.brands.length - 1);
    }
  }

  goTo(i: number) {
    this.currentIndex.set(i);
  }
}