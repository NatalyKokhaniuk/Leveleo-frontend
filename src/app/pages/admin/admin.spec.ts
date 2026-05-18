import { ComponentFixture, TestBed } from '@angular/core/testing';
import { configureComponentTestBed } from '../../testing/component-test-bed';
import { AdminComponent } from './admin';

describe('AdminComponent', () => {
  let component: AdminComponent;
  let fixture: ComponentFixture<AdminComponent>;

  beforeEach(async () => {
    await configureComponentTestBed(AdminComponent);
  });

  it('should create', () => {
    fixture = TestBed.createComponent(AdminComponent);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
