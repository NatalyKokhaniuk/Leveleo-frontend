import { ComponentFixture, TestBed } from '@angular/core/testing';
import { configureComponentTestBed } from '../../testing/component-test-bed';
import { TermsComponent } from './terms';

describe('TermsComponent', () => {
  let component: TermsComponent;
  let fixture: ComponentFixture<TermsComponent>;

  beforeEach(async () => {
    await configureComponentTestBed(TermsComponent);
  });

  it('should create', () => {
    fixture = TestBed.createComponent(TermsComponent);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
