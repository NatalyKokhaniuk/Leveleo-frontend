import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import {
  ActiveSubscriberDto,
  NewsletterSubscriptionResponseDto,
  NewsletterUnsubscribeRequestDto,
  SubscribeNewsletterDto,
} from './newsletter.types';

@Injectable({ providedIn: 'root' })
export class NewsletterService {
  private api = inject(ApiService);

  /** POST /api/newsletter/subscribe */
  subscribe(dto: SubscribeNewsletterDto): Observable<NewsletterSubscriptionResponseDto> {
    return this.api.post<NewsletterSubscriptionResponseDto>('/newsletter/subscribe', dto);
  }

  /** GET /api/newsletter/subscribers — Admin (і зазвичай Moderator з боку API). */
  getActiveSubscribers(): Observable<ActiveSubscriberDto[]> {
    return this.api.get<ActiveSubscriberDto[]>('/newsletter/subscribers');
  }

  /**
   * Публічна відписка: POST /api/newsletter/unsubscribe (email + unsubscribeToken).
   */
  unsubscribe(req: NewsletterUnsubscribeRequestDto): Observable<void> {
    const email = req.email.trim();
    const unsubscribeToken = (req.unsubscribeToken ?? '').trim();
    if (!email || !unsubscribeToken) {
      return throwError(() => new Error('NEWSLETTER_UNSUBSCRIBE_MISSING_TOKEN'));
    }
    return this.api.post<void>('/newsletter/unsubscribe', { email, unsubscribeToken });
  }

  /**
   * Адмін: POST /api/newsletter/admin/unsubscribe
   * Тіло — JSON-рядок email (`[FromBody] string` на ASP.NET).
   */
  adminUnsubscribeByEmail(email: string): Observable<void> {
    const trimmed = email.trim();
    if (!trimmed) {
      return throwError(() => new Error('EMAIL_EMPTY'));
    }
    return this.api.postRawJson('/newsletter/admin/unsubscribe', JSON.stringify(trimmed)).pipe(
      map(() => undefined),
    );
  }
}
