import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ContactService } from '../../features/contact/contact.service';
import { ContactFormCategory } from '../../features/contact/contact.types';

@Component({
  selector: 'app-contacts',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './contacts.html',
  styleUrl: './contacts.component.scss',
})
export class ContactsComponent {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private contactService = inject(ContactService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  submitting = signal(false);
  submitError = signal<string | null>(null);

  readonly ContactFormCategory = ContactFormCategory;

  categories: { value: ContactFormCategory; label: string }[] = [
    { value: ContactFormCategory.DeliveryQuestion, label: 'CONTACTS.CATEGORY.DELIVERY' },
    { value: ContactFormCategory.OrderQuestion, label: 'CONTACTS.CATEGORY.ORDER' },
    { value: ContactFormCategory.ReturnOrExchange, label: 'CONTACTS.CATEGORY.RETURN' },
    { value: ContactFormCategory.ProductQuestion, label: 'CONTACTS.CATEGORY.PRODUCT' },
    { value: ContactFormCategory.WebsiteQuestion, label: 'CONTACTS.CATEGORY.WEBSITE' },
    { value: ContactFormCategory.PaymentQuestion, label: 'CONTACTS.CATEGORY.PAYMENT' },
    { value: ContactFormCategory.Other, label: 'CONTACTS.CATEGORY.OTHER' },
  ];

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.maxLength(30)]],
    category: [null as ContactFormCategory | null, [Validators.required]],
    subject: ['', [Validators.required, Validators.maxLength(200)]],
    message: ['', [Validators.required, Validators.minLength(10)]],
  });

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const category = (params.get('category') ?? '').trim().toLowerCase();
      if (category === 'product') {
        this.form.patchValue({ category: ContactFormCategory.ProductQuestion });
      }
    });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const category = v.category;
    if (category === null || category === undefined) {
      this.form.get('category')?.markAsTouched();
      return;
    }

    this.submitting.set(true);
    this.submitError.set(null);

    const phoneTrim = v.phone?.trim();
    this.contactService
      .submit({
        subject: v.subject.trim(),
        message: v.message.trim(),
        category,
        email: v.email.trim(),
        phone: phoneTrim ? phoneTrim : null,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.form.reset();
          this.snack.open(this.translate.instant('CONTACTS.SUCCESS_EMAIL'), 'OK', {
            duration: 8000,
          });
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          this.submitError.set(this.mapError(err));
        },
      });
  }

  private mapError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (body && typeof body === 'object' && 'message' in body) {
        return String((body as { message?: string }).message ?? err.message);
      }
      return err.message || this.translate.instant('CONTACTS.ERROR_GENERIC');
    }
    return this.translate.instant('CONTACTS.ERROR_GENERIC');
  }
}
