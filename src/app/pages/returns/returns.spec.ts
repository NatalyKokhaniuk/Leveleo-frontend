import { ComponentFixture, TestBed } from '@angular/core/testing';
import { configureComponentTestBed } from '../../testing/component-test-bed';
import { ReturnsComponent } from './returns';

describe('ReturnsComponent', () => {
  let component: ReturnsComponent;
  let fixture: ComponentFixture<ReturnsComponent>;

  beforeEach(async () => {
    await configureComponentTestBed(ReturnsComponent);
  });

  it('should create', () => {
    fixture = TestBed.createComponent(ReturnsComponent);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
