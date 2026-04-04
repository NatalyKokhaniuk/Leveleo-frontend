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
    path: 'delivery',
    loadComponent: () => import('./pages/delivery/delivery').then((m) => m.DeliveryComponent),
  },
  {
    path: 'products',
    loadComponent: () => import('./pages/products/products').then((m) => m.Products),
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
