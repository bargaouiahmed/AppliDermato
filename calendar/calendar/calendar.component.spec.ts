import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CalendarComponentt } from './calendar.component';

describe('CalendarComponent', () => {
  let component: CalendarComponentt;
  let fixture: ComponentFixture<CalendarComponentt>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CalendarComponentt ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CalendarComponentt);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
