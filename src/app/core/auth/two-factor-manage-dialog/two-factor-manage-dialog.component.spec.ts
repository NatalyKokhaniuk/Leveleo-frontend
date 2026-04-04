import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TwoFactorManageDialogComponent } from './two-factor-manage-dialog.component';

describe('TwoFactorManageDialogComponent', () => {
  let component: TwoFactorManageDialogComponent;
  let fixture: ComponentFixture<TwoFactorManageDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TwoFactorManageDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TwoFactorManageDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
