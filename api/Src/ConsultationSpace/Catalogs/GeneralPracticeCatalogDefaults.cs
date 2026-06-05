namespace api.Src.ConsultationSpace.Catalogs;

public static class GeneralPracticeCatalogDefaults
{
    public sealed record TreatmentCatalogRelationSeed(
        string TherapeuticClass,
        string Category,
        string Medicine);

    public sealed record OrdonnanceTypeDrugSeed(
        string TherapeuticClass,
        string Category,
        string Medicine,
        string Posology,
        string Duration);

    public sealed record OrdonnanceTypeSeed(
        string TypeKey,
        string Label,
        string TranslationKey,
        string Consigne,
        string InformationAdditionnel,
        IReadOnlyList<OrdonnanceTypeDrugSeed> ListDrugs);

    public static IReadOnlyList<TreatmentCatalogRelationSeed> TreatmentCatalogRelations { get; } =
    [
        new("Antibiotiques bêta-lactamines", "Pénicillines", "Amoxicilline 1 g (Clamoxyl)"),
        new("Antalgiques et antipyrétiques", "Paracétamol", "Paracétamol 1 g (Doliprane)"),
        new("Anti-inflammatoires non stéroïdiens", "AINS", "Ibuprofène 400 mg (Brufen)"),
        new("ORL et allergologie", "Antihistaminiques", "Cétirizine 10 mg"),
        new("ORL et allergologie", "Lavage nasal", "Sérum physiologique nasal"),
        new("ORL et allergologie", "Corticoïdes nasaux", "Budésonide spray nasal 64 mcg"),
        new("Gastro-entérologie", "Réhydratation orale", "SRO (sels de réhydratation orale)"),
        new("Gastro-entérologie", "Antidiarrhéiques", "Racécadotril 100 mg (Tiorfan)"),
        new("Gastro-entérologie", "Antispasmodiques", "Phloroglucinol 80 mg (Spasfon)"),
        new("Urologie", "Antibiotiques urinaires", "Fosfomycine trométamol 3 g (Monuril)"),
        new("Urologie", "Antibiotiques urinaires", "Nitrofurantoine 100 mg"),
        new("Pneumologie", "Bronchodilatateurs", "Salbutamol inhalateur 100 mcg"),
        new("Pneumologie", "Corticoïdes oraux", "Prednisone 20 mg"),
        new("Collyre", "Larmes artificielles", "Théalose"),
        new("Collyre", "Larmes artificielles", "Vismed"),
        new("Collyre", "Larmes artificielles", "Hyalufresh"),
        new("Collyre", "Larmes artificielles", "Aqualarm"),
        new("Collyre", "Larmes artificielles", "Lacrymed Unidose"),
        new("Collyre", "Antibiotique seul", "Tobra"),
        new("Collyre", "Antibiotique seul", "Néofloxin"),
        new("Collyre", "Antibiotique seul", "Cipro Collyre"),
        new("Collyre", "Antibiotique + corticoïde", "Frakidex collyre"),
        new("Collyre", "Antibiotique + corticoïde", "Tobacort"),
        new("Collyre", "Antibiotique + corticoïde", "Dexamex"),
        new("Collyre", "Antiseptique", "Désomédine"),
        new("Collyre", "Antiseptique", "Vitabact"),
        new("Collyre", "Anti-inflammatoire", "Dicloabak"),
        new("Collyre", "Anti-inflammatoire", "Votril"),
        new("Collyre", "Anti-inflammatoire", "Indocollyre unidose"),
        new("Collyre", "Anti-allergique", "Naabak"),
        new("Collyre", "Anti-allergique", "Opatanol"),
        new("Collyre", "Anti-allergique", "Zalerg"),
        new("Collyre", "Hypotonisant (glaucome)", "Ganfort"),
        new("Collyre", "Hypotonisant (glaucome)", "Travatan"),
        new("Collyre", "Hypotonisant (glaucome)", "Xalatan"),
        new("Collyre", "Hypotonisant (glaucome)", "Alphagan"),
        new("Collyre", "Immunosuppresseur", "Ikrevis 0.1"),
    ];

    public static IReadOnlyList<OrdonnanceTypeSeed> OrdonnanceTypeTemplates { get; } =
    [
        new(
            "angine_bacterienne",
            "Angine bactérienne",
            "consultation.conduite.ordonnance.types.angineBacterienne",
            "Boire abondamment, terminer l'antibiotique et consulter si aggravation.",
            "Éviter l'automédication antibiotique.",
            [
                new(
                    "Antibiotiques bêta-lactamines",
                    "Pénicillines",
                    "Amoxicilline 1 g (Clamoxyl)",
                    "1 cp x 2/j",
                    "06 jours"),
                new(
                    "Antalgiques et antipyrétiques",
                    "Paracétamol",
                    "Paracétamol 1 g (Doliprane)",
                    "1 cp si fièvre/douleur, max 3/j",
                    "03 jours"),
            ]),
        new(
            "syndrome_grippal",
            "Syndrome grippal",
            "consultation.conduite.ordonnance.types.syndromeGrippal",
            "Repos, hydratation, surveiller la fièvre.",
            "Réévaluation médicale si dyspnée ou fièvre persistante.",
            [
                new(
                    "Antalgiques et antipyrétiques",
                    "Paracétamol",
                    "Paracétamol 1 g (Doliprane)",
                    "1 cp toutes les 8h si besoin",
                    "03 jours"),
                new(
                    "ORL et allergologie",
                    "Lavage nasal",
                    "Sérum physiologique nasal",
                    "Lavage nasal 3-4 fois/j",
                    "05 jours"),
            ]),
        new(
            "rhinopharyngite_aigue",
            "Rhinopharyngite aiguë",
            "consultation.conduite.ordonnance.types.rhinopharyngiteAigue",
            "Hydratation et lavage nasal réguliers.",
            "Consulter en cas de douleur sinusienne intense ou fièvre prolongée.",
            [
                new(
                    "ORL et allergologie",
                    "Lavage nasal",
                    "Sérum physiologique nasal",
                    "Lavage nasal 4 fois/j",
                    "07 jours"),
                new(
                    "ORL et allergologie",
                    "Antihistaminiques",
                    "Cétirizine 10 mg",
                    "1 cp le soir",
                    "05 jours"),
                new(
                    "Antalgiques et antipyrétiques",
                    "Paracétamol",
                    "Paracétamol 1 g (Doliprane)",
                    "1 cp si douleur/fièvre, max 3/j",
                    "03 jours"),
            ]),
        new(
            "gastro_enterite_aigue",
            "Gastro-entérite aiguë",
            "consultation.conduite.ordonnance.types.gastroEnteriteAigue",
            "Fractionner les prises, prioriser la réhydratation orale.",
            "Urgences si signes de déshydratation ou sang dans les selles.",
            [
                new(
                    "Gastro-entérologie",
                    "Réhydratation orale",
                    "SRO (sels de réhydratation orale)",
                    "Après chaque selle liquide",
                    "03 jours"),
                new(
                    "Gastro-entérologie",
                    "Antidiarrhéiques",
                    "Racécadotril 100 mg (Tiorfan)",
                    "1 gélule x 3/j",
                    "03 jours"),
                new(
                    "Gastro-entérologie",
                    "Antispasmodiques",
                    "Phloroglucinol 80 mg (Spasfon)",
                    "1 cp x 2/j si douleurs",
                    "03 jours"),
            ]),
        new(
            "cystite_simple",
            "Cystite simple",
            "consultation.conduite.ordonnance.types.cystiteSimple",
            "Boire 1,5 à 2 litres d'eau par jour.",
            "Faire un contrôle si persistance des symptômes à 48h.",
            [
                new(
                    "Urologie",
                    "Antibiotiques urinaires",
                    "Fosfomycine trométamol 3 g (Monuril)",
                    "1 sachet dose unique",
                    "01 jour"),
                new(
                    "Gastro-entérologie",
                    "Antispasmodiques",
                    "Phloroglucinol 80 mg (Spasfon)",
                    "1 cp x 2/j si douleurs",
                    "03 jours"),
            ]),
        new(
            "bronchite_aigue_simple",
            "Bronchite aiguë simple",
            "consultation.conduite.ordonnance.types.bronchiteAigueSimple",
            "Hydratation, arrêt du tabac et surveillance respiratoire.",
            "Consulter en urgence en cas de gêne respiratoire importante.",
            [
                new(
                    "Antalgiques et antipyrétiques",
                    "Paracétamol",
                    "Paracétamol 1 g (Doliprane)",
                    "1 cp si fièvre/douleur, max 3/j",
                    "03 jours"),
                new(
                    "Pneumologie",
                    "Bronchodilatateurs",
                    "Salbutamol inhalateur 100 mcg",
                    "1-2 bouffees si besoin",
                    "05 jours"),
                new(
                    "Pneumologie",
                    "Corticoïdes oraux",
                    "Prednisone 20 mg",
                    "1 cp/j le matin",
                    "05 jours"),
            ]),
    ];
}
