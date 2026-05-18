import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  configureComponentTestBed,
  matDialogTestProviders,
} from '../../../testing/component-test-bed';
import { AuthDialogComponent } from './auth-dialog.component';

describe('AuthDialogComponent', () => {
  let component: AuthDialogComponent;
  let fixture: ComponentFixture<AuthDialogComponent>;

  beforeEach(async () => {
    await configureComponentTestBed(AuthDialogComponent, {
      providers: matDialogTestProviders({}),
    });
  });

  it('should create', () => {
    fixture = TestBed.createComponent(AuthDialogComponent);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
