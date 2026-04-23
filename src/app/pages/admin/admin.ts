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
    { key: 'SUBSCRIPTIONS', icon: 'subscriptions', link: '/admin/subscriptions' },
    { key: 'STATISTICS', icon: 'bar_chart', link: '/admin/statistics' },
    { key: 'ATTRIBUTE_GROUPS', icon: 'view_list', link: '/admin/attribute-groups' },
    { key: 'ATTRIBUTES', icon: 'tune', link: '/admin/attributes' },
    { key: 'CATEGORIES', icon: 'category', link: '/admin/categories' },
    { key: 'BRANDS', icon: 'store', link: '/admin/brands' },
    { key: 'PROMOTIONS', icon: 'local_offer', link: '/admin/promotions' },
    { key: 'PRODUCTS', icon: 'inventory_2', link: '/admin/products' },
    { key: 'REVIEWS', icon: 'rate_review', link: '/admin/reviews' },
    { key: 'PAYMENTS', icon: 'payments', link: '/admin/payments' },
    { key: 'ORDERS', icon: 'shopping_cart', link: '/admin/orders' },
    { key: 'TASKS', icon: 'task', link: '/admin/tasks' },
  ];

  /** USERS — лише Admin; підписки — Admin і Moderator (видалення лише в UI для Admin). */
  showMenuItem(item: { key: string }): boolean {
    if (item.key === 'USERS' && !this.userservice.isAdmin()) return false;
    if (item.key === 'STATISTICS' && !this.userservice.isAdmin()) return false;
    if (item.key === 'SUBSCRIPTIONS' && !this.userservice.isAdmin()) return false;
    return true;
  }
}
