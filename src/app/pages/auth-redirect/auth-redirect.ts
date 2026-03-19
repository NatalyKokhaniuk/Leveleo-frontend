import { isPlatformBrowser } from '@angular/common';
import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

/**
 * Intermediate redirect component for routes that carry query params.
 * e.g. /forgot-password?userId=X&token=Y  →  /?authAction=forgot-password&userId=X&token=Y
 *
 * Angular's redirectTo strips query params, so we need a real component for these cases.
 */
@Component({
  selector: 'app-auth-redirect',
  standalone: true,
  template: '',
})
export class AuthRedirect implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const snapshot = this.route.snapshot;
    const segment = snapshot.url[0]?.path ?? '';
    const extra: Record<string, string> = { ...snapshot.queryParams };
    const hash = window.location.hash;
    if (hash.startsWith('#token=')) {
      extra['tempToken'] = hash.slice('#token='.length);
    }

    this.router.navigate(['/'], {
      queryParams: { authAction: segment, ...extra },
      replaceUrl: true,
    });
  }
}
