import { ComponentFixture, TestBed } from '@angular/core/testing';
import { configureComponentTestBed } from '../../testing/component-test-bed';
import { DeliveryComponent } from './delivery';

describe('DeliveryComponent', () => {
  let component: DeliveryComponent;
  let fixture: ComponentFixture<DeliveryComponent>;

  beforeEach(async () => {
    await configureComponentTestBed(DeliveryComponent);
  });

  it('should create', () => {
    fixture = TestBed.createComponent(DeliveryComponent);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
