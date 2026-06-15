type KnownDefaultTreatmentValueTranslation = {
  i18nKey: string;
  aliases: readonly string[];
};

const KNOWN_DEFAULT_TREATMENT_VALUE_TRANSLATIONS: readonly KnownDefaultTreatmentValueTranslation[] = [
  {
    i18nKey: 'consultation.catalog.defaults.class.antibiotiquesBetaLactamines',
    aliases: ['Antibiotiques bêta-lactamines'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.class.antalgiquesAntipyretiques',
    aliases: ['Antalgiques et antipyrétiques'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.class.antiInflammatoiresNonSteroidiens',
    aliases: ['Anti-inflammatoires non stéroïdiens'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.class.orlEtAllergologie',
    aliases: ['ORL et allergologie'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.class.gastroEnterologie',
    aliases: ['Gastro-entérologie'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.class.urologie',
    aliases: ['Urologie'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.class.pneumologie',
    aliases: ['Pneumologie'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.category.penicillines',
    aliases: ['Pénicillines'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.category.paracetamol',
    aliases: ['Paracétamol'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.category.ains',
    aliases: ['AINS'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.category.antihistaminiques',
    aliases: ['Antihistaminiques'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.category.lavageNasal',
    aliases: ['Lavage nasal'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.category.corticoidesNasaux',
    aliases: ['Corticoïdes nasaux'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.category.rehydratationOrale',
    aliases: ['Réhydratation orale'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.category.antidiarrheiques',
    aliases: ['Antidiarrhéiques'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.category.antispasmodiques',
    aliases: ['Antispasmodiques'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.category.antibiotiquesUrinaires',
    aliases: ['Antibiotiques urinaires'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.category.bronchodilatateurs',
    aliases: ['Bronchodilatateurs'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.category.corticoidesOraux',
    aliases: ['Corticoïdes oraux'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.amoxicilline1gClamoxyl',
    aliases: ['Amoxicilline 1 g (Clamoxyl)'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.paracetamol1gDoliprane',
    aliases: ['Paracétamol 1 g (Doliprane)'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.ibuprofene400mgBrufen',
    aliases: ['Ibuprofène 400 mg (Brufen)'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.cetirizine10mg',
    aliases: ['Cétirizine 10 mg'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.serumPhysiologiqueNasal',
    aliases: ['Sérum physiologique nasal'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.budesonideSprayNasal64mcg',
    aliases: ['Budésonide spray nasal 64 mcg'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.sroSelsRehydratationOrale',
    aliases: ['SRO (sels de réhydratation orale)'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.racecadotril100mgTiorfan',
    aliases: ['Racécadotril 100 mg (Tiorfan)'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.phloroglucinol80mgSpasfon',
    aliases: ['Phloroglucinol 80 mg (Spasfon)'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.fosfomycineTrometamol3gMonuril',
    aliases: ['Fosfomycine trométamol 3 g (Monuril)'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.nitrofurantoine100mg',
    aliases: ['Nitrofurantoine 100 mg'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.salbutamolInhalateur100mcg',
    aliases: ['Salbutamol inhalateur 100 mcg'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.prednisone20mg',
    aliases: ['Prednisone 20 mg'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.gtt1x3Jours',
    aliases: ['1 gtt x 3 jours', '1 gtt * 3 jours'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.gtt1x5Jours',
    aliases: ['1 gtt x 5 jours', '1 gtt * 5 jours'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.gtt1x7Jours',
    aliases: ['1 gtt x 7 jours', '1 gtt * 7 jours'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.gtt2x5Jours',
    aliases: ['2 gtt x 5 jours', '2 gtt * 5 jours'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.gtt2x7Jours',
    aliases: ['2 gtt x 7 jours', '2 gtt * 7 jours'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.cp1x1ParJour',
    aliases: ['1 cp * 1/j'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.cp1x2ParJour',
    aliases: ['1 cp * 2/j', '1 cp x 2/j'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.cp1x3ParJour',
    aliases: ['1 cp * 3/j', '1 cp x 3/j'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.ml5x3ParJour',
    aliases: ['5 ml * 3/j', '5 ml x 3/j'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.auBesoinPrn',
    aliases: ['Au besoin (PRN)'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.cpSiFievreDouleurMax3ParJour',
    aliases: ['1 cp si fièvre/douleur, max 3/j'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.cpToutesLes8hSiBesoin',
    aliases: ['1 cp toutes les 8h si besoin'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.lavageNasal3a4ParJour',
    aliases: ['Lavage nasal 3-4 fois/j'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.lavageNasal4ParJour',
    aliases: ['Lavage nasal 4 fois/j'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.cpLeSoir',
    aliases: ['1 cp le soir'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.cpSiDouleurFievreMax3ParJour',
    aliases: ['1 cp si douleur/fièvre, max 3/j'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.apresChaqueSelleLiquide',
    aliases: ['Après chaque selle liquide'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.gelule1x3ParJour',
    aliases: ['1 gélule x 3/j'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.cp1x2ParJourSiDouleurs',
    aliases: ['1 cp x 2/j si douleurs'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.sachetDoseUnique',
    aliases: ['1 sachet dose unique'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.bouffee1a2SiBesoin',
    aliases: ['1-2 bouffées si besoin'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.cp1ParJourLeMatin',
    aliases: ['1 cp/j le matin'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.application1ParJour',
    aliases: ['Application 1 fois/j'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.application2ParJour',
    aliases: ['Application 2 fois/j'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.application3ParJour',
    aliases: ['Application 3 fois/j'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.applicationFineCoucheLeSoir',
    aliases: ['Application fine couche le soir'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.applicationSurLesionsUniquement',
    aliases: ['Application sur lésions uniquement'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.applicationCorpsEntier812hRenouvelerJ7',
    aliases: ['Application corps entier 8-12h, renouveler J7'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.applicationCuirChevelu10MinPuisRincer',
    aliases: ['Application cuir chevelu 10 min puis rincer'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.shampooing2a3FoisSemaine',
    aliases: ['Shampooing 2-3 fois/semaine'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.application5FoisParJour',
    aliases: ['1 application 5 fois/j'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.comprime1ParJour',
    aliases: ['1 comprimé/j'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.comprime1x2ParJour',
    aliases: ['1 comprimé x 2/j'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.comprime1CinqFoisParJour',
    aliases: ['1 comprimé 5 fois/j'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.cp1ParJour',
    aliases: ['1 cp/j'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.gelule1ParJour',
    aliases: ['1 gélule/j'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.capsule1ParJour',
    aliases: ['1 capsule/j'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.selonPoidsProtocoleDermatologue',
    aliases: ['Selon poids/protocole dermatologue'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.posology.selonProtocoleDermatologue',
    aliases: ['Selon protocole dermatologue'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.duration.jours05',
    aliases: ['05 jours'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.duration.jours07',
    aliases: ['07 jours'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.duration.jours10',
    aliases: ['10 jours'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.duration.semaines02',
    aliases: ['02 semaines'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.duration.semaines03',
    aliases: ['03 semaines'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.duration.mois01',
    aliases: ['01 mois'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.duration.jours06',
    aliases: ['06 jours'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.duration.jours03',
    aliases: ['03 jours'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.duration.jour01',
    aliases: ['01 jour'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.duration.jours14',
    aliases: ['14 jours'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.duration.semaines04',
    aliases: ['04 semaines'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.duration.semaines06',
    aliases: ['06 semaines'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.duration.semaines08',
    aliases: ['08 semaines'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.duration.semaines12',
    aliases: ['12 semaines'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.duration.mois03',
    aliases: ['03 mois'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.text.boireAbondammentTerminerAntibiotique',
    aliases: ["Boire abondamment, terminer l'antibiotique et consulter si aggravation."],
  },
  {
    i18nKey: 'consultation.catalog.defaults.text.eviterAutomedicationAntibiotique',
    aliases: ["Éviter l'automédication antibiotique."],
  },
  {
    i18nKey: 'consultation.catalog.defaults.text.reposHydratationSurveillerFievre',
    aliases: ['Repos, hydratation, surveiller la fièvre.'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.text.reevaluationSiDyspneeOuFievre',
    aliases: ['Réévaluation médicale si dyspnée ou fièvre persistante.'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.text.hydratationLavageNasalReguliers',
    aliases: ['Hydratation et lavage nasal réguliers.'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.text.consulterSiDouleurSinusienneOuFievre',
    aliases: ['Consulter en cas de douleur sinusienne intense ou fièvre prolongée.'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.text.fractionnerPrisesRehydratation',
    aliases: ['Fractionner les prises, prioriser la réhydratation orale.'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.text.urgencesSiDeshydratationOuSangSelles',
    aliases: ['Urgences si signes de déshydratation ou sang dans les selles.'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.text.boireEau15a2LParJour',
    aliases: ["Boire 1,5 à 2 litres d'eau par jour."],
  },
  {
    i18nKey: 'consultation.catalog.defaults.text.controleSiPersistance48h',
    aliases: ['Faire un contrôle si persistance des symptômes à 48h.'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.text.hydratationArretTabacSurveillance',
    aliases: ['Hydratation, arrêt du tabac et surveillance respiratoire.'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.text.consulterUrgenceSiGeneRespiratoire',
    aliases: ['Consulter en urgence en cas de gêne respiratoire importante.'],
  },
    {
    i18nKey: 'consultation.catalog.defaults.class.collyre',
    aliases: ['Collyre'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.category.larmesArtificielles',
    aliases: ['Larmes artificielles'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.category.antibiotiqueSeul',
    aliases: ['Antibiotique seul'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.category.antibiotiqueCorticoide',
    aliases: ['Antibiotique + corticoïde', 'Antibiotique + corticoide'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.category.antiseptique',
    aliases: ['Antiseptique'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.category.antiInflammatoire',
    aliases: ['Anti-inflammatoire'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.category.antiAllergique',
    aliases: ['Anti-allergique'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.category.hypotonisantGlaucome',
    aliases: ['Hypotonisant (glaucome)'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.category.immunosuppresseur',
    aliases: ['Immunosuppresseur'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.thealose',
    aliases: ['Théalose'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.vismed',
    aliases: ['Vismed'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.hyalufresh',
    aliases: ['Hyalufresh'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.aqualarm',
    aliases: ['Aqualarm'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.lacrymedUnidose',
    aliases: ['Lacrymed Unidose'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.tobra',
    aliases: ['Tobra'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.neofloxin',
    aliases: ['Néofloxin', 'Neofloxin'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.ciproCollyre',
    aliases: ['Cipro Collyre'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.frakidexCollyre',
    aliases: ['Frakidex collyre'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.tobacort',
    aliases: ['Tobacort'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.dexamex',
    aliases: ['Dexamex'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.desomedine',
    aliases: ['Désomédine', 'Desomédine', 'Desomedine'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.vitabact',
    aliases: ['Vitabact'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.dicloabak',
    aliases: ['Dicloabak'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.votril',
    aliases: ['Votril'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.indocollyreUnidose',
    aliases: ['Indocollyre unidose'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.naabak',
    aliases: ['Naabak'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.opatanol',
    aliases: ['Opatanol'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.zalerg',
    aliases: ['Zalerg'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.ganfort',
    aliases: ['Ganfort'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.travatan',
    aliases: ['Travatan'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.xalatan',
    aliases: ['Xalatan'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.alphagan',
    aliases: ['Alphagan'],
  },
  {
    i18nKey: 'consultation.catalog.defaults.medicine.ikrevis01',
    aliases: ['Ikrevis 0.1'],
  },
];

const DEFAULT_TREATMENT_VALUE_KEY_BY_ALIAS = new Map<string, string>();
const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { fatal: false }) : null;

for (const entry of KNOWN_DEFAULT_TREATMENT_VALUE_TRANSLATIONS) {
  for (const alias of entry.aliases) {
    for (const candidate of expandKnownDefaultTreatmentValueCandidates(alias)) {
      const normalizedAlias = normalizeKnownDefaultTreatmentValue(candidate);
      if (!normalizedAlias || DEFAULT_TREATMENT_VALUE_KEY_BY_ALIAS.has(normalizedAlias)) {
        continue;
      }

      DEFAULT_TREATMENT_VALUE_KEY_BY_ALIAS.set(normalizedAlias, entry.i18nKey);
    }
  }
}

export function findKnownDefaultTreatmentValueTranslationKey(value: string | null | undefined): string | null {
  const normalizedValue = normalizeKnownDefaultTreatmentValue(value ?? '');
  if (!normalizedValue) {
    return null;
  }

  return DEFAULT_TREATMENT_VALUE_KEY_BY_ALIAS.get(normalizedValue) ?? null;
}

function normalizeKnownDefaultTreatmentValue(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function expandKnownDefaultTreatmentValueCandidates(value: string): string[] {
  const candidates = [value];
  const repaired = repairCommonMojibake(value);
  if (repaired && repaired !== value) {
    candidates.push(repaired);
  }

  return candidates;
}

function repairCommonMojibake(value: string): string {
  if (!value || !textDecoder || !/[ÃÂâØÙ]/.test(value)) {
    return value;
  }

  try {
    const bytes = Uint8Array.from([...value].map((char) => char.charCodeAt(0) & 0xff));
    const decoded = textDecoder.decode(bytes).trim();
    return decoded || value;
  } catch {
    return value;
  }
}

