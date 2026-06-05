import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NgSelectComponent } from '@ng-select/ng-select';
import { ProfessionSelectComponent } from '../../../../shared/components/profession-select/profession-select';
import {
  SelfCheckinAnomalyRequest,
  SelfCheckinBootstrapResponse,
  SelfCheckinCreateConsultationResponse,
  SelfCheckinLanguage,
  SelfCheckinOngoingTreatmentRequest,
  ReturningSearchType,
  SelfCheckinPatientSummary,
} from '../../../../core/models/self-checkin.models';
import { ConsultationInterrogatoireResponse } from '../../../../core/models/interrogatoire.models';
import { SelfCheckinService } from '../../../../core/services/self-checkin.service';
import { ConsultationCreationGuardService } from '../../../../core/services/consultation-creation-guard.service';
import { selfCheckinT } from './self-checkin.i18n';

type Step =
  | 'language'
  | 'visit'
  | 'newPatient'
  | 'returningPatient'
  | 'motif'
  | 'questionnaire'
  | 'confirmation'
  | 'error';
type PatientSelectorStep = 'newPatient' | 'returningPatient';

type QuestionnaireStep =
  | 'antecedentsGeneraux'
  | 'antecedentsFamiliaux'
  | 'signesFonctionnels'
  | 'histoireMaladie'
  | 'traitementEnCours';
type YesNoAnswer = '' | 'yes' | 'no';

type NewPatientFormModel = {
  firstname: string;
  lastname: string;
  dateOfBirth: string;
  sex: string;
  phoneNumber: string;
  email: string;
  profession: string;
  workPlace: string;
  country: string;
  city: string;
};

type QuestionnaireModel = {
  hasAntecedentsGeneraux: YesNoAnswer;
  antecedentsGeneraux: string[];
  hasAntecedentsFamiliaux: YesNoAnswer;
  antecedentsFamiliaux: string[];
  hasSignesFonctionnels: YesNoAnswer;
  signesFonctionnels: string[];
  hasHistoireMaladie: YesNoAnswer;
  histoireMaladie: string;
  hasTraitementEnCours: YesNoAnswer;
  traitementEnCours: string[];
};

@Component({
  selector: 'app-self-checkin-page',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectComponent, ProfessionSelectComponent],
  templateUrl: './self-checkin-page.html',
  styleUrl: './self-checkin-page.css',
})
export class SelfCheckinPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly selfCheckinService = inject(SelfCheckinService);
  private readonly consultationCreationGuard = inject(ConsultationCreationGuardService);

  @ViewChild('rootContainer') private rootContainer?: ElementRef<HTMLElement>;

  protected readonly step = signal<Step>('language');
  protected readonly language = signal<SelfCheckinLanguage>('fr');
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly infoMessage = signal('');
  protected readonly isFullscreen = signal(false);

  protected readonly doctorDisplayName = signal('');
  protected readonly doctorId = signal('');
  protected readonly kioskKey = signal('');
  protected readonly timeoutSeconds = signal(90);
  protected readonly nextDossierNumber = signal<number | null>(null);
  protected readonly isLoadingNextDossierNumber = signal(false);
  protected readonly motifSuggestions = signal<string[]>([]);
  protected readonly professionOptions = signal<string[]>([]);
  protected readonly treatmentOptions = signal<string[]>([]);

  protected readonly selectedMotifs = signal<string[]>([]);
  protected readonly motifInput = signal('');

  protected readonly newPatient = signal<NewPatientFormModel>({
    firstname: '',
    lastname: '',
    dateOfBirth: '',
    sex: '',
    phoneNumber: '',
    email: '',
    profession: '',
    workPlace: '',
    country: 'Tunisie',
    city: '',
  });

  protected readonly returningSearchType = signal<ReturningSearchType>('phone');
  protected readonly returningSearch = signal({
    nom: '',
    prenom: '',
    tel: '',
    email: '',
    numFiche: '',
    dateAnniversaire: '',
  });
  protected readonly returningResults = signal<SelfCheckinPatientSummary[]>([]);
  protected readonly selectedReturningPatientId = signal('');

  protected readonly questionnaire = signal<QuestionnaireModel>({
    hasAntecedentsGeneraux: '',
    antecedentsGeneraux: [],
    hasAntecedentsFamiliaux: '',
    antecedentsFamiliaux: [],
    hasSignesFonctionnels: '',
    signesFonctionnels: [],
    hasHistoireMaladie: '',
    histoireMaladie: '',
    hasTraitementEnCours: '',
    traitementEnCours: [],
  });

  protected readonly questionnaireStepOrder: QuestionnaireStep[] = [
    'antecedentsGeneraux',
    'antecedentsFamiliaux',
    'signesFonctionnels',
    'histoireMaladie',
    'traitementEnCours',
  ];
  protected readonly questionnaireStep = signal<QuestionnaireStep>('antecedentsGeneraux');
  private previousStepBeforeMotif: PatientSelectorStep | null = null;

  private selectedPatientId = '';
  private consultationId = '';
  private questionnaireDiagnostics: string[] = [];
  private prefilledAnomalies: SelfCheckinAnomalyRequest[] = [];
  private prefilledTreatments: SelfCheckinOngoingTreatmentRequest[] = [];
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private confirmationTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly sameDayConsultationGuards = new Set<string>();
  private readonly defaultMotifKeys = [
    'motifFever',
    'motifDryCough',
    'motifProductiveCough',
    'motifSoreThroat',
    'motifDyspnea',
    'motifChestPain',
    'motifPalpitations',
    'motifHeadache',
    'motifDizziness',
    'motifGeneralFatigue',
    'motifAbdominalPain',
    'motifNausea',
    'motifVomiting',
    'motifDiarrhea',
    'motifConstipation',
    'motifDysuria',
    'motifPollakiuria',
    'motifLowBackPain',
    'motifJointPain',
    'motifCheckup',
    'motifPrescriptionRenewal',
    'motifVaccination',
  ];
  private readonly questionnaireOptionKeys = [
    'generalHistoryHypertension',
    'generalHistoryDiabetes',
    'generalHistoryAsthma',
    'generalHistoryThyroid',
    'generalHistoryCardiacDisease',
    'familyHistoryDiabetes',
    'familyHistoryHypertension',
    'familyHistoryCardiacDisease',
    'familyHistoryCancer',
    'familyHistoryStroke',
    'functionalSignFever',
    'functionalSignCough',
    'functionalSignDyspnea',
    'functionalSignChestPain',
    'functionalSignAbdominalPain',
    'functionalSignFatigue',
    'functionalSignHeadache',
  ];
  private readonly supportedLanguages: SelfCheckinLanguage[] = ['fr', 'en', 'ar'];
  private readonly motifKeyByKnownLabel = new Map<string, string>([
    ['fievre', 'motifFever'],
    ['toux seche', 'motifDryCough'],
    ['toux grasse', 'motifProductiveCough'],
    ['maux de gorge', 'motifSoreThroat'],
    ['dyspnee', 'motifDyspnea'],
    ['douleur thoracique', 'motifChestPain'],
    ['palpitations', 'motifPalpitations'],
    ['cephalee', 'motifHeadache'],
    ['vertiges', 'motifDizziness'],
    ['fatigue generale', 'motifGeneralFatigue'],
    ['douleur abdominale', 'motifAbdominalPain'],
    ['nausees', 'motifNausea'],
    ['vomissements', 'motifVomiting'],
    ['diarrhee', 'motifDiarrhea'],
    ['constipation', 'motifConstipation'],
    ['dysurie', 'motifDysuria'],
    ['pollakiurie', 'motifPollakiuria'],
    ['lombalgie', 'motifLowBackPain'],
    ['arthralgies', 'motifJointPain'],
    ['bilan de sante', 'motifCheckup'],
    ['renouvellement ordonnance', 'motifPrescriptionRenewal'],
    ['vaccination', 'motifVaccination'],
  ]);

  protected readonly addKioskTag = (term: string): string => this.normalizeTag(term);

  protected readonly isRtl = computed(() => this.language() === 'ar');
  protected readonly canContinueFromReturning = computed(
    () => this.selectedReturningPatientId().length > 0,
  );
  protected readonly canContinueCurrentQuestionStep = computed(() => {
    const form = this.questionnaire();
    switch (this.questionnaireStep()) {
      case 'antecedentsGeneraux':
        return (
          form.hasAntecedentsGeneraux === 'no' ||
          (form.hasAntecedentsGeneraux === 'yes' && form.antecedentsGeneraux.length > 0)
        );
      case 'antecedentsFamiliaux':
        return (
          form.hasAntecedentsFamiliaux === 'no' ||
          (form.hasAntecedentsFamiliaux === 'yes' && form.antecedentsFamiliaux.length > 0)
        );
      case 'signesFonctionnels':
        return (
          form.hasSignesFonctionnels === 'no' ||
          (form.hasSignesFonctionnels === 'yes' && form.signesFonctionnels.length > 0)
        );
      case 'histoireMaladie':
        return (
          form.hasHistoireMaladie === 'no' ||
          (form.hasHistoireMaladie === 'yes' && form.histoireMaladie.trim().length > 0)
        );
      case 'traitementEnCours':
        return (
          form.hasTraitementEnCours === 'no' ||
          (form.hasTraitementEnCours === 'yes' && form.traitementEnCours.length > 0)
        );
      default:
        return true;
    }
  });

  protected readonly stepNumber = computed(() => {
    switch (this.step()) {
      case 'language':
        return 1;
      case 'visit':
        return 2;
      case 'newPatient':
      case 'returningPatient':
        return 3;
      case 'motif':
        return 4;
      case 'questionnaire':
        return 5;
      case 'confirmation':
        return 6;
      default:
        return 1;
    }
  });

  protected readonly questionnaireStepNumber = computed(
    () => this.questionnaireStepOrder.indexOf(this.questionnaireStep()) + 1,
  );
  protected readonly antecedentsGenerauxOptions = computed(() => [
    this.t('generalHistoryHypertension'),
    this.t('generalHistoryDiabetes'),
    this.t('generalHistoryAsthma'),
    this.t('generalHistoryThyroid'),
    this.t('generalHistoryCardiacDisease'),
  ]);
  protected readonly antecedentsFamiliauxOptions = computed(() => [
    this.t('familyHistoryDiabetes'),
    this.t('familyHistoryHypertension'),
    this.t('familyHistoryCardiacDisease'),
    this.t('familyHistoryCancer'),
    this.t('familyHistoryStroke'),
  ]);
  protected readonly signesFonctionnelsOptions = computed(() => [
    this.t('functionalSignFever'),
    this.t('functionalSignCough'),
    this.t('functionalSignDyspnea'),
    this.t('functionalSignChestPain'),
    this.t('functionalSignAbdominalPain'),
    this.t('functionalSignFatigue'),
    this.t('functionalSignHeadache'),
  ]);
  protected readonly defaultMotifOptions = computed(() =>
    this.defaultMotifKeys.map((key) => this.t(key)),
  );
  protected readonly motifSelectOptions = computed(() => this.motifOptions());

  protected readonly canSubmitQuestionnaire = computed(() => {
    const form = this.questionnaire();
    if (
      !form.hasAntecedentsGeneraux ||
      !form.hasAntecedentsFamiliaux ||
      !form.hasSignesFonctionnels ||
      !form.hasHistoireMaladie ||
      !form.hasTraitementEnCours
    ) {
      return false;
    }

    const validHistory =
      form.hasHistoireMaladie === 'no' || form.histoireMaladie.trim().length > 0;
    return this.selectedMotifs().length > 0 && validHistory;
  });

  protected readonly stepsCount = 6;

  ngOnInit(): void {
    this.doctorId.set(this.route.snapshot.paramMap.get('doctorId') ?? '');
    this.kioskKey.set(this.route.snapshot.paramMap.get('kioskKey') ?? '');

    if (!this.doctorId() || !this.kioskKey()) {
      this.setError('genericError');
      return;
    }

    this.loadBootstrap();
  }

  ngOnDestroy(): void {
    this.clearInactivityTimer();
    this.clearConfirmationTimer();
  }

  protected t(key: string): string {
    return selfCheckinT(this.language(), key);
  }

  protected onUserActivity(): void {
    this.resetInactivityTimer();
  }

  protected selectLanguage(language: SelfCheckinLanguage): void {
    this.language.set(language);
    this.step.set('visit');
    this.errorMessage.set('');
    this.infoMessage.set('');
    this.resetInactivityTimer();
  }

  protected selectVisitType(isFirstVisit: boolean): void {
    this.step.set(isFirstVisit ? 'newPatient' : 'returningPatient');
    if (isFirstVisit) {
      this.loadNextDossierNumber();
    }
    this.errorMessage.set('');
    this.infoMessage.set('');
    this.resetInactivityTimer();
  }

  protected backToVisitType(): void {
    this.step.set('visit');
    this.errorMessage.set('');
    this.resetInactivityTimer();
  }

  protected async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        this.isFullscreen.set(false);
        return;
      }

      const container = this.rootContainer?.nativeElement;
      if (!container || !container.requestFullscreen) {
        return;
      }

      await container.requestFullscreen();
      this.isFullscreen.set(true);
    } catch {
      // Browsers may block fullscreen unless a direct user interaction is detected.
    }
  }

  @HostListener('document:fullscreenchange')
  protected onFullscreenChange(): void {
    this.isFullscreen.set(Boolean(document.fullscreenElement));
  }

  protected updateNewPatientField<K extends keyof NewPatientFormModel>(
    key: K,
    value: NewPatientFormModel[K],
  ): void {
    this.newPatient.update((current) => ({ ...current, [key]: value }));
    this.resetInactivityTimer();
  }

  protected goToMotifFromNewPatient(): void {
    const form = this.newPatient();
    if (!form.firstname.trim() || !form.lastname.trim() || !form.dateOfBirth || !form.sex.trim()) {
      this.errorMessage.set(this.t('requiredField'));
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.selfCheckinService
      .createPatient(this.doctorId(), this.kioskKey(), {
        firstname: form.firstname.trim(),
        lastname: form.lastname.trim(),
        dateOfBirth: form.dateOfBirth,
        sex: form.sex.trim(),
        phoneNumber: form.phoneNumber.trim(),
        email: form.email.trim(),
        profession: form.profession.trim(),
        workPlace: form.workPlace.trim(),
        country: form.country.trim() || 'Tunisie',
        city: form.city.trim(),
      })
      .subscribe({
        next: (response: { patient: SelfCheckinPatientSummary }) => {
          this.loading.set(false);
          this.selectedPatientId = response.patient.id;
          this.previousStepBeforeMotif = 'newPatient';
          this.step.set('motif');
          this.errorMessage.set('');
          this.resetInactivityTimer();
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.handleApiError(error);
        },
      });
  }

  protected updateReturningSearchType(searchType: ReturningSearchType): void {
    this.returningSearchType.set(searchType);
    this.returningResults.set([]);
    this.selectedReturningPatientId.set('');
    this.errorMessage.set('');
    this.infoMessage.set('');
    this.resetInactivityTimer();
  }

  protected updateReturningField(
    key: 'nom' | 'prenom' | 'tel' | 'email' | 'numFiche' | 'dateAnniversaire',
    value: string,
  ): void {
    this.returningSearch.update((current) => ({ ...current, [key]: value }));
    this.resetInactivityTimer();
  }

  protected searchReturningPatient(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.infoMessage.set('');
    this.returningResults.set([]);
    this.selectedReturningPatientId.set('');

    const search = this.returningSearch();
    const searchType = this.returningSearchType();

    this.selfCheckinService
      .findPatient(this.doctorId(), this.kioskKey(), {
        searchType,
        nom: search.nom,
        prenom: search.prenom,
        tel: search.tel,
        email: search.email,
        numFiche: search.numFiche,
        dateAnniversaire: search.dateAnniversaire,
      })
      .subscribe({
        next: (response: { results: SelfCheckinPatientSummary[] }) => {
          this.loading.set(false);
          this.returningResults.set(response.results ?? []);
          if ((response.results ?? []).length === 0) {
            this.infoMessage.set(this.t('searchNoResult'));
          }
          this.resetInactivityTimer();
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.handleApiError(error);
        },
      });
  }

  protected selectReturningPatient(patientId: string): void {
    this.selectedReturningPatientId.set(patientId);
    this.errorMessage.set('');
    this.resetInactivityTimer();
  }

  protected continueReturningPatient(): void {
    if (!this.selectedReturningPatientId()) {
      this.errorMessage.set(this.t('requiredField'));
      return;
    }

    this.selectedPatientId = this.selectedReturningPatientId();
    this.previousStepBeforeMotif = 'returningPatient';
    this.step.set('motif');
    this.errorMessage.set('');
    this.resetInactivityTimer();
  }

  protected continueAsNewPatient(): void {
    this.step.set('newPatient');
    this.loadNextDossierNumber();
    this.errorMessage.set('');
    this.resetInactivityTimer();
  }

  protected setMotifInput(value: string): void {
    this.motifInput.set(value);
    this.resetInactivityTimer();
  }

  protected motifOptions(): string[] {
    const byLower = new Map<string, string>();

    for (const option of this.defaultMotifOptions()) {
      const trimmed = option.trim();
      if (!trimmed) {
        continue;
      }
      byLower.set(this.normalizeChoice(trimmed), trimmed);
    }

    for (const option of this.motifSuggestions()) {
      const trimmed = this.translateKnownMotif(option).trim();
      if (!trimmed) {
        continue;
      }
      byLower.set(this.normalizeChoice(trimmed), trimmed);
    }

    for (const option of this.selectedMotifs()) {
      const trimmed = option.trim();
      if (!trimmed) {
        continue;
      }
      byLower.set(this.normalizeChoice(trimmed), trimmed);
    }

    return [...byLower.values()];
  }

  protected updateSelectedMotifs(values: readonly unknown[]): void {
    this.selectedMotifs.set(this.uniqueStrings(values).slice(0, 25));
    this.errorMessage.set('');
    this.resetInactivityTimer();
  }

  protected toggleMotif(motif: string): void {
    const current = this.selectedMotifs();
    if (current.includes(motif)) {
      this.selectedMotifs.set(current.filter((item) => item !== motif));
    } else {
      this.selectedMotifs.set([...current, motif]);
    }

    this.errorMessage.set('');
    this.resetInactivityTimer();
  }

  protected addCustomMotif(): void {
    const raw = this.motifInput().trim();
    if (!raw) {
      return;
    }

    const current = this.selectedMotifs();
    const normalized = raw.toLowerCase();
    if (!current.some((item) => item.toLowerCase() === normalized)) {
      this.selectedMotifs.set([...current, raw]);
    }

    this.motifInput.set('');
    this.errorMessage.set('');
    this.resetInactivityTimer();
  }

  protected continueFromMotifs(): void {
    if (this.selectedMotifs().length === 0) {
      this.errorMessage.set(this.t('motifRequired'));
      return;
    }

    if (!this.selectedPatientId) {
      this.errorMessage.set(this.t('genericError'));
      return;
    }

    if (this.previousStepBeforeMotif === 'returningPatient') {
      this.initializeReturningConsultationFromMotifs();
      return;
    }

    this.openQuestionnaire();
  }

  protected goBackFromMotifs(): void {
    this.step.set(this.previousStepBeforeMotif ?? 'visit');
    this.resetInactivityTimer();
  }

  protected updateQuestionnaireField<K extends keyof QuestionnaireModel>(
    key: K,
    value: QuestionnaireModel[K],
  ): void {
    this.questionnaire.update((current) => ({ ...current, [key]: value }));
    this.errorMessage.set('');
    this.resetInactivityTimer();
  }

  protected updateQuestionnaireSelection(
    key: 'antecedentsGeneraux' | 'antecedentsFamiliaux' | 'signesFonctionnels' | 'traitementEnCours',
    value: readonly unknown[],
  ): void {
    this.questionnaire.update((current) => ({
      ...current,
      [key]: this.uniqueStrings(value).slice(0, 25),
    }));
    this.errorMessage.set('');
    this.resetInactivityTimer();
  }

  protected nextQuestionnaireStep(): void {
    const index = this.questionnaireStepOrder.indexOf(this.questionnaireStep());
    if (index >= this.questionnaireStepOrder.length - 1) {
      return;
    }

    this.questionnaireStep.set(this.questionnaireStepOrder[index + 1]);
    this.resetInactivityTimer();
  }

  protected previousQuestionnaireStep(): void {
    const index = this.questionnaireStepOrder.indexOf(this.questionnaireStep());
    if (index <= 0) {
      this.goBackFromQuestionnaire();
      return;
    }

    this.questionnaireStep.set(this.questionnaireStepOrder[index - 1]);
    this.resetInactivityTimer();
  }

  protected isLastQuestionnaireStep(): boolean {
    return this.questionnaireStep() === 'traitementEnCours';
  }

  protected submitQuestionnaire(): void {
    if (!this.selectedPatientId) {
      this.errorMessage.set(this.t('genericError'));
      return;
    }

    const form = this.questionnaire();
    if (
      !form.hasAntecedentsGeneraux ||
      !form.hasAntecedentsFamiliaux ||
      !form.hasSignesFonctionnels ||
      !form.hasHistoireMaladie ||
      !form.hasTraitementEnCours
    ) {
      this.errorMessage.set(this.t('answerRequired'));
      return;
    }

    if (form.hasHistoireMaladie === 'yes' && form.histoireMaladie.trim().length === 0) {
      this.errorMessage.set(this.t('historySelectionRequired'));
      return;
    }

    if (this.selectedMotifs().length === 0) {
      this.errorMessage.set(this.t('motifRequired'));
      return;
    }

    const nowUtc = new Date();
    const utcDay = nowUtc.toISOString().slice(0, 10);
    const guardKey = `${this.selectedPatientId}|${utcDay}`;
    if (this.sameDayConsultationGuards.has(guardKey)) {
      this.errorMessage.set(this.t('sameDayConsultationBlocked'));
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.infoMessage.set('');

    if (this.consultationId) {
      this.patchConsultationAndConfirm(guardKey);
      return;
    }

    this.consultationCreationGuard
      .hasSameDayConsultation(this.selectedPatientId, utcDay)
      .subscribe({
        next: (hasSameDayConsultation) => {
          if (hasSameDayConsultation) {
            this.loading.set(false);
            this.errorMessage.set(this.t('sameDayConsultationBlocked'));
            return;
          }

          this.selfCheckinService
            .createConsultation(this.doctorId(), this.kioskKey(), {
              patientId: this.selectedPatientId,
              motifs: this.selectedMotifs(),
              consultationDate: nowUtc,
            })
            .subscribe({
              next: (response: SelfCheckinCreateConsultationResponse) => {
                this.consultationId = response.consultationId;
                if (response.reused) {
                  this.infoMessage.set(this.t('sameDayConsultationReused'));
                }

                this.patchConsultationAndConfirm(guardKey);
              },
              error: (error: unknown) => {
                this.loading.set(false);
                this.handleApiError(error);
              },
            });
        },
        error: () => {
          this.loading.set(false);
          this.errorMessage.set(this.t('genericError'));
        },
      });
  }

  protected goBackFromQuestionnaire(): void {
    this.step.set('motif');
    this.resetInactivityTimer();
  }

  protected resetSession(): void {
    this.resetFlow(false);
  }

  private loadBootstrap(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.selfCheckinService.bootstrap(this.doctorId(), this.kioskKey()).subscribe({
      next: (response: SelfCheckinBootstrapResponse) => {
        this.loading.set(false);
        this.doctorDisplayName.set(response.doctor?.displayName ?? '');
        this.timeoutSeconds.set(Math.max(30, response.timeoutSeconds ?? 90));
        this.motifSuggestions.set(response.motifs ?? []);
        this.professionOptions.set(response.professionOptions ?? []);
        this.treatmentOptions.set(response.treatmentOptions ?? []);

        if (!response.enabled) {
          this.step.set('error');
          this.errorMessage.set(this.t('kioskDisabled'));
          return;
        }

        this.step.set('language');
        this.resetInactivityTimer();
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.handleApiError(error);
      },
    });
  }

  private loadNextDossierNumber(): void {
    this.nextDossierNumber.set(null);
    this.isLoadingNextDossierNumber.set(true);

    this.selfCheckinService.getNextDossierNumber(this.doctorId(), this.kioskKey()).subscribe({
      next: (response) => {
        this.nextDossierNumber.set(
          typeof response?.nextDossierNumber === 'number' && response.nextDossierNumber > 0
            ? response.nextDossierNumber
            : null,
        );
        this.isLoadingNextDossierNumber.set(false);
      },
      error: () => {
        this.nextDossierNumber.set(null);
        this.isLoadingNextDossierNumber.set(false);
      },
    });
  }

  private buildQuestionnairePayload(): {
    histoireMaladie: string;
    diagnostics: string[];
    anomalies: SelfCheckinAnomalyRequest[];
    ongoingTreatments: SelfCheckinOngoingTreatmentRequest[];
  } {
    const form = this.questionnaire();
    const anomalies: SelfCheckinAnomalyRequest[] = [];
    const usedPrefilledAnomalies = new Set<number>();
    const usedPrefilledTreatments = new Set<number>();
    let sortOrder = 0;

    const addAnomaly = (
      section: 'medical' | 'family' | 'surgical',
      name: string,
      description: string,
    ): void => {
      const prefilled = this.findPrefilledAnomaly(section, name, usedPrefilledAnomalies);
      if (prefilled) {
        anomalies.push({
          ...prefilled,
          sortOrder: sortOrder++,
        });
        return;
      }

      anomalies.push({
        section,
        isCustom: true,
        templateKey: null,
        sortOrder: sortOrder++,
        payload: {
          name,
          description,
        },
      });
    };

    for (const item of form.hasAntecedentsGeneraux === 'yes' ? form.antecedentsGeneraux : []) {
      addAnomaly('medical', item, '');
    }

    for (const item of form.hasAntecedentsFamiliaux === 'yes' ? form.antecedentsFamiliaux : []) {
      addAnomaly('family', item, '');
    }

    for (const item of form.hasSignesFonctionnels === 'yes' ? form.signesFonctionnels : []) {
      addAnomaly('medical', item, '');
    }

    for (let index = 0; index < this.prefilledAnomalies.length; index++) {
      const prefilled = this.prefilledAnomalies[index];
      if (prefilled.section === 'surgical' && !usedPrefilledAnomalies.has(index)) {
        anomalies.push({
          ...prefilled,
          sortOrder: sortOrder++,
        });
      }
    }

    const selectedTreatments = this.uniqueStrings(
      form.hasTraitementEnCours === 'yes' ? form.traitementEnCours : [],
    )
      .slice(0, 25)
      .map((item) => this.findPrefilledTreatment(item, usedPrefilledTreatments) ?? ({
        medicine: item,
        therapeuticClass: '',
        category: '',
        posology: '',
        duration: '',
        date: '',
      }));

    return {
      histoireMaladie:
        form.hasHistoireMaladie === 'yes' ? form.histoireMaladie.trim() : this.t('no'),
      diagnostics: this.questionnaireDiagnostics,
      anomalies,
      ongoingTreatments: selectedTreatments,
    };
  }

  private initializeReturningConsultationFromMotifs(): void {
    if (this.consultationId) {
      this.openQuestionnaire();
      return;
    }

    const nowUtc = new Date();
    const guardKey = `${this.selectedPatientId}|${nowUtc.toISOString().slice(0, 10)}`;
    if (this.sameDayConsultationGuards.has(guardKey)) {
      this.errorMessage.set(this.t('sameDayConsultationBlocked'));
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.infoMessage.set('');

    this.consultationCreationGuard
      .hasSameDayConsultation(this.selectedPatientId, nowUtc.toISOString().slice(0, 10))
      .subscribe({
        next: (hasSameDayConsultation) => {
          if (hasSameDayConsultation) {
            this.loading.set(false);
            this.errorMessage.set(this.t('sameDayConsultationBlocked'));
            return;
          }

          this.selfCheckinService
            .createConsultation(this.doctorId(), this.kioskKey(), {
              patientId: this.selectedPatientId,
              motifs: this.selectedMotifs(),
              consultationDate: nowUtc,
            })
            .subscribe({
              next: (response: SelfCheckinCreateConsultationResponse) => {
                this.loading.set(false);
                this.consultationId = response.consultationId;
                if (response.reused) {
                  this.infoMessage.set(this.t('sameDayConsultationReused'));
                }

                this.applyConsultationToQuestionnaire(response.consultation);
                this.openQuestionnaire();
              },
              error: (error: unknown) => {
                this.loading.set(false);
                this.handleApiError(error);
              },
            });
        },
        error: () => {
          this.loading.set(false);
          this.errorMessage.set(this.t('genericError'));
        },
      });
  }

  private patchConsultationAndConfirm(guardKey: string): void {
    this.selfCheckinService
      .patchMotif(this.doctorId(), this.kioskKey(), this.consultationId, {
        motifs: this.selectedMotifs(),
      })
      .subscribe({
        next: () => {
          const payload = this.buildQuestionnairePayload();
          this.selfCheckinService
            .patchInterrogatoire(this.doctorId(), this.kioskKey(), this.consultationId, payload)
            .subscribe({
              next: () => {
                this.sameDayConsultationGuards.add(guardKey);
                this.loading.set(false);
                this.step.set('confirmation');
                this.resetInactivityTimer();
                this.scheduleConfirmationReset();
              },
              error: (error: unknown) => {
                this.loading.set(false);
                this.handleApiError(error);
              },
            });
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.handleApiError(error);
        },
      });
  }

  private openQuestionnaire(): void {
    this.step.set('questionnaire');
    this.questionnaireStep.set('antecedentsGeneraux');
    this.errorMessage.set('');
    this.resetInactivityTimer();
  }

  private applyConsultationToQuestionnaire(
    consultation: ConsultationInterrogatoireResponse | null | undefined,
  ): void {
    if (!consultation) {
      return;
    }

    this.questionnaireDiagnostics = this.uniqueStrings(consultation.diagnostics ?? []);

    const generalHistory: string[] = [];
    const familyHistory: string[] = [];
    const functionalSigns: string[] = [];
    const functionalSignChoices = new Set(
      this.signesFonctionnelsOptions().map((item) => this.normalizeChoice(item)),
    );

    const anomalies = [...(consultation.anomalies ?? [])].sort(
      (left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0),
    );
    this.prefilledAnomalies = anomalies.map((item, index) => ({
      section: item.section,
      isCustom: item.isCustom,
      templateKey: item.templateKey,
      sortOrder: item.sortOrder ?? index,
      payload: item.payload ?? {},
    }));
    this.prefilledTreatments = (consultation.ongoingTreatments ?? []).map((item) => ({
      medicine: item.medicine ?? '',
      therapeuticClass: item.therapeuticClass ?? '',
      category: item.category ?? '',
      posology: item.posology ?? '',
      duration: item.duration ?? '',
      date: item.date ?? '',
    }));

    for (const anomaly of anomalies) {
      const label = this.translateKnownQuestionnaireOption(this.anomalyLabel(anomaly));
      if (!label) {
        continue;
      }

      if (anomaly.section === 'family') {
        this.addUniqueChoice(familyHistory, label);
        continue;
      }

      if (functionalSignChoices.has(this.normalizeChoice(label))) {
        this.addUniqueChoice(functionalSigns, label);
        continue;
      }

      if (anomaly.section === 'medical') {
        this.addUniqueChoice(generalHistory, label);
      }
    }

    const treatments = this.uniqueStrings(
      (consultation.ongoingTreatments ?? []).map((item) => item.medicine),
    );
    const histoireMaladie = (consultation.histoireMaladie ?? '').trim();

    this.questionnaire.set({
      hasAntecedentsGeneraux: generalHistory.length > 0 ? 'yes' : '',
      antecedentsGeneraux: generalHistory,
      hasAntecedentsFamiliaux: familyHistory.length > 0 ? 'yes' : '',
      antecedentsFamiliaux: familyHistory,
      hasSignesFonctionnels: functionalSigns.length > 0 ? 'yes' : '',
      signesFonctionnels: functionalSigns,
      hasHistoireMaladie: histoireMaladie.length > 0 ? 'yes' : '',
      histoireMaladie,
      hasTraitementEnCours: treatments.length > 0 ? 'yes' : '',
      traitementEnCours: treatments,
    });
  }

  private anomalyLabel(
    anomaly: { payload?: Record<string, unknown> | null; templateKey?: string | null },
  ): string {
    const payload = (anomaly.payload ?? {}) as Record<string, unknown>;
    return this.pickFirstString(
      payload['name'],
      payload['label'],
      payload['type'],
      anomaly.templateKey,
    );
  }

  private findPrefilledAnomaly(
    section: 'medical' | 'family' | 'surgical',
    name: string,
    usedIndexes: Set<number>,
  ): SelfCheckinAnomalyRequest | null {
    const normalizedName = this.normalizeChoice(name);
    for (let index = 0; index < this.prefilledAnomalies.length; index++) {
      const candidate = this.prefilledAnomalies[index];
      if (usedIndexes.has(index) || candidate.section !== section) {
        continue;
      }

      const candidateLabel = this.translateKnownQuestionnaireOption(this.anomalyLabel(candidate));
      if (this.normalizeChoice(candidateLabel) === normalizedName) {
        usedIndexes.add(index);
        return candidate;
      }
    }

    return null;
  }

  private findPrefilledTreatment(
    medicine: string,
    usedIndexes: Set<number>,
  ): SelfCheckinOngoingTreatmentRequest | null {
    const normalizedMedicine = this.normalizeChoice(medicine);
    for (let index = 0; index < this.prefilledTreatments.length; index++) {
      const candidate = this.prefilledTreatments[index];
      if (usedIndexes.has(index)) {
        continue;
      }

      if (this.normalizeChoice(candidate.medicine) === normalizedMedicine) {
        usedIndexes.add(index);
        return candidate;
      }
    }

    return null;
  }

  private translateKnownMotif(value: string): string {
    const key = this.motifKeyByKnownLabel.get(this.normalizeChoice(value));
    return key ? this.t(key) : this.translateKnownI18nValue(value, this.defaultMotifKeys);
  }

  private translateKnownQuestionnaireOption(value: string): string {
    return this.translateKnownI18nValue(value, this.questionnaireOptionKeys);
  }

  private translateKnownI18nValue(value: string, keys: readonly string[]): string {
    const normalized = this.normalizeChoice(value);
    for (const key of keys) {
      for (const language of this.supportedLanguages) {
        if (this.normalizeChoice(selfCheckinT(language, key)) === normalized) {
          return this.t(key);
        }
      }
    }

    return value;
  }

  private pickFirstString(...values: unknown[]): string {
    for (const value of values) {
      if (typeof value !== 'string') {
        continue;
      }

      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }

    return '';
  }

  private addUniqueChoice(target: string[], value: string): void {
    const normalized = this.normalizeChoice(value);
    if (target.some((item) => this.normalizeChoice(item) === normalized)) {
      return;
    }

    target.push(value);
  }

  private uniqueStrings(values: readonly unknown[]): string[] {
    const result: string[] = [];
    for (const value of values) {
      if (typeof value !== 'string') {
        continue;
      }

      const trimmed = value.trim();
      if (!trimmed) {
        continue;
      }

      this.addUniqueChoice(result, trimmed);
    }

    return result;
  }

  private normalizeChoice(value: string): string {
    return value
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private normalizeTag(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  private resetFlow(fromInactivity: boolean): void {
    this.clearConfirmationTimer();
    this.clearInactivityTimer();

    this.step.set('language');
    this.language.set('fr');
    this.errorMessage.set('');
    this.infoMessage.set(fromInactivity ? this.t('resetInfo') : '');

    this.selectedMotifs.set([]);
    this.motifInput.set('');
    this.returningResults.set([]);
    this.selectedReturningPatientId.set('');
    this.selectedPatientId = '';
    this.consultationId = '';
    this.questionnaireDiagnostics = [];
    this.prefilledAnomalies = [];
    this.prefilledTreatments = [];
    this.previousStepBeforeMotif = null;
    this.questionnaireStep.set('antecedentsGeneraux');

    this.newPatient.set({
      firstname: '',
      lastname: '',
      dateOfBirth: '',
      sex: '',
      phoneNumber: '',
      email: '',
      profession: '',
      workPlace: '',
      country: 'Tunisie',
      city: '',
    });
    this.nextDossierNumber.set(null);
    this.isLoadingNextDossierNumber.set(false);

    this.returningSearch.set({
      nom: '',
      prenom: '',
      tel: '',
      email: '',
      numFiche: '',
      dateAnniversaire: '',
    });
    this.returningSearchType.set('phone');

    this.questionnaire.set({
      hasAntecedentsGeneraux: '',
      antecedentsGeneraux: [],
      hasAntecedentsFamiliaux: '',
      antecedentsFamiliaux: [],
      hasSignesFonctionnels: '',
      signesFonctionnels: [],
      hasHistoireMaladie: '',
      histoireMaladie: '',
      hasTraitementEnCours: '',
      traitementEnCours: [],
    });

    this.resetInactivityTimer();
  }

  private resetInactivityTimer(): void {
    if (this.step() === 'error') {
      return;
    }

    this.clearInactivityTimer();
    this.inactivityTimer = setTimeout(() => {
      this.resetFlow(true);
    }, this.timeoutSeconds() * 1000);
  }

  private clearInactivityTimer(): void {
    if (!this.inactivityTimer) {
      return;
    }

    clearTimeout(this.inactivityTimer);
    this.inactivityTimer = null;
  }

  private scheduleConfirmationReset(): void {
    this.clearConfirmationTimer();
    this.confirmationTimer = setTimeout(() => {
      this.resetFlow(false);
    }, 20000);
  }

  private clearConfirmationTimer(): void {
    if (!this.confirmationTimer) {
      return;
    }

    clearTimeout(this.confirmationTimer);
    this.confirmationTimer = null;
  }

  private setError(key: string): void {
    this.step.set('error');
    this.errorMessage.set(this.t(key));
  }

  private handleApiError(error: unknown): void {
    const parsed = this.extractApiErrorMessage(error);
    this.errorMessage.set(parsed);
    if (this.step() === 'language') {
      this.step.set('error');
    }
  }

  private extractApiErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const payload = error.error as { message?: string; Message?: string; code?: string } | null;
      const code = payload?.code?.toLowerCase() ?? '';
      if (code.includes('same') && code.includes('day')) {
        return this.t('sameDayConsultationBlocked');
      }

      const message = payload?.message ?? payload?.Message;
      if (typeof message === 'string' && message.trim().length > 0) {
        return message;
      }
    }

    return this.t('genericError');
  }
}
