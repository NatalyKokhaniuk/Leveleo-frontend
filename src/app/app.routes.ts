import { Routes } from '@angular/router';


export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },
  
  
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about').then((m) => m.AboutComponent),
  },
  {
    path: 'products',
    loadComponent: () => import('./pages/products/products').then((m) => m.Products),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
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
