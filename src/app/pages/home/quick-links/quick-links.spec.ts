import { ComponentFixture, TestBed } from '@angular/core/testing';
import { configureComponentTestBed } from '../../../testing/component-test-bed';
import { QuickLinksComponent } from './quick-links';

describe('QuickLinksComponent', () => {
  let component: QuickLinksComponent;
  let fixture: ComponentFixture<QuickLinksComponent>;

  beforeEach(async () => {
    await configureComponentTestBed(QuickLinksComponent);
  });

  it('should create', () => {
    fixture = TestBed.createComponent(QuickLinksComponent);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
