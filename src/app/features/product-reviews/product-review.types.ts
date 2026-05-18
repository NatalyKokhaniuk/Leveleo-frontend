/** Публічний відгук про товар (відповідь API магазину). */
export interface ProductReviewPublicDto {
  id: string;
  rating: number;
  comment?: string | null;
  
  userDisplayName?: string | null;
  createdAt?: string | null;
}
