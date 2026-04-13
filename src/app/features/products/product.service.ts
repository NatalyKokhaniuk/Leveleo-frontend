import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { encodeProductFilters } from './product-filter.encode';
import {
  CreateProductDto,
  PagedResultDto,
  ProductFilterDto,
  ProductResponseDto,
  ProductSortBy,
  UpdateProductDto,
} from './product.types';

/** Як у query `sortBy` для GET /products/promotional. */
const SORT_BY_QUERY: Record<ProductSortBy, string> = {
  [ProductSortBy.PriceAsc]: 'PriceAsc',
  [ProductSortBy.PriceDesc]: 'PriceDesc',
  [ProductSortBy.AverageRatingDesc]: 'AverageRatingDesc',
  [ProductSortBy.TotalSoldDesc]: 'TotalSoldDesc',
};

@Injectable({ providedIn: 'root' })
export class ProductService {
  private api = inject(ApiService);
  private base = '/products';

  /** Список з фільтрами: GET /products?filters=Base64(JSON). Текстовий пошук — окремий метод {@link search}. */
  getPaged(filter: ProductFilterDto): Observable<PagedResultDto<ProductResponseDto>> {
    const filters = encodeURIComponent(encodeProductFilters(filter));
    return this.api.get<PagedResultDto<ProductResponseDto>>(`${this.base}?filters=${filters}`);
  }

  /**
   * Акційні товари (product-акції з валідними датами), без кошикових акцій.
   * GET /products/promotional?page=&pageSize=&sortBy=&categoryId=&brandId=
   */
  getPromotional(params: {
    page: number;
    pageSize: number;
    sortBy: ProductSortBy;
    categoryId?: string | null;
    brandId?: string | null;
  }): Observable<PagedResultDto<ProductResponseDto>> {
    const qs: string[] = [
      `page=${encodeURIComponent(String(Math.max(1, params.page)))}`,
      `pageSize=${encodeURIComponent(String(Math.max(1, params.pageSize)))}`,
      `sortBy=${encodeURIComponent(SORT_BY_QUERY[params.sortBy] ?? 'PriceAsc')}`,
    ];
    const cat = params.categoryId?.trim();
    const br = params.brandId?.trim();
    if (cat) {
      qs.push(`categoryId=${encodeURIComponent(cat)}`);
    }
    if (br) {
      qs.push(`brandId=${encodeURIComponent(br)}`);
    }
    return this.api.get<PagedResultDto<ProductResponseDto>>(`${this.base}/promotional?${qs.join('&')}`);
  }

  search(query: string, page = 1, pageSize = 20): Observable<PagedResultDto<ProductResponseDto>> {
    const q = encodeURIComponent(query.trim());
    return this.api.get<PagedResultDto<ProductResponseDto>>(
      `${this.base}/search?query=${q}&page=${page}&pageSize=${pageSize}`,
    );
  }

  getById(productId: string): Observable<ProductResponseDto> {
    return this.api.get<ProductResponseDto>(`${this.base}/${productId}`);
  }

  getBySlug(slug: string): Observable<ProductResponseDto> {
    return this.api.get<ProductResponseDto>(`${this.base}/slug/${encodeURIComponent(slug)}`);
  }

  create(dto: CreateProductDto): Observable<ProductResponseDto> {
    return this.api.post<ProductResponseDto>(this.base, dto);
  }

  update(productId: string, dto: UpdateProductDto): Observable<ProductResponseDto> {
    return this.api.put<ProductResponseDto>(`${this.base}/${productId}`, dto);
  }

  delete(productId: string): Observable<void> {
    return this.api.delete<void>(`${this.base}/${productId}`);
  }
}
