import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsHoursPopupComponent } from './settings-hours-popup.component';

describe('SettingsHoursPopupComponent', () => {
  let component: SettingsHoursPopupComponent;
  let fixture: ComponentFixture<SettingsHoursPopupComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SettingsHoursPopupComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsHoursPopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
