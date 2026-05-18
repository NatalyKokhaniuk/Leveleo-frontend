import { ComponentFixture, TestBed } from '@angular/core/testing';
import { configureComponentTestBed } from '../../../../testing/component-test-bed';
import { UsersComponent } from './users';

describe('UsersComponent', () => {
  let component: UsersComponent;
  let fixture: ComponentFixture<UsersComponent>;

  beforeEach(async () => {
    await configureComponentTestBed(UsersComponent);
  });

  it('should create', () => {
    fixture = TestBed.createComponent(UsersComponent);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
