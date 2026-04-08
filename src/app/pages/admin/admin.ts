import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/services/auth.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, MatIconModule],
  templateUrl: './admin.html',
})
export class AdminComponent {
  userservice = inject(AuthService);
  menu: { key: string; icon: string; link: string }[] = [
    { key: 'USERS', icon: 'people', link: '/admin/users' },
    { key: 'STATISTICS', icon: 'bar_chart', link: '/admin/statistics' },
    { key: 'TASKS', icon: 'task', link: '/admin/tasks' },
    { key: 'BRANDS', icon: 'store', link: '/admin/brands' },
    { key: 'ATTRIBUTES', icon: 'tune', link: '/admin/attributes' },
    { key: 'ATTRIBUTE_GROUPS', icon: 'view_list', link: '/admin/attribute-groups' },
    { key: 'CATEGORIES', icon: 'category', link: '/admin/categories' },
    { key: 'PRODUCTS', icon: 'inventory_2', link: '/admin/products' },
    { key: 'ORDERS', icon: 'shopping_cart', link: '/admin/orders' },
    { key: 'SHIPPING', icon: 'local_shipping', link: '/admin/shipping' },
    { key: 'SUBSCRIPTIONS', icon: 'subscriptions', link: '/admin/subscriptions' },
    { key: 'PAYMENTS', icon: 'payments', link: '/admin/payments' },
    { key: 'PROMOTIONS', icon: 'local_offer', link: '/admin/promotions' },
    { key: 'REVIEWS', icon: 'rate_review', link: '/admin/reviews' },
  ];

  /** USERS — лише Admin; підписки — Admin і Moderator (видалення лише в UI для Admin). */
  showMenuItem(item: { key: string }): boolean {
    if (item.key === 'USERS' && !this.userservice.isAdmin()) return false;
    if (item.key === 'STATISTICS' && !this.userservice.isAdmin()) return false;
    if (item.key === 'SUBSCRIPTIONS' && !this.userservice.isAdmin()) return false;
    return true;
  }
}
