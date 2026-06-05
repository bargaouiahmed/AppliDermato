import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageLeavesPopupComponent } from './manage-leaves-popup.component';

describe('ManageLeavesPopupComponent', () => {
  let component: ManageLeavesPopupComponent;
  let fixture: ComponentFixture<ManageLeavesPopupComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ManageLeavesPopupComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ManageLeavesPopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
