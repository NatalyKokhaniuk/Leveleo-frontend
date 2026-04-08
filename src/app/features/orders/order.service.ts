import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { CreateOrderResultDto, OrderCreateDto } from './order.types';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private api = inject(ApiService);
  private base = '/orders';

  create(dto: OrderCreateDto): Observable<CreateOrderResultDto> {
    return this.api.post<CreateOrderResultDto>(this.base, dto);
  }
}
