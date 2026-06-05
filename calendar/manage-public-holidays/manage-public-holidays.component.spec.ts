import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ManagePublicHolidaysComponent } from './manage-public-holidays.component';

describe('ManagePublicHolidaysComponent', () => {
  let component: ManagePublicHolidaysComponent;
  let fixture: ComponentFixture<ManagePublicHolidaysComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ManagePublicHolidaysComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ManagePublicHolidaysComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
