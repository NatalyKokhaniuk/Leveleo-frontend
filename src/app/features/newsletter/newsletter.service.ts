import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import {
  ActiveSubscriberDto,
  NewsletterSubscriptionResponseDto,
  SubscribeNewsletterDto,
} from './newsletter.types';

@Injectable({ providedIn: 'root' })
export class NewsletterService {
  private api = inject(ApiService);

  /** POST /api/newsletter/subscribe */
  subscribe(dto: SubscribeNewsletterDto): Observable<NewsletterSubscriptionResponseDto> {
    return this.api.post<NewsletterSubscriptionResponseDto>('/newsletter/subscribe', dto);
  }

  /** GET /api/newsletter/subscribers — лише Admin. */
  getActiveSubscribers(): Observable<ActiveSubscriberDto[]> {
    return this.api.get<ActiveSubscriberDto[]>('/newsletter/subscribers');
  }
}
