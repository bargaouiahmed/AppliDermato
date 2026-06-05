# Dermatology Consultation Refactor Report

Date: 2026-06-05

## Scope

This report covers the consultation parts related to:

- `Interrogatoire`
- `Examen`
- the catalogs and seeded values that feed those sections

Assumption retained from your request:

- `Conduite a tenir` stays mostly unchanged for the first phase
- no EF migrations have been applied yet
- the goal is to reuse the current app and refactor the schema toward dermatology

## 1. What the app currently does

### Backend shape today

The current consultation model is already partly flexible:

- `Interrogatoire` has only two strongly typed clinical fields:
  - `HistoireMaladie: string`
  - `Diagnostics: string[]`
- antecedents are not stored as dedicated columns; they are stored as `InterrogatoireAnomaly` rows with a JSON `Payload`
- ongoing treatment is stored as a structured list of medicines
- `ConsultationExam` is fully JSON-based through `Payload`

Relevant code points:

- `api/Src/ConsultationSpace/InterrogationSection/Entities/Interrogatoire.cs`
- `api/Src/ConsultationSpace/InterrogationSection/Entities/InterrogatoireAnomaly.cs`
- `api/Src/ConsultationSpace/InterrogationSection/Entities/OngoingTreatmentMedicine.cs`
- `api/Src/ConsultationSpace/ExamSection/Entities/ConsultationExam.cs`
- `api/Src/ConsultationSpace/InterrogationSection/Services/InterrogatoireService.cs`
- `api/Src/ConsultationSpace/ExamSection/Services/ExamService.cs`

Important current constraints:

- anomaly sections are only `Medical`, `Family`, `Surgical`
- interrogatoire default catalog is still general-practice oriented
- motif seeds are still general-practice oriented
- exam default sections are still general medicine oriented, except for one generic `peauDermatologique`

### What this means for the refactor

Good news:

- you can change most dermatology-specific fields in `Examen` without changing the DB table, because exam is already `jsonb`
- you can also evolve antecedents with relatively light schema work, because they already live in anomaly rows + JSON payload

Less good:

- the current interrogatoire domain language is too generic for dermatology
- the anomaly section model is too narrow for modern derm workflows
- the current seeded values will push the UI toward general medicine if left as-is
- ongoing treatment is medication-centric, but dermatology often also needs structured non-drug treatment history, response, and adverse effects

## 2. Clinical research summary for a dermatology app

The core dermatology consultation differs from general medicine because diagnosis relies heavily on:

- lesion morphology
- body site and distribution
- evolution over time
- symptoms such as itch, pain, burning
- triggers and exposures
- scalp, nail, hair, and mucosal involvement
- prior treatment response
- skin cancer risk and warning signs for suspicious lesions

Authoritative sources used:

- Merck Manual Professional, "Evaluation of the Dermatologic Patient":
  https://www.merckmanuals.com/professional/dermatologic-disorders/approach-to-the-dermatologic-patient/evaluation-of-the-dermatologic-patient
- MSD Manual Professional, "Description of Skin Lesions":
  https://www.msdmanuals.com/en-gb/professional/dermatologic-disorders/approach-to-the-dermatologic-patient/description-of-skin-lesions
- Merck Manual Professional, "Diagnostic Tests for Skin Disorders":
  https://www.merckmanuals.com/professional/dermatologic-disorders/approach-to-the-dermatologic-patient/diagnostic-tests-for-skin-disorders
- DermNet, "Terminology in dermatology":
  https://dermnetnz.org/topics/terminology
- DermNet, "Symptoms of skin disease":
  https://dermnetnz.org/cme/principles/symptoms-of-skin-disease-cme
- DermNet, "Examination of the skin":
  https://dermnetnz.org/cme/principles/examination-of-the-skin
- DermNet, "Skin tests and investigations":
  https://dermnetnz.org/topics/dermatological-investigations-and-tests
- DermNet, "Dermoscopy":
  https://dermnetnz.org/topics/dermoscopy
- AAD, "ABCDEs of melanoma":
  https://www.aad.org/public/diseases/skin-cancer/find/at-risk/abcdes

### Practical implications from the sources

- The lesion history must capture onset, initial site, spread, change in appearance, and triggering factors.
- Full skin exam should support scalp, nails, and mucous membranes, not only trunk/limbs skin.
- Lesion description should support morphology, color, distribution, configuration, texture, and secondary change.
- Symptoms should capture itch, pain, burning, tenderness, bleeding, and sleep impact when relevant.
- Exposure history matters: sun, occupation, cosmetics, contactants, travel, sexual history in selected cases, medications, and systemic disease.
- Diagnostic workflow may require dermoscopy, Wood lamp, scraping/mycology, swab/culture, and biopsy.
- Pigmented lesions need explicit melanoma-warning capture such as asymmetry, border irregularity, color variation, diameter, and evolution.

## 3. High-level product recommendation

### Keep

- `Conduite`
- consultation container and ownership model
- `HistoireMaladie` as a free-text narrative field
- `Diagnostics` as a list
- the idea of seeded catalogs and custom catalog additions
- JSON payload strategy for exam

### Refactor

- replace general-practice motif seeds with dermatology motifs
- replace general-practice exam sections with dermatology sections
- expand antecedent modeling beyond only `medical/family/surgical`
- add structured dermatology history fields instead of relying only on free text
- introduce structured lesion descriptors
- add structured cancer-risk and suspicious-lesion capture
- add structured investigations/procedures capture

### Remove or de-emphasize

- GP-focused symptom seeds like cough, rhinorrhea, otalgia, dysuria, etc.
- organ-system exam sections such as cardiac/pulmonary/abdomen unless you explicitly want them for occasional general review
- vitals as default-required exam content for every dermatology consultation

## 4. Recommended dermatology data model

## 4.1 Interrogatoire

Recommended structure:

- keep a narrative `histoireMaladie`
- add a structured `dermatologyHistory` object
- keep `antecedentsGeneraux` and `antecedentsFamiliaux`
- add lesion-oriented history fields
- keep current treatment, but extend it with response and tolerance

### A. Motif de consultation

| Field | UI type | Storage | Recommendation |
|---|---|---|---|
| `motifs[]` | multi-select with searchable catalog + free add | `string[]` | Keep existing pattern, replace seed values |
| `motifFreeText` | optional text input | `string` | Optional only if you want an "other" narrative |

Suggested seeded motifs:

- Prurit
- Eruption cutanee
- Acnee
- Eczema / dermatite
- Psoriasis
- Urticaire
- Tache pigmentee / nevus
- Chute de cheveux
- Atteinte du cuir chevelu
- Atteinte des ongles
- Mycose cutanee
- Infection bacterienne cutanee
- Infection virale cutanee
- Plaie / ulcere cutane
- Lichen
- Rosacee
- Vitiligo / trouble pigmentaire
- Cicatrice / cheloide
- Suivi traitement dermatologique
- Controle lesion suspecte
- Bilan de grains de beaute

### B. Histoire de la maladie actuelle

| Field | UI type | Storage | Recommendation |
|---|---|---|---|
| `histoireMaladie` | large textarea | `string` | Keep as the main clinical narrative |
| `dateDebut` | date picker or relative duration select + optional date | `string/date` | Important |
| `modeDebut` | dropdown | enum/string | `brutal`, `progressif`, `recidivant`, `chronique` |
| `siteInitial` | body-site multi-select + optional free text | `string[]` + note | Important |
| `extensionEvolution` | segmented choice + textarea | object/json | `stable`, `extension`, `migration`, `recurrent`, plus notes |
| `duree` | short text or computed from date | `string` | Optional if `dateDebut` exists |
| `facteursDeclenchants` | multi-select + free text | `string[]` | Sun, cosmetics, stress, medications, friction, infection, etc. |
| `facteursAggravants` | multi-select + free text | `string[]` | Heat, sweating, sun, scratching, water, shaving, etc. |
| `facteursSoulageants` | multi-select + free text | `string[]` | Emollient, cold, topical steroid, antihistamine, etc. |
| `episodesAnterieurs` | yes/no + textarea | bool + `string` | Important in derm |
| `saisonnalite` | dropdown | enum/string | none/summer/winter/intermittent |
| `contagionEntourage` | yes/no/unknown | enum/string | Useful for scabies, fungal, viral contexts |

### C. Symptomes fonctionnels dermatologiques

| Field | UI type | Storage | Recommendation |
|---|---|---|---|
| `pruritIntensity` | 0-10 slider/input | `int?` | Strongly recommended |
| `douleurIntensity` | 0-10 slider/input | `int?` | Recommended |
| `brulure` | yes/no | `bool?` | Recommended |
| `sensibilite` | yes/no | `bool?` | Recommended |
| `saignement` | yes/no | `bool?` | Recommended |
| `suintement` | yes/no | `bool?` | Recommended |
| `suppuration` | yes/no | `bool?` | Recommended |
| `troubleSommeil` | yes/no | `bool?` | Useful for pruritic disease burden |
| `fievreAssociee` | yes/no | `bool?` | Keep simple |
| `signesGeneraux` | short textarea | `string` | Weight loss, asthenia, arthralgia, etc. |

Recommendation:

- use compact boolean toggles for the common symptom set
- use 0-10 numeric controls for itch and pain
- keep one free-text `signesGeneraux` field instead of many systemic fields in phase 1

### D. Antecedents generaux

You asked to keep this section. I agree, but the values should be reseeded for dermatology.

Recommended UI:

- multi-select chips from catalog
- when a selected item clinically needs detail, open an embedded mini-form

This is a very good fit for your current anomaly + payload design.

Recommended seeded values:

- Terrain atopique
- Asthme
- Rhinite allergique
- Psoriasis personnel
- Vitiligo personnel
- Alopecie areata personnelle
- Urticaire chronique
- Maladie auto-immune
- Immunodepression
- Diabete
- Grossesse en cours
- Allaitement
- Hepatopathie chronique
- Insuffisance renale chronique
- Cancer personnel
- Greffe / immunosuppresseurs
- Anticoagulants
- Allergie medicamenteuse
- Photosensibilite connue
- Antecedent de cancer cutane
- Antecedent de radiotherapie

Embedded forms to open only for selected items:

- `immunodepression`: cause, treatment, start date
- `allergieMedicaments`: culprit drug, reaction, date, severity
- `cancerCutane`: type, site, year, treatment
- `grossesse`: trimester
- `photosensibilite`: suspected trigger, description

### E. Antecedents familiaux

Keep this section, but reseed values to dermatology relevance.

Recommended seeded values:

- Atopie familiale
- Psoriasis familial
- Vitiligo familial
- Pelade familiale
- Lupus / maladie auto-immune familiale
- Melanome familial
- Cancer cutane non melanome familial
- Acne severe familiale
- Ichthyose / maladie genetique cutanee familiale

UI recommendation:

- multi-select chips from catalog
- optional detail textarea only when needed

### F. Antecedents dermatologiques personnels

This section does not exist clearly enough today and should be added.

| Field | UI type | Storage | Recommendation |
|---|---|---|---|
| `antecedentDermatoseConnue` | searchable multi-select | `string[]` | eczema, psoriasis, acne, urticaria, lupus cutane, etc. |
| `antecedentCancerCutane` | yes/no + embedded form | object/json | type, year, site, treatment |
| `antecedentBiopsieCutanee` | yes/no + textarea | object/json | date/site/result if known |
| `phototype` | dropdown | enum/int | Fitzpatrick I-VI |
| `coupsDeSoleilImportants` | yes/no/unknown | enum/string | useful for skin cancer risk |
| `cabinesUV` | yes/no + quantity/frequency | object/json | useful for skin cancer risk |
| `professionExposition` | dropdown + text | object/json | outdoor work, chemicals, wet work |

### G. Expositions et declencheurs

This should be a dedicated section because it is often diagnostic in derm.

| Field | UI type | Storage | Recommendation |
|---|---|---|---|
| `expositionSolaire` | dropdown | enum/string | low/moderate/high |
| `photoprotection` | dropdown | enum/string | regular/occasional/none |
| `contactCosmetiques` | yes/no + textarea | object/json | recommended |
| `produitsTopiquesRecents` | repeatable rows | array/object | very useful |
| `medicamentsRecents` | repeatable rows | array/object | strong recommendation |
| `contactProfessionnel` | yes/no + textarea | object/json | detergents, solvents, gloves, cement, etc. |
| `animaux` | yes/no + textarea | object/json | useful in infections/infestations |
| `voyageRecent` | yes/no + textarea | object/json | useful when relevant |
| `partageLinge / entourage atteint` | yes/no | `bool?` | useful for scabies/infectious context |

### H. Traitements en cours / deja essayes

Current medication rows are useful, but dermatology needs more than a simple list.

Recommended approach:

- keep current medication rows for systemic treatments
- add a second repeatable collection for dermatology treatment attempts

Suggested new repeatable row:

| Field | UI type | Storage | Recommendation |
|---|---|---|---|
| `treatmentName` | autocomplete + free text | `string` | topical steroid, antifungal, isotretinoin, etc. |
| `route` | dropdown | enum/string | topical/oral/injectable/phototherapy/other |
| `indication` | short text | `string` | optional |
| `posology` | short text | `string` | keep flexible |
| `duration` | short text | `string` | keep flexible |
| `response` | dropdown | enum/string | none/partial/good/relapse |
| `adverseEffects` | short textarea | `string` | recommended |
| `isCurrent` | checkbox | `bool` | recommended |

### I. Hair / scalp / nails / mucosa history

This is important enough in derm to deserve explicit toggles.

| Field | UI type | Storage | Recommendation |
|---|---|---|---|
| `scalpSymptoms` | checkbox group + note | object/json | itch, scaling, pain, hair shedding |
| `hairLossTypeHistory` | dropdown | enum/string | diffuse/patchy/scarring/unknown |
| `nailSymptoms` | checkbox group + note | object/json | fragility, pitting, discoloration, thickening |
| `mucosalSymptoms` | yes/no + site checklist | object/json | oral/genital/ocular involvement |

### J. Suspicious pigmented lesion / skin cancer risk

Do not force this for every consultation. Make it a collapsible subsection shown when:

- motif is pigmented lesion / lesion suspecte / cancer screening
- or doctor manually enables it

| Field | UI type | Storage | Recommendation |
|---|---|---|---|
| `isSuspiciousLesionWorkflow` | checkbox | `bool` | toggles the subsection |
| `asymmetry` | yes/no | `bool?` | recommended |
| `borderIrregularity` | yes/no | `bool?` | recommended |
| `colorVariegation` | yes/no | `bool?` | recommended |
| `diameterMm` | numeric input | `decimal?` | recommended |
| `evolving` | yes/no | `bool?` | strongly recommended |
| `itchingBleedingCrusting` | checkbox group | object/json | useful |
| `personalSkinCancerHistory` | yes/no | `bool?` | optional duplicate shortcut if not already captured |
| `familyMelanomaHistory` | yes/no | `bool?` | optional duplicate shortcut |

## 4.2 Examen dermatologique

## Core recommendation

Do not model the dermatology exam as a classic general-medicine organ review.

Instead, use:

- a light general block
- a strong lesion-description block
- site-specific blocks
- optional suspicious-lesion and investigation blocks

### A. Examen general

For dermatology, keep this minimal by default.

| Field | UI type | Storage | Recommendation |
|---|---|---|---|
| `etatGeneral` | dropdown + note | object/json | keep |
| `temperature` | numeric optional | `decimal?` | keep optional |
| `poidsKg` | numeric optional | `decimal?` | useful for systemic treatment dosing |
| `tailleCm` | numeric optional | `decimal?` | useful for dosing |
| `tensionArterielle` | optional collapsed pair | object/json | optional, not default-prominent |

Recommendation:

- remove automatic prominence of cardiac rhythm, saturation, abdomen-style GP defaults
- keep only the fields relevant for systemic therapy safety or infectious red flags

### B. Main dermatologic lesion description

This is the most important new structured exam block.

Use one or more repeatable lesion groups because patients may have more than one clinically distinct lesion pattern.

Per lesion-group recommended fields:

| Field | UI type | Storage | Recommendation |
|---|---|---|---|
| `label` | short text | `string` | e.g. "lesion principale", "plaque coude" |
| `bodySites` | body map multi-select + chip list | `string[]` | strongly recommended |
| `laterality` | dropdown | enum/string | left/right/bilateral/midline/diffuse |
| `countEstimate` | dropdown | enum/string | single/few/multiple/confluent |
| `primaryMorphology` | multi-select | `string[]` | macule, papule, plaque, vesicle, bulla, pustule, nodule, wheal, cyst, ulcer |
| `secondaryChanges` | multi-select | `string[]` | scale, crust, erosion, excoriation, fissure, lichenification, ulceration, atrophy |
| `color` | multi-select | `string[]` | erythematous, hyperpigmented, hypopigmented, violaceous, skin-colored, black, etc. |
| `shapeConfiguration` | multi-select | `string[]` | annular, nummular, linear, grouped, targetoid, dermatomal, follicular |
| `distribution` | multi-select | `string[]` | localized, generalized, flexural, extensor, photo-distributed, acral, seborrheic, symmetrical |
| `surfaceTexture` | multi-select | `string[]` | smooth, rough, verrucous, keratotic, indurated |
| `border` | dropdown | enum/string | well-defined / ill-defined |
| `sizeMm` | text or 2 numeric inputs | object/json | flexible: single diameter or L x W |
| `palpation` | checkbox group | object/json | tender, warm, firm, fluctuant, fixed |
| `blanching` | yes/no/not tested | enum/string | useful in vascular lesions |
| `dermoscopySummary` | short textarea | `string` | recommended if dermatoscope used |
| `notes` | textarea | `string` | keep |

UI recommendation:

- multi-select chips for terminology fields
- embedded form only when a lesion group is expanded
- body map is ideal, but chip-based site selection is acceptable in phase 1

### C. Body-site sub-exams

Support explicit site toggles:

| Field | UI type | Storage | Recommendation |
|---|---|---|---|
| `scalpExam` | section with checklist + textarea | object/json | scaling, erythema, alopecia, scarring, pustules |
| `hairExam` | section with dropdowns + textarea | object/json | diffuse shedding, patchy alopecia, broken hairs, scarring |
| `nailExam` | section with checklist + textarea | object/json | pitting, onycholysis, subungual hyperkeratosis, melanonychia, dystrophy |
| `mucosaExam` | section with site checklist + textarea | object/json | oral, genital, conjunctival |
| `lymphNodes` | yes/no + note | object/json | useful for infections/tumors |

### D. Suspicious lesion exam block

If suspicious lesion workflow is enabled, add:

| Field | UI type | Storage | Recommendation |
|---|---|---|---|
| `abcde.asymmetry` | yes/no | `bool?` | recommended |
| `abcde.border` | yes/no | `bool?` | recommended |
| `abcde.color` | yes/no | `bool?` | recommended |
| `abcde.diameterMm` | numeric | `decimal?` | recommended |
| `abcde.evolving` | yes/no | `bool?` | recommended |
| `uglyDuckling` | yes/no | `bool?` | optional but useful |
| `ulceration` | yes/no | `bool?` | useful |
| `bleeding` | yes/no | `bool?` | useful |
| `biopsyPlanned` | yes/no | `bool?` | useful |

### E. Investigations / procedures done or requested

This can stay outside `Conduite` if the goal is to document what happened during the exam, not only what was prescribed.

| Field | UI type | Storage | Recommendation |
|---|---|---|---|
| `dermoscopyPerformed` | checkbox | `bool` | recommended |
| `woodLampPerformed` | checkbox | `bool` | recommended |
| `skinScrapingPerformed` | checkbox | `bool` | recommended |
| `mycologySample` | checkbox | `bool` | recommended |
| `swabCulture` | checkbox | `bool` | recommended |
| `biopsyPerformed` | checkbox | `bool` | recommended |
| `biopsyType` | dropdown | enum/string | shave/punch/excisional/other |
| `biopsySite` | text | `string` | recommended |
| `clinicalImpressionForPathology` | textarea | `string` | highly useful |

## 5. Which frontend widget type should be used

## Best rule for this app

- use dropdowns/selects for constrained, clinically standardized values
- use multi-select chips for morphology, color, distribution, symptoms, and antecedent catalogs
- use embedded forms when selecting an item requires extra detail
- use repeatable rows for treatments, lesion groups, and procedures
- use textarea only for narrative, nuance, or pathology comments

### Recommended by field family

| Field family | Best widget |
|---|---|
| Motifs | searchable multi-select + free add |
| Antecedents catalog | multi-select chips |
| Antecedent requiring details | multi-select item opening embedded form |
| Histoire maladie | textarea |
| Symptoms intensity | numeric input or slider |
| Symptoms yes/no | toggle or segmented yes/no/unknown |
| Morphology / color / distribution | multi-select chips |
| Site localization | body map or grouped multi-select |
| Lesion groups | repeatable accordion cards |
| Treatment trials | repeatable rows |
| Suspicious lesion checklist | compact checkbox/yes-no grid |
| Procedure details | checkbox + conditional embedded form |

## 6. What should change in the database

## Option A: minimal-migration strategy

Best if you want to move fast.

### Keep tables

- `Interrogatoires`
- `InterrogatoireAnomalies`
- `OngoingTreatmentMedicines`
- `ConsultationExams`

### Change usage

- keep `Interrogatoire.HistoireMaladie`
- keep `Interrogatoire.Diagnostics`
- repurpose `InterrogatoireAnomalies` to support more dermatology sections
- extend `ConsultationExam.Payload` schema to dermatology JSON
- optionally add one new JSON column on `Interrogatoires`, for example `StructuredHistory`

### Minimal schema changes recommended

1. Expand anomaly sections:
   - current enum `Medical/Family/Surgical` is too restrictive
   - replace with broader dermatology-ready sections such as:
     - `GeneralMedical`
     - `Family`
     - `DermatologicPersonal`
     - `Exposure`
     - `Allergy`
     - `CancerRisk`

2. Add `StructuredHistory` JSONB to `Interrogatoires`:
   - this is the cleanest way to store the new lesion history and symptom structure
   - keep `HistoireMaladie` as narrative

3. Extend treatment storage:
   - either add a new table `InterrogatoireTreatmentTrials`
   - or add JSONB `TreatmentResponsePayload` to current treatment rows

This option gives the best speed/benefit ratio.

## Option B: cleaner long-term schema

Best if you want stronger analytics and validation later.

Create dedicated structures such as:

- `InterrogatoireStructuredHistory`
- `InterrogatoireExposure`
- `InterrogatoireDermHistory`
- `ConsultationExamLesion`
- `ConsultationProcedure`

This is better for reporting and strict validation, but heavier now.

## Recommendation

Choose Option A first.

Reason:

- no migrations applied yet, so you still have freedom
- but the app is already built around flexible JSON patterns
- dermatology needs flexibility because lesion description is rich and varies a lot

## 7. Concrete mapping from current app to target app

| Current app element | Keep / change | Dermatology target |
|---|---|---|
| `Interrogatoire.HistoireMaladie` | Keep | Main narrative field |
| `Interrogatoire.Diagnostics[]` | Keep | Final/working diagnoses list |
| `InterrogatoireAnomalies` section `medical` | Keep but reseed | Antecedents generaux dermatology-oriented |
| `InterrogatoireAnomalies` section `family` | Keep but reseed | Antecedents familiaux dermatology-oriented |
| `InterrogatoireAnomalies` section `surgical` | Likely remove or demote | Replace with `dermatologicPersonal`, `exposures`, or `cancerRisk` |
| `OngoingTreatmentMedicines` | Keep and extend | Systemic/current meds |
| general-practice motifs | Replace | dermatology motifs |
| `ConsultationExam.Payload.general` | Keep but simplify | minimal general exam |
| `ConsultationExam.Payload.specific` GP sections | Replace | lesion groups + scalp/hair/nails/mucosa + suspicious lesion + procedures |

## 8. Fields I would remove from the default dermatology UI

Unless you explicitly want a mixed generalist/derm product, I would remove from the default exam flow:

- cardiac auscultation block
- pulmonary auscultation block
- abdomen block
- neurologic block
- osteo-articular block
- urogenital block
- ORL/conjunctiva as a standalone default block

Some of these can still exist in an optional "other exam" free-text area.

## 9. Seed values to introduce

## Interrogatoire catalogs

### Antecedents generaux

- Terrain atopique
- Asthme
- Rhinite allergique
- Psoriasis
- Vitiligo
- Urticaire chronique
- Maladie auto-immune
- Immunodepression
- Diabete
- Grossesse
- Allaitement
- Allergie medicamenteuse
- Photosensibilite
- Antecedent cancer cutane

### Antecedents familiaux

- Atopie familiale
- Psoriasis familial
- Vitiligo familial
- Pelade familiale
- Lupus / auto-immun familial
- Melanome familial
- Cancer cutane familial

### Morphology catalog

- Macule
- Papule
- Plaque
- Vesicule
- Bulle
- Pustule
- Nodule
- Kyste
- Wheal / papule urticarienne
- Erosion
- Ulcere

### Secondary changes catalog

- Squames
- Croute
- Excoriation
- Fissure
- Lichenification
- Atrophie
- Cicatrice
- Keratose

### Distribution catalog

- Localisee
- Generalisee
- Symetrique
- Asymetrique
- Photo-distribuee
- Flexurale
- Extenseurs
- Acrale
- Seborrheique
- Dermatomerique
- Folliculaire

## 10. Final recommendation

If the goal is to move safely and quickly to a dermatologist app, the best first refactor is:

1. keep `Conduite` unchanged
2. keep `HistoireMaladie` and `Diagnostics`
3. replace GP seeds and GP exam defaults
4. add structured dermatology history in JSON
5. turn exam into lesion-centered dermatology exam JSON
6. keep antecedents generaux/familiaux, but reseed them for dermatology
7. add dedicated support for scalp, hair, nails, mucosa, exposures, prior treatment response, and suspicious lesion workflow

## 11. Proposed implementation order

1. Redesign the frontend form contract for dermatology interrogatoire and exam.
2. Update backend DTOs for the new JSON payloads.
3. Expand anomaly section enum or replace it with string-backed sections.
4. Replace default seeded motifs and antecedent catalogs.
5. Replace `ExamService` default payload and finding catalog.
6. Add migration(s).
7. Update print/export only where consultation summary depends on old field names.

## 12. Important note

This report is for software/domain modeling, not medical decision support. Final field choices should still be validated by at least one practicing dermatologist before freezing the schema.
