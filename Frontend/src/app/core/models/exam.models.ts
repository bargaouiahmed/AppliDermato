export type BodyGender = 'male' | 'female';
export type BodyView = 'front' | 'back';
export type DermatologyRegionSegment = 'common' | 'left' | 'right';

export interface DermatologyExamImage {
  documentId: string;
  fileUrl: string;
  originalFileName: string;
  contentType: string;
  fileSizeBytes: number;
  createdAt: string;
}

export interface DermatologyExamDrawing {
  viewBox: string;
  lesions: DermatologyExamDrawingLesion[];
  paths?: string[];
}

export interface DermatologyExamDrawingLesion {
  id: string;
  path: string;
  description: string;
  image: DermatologyExamImage | null;
}

export interface DermatologyExamZone {
  regionId: string;
  label: string;
  slug: string;
  segment: DermatologyRegionSegment;
  pathIndex: number;
  view: BodyView;
  description: string;
  image: DermatologyExamImage | null;
  drawing: DermatologyExamDrawing | null;
  updatedAt: string | null;
}

export interface DermatologyBodyMapData {
  gender: BodyGender;
  zones: Record<string, DermatologyExamZone>;
  notes: string;
}

export interface ConsultationExamPayload {
  bodyMap: DermatologyBodyMapData;
}

export interface ConsultationExamResponse {
  consultationId: string;
  payload: ConsultationExamPayload;
}

export interface UpdateConsultationExamRequest {
  payload: ConsultationExamPayload;
}

export function createDefaultConsultationExamPayload(
  gender: BodyGender = 'male',
): ConsultationExamPayload {
  return {
    bodyMap: {
      gender,
      zones: {},
      notes: '',
    },
  };
}

export function createDefaultDermatologyExamZone(
  input: Partial<DermatologyExamZone> & Pick<
    DermatologyExamZone,
    'regionId' | 'label' | 'slug' | 'segment' | 'pathIndex' | 'view'
  >,
): DermatologyExamZone {
  return {
    regionId: input.regionId,
    label: input.label,
    slug: input.slug,
    segment: input.segment,
    pathIndex: input.pathIndex,
    view: input.view,
    description: input.description?.trim() ?? '',
    image: input.image ?? null,
    drawing: input.drawing ?? null,
    updatedAt: input.updatedAt ?? null,
  };
}

export function cloneConsultationExamPayload(
  payload: ConsultationExamPayload | null | undefined,
): ConsultationExamPayload {
  return JSON.parse(
    JSON.stringify(payload ?? createDefaultConsultationExamPayload()),
  ) as ConsultationExamPayload;
}

export type SpecificExamSectionKey =
  | 'orlCouConjonctive'
  | 'auscultationCardiaque'
  | 'auscultationPulmonaire'
  | 'abdomen'
  | 'neurologique'
  | 'locomoteurOsteoArticulaire'
  | 'peauDermatologique'
  | 'urogenital';

export type ExamSectionStatus = 'normal' | 'abnormal' | 'not_examined';
export type EtatGeneralValue = '' | 'good' | 'average' | 'altered';
export type RythmeCardiaqueValue = '' | 'regular' | 'irregular';

export interface GeneralExamData {
  etatGeneral: EtatGeneralValue;
  tensionSystolique: number | null;
  tensionDiastolique: number | null;
  frequenceCardiaque: number | null;
  rythmeCardiaque: RythmeCardiaqueValue;
  temperature: number | null;
  saturationO2: number | null;
  poidsKg: number | null;
  tailleCm: number | null;
  imc: number | null;
}

export interface SpecificExamFindingDetail {
  description: string;
}

export interface SpecificExamSectionData {
  status: ExamSectionStatus;
  selectedFindings: string[];
  findingDetails: Record<string, SpecificExamFindingDetail>;
  notes: string;
}

export type SpecificExamSections = Record<SpecificExamSectionKey, SpecificExamSectionData>;

export interface ExamFindingCatalogItem {
  section: SpecificExamSectionKey;
  isCustom: boolean;
  label: string;
}

export interface UpsertExamFindingCatalogItemRequest {
  section: SpecificExamSectionKey;
  label: string;
}

export const SPECIFIC_EXAM_SECTION_NORMAL_FINDINGS: Record<SpecificExamSectionKey, string> = {
  orlCouConjonctive: 'ORL, cou et conjonctives sans anomalie',
  auscultationCardiaque: 'Bruits du coeur reguliers, sans souffle',
  auscultationPulmonaire: 'Murmure vesiculaire bien percu, sans rale',
  abdomen: 'Abdomen souple, depressible et indolore',
  neurologique: 'Examen neurologique sans deficit focal',
  locomoteurOsteoArticulaire: 'Mobilite conservee, sans limitation articulaire',
  peauDermatologique: 'Peau saine, sans lesion dermatologique',
  urogenital: 'Examen urogenital sans anomalie',
};

export const SPECIFIC_EXAM_SECTION_KEYS: SpecificExamSectionKey[] = [
  'orlCouConjonctive',
  'auscultationCardiaque',
  'auscultationPulmonaire',
  'abdomen',
  'neurologique',
  'locomoteurOsteoArticulaire',
  'peauDermatologique',
  'urogenital',
];

export function createDefaultGeneralExamData(): GeneralExamData {
  return {
    etatGeneral: '',
    tensionSystolique: null,
    tensionDiastolique: null,
    frequenceCardiaque: null,
    rythmeCardiaque: '',
    temperature: null,
    saturationO2: null,
    poidsKg: null,
    tailleCm: null,
    imc: null,
  };
}

export function createDefaultSpecificExamSectionData(
  sectionKey?: SpecificExamSectionKey,
): SpecificExamSectionData {
  const normalFinding = sectionKey ? SPECIFIC_EXAM_SECTION_NORMAL_FINDINGS[sectionKey] ?? '' : '';
  if (normalFinding) {
    return {
      status: 'normal',
      selectedFindings: [normalFinding],
      findingDetails: {
        [normalFinding]: {
          description: '',
        },
      },
      notes: '',
    };
  }

  return {
    status: 'not_examined',
    selectedFindings: [],
    findingDetails: {},
    notes: '',
  };
}

export function createDefaultSpecificExamSections(): SpecificExamSections {
  return {
    orlCouConjonctive: createDefaultSpecificExamSectionData('orlCouConjonctive'),
    auscultationCardiaque: createDefaultSpecificExamSectionData('auscultationCardiaque'),
    auscultationPulmonaire: createDefaultSpecificExamSectionData('auscultationPulmonaire'),
    abdomen: createDefaultSpecificExamSectionData('abdomen'),
    neurologique: createDefaultSpecificExamSectionData('neurologique'),
    locomoteurOsteoArticulaire: createDefaultSpecificExamSectionData('locomoteurOsteoArticulaire'),
    peauDermatologique: createDefaultSpecificExamSectionData('peauDermatologique'),
    urogenital: createDefaultSpecificExamSectionData('urogenital'),
  };
}
