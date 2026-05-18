import { ComponentFixture, TestBed } from '@angular/core/testing';
import { configureComponentTestBed } from '../../testing/component-test-bed';
import { NotFound } from './not-found';

describe('NotFound', () => {
  let component: NotFound;
  let fixture: ComponentFixture<NotFound>;

  beforeEach(async () => {
    await configureComponentTestBed(NotFound);
  });

  it('should create', () => {
    fixture = TestBed.createComponent(NotFound);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
