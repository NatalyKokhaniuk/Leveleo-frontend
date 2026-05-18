import { TestBed } from '@angular/core/testing';
import { configureComponentTestBed } from './testing/component-test-bed';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await configureComponentTestBed(App);
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render shell layout', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-header')).not.toBeNull();
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });
});
