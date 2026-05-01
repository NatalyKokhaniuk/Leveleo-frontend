import type { ProductCatalogDisplayState } from '../products/product-catalog-display';

export interface ReviewDto {
  id: string;
  orderItemId: string;
  productId: string;
  /** Slug для посилання на вітрину `/products/:slug`; якщо немає — посилання веде в адмінку товару. */
  productSlug?: string | null;
  productMainImageKey?: string | null;
  productExistsInCatalog?: boolean;
  productIsActive?: boolean | null;
  productCatalogDisplayState?: ProductCatalogDisplayState | string | null;
  productName: string;
  rating: number;
  comment: string | null;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;

  photos: {
    id: string;
    photoKey: string;
  }[];

  videos: {
    id: string;
    videoKey: string;
  }[];

  /** Якщо бекенд додає статус замовлення — для фільтрації bulk-approve. */
  orderStatus?: string | null;

  /** Відхилено модератором (якщо API повертає). */
  isRejected?: boolean;
  /** Наприклад Pending | Rejected | Approved (залежить від бекенду). */
  moderationStatus?: string | null;
}

/** GET /api/Reviews/product/{productId} та admin/product. */
export interface ProductReviewsDto {
  productId: string;
  averageRating?: number;
  totalReviews?: number;
  reviews?: ReviewDto[];
}

export interface CreateReviewDto {
  orderItemId: string;
  rating: number;
  comment: string | null;
  photoKeys: string[] | null;
  videoKeys: string[] | null;
}

export interface UpdateReviewDto {
  rating: number;
  comment: string | null;
  photoKeys: string[] | null;
  videoKeys: string[] | null;
}

export interface PagedReviews {
  items: ReviewDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}