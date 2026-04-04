import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TwoFactorSetupDialogComponent } from './two-factor-setup-dialog.component';

describe('TwoFactorSetupDialogComponent', () => {
  let component: TwoFactorSetupDialogComponent;
  let fixture: ComponentFixture<TwoFactorSetupDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwoFactorSetupDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TwoFactorSetupDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
