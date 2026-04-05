/** Публічний відгук про товар (відповідь API магазину). */
export interface ProductReviewPublicDto {
  id: string;
  rating: number;
  comment?: string | null;
  /** Ім’я автора або «Анонім» з бекенду */
  userDisplayName?: string | null;
  createdAt?: string | null;
}
