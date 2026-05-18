import { ComponentFixture, TestBed } from '@angular/core/testing';
import { configureComponentTestBed } from '../../testing/component-test-bed';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;

  beforeEach(async () => {
    await configureComponentTestBed(ProfileComponent);
  });

  it('should create', () => {
    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
