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

export interface ConsultationExamPayload {
  general: GeneralExamData;
  specific: SpecificExamSections;
}

export interface ConsultationExamResponse {
  consultationId: string;
  payload: ConsultationExamPayload;
}

export interface UpdateConsultationExamRequest {
  payload: ConsultationExamPayload;
}

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
  auscultationCardiaque: 'Bruits du cœur réguliers, sans souffle',
  auscultationPulmonaire: 'Murmure vésiculaire bien perçu, sans râle',
  abdomen: 'Abdomen souple, dépressible et indolore',
  neurologique: 'Examen neurologique sans déficit focal',
  locomoteurOsteoArticulaire: 'Mobilité conservée, sans limitation articulaire',
  peauDermatologique: 'Peau saine, sans lésion dermatologique',
  urogenital: 'Examen urogénital sans anomalie',
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

export function createDefaultSpecificExamSectionData(sectionKey?: SpecificExamSectionKey): SpecificExamSectionData {
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

export function createDefaultConsultationExamPayload(): ConsultationExamPayload {
  return {
    general: createDefaultGeneralExamData(),
    specific: createDefaultSpecificExamSections(),
  };
}
