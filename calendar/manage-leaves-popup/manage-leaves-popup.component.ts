import { Component, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RdvService } from 'src/app/services/rdv/rdv.service';
import { SharedDataService } from 'src/app/services/shared/shared.service';

@Component({
  selector: 'app-manage-leaves-popup',
  templateUrl: './manage-leaves-popup.component.html',
  styleUrls: ['./manage-leaves-popup.component.css']
})
export class ManageLeavesPopupComponent implements OnInit {

   leaves: any[] = [];
  years: number[] = [];
  selectedYear: number = new Date().getFullYear();
  isLoading: boolean = false;
  isSubmitting: boolean = false;
  leaveForm: FormGroup;
  isEditing: boolean = false;
  currentLeaveId: string | null = null;
  today: string = new Date().toISOString().split('T')[0];

  constructor(
    public activeModal: NgbActiveModal,
    private leaveService: RdvService,
    private fb: FormBuilder,
    private sharedService :SharedDataService
  ) {
    // Générer les années (5 ans passés, année courante, 5 ans futurs)
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
      this.years.push(i);
    }

    // Initialiser le formulaire
    this.leaveForm = this.fb.group({
      date: ['', [Validators.required]],
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(500)]],
      type: ['annual', [Validators.required]],
      isRecurring: [false],
      isFullDay: [true],
      startTime: ['08:00'],
      endTime: ['17:00']
    });

    // Écouter les changements de isFullDay
    this.leaveForm.get('isFullDay')?.valueChanges.subscribe(isFullDay => {
      const startTimeControl = this.leaveForm.get('startTime');
      const endTimeControl = this.leaveForm.get('endTime');
      
      if (isFullDay) {
        startTimeControl?.clearValidators();
        endTimeControl?.clearValidators();
      } else {
        startTimeControl?.setValidators([Validators.required]);
        endTimeControl?.setValidators([Validators.required]);
      }
      
      startTimeControl?.updateValueAndValidity();
      endTimeControl?.updateValueAndValidity();
    });
  }

  ngOnInit(): void {
    this.loadLeaves();
  }

  loadLeaves(): void {
    this.isLoading = true;
    this.leaveService.getLeavesByYearByMedecin(this.selectedYear.toString())
      .subscribe({
        next: (leaves) => {
          this.leaves = this.sortLeavesByDate(leaves);
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Erreur chargement congés:', err);
          this.isLoading = false;
          alert('Erreur lors du chargement des congés');
        }
      });
  }

  onYearChange(): void {
    this.loadLeaves();
    this.resetForm();
  }

  onSubmit(): void {
    if (this.leaveForm.invalid) {
      this.markFormGroupTouched(this.leaveForm);
      return;
    }

    this.isSubmitting = true;
    const formValue = this.leaveForm.value;

    // Nettoyer les données pour les congés journée complète
    const leaveData = {
      ...formValue,
      startTime: formValue.isFullDay ? undefined : formValue.startTime,
      endTime: formValue.isFullDay ? undefined : formValue.endTime
    };

    if (this.isEditing && this.currentLeaveId) {
      // Mettre à jour le congé existant
      this.leaveService.updateLeaveByMedecin(this.currentLeaveId, leaveData)
        .subscribe({
          next: (updatedLeave) => {
            const index = this.leaves.findIndex(l => l._id === updatedLeave._id);
            if (index !== -1) {
              this.leaves[index] = updatedLeave;
            }
            this.leaves = this.sortLeavesByDate(this.leaves);
            this.resetForm();
            this.isSubmitting = false;
            this.sharedService.emitSubmitEvent();
          },
          error: (err) => {
            console.error('Erreur mise à jour congé:', err);
            this.isSubmitting = false;
            alert('Erreur lors de la mise à jour du congé');
          }
        });
    } else {
      // Ajouter un nouveau congé
      this.leaveService.addLeaveByMedecin(leaveData)
        .subscribe({
          next: (leaves) => {
            this.leaves = this.sortLeavesByDate(leaves.filter(l => 
              l.date.startsWith(this.selectedYear.toString())
            ));
            this.resetForm();
            this.isSubmitting = false;
            this.sharedService.emitSubmitEvent();
          },
          error: (err) => {
            console.error('Erreur ajout congé:', err);
            this.isSubmitting = false;
            alert('Erreur lors de l\'ajout du congé');
          }
        });
    }
  }

  editLeave(leave: any): void {
    this.isEditing = true;
    this.currentLeaveId = leave._id || null;
    
    this.leaveForm.patchValue({
      date: leave.date,
      name: leave.name,
      description: leave.description || '',
      type: leave.type,
      isRecurring: leave.isRecurring,
      isFullDay: leave.isFullDay,
      startTime: leave.startTime || '08:00',
      endTime: leave.endTime || '17:00'
    });

    // Scroll vers le formulaire
    document.getElementById('leaveFormSection')?.scrollIntoView({ behavior: 'smooth' });
  }

  deleteLeave(leaveId: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce congé ? Cette action est irréversible.')) {
      this.leaveService.deleteLeaveByMedecin(leaveId)
        .subscribe({
          next: () => {
            this.leaves = this.leaves.filter(l => l._id !== leaveId);
            this.sharedService.emitSubmitEvent();

          },
          error: (err) => {
            console.error('Erreur suppression congé:', err);
           
          }
        });
    }
  }

  resetForm(): void {
    this.leaveForm.reset({
      date: '',
      name: '',
      description: '',
      type: 'annual',
      isRecurring: false,
      isFullDay: true,
      startTime: '08:00',
      endTime: '17:00'
    });
    this.isEditing = false;
    this.currentLeaveId = null;
  }

  cancelEdit(): void {
    this.resetForm();
  }

  getTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'annual': 'Congé annuel',
      'sick': 'Congé maladie',
      'personal': 'Congé personnel',
      'training': 'Formation',
      'other': 'Autre'
    };
    return labels[type] || type;
  }

  getTypeBadgeClass(type: string): string {
    const classes: { [key: string]: string } = {
      'annual': 'badge bg-primary',
      'sick': 'badge bg-danger',
      'personal': 'badge bg-warning',
      'training': 'badge bg-info',
      'other': 'badge bg-secondary'
    };
    return classes[type] || 'badge bg-secondary';
  }

  getDurationDisplay(leave: any): string {
    if (leave.isFullDay) {
      return 'Journée complète';
    }
    return `${leave.startTime} - ${leave.endTime}`;
  }

  private sortLeavesByDate(leaves: any[]): any[] {
    return leaves.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  getLeaveStats(): { total: number, annual: number, sick: number, personal: number } {
    return {
      total: this.leaves.length,
      annual: this.leaves.filter(l => l.type === 'annual').length,
      sick: this.leaves.filter(l => l.type === 'sick').length,
      personal: this.leaves.filter(l => l.type === 'personal').length
    };
  }

  close(): void {
    this.activeModal.close(this.leaves);
  }
}
