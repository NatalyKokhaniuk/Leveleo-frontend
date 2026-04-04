import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ContactFormResponseDto, CreateContactFormDto } from './contact.types';
import { ApiService } from '../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class ContactService {
  private api = inject(ApiService);

  /** POST api/contact — AllowAnonymous. */
  submit(dto: CreateContactFormDto): Observable<ContactFormResponseDto> {
    return this.api.post<ContactFormResponseDto>('/contact', dto);
  }
}
