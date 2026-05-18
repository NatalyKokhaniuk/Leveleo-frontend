import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MediaUrlCacheService } from '../../../core/services/media-url-cache.service';
import { CategoryService } from '../../../features/categories/category.service';
import { PromotionService } from '../../../features/promotions/promotion.service';
import { configureComponentTestBed } from '../../../testing/component-test-bed';
import { CarouselComponent } from './carousel';

describe('CarouselComponent', () => {
  let fixture: ComponentFixture<CarouselComponent>;

  beforeEach(async () => {
    await configureComponentTestBed(CarouselComponent, {
      providers: [
        { provide: CategoryService, useValue: { getAll: () => of([]) } },
        {
          provide: PromotionService,
          useValue: { loadActiveWithDetails: () => of([]) },
        },
        {
          provide: MediaUrlCacheService,
          useValue: { getUrl: () => of(null), refreshUrl: () => of(null) },
        },
      ],
    });
  });

  it('should create', () => {
    fixture = TestBed.createComponent(CarouselComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
