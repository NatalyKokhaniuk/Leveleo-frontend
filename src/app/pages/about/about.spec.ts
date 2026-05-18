import { ComponentFixture, TestBed } from '@angular/core/testing';
import { configureComponentTestBed } from '../../testing/component-test-bed';
import { AboutComponent } from './about';

describe('AboutComponent', () => {
  let component: AboutComponent;
  let fixture: ComponentFixture<AboutComponent>;

  beforeEach(async () => {
    await configureComponentTestBed(AboutComponent);
  });

  it('should create', () => {
    fixture = TestBed.createComponent(AboutComponent);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
