import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  configureComponentTestBed,
  matDialogTestProviders,
} from '../../../testing/component-test-bed';
import { TwoFactorSetupDialogComponent } from './two-factor-setup-dialog.component';

describe('TwoFactorSetupDialogComponent', () => {
  let component: TwoFactorSetupDialogComponent;
  let fixture: ComponentFixture<TwoFactorSetupDialogComponent>;

  beforeEach(async () => {
    await configureComponentTestBed(TwoFactorSetupDialogComponent, {
      providers: matDialogTestProviders({}),
    });
  });

  it('should create', () => {
    fixture = TestBed.createComponent(TwoFactorSetupDialogComponent);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
