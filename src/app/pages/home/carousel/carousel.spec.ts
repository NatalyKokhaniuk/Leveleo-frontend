import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { MediaUrlCacheService } from '../../../core/services/media-url-cache.service';
import { CategoryService } from '../../../features/categories/category.service';
import { PromotionService } from '../../../features/promotions/promotion.service';
import { CarouselComponent } from './carousel';

describe('CarouselComponent', () => {
  let fixture: ComponentFixture<CarouselComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CarouselComponent, TranslateModule.forRoot()],
      providers: [
        { provide: CategoryService, useValue: { getAll: () => of([]) } },
        { provide: PromotionService, useValue: { getActive: () => of([]) } },
        {
          provide: MediaUrlCacheService,
          useValue: { getUrl: () => of(null), refreshUrl: () => of(null) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CarouselComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
