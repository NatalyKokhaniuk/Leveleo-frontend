import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NewsletterService } from '../../../features/newsletter/newsletter.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TranslateModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './footer.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private newsletter = inject(NewsletterService);
  private snack = inject(MatSnackBar);
  translate = inject(TranslateService);

  year = new Date().getFullYear();
  subscribeSubmitting = signal(false);

  subscribeForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  links = {
    catalog: [
      { label: 'FOOTER.GUITARS', link: '/products/guitars' },
      { label: 'FOOTER.KEYBOARDS', link: '/products/keyboards' },
      { label: 'FOOTER.DJ', link: '/products/dj' },
      { label: 'FOOTER.STUDIO', link: '/products/studio' },
    ],
    info: [
      { label: 'FOOTER.ABOUT', link: '/contacts' },
      { label: 'FOOTER.DELIVERY', link: '/delivery' },
      { label: 'FOOTER.RETURN', link: '/returns' },
      { label: 'FOOTER.CONTACTS', link: '/terms' },
    ],
  };

  onSubscribe() {
    if (this.subscribeForm.invalid) {
      this.subscribeForm.markAllAsTouched();
      return;
    }
    const raw = this.subscribeForm.get('email')?.value;
    const email = typeof raw === 'string' ? raw.trim() : '';
    if (!email) return;

    this.subscribeSubmitting.set(true);
    this.newsletter.subscribe({ email, source: this.newsletterSourceFromRoute() }).subscribe({
      next: (res) => {
        this.subscribeSubmitting.set(false);
        this.subscribeForm.reset();
        const msg =
          res.message && res.message.trim().length > 0
            ? res.message
            : this.translate.instant('FOOTER.NEWSLETTER_SUCCESS');
        this.snack.open(msg, 'OK', { duration: 6000 });
      },
      error: (err: unknown) => {
        this.subscribeSubmitting.set(false);
        let msg = this.translate.instant('FOOTER.NEWSLETTER_ERROR');
        if (err instanceof HttpErrorResponse && err.error && typeof err.error === 'object') {
          const body = err.error as { message?: string };
          if (typeof body.message === 'string' && body.message.trim().length > 0) {
            msg = body.message;
          }
        }
        this.snack.open(msg, 'OK', { duration: 6000 });
      },
    });
  }

  /** Джерело підписки для бекенду — шлях з адресного рядка (без query/hash). */
  private newsletterSourceFromRoute(): string {
    const path = this.router.url.split('?')[0].split('#')[0];
    if (!path || path === '/') {
      return 'home';
    }
    return path.replace(/^\//, '').replace(/\//g, '_') || 'home';
  }
}
