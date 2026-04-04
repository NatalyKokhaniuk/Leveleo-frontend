import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { ProductImageDto, ProductVideoDto } from './product.types';

@Injectable({ providedIn: 'root' })
export class ProductMediaService {
  private api = inject(ApiService);

  private base(productId: string): string {
    return `/products/${productId}/media`;
  }

  getImages(productId: string): Observable<ProductImageDto[]> {
    return this.api.get<ProductImageDto[]>(`${this.base(productId)}/images`);
  }

  addImage(productId: string, imageKey: string, sortOrder?: number | null): Observable<ProductImageDto> {
    let path = `${this.base(productId)}/images?imageKey=${encodeURIComponent(imageKey)}`;
    if (sortOrder != null && sortOrder !== undefined) {
      path += `&sortOrder=${sortOrder}`;
    }
    return this.api.post<ProductImageDto>(path, {});
  }

  deleteImage(productId: string, imageId: string): Observable<void> {
    return this.api.delete<void>(`${this.base(productId)}/images/${imageId}`);
  }

  getVideos(productId: string): Observable<ProductVideoDto[]> {
    return this.api.get<ProductVideoDto[]>(`${this.base(productId)}/videos`);
  }

  addVideo(productId: string, videoKey: string, sortOrder?: number | null): Observable<ProductVideoDto> {
    let path = `${this.base(productId)}/videos?videoKey=${encodeURIComponent(videoKey)}`;
    if (sortOrder != null && sortOrder !== undefined) {
      path += `&sortOrder=${sortOrder}`;
    }
    return this.api.post<ProductVideoDto>(path, {});
  }

  deleteVideo(productId: string, videoId: string): Observable<void> {
    return this.api.delete<void>(`${this.base(productId)}/videos/${videoId}`);
  }
}
