import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { adminOrModeratorGuard } from './core/guards/admin.moderator.guartd';
import { authGuard } from './core/guards/auth.guard';

/** Заголовок вкладки: лише «Leveleo». */
const docBrand = { docTitle: 'brand' as const };
/** Заголовок вкладки: «404» (сторінка помилки сервера). */
const doc404 = { docTitle: '404' as const };
/** «Leveleo — …» через i18n-ключ назви сторінки. */
const docPage = (docTitleKey: string) => ({ docTitle: 'suffix' as const, docTitleKey });

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
    data: docBrand,
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin').then((m) => m.AdminComponent),
    canActivate: [adminOrModeratorGuard],
    data: docPage('ADMIN.TITLE'),
  },
  {
    path: 'admin/users',
    loadComponent: () => import('./pages/admin/admin/users/users').then((m) => m.UsersComponent),
    canActivate: [adminGuard],
    data: docPage('ADMIN.USER.TITLE'),
  },
  {
    path: 'admin/reviews',
    loadComponent: () => import('./pages/admin/admin/reviews/reviews').then((m) => m.AdminReviewsComponent),
    canActivate: [adminOrModeratorGuard],
    data: docPage('ADMIN.REVIEWS_PAGE.TITLE'),
  },
  {
    path: 'admin/subscriptions',
    loadComponent: () =>
      import('./pages/admin/admin/subscriptions/subscriptions').then((m) => m.AdminSubscriptionsComponent),
    canActivate: [adminOrModeratorGuard],
    data: docPage('ADMIN.SUBSCRIPTIONS_PAGE.TITLE'),
  },
  {
    path: 'admin/categories',
    loadComponent: () =>
      import('./pages/admin/admin/categories/categories').then((m) => m.CategoriesComponent),
    canActivate: [adminOrModeratorGuard],
    data: docPage('ADMIN.CATEGORY.TITLE'),
  },
  {
    path: 'admin/brands',
    loadComponent: () =>
      import('./pages/admin/admin/brands/brands').then((m) => m.BrandsComponent),
    canActivate: [adminOrModeratorGuard],
    data: docPage('ADMIN.BRAND.TITLE'),
  },
  {
    path: 'admin/tasks/:taskId',
    loadComponent: () =>
      import('./pages/admin/admin/tasks/task-detail/task-detail').then((m) => m.AdminTaskDetailComponent),
    canActivate: [adminOrModeratorGuard],
    data: docPage('ADMIN.TASKS_PAGE.TITLE'),
  },
  {
    path: 'admin/tasks',
    loadComponent: () =>
      import('./pages/admin/admin/tasks/tasks').then((m) => m.AdminTasksComponent),
    canActivate: [adminOrModeratorGuard],
    data: docPage('ADMIN.TASKS_PAGE.TITLE'),
  },
  {
    path: 'admin/attribute-groups',
    loadComponent: () =>
      import('./pages/admin/admin/attribute-groups/attribute-groups').then(
        (m) => m.AttributeGroupsComponent,
      ),
    canActivate: [adminOrModeratorGuard],
    data: docPage('ADMIN.ATTRIBUTE_GROUP.TITLE'),
  },
  {
    path: 'admin/attributes',
    loadComponent: () =>
      import('./pages/admin/admin/product-attributes/product-attributes').then(
        (m) => m.ProductAttributesComponent,
      ),
    canActivate: [adminOrModeratorGuard],
    data: docPage('ADMIN.PRODUCT_ATTRIBUTE.TITLE'),
  },
  {
    path: 'admin/products/:productId',
    loadComponent: () =>
      import('./pages/admin/admin/products/product-detail/product-detail').then(
        (m) => m.AdminProductDetailComponent,
      ),
    canActivate: [adminOrModeratorGuard],
    data: docPage('ADMIN.PRODUCT.TITLE'),
  },
  {
    path: 'admin/products',
    loadComponent: () =>
      import('./pages/admin/admin/products/products').then((m) => m.AdminProductsComponent),
    canActivate: [adminOrModeratorGuard],
    data: docPage('ADMIN.PRODUCT.TITLE'),
  },
  {
    path: 'admin/promotions',
    loadComponent: () =>
      import('./pages/admin/admin/promotions/promotions').then((m) => m.AdminPromotionsComponent),
    canActivate: [adminOrModeratorGuard],
    data: docPage('ADMIN.PROMOTION.TITLE'),
  },
  {
    path: 'admin/statistics',
    loadComponent: () =>
      import('./pages/admin/admin/statistics/statistics').then((m) => m.AdminStatisticsComponent),
    canActivate: [adminOrModeratorGuard],
    data: docPage('ADMIN.STATISTICS'),
  },
  {
    path: 'admin/orders/:orderId',
    loadComponent: () =>
      import('./pages/admin/admin/orders/order-detail/order-detail').then((m) => m.AdminOrderDetailComponent),
    canActivate: [adminOrModeratorGuard],
    data: docPage('ADMIN.ORDERS_PAGE.DETAIL_DOC_TITLE'),
  },
  {
    path: 'admin/orders',
    loadComponent: () =>
      import('./pages/admin/admin/orders/orders').then((m) => m.AdminOrdersComponent),
    canActivate: [adminOrModeratorGuard],
    data: docPage('ADMIN.ORDERS_PAGE.TITLE'),
  },
  {
    path: 'admin/payments',
    loadComponent: () =>
      import('./pages/admin/admin/payments/payments').then((m) => m.AdminPaymentsComponent),
    canActivate: [adminOrModeratorGuard],
    data: docPage('ADMIN.PAYMENTS_PAGE.TITLE'),
  },

  {
    path: 'about',
    loadComponent: () => import('./pages/about/about').then((m) => m.AboutComponent),
    data: docPage('ABOUT.TITLE'),
  },
  {
    path: 'terms',
    loadComponent: () => import('./pages/terms/terms').then((m) => m.TermsComponent),
    data: docPage('TERMS.TITLE'),
  },
  {
    path: 'returns',
    loadComponent: () => import('./pages/returns/returns').then((m) => m.ReturnsComponent),
    data: docPage('RETURNS.TITLE'),
  },
  {
    path: 'contacts',
    loadComponent: () => import('./pages/contacts/contacts').then((m) => m.ContactsComponent),
    data: docPage('CONTACTS.TITLE'),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./pages/forgot-password/forgot-password').then((m) => m.ForgotPasswordPage),
    data: docPage('AUTH.FORGOT_PASSWORD_REQUEST_TITLE'),
  },
  {
    path: 'newsletter/unsubscribe',
    loadComponent: () =>
      import('./pages/newsletter-unsubscribe/newsletter-unsubscribe').then(
        (m) => m.NewsletterUnsubscribeComponent,
      ),
    data: docPage('DOC_TITLE.NEWSLETTER_UNSUBSCRIBE'),
  },
  {
    path: 'delivery',
    loadComponent: () => import('./pages/delivery/delivery').then((m) => m.DeliveryComponent),
    data: docPage('DELIVERY.TITLE'),
  },
  {
    path: 'catalog',
    loadComponent: () => import('./pages/catalog/catalog').then((m) => m.CatalogPage),
    data: docPage('CATALOG.TITLE'),
  },
  {
    path: 'promotions',
    loadComponent: () => import('./pages/promotions/promotions').then((m) => m.PromotionsPage),
    data: docPage('PROMOTIONS_PAGE.TITLE'),
  },
  {
    path: 'products/brand/:brandSlug',
    loadComponent: () => import('./pages/products/products').then((m) => m.Products),
    data: docPage('PRODUCTS.TITLE'),
  },
  {
    path: 'products/category/:categorySlug',
    loadComponent: () => import('./pages/products/products').then((m) => m.Products),
    data: docPage('PRODUCTS.TITLE'),
  },
  {
    path: 'products/promotion/:promotionSlug',
    loadComponent: () => import('./pages/products/products').then((m) => m.Products),
    data: docPage('PRODUCTS.TITLE'),
  },
  {
    path: 'products/:productSlug',
    loadComponent: () =>
      import('./pages/products/product-page/product-page').then((m) => m.ProductPage),
    data: docPage('PRODUCTS.TITLE'),
  },
  {
    path: 'products',
    loadComponent: () => import('./pages/products/products').then((m) => m.Products),
    data: docPage('PRODUCTS.TITLE'),
  },
  {
    path: 'favorites',
    loadComponent: () => import('./pages/favorites/favorites').then((m) => m.FavoritesPage),
    data: docPage('FAVORITES.TITLE'),
  },
  {
    path: 'comparison',
    loadComponent: () => import('./pages/comparison/comparison').then((m) => m.ComparisonPage),
    data: docPage('COMPARISON.TITLE'),
  },
  {
    path: 'cart',
    loadComponent: () => import('./pages/cart/cart').then((m) => m.CartPage),
    data: docPage('CART.TITLE'),
  },
  {
    path: 'order-checkout',
    loadComponent: () =>
      import('./pages/order-checkout/order-checkout').then((m) => m.OrderCheckoutPage),
    canActivate: [authGuard],
    data: docPage('ORDER_CHECKOUT.TITLE'),
  },
  {
    path: 'order-success',
    loadComponent: () =>
      import('./pages/order-detail/order-detail').then((m) => m.OrderDetailPage),
    canActivate: [authGuard],
    data: docPage('DOC_TITLE.ORDER_SUCCESS'),
  },
  {
    path: 'orders/:orderId',
    loadComponent: () =>
      import('./pages/order-detail/order-detail').then((m) => m.OrderDetailPage),
    data: docPage('DOC_TITLE.ORDER_DETAIL'),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
    canActivate: [authGuard],
    data: docPage('DOC_TITLE.PROFILE'),
  },

  {
    path: 'internal-server-error',
    loadComponent: () =>
      import('./pages/internal-server-error/internal-server-error').then((m) => m.InternalServerErrorPage),
    data: doc404,
  },

  // ── All auth callback paths use AuthRedirect to preserve query params ─
  {
    path: 'email-confirmed',
    loadComponent: () => import('./pages/auth-redirect/auth-redirect').then((m) => m.AuthRedirect),
    data: docPage('DOC_TITLE.AUTH_REDIRECT'),
  },
  {
    path: 'email-not-confirmed',
    loadComponent: () => import('./pages/auth-redirect/auth-redirect').then((m) => m.AuthRedirect),
    data: docPage('DOC_TITLE.AUTH_REDIRECT'),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/auth-redirect/auth-redirect').then((m) => m.AuthRedirect),
    data: docPage('DOC_TITLE.AUTH_REDIRECT'),
  },
  {
    path: 'forgot-password-confirmation',
    loadComponent: () => import('./pages/auth-redirect/auth-redirect').then((m) => m.AuthRedirect),
    data: docPage('DOC_TITLE.AUTH_REDIRECT'),
  },
  {
    path: 'change-password',
    loadComponent: () => import('./pages/auth-redirect/auth-redirect').then((m) => m.AuthRedirect),
    data: docPage('DOC_TITLE.AUTH_REDIRECT'),
  },
  {
    path: 'change-password-confirmation',
    loadComponent: () => import('./pages/auth-redirect/auth-redirect').then((m) => m.AuthRedirect),
    data: docPage('DOC_TITLE.AUTH_REDIRECT'),
  },
  {
    path: 'change-password-error',
    loadComponent: () => import('./pages/auth-redirect/auth-redirect').then((m) => m.AuthRedirect),
    data: docPage('DOC_TITLE.AUTH_REDIRECT'),
  },
  {
    path: 'social-login',
    loadComponent: () => import('./pages/auth-redirect/auth-redirect').then((m) => m.AuthRedirect),
    data: docPage('DOC_TITLE.AUTH_REDIRECT'),
  },

  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
    data: docPage('NOT_FOUND.TITLE'),
  },
];
