import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  configureComponentTestBed,
  matDialogTestProviders,
} from '../../../testing/component-test-bed';
import { TwoFactorManageDialogComponent } from './two-factor-manage-dialog.component';

describe('TwoFactorManageDialogComponent', () => {
  let component: TwoFactorManageDialogComponent;
  let fixture: ComponentFixture<TwoFactorManageDialogComponent>;

  beforeEach(async () => {
    await configureComponentTestBed(TwoFactorManageDialogComponent, {
      providers: matDialogTestProviders({ currentMethod: 'Totp' }),
    });
  });

  it('should create', () => {
    fixture = TestBed.createComponent(TwoFactorManageDialogComponent);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
