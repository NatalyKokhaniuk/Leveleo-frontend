import { ComponentFixture, TestBed } from '@angular/core/testing';
import { configureComponentTestBed } from '../../testing/component-test-bed';
import { Home } from './home';

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;

  beforeEach(async () => {
    await configureComponentTestBed(Home);
  });

  it('should create', () => {
    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
