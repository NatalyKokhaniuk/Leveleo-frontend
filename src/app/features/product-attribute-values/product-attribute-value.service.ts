import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import {
  CreateProductAttributeValueDto,
  ProductAttributeValueResponseDto,
  UpdateProductAttributeValueDto,
} from './product-attribute-value.types';

@Injectable({ providedIn: 'root' })
export class ProductAttributeValueService {
  private api = inject(ApiService);
  private base = '/ProductAttributeValues';

  getByProductId(productId: string): Observable<ProductAttributeValueResponseDto[]> {
    return this.api.get<ProductAttributeValueResponseDto[]>(`${this.base}/product/${productId}`);
  }

  create(productId: string, dto: CreateProductAttributeValueDto): Observable<ProductAttributeValueResponseDto> {
    return this.api.post<ProductAttributeValueResponseDto>(`${this.base}/product/${productId}`, dto);
  }

  update(
    valueId: string,
    dto: UpdateProductAttributeValueDto,
  ): Observable<ProductAttributeValueResponseDto> {
    return this.api.put<ProductAttributeValueResponseDto>(`${this.base}/${valueId}`, dto);
  }

  delete(valueId: string): Observable<void> {
    return this.api.delete<void>(`${this.base}/${valueId}`);
  }
}
