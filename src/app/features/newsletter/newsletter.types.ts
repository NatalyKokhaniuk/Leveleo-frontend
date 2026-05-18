/** Відповідає SubscribeNewsletterDto на бекенді. */
export interface SubscribeNewsletterDto {
  email: string;
  
  source?: string;
}

/** Відповідає NewsletterSubscriptionResponseDto (основні поля). */
export interface NewsletterSubscriptionResponseDto {
  message?: string;
  isSubscribed?: boolean;
}

/** GET /api/newsletter/subscribers — ActiveSubscriberDto. */
export interface ActiveSubscriberDto {
  id: string;
  email: string;
  subscribedAt: string;
  source?: string | null;
  hasAccount: boolean;
  fullName?: string | null;
}

/** POST /api/newsletter/unsubscribe (тіло як у публічної відписки). */
export interface NewsletterUnsubscribeRequestDto {
  email: string;
  unsubscribeToken?: string | null;
}
