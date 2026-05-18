import { ComponentFixture, TestBed } from '@angular/core/testing';
import { configureComponentTestBed } from '../../testing/component-test-bed';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await configureComponentTestBed(HeaderComponent);
  });

  it('should create', () => {
    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
