import { isPlatformBrowser } from '@angular/common';
import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Маршрут /newsletter/unsubscribe?token=...
 * Перенаправляє на GET /api/newsletter/unsubscribe?token=... (HTML від бекенду).
 */
@Component({
  selector: 'app-newsletter-unsubscribe',
  standalone: true,
  imports: [TranslateModule, RouterLink],
  templateUrl: './newsletter-unsubscribe.html',
})
export class NewsletterUnsubscribeComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);

  missingToken = false;

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token?.trim()) {
      this.missingToken = true;
      return;
    }
    if (!isPlatformBrowser(this.platformId)) return;
    const url = `/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
    window.location.replace(url);
  }
}
