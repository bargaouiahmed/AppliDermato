import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ConsultationConduiteResponse, ConsultationConduiteActionResponse } from '../../../core/models/conduite.models';
import { ConduiteService } from '../../../core/services/conduite.service';

export interface ConsultationCarepDetailModalData {
  consultationId: string;
  actionKey: string;
  actionLabel: string;
}

type CarepDetailType =
  | 'ordonnance'
  | 'certificat'
  | 'lettre_confrere'
  | 'paraclinique_chirurgie'
  | 'paraclinique_imagerie'
  | 'paraclinique_bilan_sanguin'
  | 'cnam_ap1'
  | 'cnam_ap2'
  | 'cnam_ap3'
  | 'cnam_ap4'
  | 'cnam_apci'
  | 'unknown';

@Component({
  selector: 'app-consultation-carep-detail-modal',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './consultation-carep-detail-modal.html',
  styleUrl: './consultation-carep-detail-modal.css',
})
export class ConsultationCarepDetailModal implements OnChanges {
  private readonly router = inject(Router);
  private readonly conduiteService = inject(ConduiteService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() isOpen = false;
  @Input() data: ConsultationCarepDetailModalData | null = null;

  @Output() closed = new EventEmitter<void>();

  @ViewChild('modalBackdrop') private backdropRef?: ElementRef<HTMLElement>;

  protected conduiteData: ConsultationConduiteResponse | null = null;
  protected selectedAction: ConsultationConduiteActionResponse | null = null;
  protected isLoading = false;
  protected loadError = '';

  @HostListener('document:keydown.escape')
  protected onEscapeKey(): void {
    this.close();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true && this.data) {
      this.fetchConduiteData();
    }
  }

  protected close(): void {
    this.closed.emit();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.backdropRef?.nativeElement) {
      this.close();
    }
  }

  protected get detailType(): CarepDetailType {
    if (!this.data?.actionKey) {
      return 'unknown';
    }

    const key = String(this.data.actionKey).toLowerCase().trim();
    if (key.includes('ordonnance')) {
      return 'ordonnance';
    }
    if (key.includes('certificat')) {
      return 'certificat';
    }
    if (key.includes('lettre')) {
      return 'lettre_confrere';
    }
    if (key.includes('chirurgie')) {
      return 'paraclinique_chirurgie';
    }
    if (key.includes('imagerie')) {
      return 'paraclinique_imagerie';
    }
    if (key.includes('bilan sanguin') || key.includes('bilan_sanguin')) {
      return 'paraclinique_bilan_sanguin';
    }
    if (key.includes('cnam')) {
      const formType = this.resolveCnamFormType();
      return `cnam_${formType}` as CarepDetailType;
    }
    return 'unknown';
  }

  protected get canPrint(): boolean {
    const type = this.detailType;
    return (
      type !== 'unknown' &&
      (type === 'ordonnance' ||
        type === 'certificat' ||
        type === 'lettre_confrere' ||
        type.startsWith('cnam_') ||
        type.startsWith('paraclinique_'))
    );
  }

  protected get cnamFormType(): string {
    if (this.detailType.startsWith('cnam_')) {
      return this.detailType.replace('cnam_', '').toUpperCase();
    }
    return '';
  }

  protected get cnamInfo(): {
    formType: string;
    codeConventionnel?: string;
    diagnostic?: string;
    medicationLines?: Array<{ designation: string; posologie: string; dureeTraitement: string }>;
    therapeutique?: string;
    natureExamen?: string;
    dateExamen?: string;
    donneesCliniques?: string;
    pathologieOrigine?: string;
    traitement?: string;
    etatSante?: string;
    bilanFonctionnel?: string;
    prolongation?: string;
    observation?: string;
  } {
    const payload = this.selectedAction?.payload;
    if (!payload) {
      return { formType: this.cnamFormType };
    }

    const type = this.cnamFormType.toLowerCase();
    const data = (payload[type] as Record<string, unknown>) ?? {};

    const info: {
      formType: string;
      codeConventionnel?: string;
      diagnostic?: string;
      medicationLines?: Array<{ designation: string; posologie: string; dureeTraitement: string }>;
      therapeutique?: string;
      natureExamen?: string;
      dateExamen?: string;
      donneesCliniques?: string;
      pathologieOrigine?: string;
      traitement?: string;
      etatSante?: string;
      bilanFonctionnel?: string;
      prolongation?: string;
      observation?: string;
    } = {
      formType: this.cnamFormType,
      codeConventionnel: this.readStr(data, 'codeConventionnel'),
      diagnostic: this.readStr(data, 'diagnostic') || this.readStr(data, 'diagnostics'),
      therapeutique: this.readStr(data, 'therapeutique'),
      natureExamen: this.readStr(data, 'natureExamen'),
      dateExamen: this.readStr(data, 'dateExamen'),
      donneesCliniques: this.readStr(data, 'donneesCliniquesParacliniques'),
      pathologieOrigine: this.readStr(data, 'pathologieOrigine'),
      traitement: this.readStr(data, 'traitement'),
      etatSante: this.readStr(data, 'etatSante'),
      bilanFonctionnel: this.readStr(data, 'bilanFonctionnel'),
      prolongation: this.readStr(data, 'prolongation'),
      observation: this.readStr(data, 'observation'),
    };

    const lines = data['medicationLines'] as Array<Record<string, unknown>> | undefined;
    if (lines) {
      info.medicationLines = lines.map((line) => ({
        designation: this.readStr(line, 'designation'),
        posologie: this.readStr(line, 'posologie'),
        dureeTraitement: this.readStr(line, 'dureeTraitement'),
      }));
    }

    return info;
  }

  protected get ordonnanceDrugs(): Array<{ medicine: string; therapeuticClass: string; category: string; posology: string; duration: string }> {
    const payload = this.selectedAction?.payload;
    if (!payload) {
      return [];
    }

    const selectedType = payload['selectedType'] as Record<string, unknown> | undefined;
    const listDrugs = (selectedType?.['listDrugs'] ?? payload['listDrugs']) as Array<Record<string, unknown>> | undefined;
    if (!listDrugs) {
      return [];
    }

    return listDrugs.map((drug) => ({
      medicine: this.readStr(drug, 'medicine') || this.readStr(drug, 'nom'),
      therapeuticClass: this.readStr(drug, 'therapeuticClass'),
      category: this.readStr(drug, 'category'),
      posology: this.readStr(drug, 'posology'),
      duration: this.readStr(drug, 'duration') || this.readStr(drug, 'duree'),
    }));
  }

  protected get ordonnanceConsigne(): string {
    const payload = this.selectedAction?.payload;
    if (!payload) {
      return '';
    }
    const selectedType = payload['selectedType'] as Record<string, unknown> | undefined;
    return (selectedType?.['consigne'] as string) ?? (payload['consigne'] as string) ?? '';
  }

  protected get certificatInfo(): {
    types: string;
    nombre: string;
    compterDe: string;
    dateCertificat: string;
    description: string;
    civiliteAccompagnant: string;
    nomPrenomAccompagnant: string;
  } {
    const payload = this.selectedAction?.payload ?? {};
    return {
      types: this.readStr(payload, 'types'),
      nombre: this.readStr(payload, 'nombre'),
      compterDe: this.readStr(payload, 'compterDe'),
      dateCertificat: this.readStr(payload, 'dateCertificat'),
      description: this.readStr(payload, 'description'),
      civiliteAccompagnant: this.readStr(payload, 'civiliteAccompagnant'),
      nomPrenomAccompagnant: this.readStr(payload, 'nomPrenomAccompagnant'),
    };
  }

  protected get lettreInfo(): { medecin: string; contenue: string } {
    const payload = this.selectedAction?.payload ?? {};
    return {
      medecin: this.readStr(payload, 'medecin'),
      contenue: this.readStr(payload, 'contenue'),
    };
  }

  protected get chirurgieInfo(): {
    types: string[];
    date?: string;
    clinique?: string;
    operateur?: string;
    information?: string;
  } {
    const payload = this.selectedAction?.payload ?? {};
    const typesVal = payload['types'];
    const types: string[] = Array.isArray(typesVal)
      ? typesVal.map((t) => (typeof t === 'object' && t !== null ? (t['name'] || t['label'] || String(t)) : String(t)))
      : [];
    const singleType = this.readStr(payload, 'type');
    if (singleType && types.length === 0) {
      types.push(singleType);
    }
    return {
      types,
      date: this.readStr(payload, 'dateOperation'),
      clinique: this.readStr(payload, 'clinique'),
      operateur: this.readStr(payload, 'operateur'),
      information: this.readStr(payload, 'informationAdditionnel'),
    };
  }

  protected get imagerieInfo(): {
    types: string[];
    date?: string;
    clinique?: string;
    information?: string;
  } {
    const payload = this.selectedAction?.payload ?? {};
    const typesVal = payload['types'];
    const types: string[] = Array.isArray(typesVal)
      ? typesVal.map((t) => (typeof t === 'object' && t !== null ? (t['name'] || t['label'] || String(t)) : String(t)))
      : [];
    const singleType = this.readStr(payload, 'type');
    if (singleType && types.length === 0) {
      types.push(singleType);
    }
    return {
      types,
      date: this.readStr(payload, 'dateOperation'),
      clinique: this.readStr(payload, 'clinique'),
      information: this.readStr(payload, 'informationAdditionnel'),
    };
  }

  protected get bilanSanguinInfo(): {
    tests: Array<{ name: string; checkedItems: string[] }>;
    date?: string;
    information?: string;
  } {
    const payload = this.selectedAction?.payload ?? {};
    const selectedTypes = (payload['selectedBilanTypes'] as Array<Record<string, unknown>>) ?? [];

    const tests = selectedTypes
      .map((t) => {
        const checkboxValues = (t['checkboxValues'] as Record<string, boolean>) ?? {};
        const checkboxDefinitions = (t['checkboxDefinitions'] as Array<{ key: string; label: string }>) ?? [];

        const checkedItems = checkboxDefinitions
          .filter((def) => checkboxValues[def.key] === true)
          .map((def) => def.label);

        return {
          name: this.readStr(t, 'name') || this.readStr(t, 'key'),
          checkedItems,
        };
      })
      .filter((t) => t.name && t.checkedItems.length > 0);

    return {
      tests,
      date: this.readStr(payload, 'dateOperation'),
      information: this.readStr(payload, 'informationAdditionnel'),
    };
  }

  protected printDocument(): void {
    if (!this.data?.consultationId) {
      return;
    }

    const type = this.detailType;
    let documentType = '';

    if (type.startsWith('cnam_')) {
      documentType = 'cnam';
    } else if (type === 'ordonnance') {
      documentType = 'ordonnance';
    } else if (type === 'certificat') {
      documentType = 'certificat';
    } else if (type === 'lettre_confrere') {
      documentType = 'lettre_confrere';
    } else if (type.startsWith('paraclinique_')) {
      documentType = 'paraclinique';
    }

    if (!documentType) {
      return;
    }

    const queryParams: Record<string, string> = {};
    if (documentType === 'paraclinique') {
      const section = type.replace('paraclinique_', '');
      queryParams['sections'] = section;
    }

    const url = this.router.serializeUrl(
      this.router.createUrlTree(['/consultations', this.data.consultationId, 'print', documentType], {
        queryParams,
      }),
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  protected printCnam(): void {
    this.printDocument();
  }

  private fetchConduiteData(): void {
    if (!this.data?.consultationId) {
      return;
    }

    this.isLoading = true;
    this.loadError = '';
    this.conduiteData = null;
    this.selectedAction = null;
    this.cdr.detectChanges();
    this.cdr.markForCheck();

    this.conduiteService
      .getConsultationConduite(this.data.consultationId)
      .pipe(
        catchError(() => {
          this.loadError = 'consultation.carepModal.loadError';
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          if (!response) {
            return;
          }
          this.conduiteData = response;
          this.selectedAction = this.findActionByKey(response, this.data!.actionKey);
          this.cdr.detectChanges();
          this.cdr.markForCheck();
        },
      });
  }

  private findActionByKey(
    response: ConsultationConduiteResponse,
    actionKey: unknown,
  ): ConsultationConduiteActionResponse | null {
    if (!actionKey) {
      return null;
    }

    const normalizedSearch = String(actionKey).trim().toLowerCase();
    const underscoreSearch = normalizedSearch.replace(/[\s-]+/g, '_');

    for (const action of response.actions ?? []) {
      const normalizedAction = (action.actionKey ?? '').trim().toLowerCase();
      const underscoreAction = normalizedAction.replace(/[\s-]+/g, '_');

      // Exact match or underscore match
      if (normalizedAction === normalizedSearch || underscoreAction === underscoreSearch) {
        return action;
      }

      // Check for partial matches or keywords if common labels are used
      if (
        (normalizedSearch.includes('ordonnance') && normalizedAction.includes('ordonnance')) ||
        (normalizedSearch.includes('cnam') && normalizedAction.includes('cnam')) ||
        (normalizedSearch.includes('certificat') && normalizedAction.includes('certificat')) ||
        (normalizedSearch.includes('lettre') && normalizedAction.includes('lettre')) ||
        (normalizedSearch.includes('chirurgie') && normalizedAction.includes('chirurgie')) ||
        (normalizedSearch.includes('imagerie') && normalizedAction.includes('imagerie')) ||
        ((normalizedSearch.includes('bilan sanguin') || normalizedSearch.includes('bilan_sanguin')) &&
          normalizedAction.includes('bilan_sanguin'))
      ) {
        return action;
      }
    }
    return null;
  }

  private resolveCnamFormType(): string {
    const payload = this.selectedAction?.payload;
    if (!payload) {
      return 'ap1';
    }
    const formType = (payload['selectedFormType'] as string) ?? 'ap1';
    if (typeof formType !== 'string') {
      return 'ap1';
    }
    const normalized = formType.trim().toLowerCase();
    return normalized === 'ap2' || normalized === 'ap3' || normalized === 'ap4' || normalized === 'apci'
      ? normalized
      : 'ap1';
  }

  private readStr(obj: Record<string, unknown> | undefined, key: string): string {
    if (!obj) {
      return '';
    }
    const val = obj[key];
    return typeof val === 'string' ? val.trim() : '';
  }
}
