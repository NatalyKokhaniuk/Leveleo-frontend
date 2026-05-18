import { ComponentFixture, TestBed } from '@angular/core/testing';
import { configureComponentTestBed } from '../../../../testing/component-test-bed';
import { AdminTasksComponent } from './tasks';

describe('AdminTasksComponent', () => {
  let component: AdminTasksComponent;
  let fixture: ComponentFixture<AdminTasksComponent>;

  beforeEach(async () => {
    await configureComponentTestBed(AdminTasksComponent);
  });

  it('should create', () => {
    fixture = TestBed.createComponent(AdminTasksComponent);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
