import { ComponentFixture, TestBed } from '@angular/core/testing';
import { configureComponentTestBed } from '../../../testing/component-test-bed';
import { DataTableComponent } from './data-table.component';

describe('DataTableComponent', () => {
  let component: DataTableComponent;
  let fixture: ComponentFixture<DataTableComponent>;

  beforeEach(async () => {
    await configureComponentTestBed(DataTableComponent);
  });

  it('should create', () => {
    fixture = TestBed.createComponent(DataTableComponent);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
