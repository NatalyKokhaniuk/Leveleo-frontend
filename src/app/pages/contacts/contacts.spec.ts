import { ComponentFixture, TestBed } from '@angular/core/testing';
import { configureComponentTestBed } from '../../testing/component-test-bed';
import { ContactsComponent } from './contacts';

describe('ContactsComponent', () => {
  let component: ContactsComponent;
  let fixture: ComponentFixture<ContactsComponent>;

  beforeEach(async () => {
    await configureComponentTestBed(ContactsComponent);
  });

  it('should create', () => {
    fixture = TestBed.createComponent(ContactsComponent);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
