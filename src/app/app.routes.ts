import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { adminOrModeratorGuard } from './core/guards/admin.moderator.guartd';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin').then((m) => m.AdminComponent),
    canActivate: [adminOrModeratorGuard], // ← додаємо guard
  },
  {
    path: 'admin/users',
    loadComponent: () => import('./pages/admin/admin/users/users').then((m) => m.UsersComponent),
    canActivate: [adminGuard], // ← додаємо guard
  },
  {
    path: 'admin/subscriptions',
    loadComponent: () =>
      import('./pages/admin/admin/subscriptions/subscriptions').then((m) => m.AdminSubscriptionsComponent),
    canActivate: [adminOrModeratorGuard],
  },
  {
    path: 'admin/categories',
    loadComponent: () =>
      import('./pages/admin/admin/categories/categories').then((m) => m.CategoriesComponent),
    canActivate: [adminOrModeratorGuard],
  },
  {
    path: 'admin/brands',
    loadComponent: () =>
      import('./pages/admin/admin/brands/brands').then((m) => m.BrandsComponent),
    canActivate: [adminOrModeratorGuard],
  },
  {
    path: 'admin/tasks/:taskId',
    loadComponent: () =>
      import('./pages/admin/admin/tasks/task-detail/task-detail').then((m) => m.AdminTaskDetailComponent),
    canActivate: [adminOrModeratorGuard],
  },
  {
    path: 'admin/tasks',
    loadComponent: () =>
      import('./pages/admin/admin/tasks/tasks').then((m) => m.AdminTasksComponent),
    canActivate: [adminOrModeratorGuard],
  },
  {
    path: 'admin/attribute-groups',
    loadComponent: () =>
      import('./pages/admin/admin/attribute-groups/attribute-groups').then(
        (m) => m.AttributeGroupsComponent,
      ),
    canActivate: [adminOrModeratorGuard],
  },
  {
    path: 'admin/attributes',
    loadComponent: () =>
      import('./pages/admin/admin/product-attributes/product-attributes').then(
        (m) => m.ProductAttributesComponent,
      ),
    canActivate: [adminOrModeratorGuard],
  },
  {
    path: 'admin/products/:productId',
    loadComponent: () =>
      import('./pages/admin/admin/products/product-detail/product-detail').then(
        (m) => m.AdminProductDetailComponent,
      ),
    canActivate: [adminOrModeratorGuard],
  },
  {
    path: 'admin/products',
    loadComponent: () =>
      import('./pages/admin/admin/products/products').then((m) => m.AdminProductsComponent),
    canActivate: [adminOrModeratorGuard],
  },
  {
    path: 'admin/promotions',
    loadComponent: () =>
      import('./pages/admin/admin/promotions/promotions').then((m) => m.AdminPromotionsComponent),
    canActivate: [adminOrModeratorGuard],
  },
  {
    path: 'admin/statistics',
    loadComponent: () =>
      import('./pages/admin/admin/statistics/statistics').then((m) => m.AdminStatisticsComponent),
    canActivate: [adminOrModeratorGuard],
  },

  {
    path: 'about',
    loadComponent: () => import('./pages/about/about').then((m) => m.AboutComponent),
  },
  {
    path: 'terms',
    loadComponent: () => import('./pages/terms/terms').then((m) => m.TermsComponent),
  },
  {
    path: 'returns',
    loadComponent: () => import('./pages/returns/returns').then((m) => m.ReturnsComponent),
  },
  {
    path: 'contacts',
    loadComponent: () => import('./pages/contacts/contacts').then((m) => m.ContactsComponent),
  },
  {
    path: 'newsletter/unsubscribe',
    loadComponent: () =>
      import('./pages/newsletter-unsubscribe/newsletter-unsubscribe').then(
        (m) => m.NewsletterUnsubscribeComponent,
      ),
  },
  {
    path: 'delivery',
    loadComponent: () => import('./pages/delivery/delivery').then((m) => m.DeliveryComponent),
  },
  {
    path: 'catalog',
    loadComponent: () => import('./pages/catalog/catalog').then((m) => m.CatalogPage),
  },
  {
    path: 'products/brand/:brandSlug',
    loadComponent: () => import('./pages/products/products').then((m) => m.Products),
  },
  {
    path: 'products/category/:categorySlug',
    loadComponent: () => import('./pages/products/products').then((m) => m.Products),
  },
  {
    path: 'products',
    loadComponent: () => import('./pages/products/products').then((m) => m.Products),
  },
  {
    path: 'favorites',
    loadComponent: () => import('./pages/favorites/favorites').then((m) => m.FavoritesPage),
  },
  {
    path: 'comparison',
    loadComponent: () => import('./pages/comparison/comparison').then((m) => m.ComparisonPage),
  },
  {
    path: 'cart',
    loadComponent: () => import('./pages/cart/cart').then((m) => m.CartPage),
  },
  {
    path: 'checkout',
    loadComponent: () => import('./pages/checkout/checkout').then((m) => m.CheckoutPage),
    canActivate: [authGuard],
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
    canActivate: [authGuard],
  },

  // ── All auth callback paths use AuthRedirect to preserve query params ─
  // Angular's `redirectTo` strips query params - so we use a component instead.
  {
    path: 'email-confirmed',
    loadComponent: () => import('./pages/auth-redirect/auth-redirect').then((m) => m.AuthRedirect),
  },
  {
    path: 'email-not-confirmed',
    loadComponent: () => import('./pages/auth-redirect/auth-redirect').then((m) => m.AuthRedirect),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/auth-redirect/auth-redirect').then((m) => m.AuthRedirect),
  },
  {
    path: 'forgot-password-confirmation',
    loadComponent: () => import('./pages/auth-redirect/auth-redirect').then((m) => m.AuthRedirect),
  },
  {
    path: 'change-password',
    loadComponent: () => import('./pages/auth-redirect/auth-redirect').then((m) => m.AuthRedirect),
  },
  {
    path: 'change-password-confirmation',
    loadComponent: () => import('./pages/auth-redirect/auth-redirect').then((m) => m.AuthRedirect),
  },
  {
    path: 'change-password-error',
    loadComponent: () => import('./pages/auth-redirect/auth-redirect').then((m) => m.AuthRedirect),
  },
  {
    path: 'social-login',
    loadComponent: () => import('./pages/auth-redirect/auth-redirect').then((m) => m.AuthRedirect),
  },

  // ── Fallback ──────────────────────────────────────────────────────
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];
