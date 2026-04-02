import { Component, inject, HostListener, ElementRef, AfterViewInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { isPlatformBrowser, NgClass, CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { signal } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';

@Component({
  selector: 'ap-footer',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TranslateModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule
  ],
  templateUrl: './footer.html',
})
export class Footer implements AfterViewInit {
  private fb = inject(FormBuilder);
  translate = inject(TranslateService);
  private platformId = inject(PLATFORM_ID);
  footerRef = inject(ElementRef);

  year = new Date().getFullYear();

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

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;
  }

  @HostListener('window:scroll', [])
  @HostListener('window:resize', [])

  onSubscribe() {
    if (this.subscribeForm.invalid) return;
    console.log('Subscribed:', this.subscribeForm.value.email);
    this.subscribeForm.reset();
  }
}