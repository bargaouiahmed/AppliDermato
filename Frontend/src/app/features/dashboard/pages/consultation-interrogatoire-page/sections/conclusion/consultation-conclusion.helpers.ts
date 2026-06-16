import {
  ConsultationConduiteActionResponse,
  ConsultationConduiteResponse,
} from '../../../../../../core/models/conduite.models';
import {
  ConsultationExamPayload,
  DermatologyExamZone,
  cloneConsultationExamPayload,
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
  imageUrl?: string;
  zoneId?: string;
  lesionId?: string;
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

export interface BuildConsultationConclusionViewModelArgs {
  patient: Patient | null;
  consultationDate: string;
  motifs: string[];
  diagnostics: string[];
  anomalies: UpdateInterrogatoireAnomalyRequest[];
  ongoingTreatments: UpdateOngoingTreatmentMedicineRequest[];
  examPayload?: ConsultationExamPayload | null;
  conduite?: ConsultationConduiteResponse | null;
  locale: string;
  translate: (key: string) => string;
}

interface EmptyLabels {
  ongoingTreatments: string;
  unassigned: string;
}

export function buildConsultationConclusionViewModel(
  args: BuildConsultationConclusionViewModelArgs,
): ConsultationConclusionViewModel {
  const translate = args.translate;
  const noneLabel = translate('consultation.page.none');
  const emptyLabels = createEmptyLabels(args.locale, translate('consultation.page.conclusion.empty.unassigned'));
  const examPayload = normalizeExamPayloadForConclusion(args.examPayload);
  const conduite = args.conduite ?? {
    consultationId: '',
    additionalInformation: '',
    actions: [],
  };

  const historyGroups = buildHistoryGroups(args.anomalies ?? [], emptyLabels.unassigned, translate);
  const generalSummary = buildGeneralSummary(examPayload, translate, emptyLabels.unassigned);
  const clinicalGroups = buildClinicalGroups(examPayload, translate, emptyLabels.unassigned);
  const carePlanGroups = buildCarePlanGroups(conduite, args.diagnostics ?? [], translate, emptyLabels.unassigned);
  const ongoingTreatments = buildTreatmentRows(args.ongoingTreatments ?? [], args.locale, noneLabel);

  const abnormalCount = countByTone(historyGroups.flatMap((group) => group.badges), 'abnormal')
    + countByTone(clinicalGroups.flatMap((group) => group.badges), 'abnormal')
    + countByTone(carePlanGroups.flatMap((group) => group.badges), 'abnormal')
    + (generalSummary.statusTone === 'abnormal' ? 1 : 0);

  const unassignedCount = countByTone(historyGroups.flatMap((group) => group.badges), 'unassigned')
    + countByTone(clinicalGroups.flatMap((group) => group.badges), 'unassigned')
    + countByTone(carePlanGroups.flatMap((group) => group.badges), 'unassigned')
    + (generalSummary.statusTone === 'unassigned' ? 1 : 0)
    + (ongoingTreatments.length === 0 ? 1 : 0);

  return {
    title: translate('consultation.page.conclusion.title'),
    patientFields: buildPatientFields(args.patient, args.consultationDate, args.motifs ?? [], args.locale, translate),
    motifsLabel: translate('consultation.page.conclusion.labels.motifs'),
    motifs: normalizeDistinctStrings(args.motifs ?? []),
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
    emptyBadgeLabel: emptyLabels.unassigned,
    stats: [
      {
        label: translate('consultation.page.conclusion.labels.summaryAbnormal'),
        value: String(abnormalCount),
        tone: 'abnormal',
      },
      {
        label: translate('consultation.page.conclusion.labels.summaryNormal'),
        value: '0',
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

function createEmptyLabels(locale: string, fallback: string): EmptyLabels {
  if (!locale.toLowerCase().startsWith('fr')) {
    return {
      ongoingTreatments: fallback,
      unassigned: fallback,
    };
  }

  return {
    ongoingTreatments: 'Non mentionnes',
    unassigned: 'Non mentionne',
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
  const motifValue = normalizeDistinctStrings(motifs).join(', ') || noneLabel;

  return [
    { label: translate('patients.create.fields.lastname'), value: normalizeText(patient?.lastname) || noneLabel },
    { label: translate('patients.create.fields.firstname'), value: normalizeText(patient?.firstname) || noneLabel },
    { label: translate('consultation.page.patient.age'), value: formatAge(patient?.dateOfBirth ?? '', locale, noneLabel) },
    { label: translate('consultation.page.patient.profession'), value: normalizeText(patient?.profession) || noneLabel },
    { label: translate('consultation.page.conclusion.labels.consultationDate'), value: formatDateValue(consultationDate, locale, noneLabel) },
    { label: translate('consultation.page.motif.title'), value: motifValue },
  ];
}

function buildHistoryGroups(
  anomalies: UpdateInterrogatoireAnomalyRequest[],
  emptyBadgeLabel: string,
  translate: (key: string) => string,
): ConclusionGroup[] {
  const dermatologicAntecedents = anomalies.filter((item) => isDermatologicAntecedentAnomaly(item));
  const generalAntecedents = anomalies.filter(
    (item) => item.section === 'medical' && !isFunctionalSignAnomaly(item) && !isDermatologicAntecedentAnomaly(item),
  );
  const familyAntecedents = anomalies.filter((item) => item.section === 'family');

  return [
    buildHistoryGroup(translate('consultation.page.conclusion.groups.medicalHistory'), generalAntecedents, emptyBadgeLabel),
    buildHistoryGroup(translate('consultation.page.conclusion.groups.dermatologicAntecedents'), dermatologicAntecedents, emptyBadgeLabel),
    buildHistoryGroup(translate('consultation.page.conclusion.groups.familyHistory'), familyAntecedents, emptyBadgeLabel),
  ];
}

function buildHistoryGroup(
  title: string,
  anomalies: UpdateInterrogatoireAnomalyRequest[],
  emptyBadgeLabel: string,
): ConclusionGroup {
  const badges = normalizeDistinctBadges(
    anomalies
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

  return {
    label: normalizeText(label),
    tone: 'abnormal',
    meta: firstNonEmptyString(
      payload['severity'],
      payload['diagnosedSince'],
      payload['date'],
      payload['description'],
      payload['notes'],
      payload['treatmentName'],
    ),
  };
}

function buildGeneralSummary(
  examPayload: ConsultationExamPayload,
  translate: (key: string) => string,
  emptyBadgeLabel: string,
): ConclusionGeneralSummary {
  const documentedZones = extractDocumentedZones(examPayload);
  const photoCount = documentedZones.filter((zone) => !!zone.image?.fileUrl).length;
  const notes = normalizeText(examPayload.bodyMap.notes);
  const genderLabel = examPayload.bodyMap.gender === 'female'
    ? translate('consultation.page.exam.bodyMap.femaleBody')
    : translate('consultation.page.exam.bodyMap.maleBody');

  return {
    title: translate('consultation.page.exam.bodyMap.summaryTitle'),
    statusLabel: documentedZones.length > 0
      ? `${documentedZones.length} documented zone${documentedZones.length > 1 ? 's' : ''}`
      : emptyBadgeLabel,
    statusTone: documentedZones.length > 0 ? 'abnormal' : 'unassigned',
    metrics: [
      { label: translate('consultation.page.exam.bodyMap.bodyModel'), value: genderLabel },
      { label: translate('consultation.page.exam.bodyMap.savedAreas'), value: documentedZones.length > 0 ? String(documentedZones.length) : emptyBadgeLabel },
      { label: translate('consultation.page.exam.bodyMap.photos'), value: photoCount > 0 ? String(photoCount) : emptyBadgeLabel },
      { label: translate('consultation.page.exam.bodyMap.notesShort'), value: notes || emptyBadgeLabel },
    ],
  };
}

function buildClinicalGroups(
  examPayload: ConsultationExamPayload,
  translate: (key: string) => string,
  emptyBadgeLabel: string,
): ConclusionGroup[] {
  const documentedZones = extractDocumentedZones(examPayload);
  const frontZones = documentedZones.filter((zone) => zone.view === 'front');
  const backZones = documentedZones.filter((zone) => zone.view === 'back');

  return [
    { title: translate('consultation.page.exam.bodyMap.front'), badges: buildZoneBadges(frontZones, translate, emptyBadgeLabel) },
    { title: translate('consultation.page.exam.bodyMap.back'), badges: buildZoneBadges(backZones, translate, emptyBadgeLabel) },
  ];
}

function buildZoneBadges(
  zones: DermatologyExamZone[],
  translate: (key: string) => string,
  emptyBadgeLabel: string,
): ConclusionBadge[] {
  if (zones.length === 0) {
    return [createUnassignedBadge(emptyBadgeLabel)];
  }

  const badges: ConclusionBadge[] = [];

  for (const zone of zones) {
    const lesions = zone.drawing?.lesions ?? [];
    
    if (lesions.length > 0) {
      // If zone has lesions, show each lesion as a separate badge
      for (let i = 0; i < lesions.length; i++) {
        const lesion = lesions[i];
        const lesionLabel = `${normalizeText(zone.label) || normalizeText(zone.regionId)} #${i + 1}`;
        badges.push({
          label: lesionLabel,
          tone: 'abnormal',
          meta: joinMeta(
            normalizeText(lesion.description),
            lesion.image?.fileUrl ? translate('consultation.page.exam.bodyMap.photoAttached') : '',
          ),
          imageUrl: lesion.image?.fileUrl ?? undefined,
          zoneId: zone.regionId,
          lesionId: lesion.id,
        });
      }
    } else {
      // If no lesions, show zone with its general description
      badges.push({
        label: normalizeText(zone.label) || normalizeText(zone.regionId),
        tone: 'abnormal',
        meta: joinMeta(
          normalizeText(zone.description),
          zone.image?.fileUrl ? translate('consultation.page.exam.bodyMap.photoAttached') : '',
        ),
        imageUrl: zone.image?.fileUrl ?? undefined,
        zoneId: zone.regionId,
      });
    }
  }

  return badges;
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
      badges: buildCertificateAndReferralBadges(certificatPayload, lettrePayload, translate, emptyBadgeLabel),
    },
  ];
}

function buildDiagnosticBadges(diagnostics: string[], emptyBadgeLabel: string): ConclusionBadge[] {
  const badges = normalizeDistinctStrings(diagnostics).map((diagnostic) => ({
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
        tone: 'abnormal',
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
  const laserPayload = asRecord(findAction(actions, 'paraclinique_laser')?.payload);
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

  const laserTypes = normalizeDistinctStrings([
    readNestedText(laserPayload, ['type']),
    ...readTypeNames(laserPayload['types']),
  ]);

  for (const item of laserTypes) {
    badges.push({
      label: `${translate('consultation.conduite.actions.paracliniqueLaser')} : ${item}`,
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
  return treatments
    .map((item) => ({
      medicine: normalizeText(item.medicine) || noneLabel,
      therapeuticClass: normalizeText(item.therapeuticClass) || noneLabel,
      category: normalizeText(item.category) || noneLabel,
      posology: normalizeText(item.posology) || noneLabel,
      duration: normalizeText(item.duration) || noneLabel,
      date: formatDateValue(item.date, locale, noneLabel),
    }))
    .filter((item) =>
      item.medicine !== noneLabel
      || item.therapeuticClass !== noneLabel
      || item.category !== noneLabel
      || item.posology !== noneLabel
      || item.duration !== noneLabel,
    );
}

function extractDocumentedZones(examPayload: ConsultationExamPayload): DermatologyExamZone[] {
  return Object.values(examPayload.bodyMap.zones ?? {})
    .filter((zone) => 
      !!normalizeText(zone.description) || 
      !!zone.image?.fileUrl ||
      (zone.drawing?.lesions && zone.drawing.lesions.length > 0)
    )
    .sort((left, right) => {
      if (left.view !== right.view) {
        return left.view.localeCompare(right.view);
      }

      return (normalizeText(left.label) || normalizeText(left.regionId)).localeCompare(
        normalizeText(right.label) || normalizeText(right.regionId),
        'fr',
        { sensitivity: 'base' },
      );
    });
}

function countByTone(items: ConclusionBadge[], tone: ConclusionTone): number {
  return items.filter((item) => item.tone === tone).length;
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
  const cloned = cloneConsultationExamPayload(incoming ?? defaults);

  return {
    bodyMap: {
      gender: cloned.bodyMap?.gender === 'female' ? 'female' : 'male',
      zones: { ...(cloned.bodyMap?.zones ?? {}) },
      notes: normalizeText(cloned.bodyMap?.notes ?? ''),
    },
  };
}

function isFunctionalSignAnomaly(item: UpdateInterrogatoireAnomalyRequest): boolean {
  const templateKey = normalizeText(item.templateKey).toLowerCase();
  return templateKey.startsWith('functional-sign-');
}

function isDermatologicAntecedentAnomaly(item: UpdateInterrogatoireAnomalyRequest): boolean {
  const templateKey = normalizeText(item.templateKey).toLowerCase();
  if (templateKey.startsWith('dermatologic-antecedent-')) {
    return true;
  }

  const payload = asRecord(item.payload);
  const category = normalizeText(payload['category']).toLowerCase();
  return category === 'laser' || category === 'surgical' || category === 'general';
}
