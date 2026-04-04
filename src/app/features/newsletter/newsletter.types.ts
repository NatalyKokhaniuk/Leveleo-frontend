/** Відповідає SubscribeNewsletterDto на бекенді. */
export interface SubscribeNewsletterDto {
  email: string;
  /** Напр. homepage, footer, popup */
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
