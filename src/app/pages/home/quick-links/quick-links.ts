import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-quick-links',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './quick-links.html',
})
export class QuickLinksComponent {
  links = [
    {
      icon: 'assets/images/nav/money.svg',
      label: 'HOME_LINKS.RETURNS',
      link: '/returns',
    },
    {
      icon: 'assets/images/nav/sale.svg',
      label: 'HOME_LINKS.PRODUCTS',
      link: '/products',
    },
    {
      icon: 'assets/images/nav/person.svg',
      label: 'HOME_LINKS.CONTACTS',
      link: '/contacts',
    },
    {
      icon: 'assets/images/nav/box.svg',
      label: 'HOME_LINKS.DELIVERY',
      link: '/delivery',
    },
    {
      icon: 'assets/images/nav/clock.svg',
      label: 'HOME_LINKS.RETURNS',
      link: '/returns',
    },
    {
      icon: 'assets/images/nav/wheel.svg',
      label: 'HOME_LINKS.TERMS',
      link: '/terms',
    },
  ];
}