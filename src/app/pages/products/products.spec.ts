import { ComponentFixture, TestBed } from '@angular/core/testing';
import { configureComponentTestBed } from '../../testing/component-test-bed';
import { Products } from './products';

describe('Products', () => {
  let component: Products;
  let fixture: ComponentFixture<Products>;

  beforeEach(async () => {
    await configureComponentTestBed(Products);
  });

  it('should create', () => {
    fixture = TestBed.createComponent(Products);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
