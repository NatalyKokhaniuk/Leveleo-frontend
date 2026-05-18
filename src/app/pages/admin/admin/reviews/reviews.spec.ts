import { ComponentFixture, TestBed } from '@angular/core/testing';
import { configureComponentTestBed } from '../../../../testing/component-test-bed';
import { AdminReviewsComponent } from './reviews';

describe('AdminReviewsComponent', () => {
  let component: AdminReviewsComponent;
  let fixture: ComponentFixture<AdminReviewsComponent>;

  beforeEach(async () => {
    await configureComponentTestBed(AdminReviewsComponent);
  });

  it('should create', () => {
    fixture = TestBed.createComponent(AdminReviewsComponent);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
