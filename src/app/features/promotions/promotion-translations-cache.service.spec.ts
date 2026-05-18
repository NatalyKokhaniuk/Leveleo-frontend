import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import type { AppliedPromotionDto } from '../products/product.types';
import { PromotionLevel } from './promotion.types';
import { PromotionService } from './promotion.service';
import { PromotionTranslationsCacheService } from './promotion-translations-cache.service';

describe('PromotionTranslationsCacheService', () => {
  let service: PromotionTranslationsCacheService;
  const getById = jasmine.createSpy('getById');

  beforeEach(() => {
    getById.calls.reset();
    TestBed.configureTestingModule({
      providers: [
        PromotionTranslationsCacheService,
        {
          provide: PromotionService,
          useValue: { getById },
        },
      ],
    });
    service = TestBed.inject(PromotionTranslationsCacheService);
  });

  const pr: AppliedPromotionDto = {
    id: 'promo-1',
    slug: 'p',
    name: 'UA only',
    level: PromotionLevel.Product,
    translations: [{ languageCode: 'uk', name: 'Літо' }],
  };

  it('fetches translations when EN missing', (done) => {
    getById.and.returnValue(
      of({
        id: 'promo-1',
        slug: 'p',
        name: null,
        level: PromotionLevel.Product,
        startDate: '',
        endDate: '',
        isActive: true,
        isCoupon: false,
        isPersonal: false,
        translations: [
          { languageCode: 'uk', name: 'Літо' },
          { languageCode: 'en', name: 'Summer' },
        ],
      }),
    );

    service.ensureForAppliedPromotion(pr, 'en').subscribe((rows) => {
      expect(getById).toHaveBeenCalledWith('promo-1');
      expect(rows.some((t) => t.languageCode === 'en' && t.name === 'Summer')).toBe(true);
      done();
    });
  });

  it('uses cache on second call', (done) => {
    getById.and.returnValue(
      of({
        id: 'promo-1',
        translations: [{ languageCode: 'en', name: 'Summer' }],
      }),
    );

    service.ensure('promo-1', [], 'en').subscribe(() => {
      service.ensure('promo-1', [], 'en').subscribe(() => {
        expect(getById).toHaveBeenCalledTimes(1);
        done();
      });
    });
  });
});
