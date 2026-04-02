import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-contacts',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
  ],
  templateUrl: './contacts.html',
})
export class ContactsComponent {
  private fb = inject(FormBuilder);
  translate = inject(TranslateService);

  // enum mapping
  categories = [
    { value: 1, label: 'CONTACTS.CATEGORY.DELIVERY' },
    { value: 2, label: 'CONTACTS.CATEGORY.ORDER' },
    { value: 3, label: 'CONTACTS.CATEGORY.RETURN' },
    { value: 4, label: 'CONTACTS.CATEGORY.PRODUCT' },
    { value: 5, label: 'CONTACTS.CATEGORY.WEBSITE' },
    { value: 6, label: 'CONTACTS.CATEGORY.PAYMENT' },
    { value: 99, label: 'CONTACTS.CATEGORY.OTHER' },
  ];

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    category: [null, Validators.required], // ✅ NEW
    subject: ['', [Validators.required]],
    message: ['', [Validators.required, Validators.minLength(10)]],
  });

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    console.log(this.form.value);
    alert(this.translate.instant('CONTACTS.SUCCESS'));
    this.form.reset();
  }
}