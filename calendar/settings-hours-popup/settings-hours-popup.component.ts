import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { RdvService } from 'src/app/services/rdv/rdv.service';
import { SharedDataService } from 'src/app/services/shared/shared.service';

@Component({
  selector: 'app-settings-hours-popup',
  templateUrl: './settings-hours-popup.component.html',
  styleUrls: ['./settings-hours-popup.component.css']
})
export class SettingsHoursPopupComponent implements OnInit {
 workingHoursForm!: FormGroup;
 timeError: boolean = false;
 hoursList: string[] = [];
 minDate: string = new Date().toISOString().split('T')[0];
 startHour :number
 endHour :number

  constructor(public modal: NgbActiveModal, private fb: FormBuilder ,private rdvService :RdvService,private sharedService :SharedDataService) {}

  ngOnInit(): void {
    for (let h = 8; h <= 20; h++) {
    const formatted = ('0' + h).slice(-2) + ':00';
    this.hoursList.push(formatted);
  }
    const savedStart = this.startHour +':00';
    const savedEnd = this.endHour +':00';

    this.workingHoursForm = this.fb.group({
      startHour: [savedStart, Validators.required],
      endHour: [savedEnd, Validators.required]
    });
  }
  ngAfterViewInit() {
  setTimeout(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
}


submit(): void {
  let { startHour, endHour } = this.workingHoursForm.value;
  startHour = parseInt(startHour.split(":")[0], 10)
  endHour = parseInt(endHour.split(":")[0], 10)

  if (startHour > endHour) {
    this.timeError = true;
    return;
  }

  this.timeError = false;
  this.rdvService.updateHeuresCalendar(startHour, endHour).subscribe({
    next: (response) => {
      // Émettre l'événement avant de fermer la modal
      this.sharedService.emitSubmitEvent();
      this.modal.close({ startHour, endHour });
    },
    error: (error) => {
      console.error('Erreur lors de la mise à jour des heures :', error);
    }
  });
}
}
