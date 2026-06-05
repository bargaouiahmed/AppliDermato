import {
  ConsultationConduiteActionResponse,
  ConsultationConduiteResponse,
} from '../../../../../../core/models/conduite.models';
import {
  ConsultationExamPayload,
  SPECIFIC_EXAM_SECTION_KEYS,
  SPECIFIC_EXAM_SECTION_NORMAL_FINDINGS,
  SpecificExamSectionData,
  SpecificExamSectionKey,
  createDefaultConsultationExamPayload,
} from '../../../../../../core/models/exam.models';
import {
  UpdateInterrogatoireAnomalyRequest,
  UpdateOngoingTreatmentMedicineRequest,
} from '../../../../../../core/models/interrogatoire.models';
import { Patient } from '../../../../../../core/models/patient.models';

export type ConclusionTone = 'normal' | 'abnormal' | 'unassigned';

export interface ConclusionBadge {
  label: string;
  tone: ConclusionTone;
  meta?: string;
}

export interface ConclusionField {
  label: string;
  value: string;
}

export interface ConclusionMetric {
  label: string;
  value: string;
  tone?: ConclusionTone;
}

export interface ConclusionGroup {
  title: string;
  badges: ConclusionBadge[];
}

export interface ConclusionGeneralSummary {
  title: string;
  statusLabel: string;
  statusTone: ConclusionTone;
  metrics: ConclusionMetric[];
}

export interface ConclusionStoryBlock {
  title: string;
  text: string;
  isEmpty: boolean;
  emptyText: string;
}

export interface ConclusionTreatmentRow {
  medicine: string;
  therapeuticClass: string;
  category: string;
  posology: string;
  duration: string;
  date: string;
}

export interface ConclusionStat {
  label: string;
  value: string;
  tone: ConclusionTone;
}

export interface ConsultationConclusionViewModel {
  title: string;
  patientFields: ConclusionField[];
  motifsLabel: string;
  motifs: string[];
  story: ConclusionStoryBlock;
  historyTitle: string;
  historyGroups: ConclusionGroup[];
  generalSummary: ConclusionGeneralSummary;
  clinicalTitle: string;
  clinicalGroups: ConclusionGroup[];
  carePlanTitle: string;
  carePlanGroups: ConclusionGroup[];
  ongoingTreatmentsTitle: string;
  ongoingTreatments: ConclusionTreatmentRow[];
  ongoingTreatmentsEmptyLabel: string;
  emptyBadgeLabel: string;
  stats: ConclusionStat[];
}

interface ConclusionEmptyLabels {
  generalStatus: string;
  medicalHistory: string;
  familyHistory: string;
  functionalSigns: string;
  story: string;
  ongoingTreatments: string;
  metrics: {
    tension: string;
    frequenceCardiaque: string;
    temperature: string;
    saturation: string;
    poids: string;
    taille: string;
    imc: string;
  };
}

export interface BuildConsultationConclusionViewModelArgs {
  patient: Patient | null;
  consultationDate: string;
  motifs: string[];
  histoireMaladie: string;
  diagnostics: string[];
  anomalies: UpdateInterrogatoireAnomalyRequest[];
  ongoingTreatments: UpdateOngoingTreatmentMedicineRequest[];
  examPayload?: ConsultationExamPayload | null;
  conduite?: ConsultationConduiteResponse | null;
  locale: string;
  translate: (key: string) => string;
}

const EXAM_SECTION_TITLE_KEYS: Record<SpecificExamSectionKey, string> = {
  orlCouConjonctive: 'consultation.page.exam.specific.orlCouConjonctive.title',
  auscultationCardiaque: 'consultation.page.exam.specific.auscultationCardiaque.title',
  auscultationPulmonaire: 'consultation.page.exam.specific.auscultationPulmonaire.title',
  abdomen: 'consultation.page.exam.specific.abdomen.title',
  neurologique: 'consultation.page.exam.specific.neurologique.title',
  locomoteurOsteoArticulaire: 'consultation.page.exam.specific.locomoteurOsteoArticulaire.title',
  peauDermatologique: 'consultation.page.exam.specific.peauDermatologique.title',
  urogenital: 'consultation.page.exam.specific.urogenital.title',
};

export function buildConsultationConclusionViewModel(
  args: BuildConsultationConclusionViewModelArgs,
): ConsultationConclusionViewModel {
  const translate = args.translate;
  const noneLabel = translate('consultation.page.none');
  const emptyBadgeLabel = translate('consultation.page.conclusion.empty.unassigned');
  const emptyLabels = createConclusionEmptyLabels(args.locale, emptyBadgeLabel);
  const examPayload = normalizeExamPayloadForConclusion(args.examPayload);
  const conduite = args.conduite ?? {
    consultationId: '',
    additionalInformation: '',
    actions: [],
  };

  const historyGroups = buildHistoryGroups(args.anomalies ?? [], translate, emptyLabels);
  const generalSummary = buildGeneralSummary(
    examPayload,
    translate,
    emptyLabels,
  );
  const clinicalGroups = buildClinicalGroups(examPayload, translate, emptyBadgeLabel);
  const carePlanGroups = buildCarePlanGroups(conduite, args.diagnostics ?? [], translate, emptyBadgeLabel);
  const ongoingTreatments = buildTreatmentRows(args.ongoingTreatments ?? [], args.locale, noneLabel);

  const abnormalCount = countByTone(
    historyGroups.flatMap((group) => group.badges),
    'abnormal',
  ) + countByTone(clinicalGroups.flatMap((group) => group.badges), 'abnormal')
    + countByTone(carePlanGroups.flatMap((group) => group.badges), 'abnormal');

  const normalCount = (generalSummary.statusTone === 'normal' ? 1 : 0)
    + countByTone(clinicalGroups.flatMap((group) => group.badges), 'normal');

  const unassignedCount = (generalSummary.statusTone === 'unassigned' ? 1 : 0)
    + countByTone(historyGroups.flatMap((group) => group.badges), 'unassigned')
    + countByTone(clinicalGroups.flatMap((group) => group.badges), 'unassigned')
    + countByTone(carePlanGroups.flatMap((group) => group.badges), 'unassigned')
    + (ongoingTreatments.length === 0 ? 1 : 0)
    + (!normalizeText(args.histoireMaladie) ? 1 : 0);

  return {
    title: translate('consultation.page.conclusion.title'),
    patientFields: buildPatientFields(
      args.patient,
      args.consultationDate,
      args.motifs ?? [],
      args.locale,
      translate,
    ),
    motifsLabel: translate('consultation.page.conclusion.labels.motifs'),
    motifs: normalizeStringArray(args.motifs ?? []),
    story: {
      title: translate('consultation.page.conclusion.labels.histoireMaladie'),
      text: normalizeText(args.histoireMaladie),
      isEmpty: !normalizeText(args.histoireMaladie),
      emptyText: emptyLabels.story,
    },
    historyTitle: translate('consultation.page.conclusion.labels.interrogatoire'),
    historyGroups,
    generalSummary,
    clinicalTitle: translate('consultation.page.conclusion.labels.examenClinique'),
    clinicalGroups,
    carePlanTitle: translate('consultation.page.conclusion.labels.carePlan'),
    carePlanGroups,
    ongoingTreatmentsTitle: translate('consultation.page.conclusion.labels.ongoingTreatments'),
    ongoingTreatments,
    ongoingTreatmentsEmptyLabel: emptyLabels.ongoingTreatments,
    emptyBadgeLabel,
    stats: [
      {
        label: translate('consultation.page.conclusion.labels.summaryAbnormal'),
        value: String(abnormalCount),
        tone: 'abnormal',
      },
      {
        label: translate('consultation.page.conclusion.labels.summaryNormal'),
        value: String(normalCount),
        tone: 'normal',
      },
      {
        label: translate('consultation.page.conclusion.labels.summaryUnassigned'),
        value: String(unassignedCount),
        tone: 'unassigned',
      },
    ],
  };
}

function createConclusionEmptyLabels(
  locale: string,
  fallbackLabel: string,
): ConclusionEmptyLabels {
  if (!locale.toLowerCase().startsWith('fr')) {
    return {
      generalStatus: fallbackLabel,
      medicalHistory: fallbackLabel,
      familyHistory: fallbackLabel,
      functionalSigns: fallbackLabel,
      story: fallbackLabel,
      ongoingTreatments: fallbackLabel,
      metrics: {
        tension: fallbackLabel,
        frequenceCardiaque: fallbackLabel,
        temperature: fallbackLabel,
        saturation: fallbackLabel,
        poids: fallbackLabel,
        taille: fallbackLabel,
        imc: fallbackLabel,
      },
    };
  }

  return {
    generalStatus: 'Non mentionné',
    medicalHistory: 'Non mentionnés',
    familyHistory: 'Non mentionnés',
    functionalSigns: 'Non mentionnés',
    story: 'Non mentionnée',
    ongoingTreatments: 'Non mentionnés',
    metrics: {
      tension: 'Non mentionnée',
      frequenceCardiaque: 'Non mentionnée',
      temperature: 'Non mentionnée',
      saturation: 'Non mentionnée',
      poids: 'Non mentionné',
      taille: 'Non mentionnée',
      imc: 'Non mentionné',
    },
  };
}

function buildPatientFields(
  patient: Patient | null,
  consultationDate: string,
  motifs: string[],
  locale: string,
  translate: (key: string) => string,
): ConclusionField[] {
  const noneLabel = translate('consultation.page.none');
  const motifValue = normalizeDistinctStrings(motifs ?? []).join(', ') || noneLabel;

  return [
    {
      label: translate('patients.create.fields.lastname'),
      value: normalizeText(patient?.lastname) || noneLabel,
    },
    {
      label: translate('patients.create.fields.firstname'),
      value: normalizeText(patient?.firstname) || noneLabel,
    },
    {
      label: translate('consultation.page.patient.age'),
      value: formatAge(patient?.dateOfBirth ?? '', locale, noneLabel),
    },
    {
      label: translate('consultation.page.patient.profession'),
      value: normalizeText(patient?.profession) || noneLabel,
    },
    {
      label: translate('consultation.page.conclusion.labels.consultationDate'),
      value: formatDateValue(consultationDate, locale, noneLabel),
    },
    {
      label: translate('consultation.page.motif.title'),
      value: motifValue,
    },
  ];
}

function buildHistoryGroups(
  anomalies: UpdateInterrogatoireAnomalyRequest[],
  translate: (key: string) => string,
  emptyLabels: ConclusionEmptyLabels,
): ConclusionGroup[] {
  const generalAntecedents = (anomalies ?? []).filter(
    (item) => item.section === 'medical' && !isFunctionalSignAnomaly(item),
  );
  const functionalSigns = (anomalies ?? []).filter(
    (item) => item.section === 'medical' && isFunctionalSignAnomaly(item),
  );
  const familyAntecedents = (anomalies ?? []).filter((item) => item.section === 'family');

  return [
    buildHistoryGroup(
      translate('consultation.page.conclusion.labels.medicalHistory'),
      generalAntecedents,
      emptyLabels.medicalHistory,
    ),
    buildHistoryGroup(
      translate('consultation.page.conclusion.labels.familyHistory'),
      familyAntecedents,
      emptyLabels.familyHistory,
    ),
    buildHistoryGroup(
      translate('consultation.page.interrogatoire.functionalSigns.title'),
      functionalSigns,
      emptyLabels.functionalSigns,
    ),
  ];
}

function buildHistoryGroup(
  title: string,
  anomalies: UpdateInterrogatoireAnomalyRequest[],
  emptyBadgeLabel: string,
): ConclusionGroup {
  const badges = normalizeDistinctBadges(
    (anomalies ?? [])
      .map((item) => buildAnomalyBadge(item))
      .filter((item): item is ConclusionBadge => item !== null),
  );

  return {
    title,
    badges: badges.length > 0 ? badges : [createUnassignedBadge(emptyBadgeLabel)],
  };
}

function buildAnomalyBadge(item: UpdateInterrogatoireAnomalyRequest): ConclusionBadge | null {
  const payload = asRecord(item.payload);
  const label = firstNonEmptyString(
    payload['label'],
    payload['name'],
    payload['title'],
    payload['value'],
    payload['type'],
    item.templateKey,
  );

  if (!label) {
    return null;
  }

  const meta = firstNonEmptyString(
    payload['severity'],
    payload['diagnosedSince'],
    payload['date'],
    payload['description'],
    payload['notes'],
    payload['treatmentName'],
  );

  return {
    label: normalizeText(label),
    tone: 'abnormal',
    meta: normalizeText(meta),
  };
}

function buildGeneralSummary(
  examPayload: ConsultationExamPayload,
  translate: (key: string) => string,
  emptyLabels: ConclusionEmptyLabels,
): ConclusionGeneralSummary {
  const general = examPayload.general ?? createDefaultConsultationExamPayload().general;
  const etatGeneral = normalizeText(general.etatGeneral);
  const generalConditionLabel = translate('consultation.page.exam.general.etatGeneral.title');

  let statusValue = emptyLabels.generalStatus;
  let statusTone: ConclusionTone = 'unassigned';

  if (etatGeneral === 'good') {
    statusValue = translate('consultation.page.exam.general.etatGeneral.good');
    statusTone = 'normal';
  } else if (etatGeneral === 'average') {
    statusValue = translate('consultation.page.exam.general.etatGeneral.average');
    statusTone = 'abnormal';
  } else if (etatGeneral === 'altered') {
    statusValue = translate('consultation.page.exam.general.etatGeneral.altered');
    statusTone = 'abnormal';
  }

  return {
    title: translate('consultation.page.conclusion.labels.examenGeneral'),
    statusLabel: `${generalConditionLabel}: ${statusValue}`,
    statusTone,
    metrics: [
      {
        label: translate('consultation.page.exam.general.tension.title'),
        value: formatBloodPressure(general, emptyLabels.metrics.tension),
        tone: general.tensionSystolique === null && general.tensionDiastolique === null ? 'normal' : undefined,
      },
      {
        label: translate('consultation.page.exam.general.frequenceCardiaque.title'),
        value: formatHeartRate(general, translate, emptyLabels.metrics.frequenceCardiaque),
        tone:
          general.frequenceCardiaque === null
          && general.rythmeCardiaque !== 'regular'
          && general.rythmeCardiaque !== 'irregular'
            ? 'normal'
            : undefined,
      },
      {
        label: translate('consultation.page.exam.general.temperature.title'),
        value: general.temperature === null ? emptyLabels.metrics.temperature : `${formatNumber(general.temperature)} °C`,
        tone: general.temperature === null ? 'normal' : undefined,
      },
      {
        label: translate('consultation.page.exam.general.saturation.title'),
        value: general.saturationO2 === null ? emptyLabels.metrics.saturation : `${general.saturationO2} %`,
        tone: general.saturationO2 === null ? 'normal' : undefined,
      },
      {
        label: translate('consultation.page.exam.general.poids.title'),
        value: general.poidsKg === null ? emptyLabels.metrics.poids : `${formatNumber(general.poidsKg)} kg`,
        tone: general.poidsKg === null ? 'normal' : undefined,
      },
      {
        label: translate('consultation.page.exam.general.taille.title'),
        value: general.tailleCm === null ? emptyLabels.metrics.taille : `${formatNumber(general.tailleCm)} cm`,
        tone: general.tailleCm === null ? 'normal' : undefined,
      },
      {
        label: translate('consultation.page.exam.general.imc.title'),
        value: formatImcValue(general, translate, emptyLabels.metrics.imc),
        tone: general.imc === null ? 'normal' : undefined,
      },
    ],
  };
}

function buildClinicalGroups(
  examPayload: ConsultationExamPayload,
  translate: (key: string) => string,
  emptyBadgeLabel: string,
): ConclusionGroup[] {
  return SPECIFIC_EXAM_SECTION_KEYS.map((sectionKey) => ({
    title: translate(EXAM_SECTION_TITLE_KEYS[sectionKey]),
    badges: buildClinicalBadges(sectionKey, examPayload.specific?.[sectionKey], emptyBadgeLabel),
  }));
}

function buildClinicalBadges(
  sectionKey: SpecificExamSectionKey,
  sectionData: SpecificExamSectionData | null | undefined,
  emptyBadgeLabel: string,
): ConclusionBadge[] {
  const normalizedFindings = normalizeDistinctStrings(sectionData?.selectedFindings ?? []);
  const normalFinding = normalizeText(SPECIFIC_EXAM_SECTION_NORMAL_FINDINGS[sectionKey] ?? '');

  if (sectionData?.status === 'normal' && normalizedFindings.length === 0 && normalFinding) {
    return [{ label: normalFinding, tone: 'normal' }];
  }

  if (normalizedFindings.length === 0 || sectionData?.status === 'not_examined') {
    return [createUnassignedBadge(emptyBadgeLabel)];
  }

  const nonNormalFindings = normalizedFindings.filter((item) => !sameText(item, normalFinding));
  if (nonNormalFindings.length === 0 && normalFinding) {
    return [{ label: normalFinding, tone: 'normal' }];
  }

  return nonNormalFindings.map((finding) => ({
    label: finding,
    tone: 'abnormal',
    meta: normalizeText(readFindingDescription(sectionData, finding)),
  }));
}

function buildCarePlanGroups(
  conduite: ConsultationConduiteResponse,
  diagnostics: string[],
  translate: (key: string) => string,
  emptyBadgeLabel: string,
): ConclusionGroup[] {
  const actions = conduite.actions ?? [];
  const ordonnancePayload = asRecord(findAction(actions, 'ordonnance')?.payload);
  const certificatPayload = asRecord(findAction(actions, 'certificat')?.payload);
  const lettrePayload = asRecord(findAction(actions, 'lettre_confrere')?.payload);

  return [
    {
      title: translate('consultation.page.conclusion.labels.diagnostics'),
      badges: buildDiagnosticBadges(diagnostics, emptyBadgeLabel),
    },
    {
      title: translate('consultation.page.conclusion.labels.prescription'),
      badges: buildPrescriptionBadges(ordonnancePayload, emptyBadgeLabel),
    },
    {
      title: translate('consultation.page.conclusion.labels.paraclinicalRequests'),
      badges: buildParacliniqueBadges(actions, translate, emptyBadgeLabel),
    },
    {
      title: translate('consultation.page.conclusion.labels.certificatesReferral'),
      badges: buildCertificateAndReferralBadges(
        certificatPayload,
        lettrePayload,
        translate,
        emptyBadgeLabel,
      ),
    },
  ];
}

function buildDiagnosticBadges(
  diagnostics: string[],
  emptyBadgeLabel: string,
): ConclusionBadge[] {
  const badges = normalizeDistinctStrings(diagnostics ?? []).map((diagnostic) => ({
    label: diagnostic,
    tone: 'abnormal' as const,
  }));

  return badges.length > 0 ? badges : [createUnassignedBadge(emptyBadgeLabel)];
}

function buildPrescriptionBadges(
  payload: Record<string, unknown>,
  emptyBadgeLabel: string,
): ConclusionBadge[] {
  const rawList = payload['listDrugs'];
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return [createUnassignedBadge(emptyBadgeLabel)];
  }

  const badges = rawList
    .map<ConclusionBadge | null>((entry) => {
      const drug = asRecord(entry);
      const name = firstNonEmptyString(drug['nom'], drug['medicine']);
      if (!name) {
        return null;
      }

      return {
        label: normalizeText(name),
        tone: 'abnormal' as const,
        meta: joinMeta(
          normalizeText(firstNonEmptyString(drug['typeClass'], drug['therapeuticClass'])),
          normalizeText(drug['category']),
          normalizeText(drug['posology']),
          normalizeText(firstNonEmptyString(drug['duree'], drug['duration'])),
        ),
      };
    })
    .filter((item): item is ConclusionBadge => item !== null);

  return badges.length > 0 ? normalizeDistinctBadges(badges) : [createUnassignedBadge(emptyBadgeLabel)];
}

function buildParacliniqueBadges(
  actions: ConsultationConduiteActionResponse[],
  translate: (key: string) => string,
  emptyBadgeLabel: string,
): ConclusionBadge[] {
  const chirurgiePayload = asRecord(findAction(actions, 'paraclinique_chirurgie')?.payload);
  const imageriePayload = asRecord(findAction(actions, 'paraclinique_imagerie')?.payload);
  const bilanPayload = asRecord(findAction(actions, 'paraclinique_bilan_sanguin')?.payload);
  const badges: ConclusionBadge[] = [];

  const chirurgieTypes = normalizeDistinctStrings([
    readNestedText(chirurgiePayload, ['type']),
    ...readTypeNames(chirurgiePayload['types']),
  ]);

  for (const item of chirurgieTypes) {
    badges.push({
      label: `${translate('consultation.conduite.actions.paracliniqueChirurgie')} : ${item}`,
      tone: 'abnormal',
    });
  }

  const imagerieTypes = normalizeDistinctStrings([
    readNestedText(imageriePayload, ['type']),
    ...readTypeNames(imageriePayload['types']),
  ]);

  for (const item of imagerieTypes) {
    badges.push({
      label: `${translate('consultation.conduite.actions.paracliniqueImagerie')} : ${item}`,
      tone: 'abnormal',
    });
  }

  const selectedBilanTypes = Array.isArray(bilanPayload['selectedBilanTypes'])
    ? bilanPayload['selectedBilanTypes']
    : [];

  for (const item of selectedBilanTypes) {
    const row = asRecord(item);
    const name = normalizeText(firstNonEmptyString(row['name'], row['key']));
    if (!name) {
      continue;
    }

    const checkedCount = Object.values(asRecord(row['checkboxValues'])).filter((value) => value === true).length;
    badges.push({
      label: `${translate('consultation.conduite.actions.paracliniqueBilanSanguin')} : ${name}`,
      tone: 'abnormal',
      meta: checkedCount > 0 ? `${checkedCount}` : undefined,
    });
  }

  return badges.length > 0 ? normalizeDistinctBadges(badges) : [createUnassignedBadge(emptyBadgeLabel)];
}

function buildCertificateAndReferralBadges(
  certificatPayload: Record<string, unknown>,
  lettrePayload: Record<string, unknown>,
  translate: (key: string) => string,
  emptyBadgeLabel: string,
): ConclusionBadge[] {
  const badges: ConclusionBadge[] = [];

  const certificateType = normalizeText(certificatPayload['types']);
  if (certificateType) {
    badges.push({
      label: certificateType,
      tone: 'abnormal',
      meta: joinMeta(
        normalizeText(certificatPayload['nombre']),
        normalizeText(certificatPayload['compterDe']),
        normalizeText(certificatPayload['dateCertificat']),
      ),
    });
  }

  const recipient = normalizeText(lettrePayload['medecin']);
  const content = normalizeText(lettrePayload['contenue']);
  if (recipient || content) {
    badges.push({
      label: recipient
        ? `${translate('consultation.page.conclusion.badges.recipient')} : ${recipient}`
        : translate('consultation.page.conclusion.badges.letterPrepared'),
      tone: 'abnormal',
    });
  }

  return badges.length > 0 ? normalizeDistinctBadges(badges) : [createUnassignedBadge(emptyBadgeLabel)];
}

function buildTreatmentRows(
  treatments: UpdateOngoingTreatmentMedicineRequest[],
  locale: string,
  noneLabel: string,
): ConclusionTreatmentRow[] {
  return (treatments ?? [])
    .map((item) => ({
      medicine: normalizeText(item.medicine) || noneLabel,
      therapeuticClass: normalizeText(item.therapeuticClass) || noneLabel,
      category: normalizeText(item.category) || noneLabel,
      posology: normalizeText(item.posology) || noneLabel,
      duration: normalizeText(item.duration) || noneLabel,
      date: formatDateValue(item.date, locale, noneLabel),
    }))
    .filter((item) => item.medicine !== noneLabel || item.therapeuticClass !== noneLabel || item.category !== noneLabel || item.posology !== noneLabel || item.duration !== noneLabel);
}

function countByTone(items: ConclusionBadge[], tone: ConclusionTone): number {
  return items.filter((item) => item.tone === tone).length;
}

function formatBloodPressure(
  general: ConsultationExamPayload['general'],
  noneLabel: string,
): string {
  if (general.tensionSystolique === null && general.tensionDiastolique === null) {
    return noneLabel;
  }

  const systolic = general.tensionSystolique === null ? '-' : String(general.tensionSystolique);
  const diastolic = general.tensionDiastolique === null ? '-' : String(general.tensionDiastolique);
  return `${systolic} / ${diastolic} mmHg`;
}

function formatHeartRate(
  general: ConsultationExamPayload['general'],
  translate: (key: string) => string,
  noneLabel: string,
): string {
  const parts: string[] = [];
  if (general.frequenceCardiaque !== null) {
    parts.push(`${general.frequenceCardiaque} bpm`);
  }
  if (general.rythmeCardiaque === 'regular') {
    parts.push(translate('consultation.page.exam.general.frequenceCardiaque.regular'));
  } else if (general.rythmeCardiaque === 'irregular') {
    parts.push(translate('consultation.page.exam.general.frequenceCardiaque.irregular'));
  }
  return parts.length > 0 ? parts.join(' • ') : noneLabel;
}

function formatImcValue(
  general: ConsultationExamPayload['general'],
  translate: (key: string) => string,
  noneLabel: string,
): string {
  if (general.imc === null) {
    return noneLabel;
  }

  const imc = Number(general.imc);
  let categoryKey = 'consultation.page.exam.general.imc.category.normal';
  if (imc < 18.5) {
    categoryKey = 'consultation.page.exam.general.imc.category.low';
  } else if (imc >= 25 && imc < 30) {
    categoryKey = 'consultation.page.exam.general.imc.category.overweight';
  } else if (imc >= 30) {
    categoryKey = 'consultation.page.exam.general.imc.category.obesity';
  }

  return `${formatNumber(imc)} • ${translate(categoryKey)}`;
}

function readFindingDescription(
  sectionData: SpecificExamSectionData | null | undefined,
  label: string,
): string {
  if (!sectionData?.findingDetails) {
    return '';
  }

  const normalizedLabel = normalizeText(label).toLowerCase();
  for (const [key, value] of Object.entries(sectionData.findingDetails)) {
    if (normalizeText(key).toLowerCase() !== normalizedLabel) {
      continue;
    }

    return normalizeText(value?.description ?? '');
  }

  return '';
}

function findAction(
  actions: ConsultationConduiteActionResponse[],
  actionKey: string,
): ConsultationConduiteActionResponse | null {
  const normalized = normalizeActionKey(actionKey);
  for (const action of actions ?? []) {
    if (normalizeActionKey(action.actionKey) === normalized) {
      return action;
    }
  }
  return null;
}

function normalizeActionKey(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function readNestedText(source: Record<string, unknown>, path: string[]): string {
  let current: unknown = source;
  for (const step of path) {
    if (!current || typeof current !== 'object') {
      return '';
    }
    current = (current as Record<string, unknown>)[step];
  }
  return normalizeText(current);
}

function readTypeNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return normalizeDistinctStrings(
    value.map((item) => firstNonEmptyString(asRecord(item)['name'], asRecord(item)['label'])),
  );
}

function createUnassignedBadge(label: string): ConclusionBadge {
  return { label, tone: 'unassigned' };
}

function normalizeDistinctBadges(items: ConclusionBadge[]): ConclusionBadge[] {
  const seen = new Set<string>();
  const result: ConclusionBadge[] = [];
  for (const item of items) {
    const key = `${item.tone}::${normalizeText(item.label).toLowerCase()}::${normalizeText(item.meta).toLowerCase()}`;
    if (!item.label || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

function normalizeDistinctStrings(items: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const normalized = normalizeText(item);
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function normalizeStringArray(items: string[]): string[] {
  return normalizeDistinctStrings(items);
}

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().replace(/\s+/g, ' ');
}

function formatAge(dateOfBirth: string, locale: string, noneLabel: string): string {
  const parsed = new Date(dateOfBirth);
  if (Number.isNaN(parsed.getTime())) {
    return noneLabel;
  }

  const today = new Date();
  let years = today.getFullYear() - parsed.getFullYear();
  const monthDiff = today.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) {
    years -= 1;
  }
  return Number.isFinite(years) && years >= 0 ? new Intl.NumberFormat(locale).format(years) : noneLabel;
}

function formatDateValue(value: string, locale: string, fallback: string): string {
  if (!value) {
    return fallback;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return normalizeText(value) || fallback;
  }
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

function formatNumber(value: number): string {
  return Number(value).toFixed(Number.isInteger(value) ? 0 : 1);
}

function sameText(left: string, right: string): boolean {
  return normalizeText(left).toLowerCase() === normalizeText(right).toLowerCase();
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) {
      return normalized;
    }
  }
  return '';
}

function joinMeta(...values: Array<string | null | undefined>): string {
  const normalized = values
    .map((value) => normalizeText(value))
    .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);
  return normalized.join(' • ');
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function normalizeExamPayloadForConclusion(
  incoming: ConsultationExamPayload | null | undefined,
): ConsultationExamPayload {
  const defaults = createDefaultConsultationExamPayload();
  if (!incoming) {
    return defaults;
  }

  const specific = { ...defaults.specific };
  for (const sectionKey of SPECIFIC_EXAM_SECTION_KEYS) {
    specific[sectionKey] = normalizeSpecificSectionForConclusion(
      sectionKey,
      incoming.specific?.[sectionKey],
    );
  }

  return {
    general: {
      ...defaults.general,
      ...(incoming.general ?? {}),
    },
    specific,
  };
}

function normalizeSpecificSectionForConclusion(
  sectionKey: SpecificExamSectionKey,
  sectionData: SpecificExamSectionData | null | undefined,
): SpecificExamSectionData {
  const defaultSection = createDefaultConsultationExamPayload().specific[sectionKey];
  if (!sectionData) {
    return {
      ...defaultSection,
      selectedFindings: [...defaultSection.selectedFindings],
      findingDetails: { ...defaultSection.findingDetails },
    };
  }

  const findingDetails: SpecificExamSectionData['findingDetails'] = {};
  for (const [key, value] of Object.entries(sectionData.findingDetails ?? {})) {
    const normalizedKey = normalizeText(key);
    if (!normalizedKey) {
      continue;
    }

    findingDetails[normalizedKey] = {
      description: normalizeText(value?.description ?? ''),
    };
  }

  const selectedFindings = normalizeDistinctStrings(sectionData.selectedFindings ?? []);
  if (selectedFindings.length === 0 && Object.keys(findingDetails).length > 0) {
    selectedFindings.push(...Object.keys(findingDetails));
  }
  const normalFinding = normalizeText(SPECIFIC_EXAM_SECTION_NORMAL_FINDINGS[sectionKey] ?? '');
  let status = sectionData.status ?? 'not_examined';
  if (selectedFindings.length === 0) {
    status = 'not_examined';
  } else if (
    normalFinding
    && selectedFindings.length === 1
    && sameText(selectedFindings[0], normalFinding)
  ) {
    status = 'normal';
  } else {
    status = 'abnormal';
  }

  return applySpecificSectionDisplayDefaults(sectionKey, {
    status,
    selectedFindings,
    findingDetails,
    notes: normalizeText(sectionData.notes ?? ''),
  });
}

function applySpecificSectionDisplayDefaults(
  sectionKey: SpecificExamSectionKey,
  sectionData: SpecificExamSectionData,
): SpecificExamSectionData {
  if (sectionData.status === 'abnormal') {
    return sectionData;
  }

  const hasSelection = sectionData.selectedFindings.length > 0;
  const hasDetails = Object.keys(sectionData.findingDetails).length > 0;
  if (hasSelection || hasDetails) {
    return sectionData;
  }

  const normalFinding = normalizeText(SPECIFIC_EXAM_SECTION_NORMAL_FINDINGS[sectionKey] ?? '');
  if (!normalFinding) {
    return sectionData;
  }

  return {
    ...sectionData,
    status: 'normal',
    selectedFindings: [normalFinding],
    findingDetails: {
      [normalFinding]: {
        description: '',
      },
    },
  };
}

function isFunctionalSignAnomaly(item: UpdateInterrogatoireAnomalyRequest): boolean {
  const templateKey = normalizeText(item.templateKey).toLowerCase();
  return templateKey.startsWith('functional-sign-');
}
