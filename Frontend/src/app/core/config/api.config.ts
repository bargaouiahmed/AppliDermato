/**
 * Centralized API configuration.
 * Every service should import endpoints from here — never hardcode paths.
 *
 * The base URL comes from the environment-specific file that Angular swaps at build time.
 */
import { environment } from '../../../environments/environment';

const BASE = environment.apiUrl.replace(/\/+$/, '');

export const API = {
  /** Auth endpoints */
  auth: {
    login: `${BASE}/api/v0/auth/signin`,
    finalizeAuth: `${BASE}/api/v0/auth/signin-with-role`,
    sendResetCode: (email: string, lang = 'fr') =>
      `${BASE}/api/v0/auth/send-password-reset-email?email=${encodeURIComponent(email)}&lang=${encodeURIComponent(lang)}`,
    resetPassword: `${BASE}/api/v0/auth/reset-password`,
    refreshToken: `${BASE}/api/v0/auth/refresh-token`,
    me: `${BASE}/api/v0/auth/me`,
    changeAutoAssignedPassword: `${BASE}/api/v0/auth/change-auto-assigned-password`,
  },

  /** Admin endpoints */
  admin: {
    createDoctor: `${BASE}/api/v0/admin/doctors`,
    listDoctors: `${BASE}/api/v0/admin/doctors`,
    getDoctor: (doctorId: string) => `${BASE}/api/v0/admin/doctors/${doctorId}`,
    updateDoctor: (doctorId: string) => `${BASE}/api/v0/admin/doctors/${doctorId}`,
    suspendDoctor: (doctorId: string) => `${BASE}/api/v0/admin/doctors/${doctorId}/suspend`,
    reactivateDoctor: (doctorId: string) => `${BASE}/api/v0/admin/doctors/${doctorId}/reactivate`,
    changeDoctorRole: (doctorId: string) => `${BASE}/api/v0/admin/doctors/${doctorId}/role`,
    removeAdmin: (doctorId: string) => `${BASE}/api/v0/admin/admins/${doctorId}`,
    deleteDoctor: (doctorId: string) => `${BASE}/api/v0/admin/doctors/${doctorId}`,
  },

  /** Profile endpoints */
  doctor: {
    getById: (_id: string) => `${BASE}/api/v0/auth/me`,
    update: (_id: string) => `${BASE}/api/v0/profile`,
    updatePassword: `${BASE}/api/v0/profile/password`,
  },

  /** Patient endpoints */
  patients: {
    add: `${BASE}/api/v0/patients`,
    nextDossierNumber: `${BASE}/api/v0/patients/next-dossier-number`,
    verifyDossierNumber: `${BASE}/api/v0/patients/verify-dossier-number`,
    getById: (patientId: string) => `${BASE}/api/v0/patients/${patientId}`,
    update: (patientId: string) => `${BASE}/api/v0/patients/${patientId}`,
    delete: (patientId: string) => `${BASE}/api/v0/patients/${patientId}`,
    getAll: `${BASE}/api/v0/patients/all`,
    professions: `${BASE}/api/v0/patients/professions`,
    getRecent: `${BASE}/api/v0/patients/recent`,
    exportCsv: `${BASE}/api/v0/patients/export/csv`,
    getConsultations: (patientId: string) =>
      `${BASE}/api/v0/patients/${patientId}/consultations`,
    getConsultationsByDate: `${BASE}/api/v0/patients/consultations/by-date`,
    getConsultationDates: `${BASE}/api/v0/patients/consultations/dates`,
  },

  /** Cabinet statistics */
  statistics: {
    overview: `${BASE}/api/v0/statistics/overview`,
    diagnostics: `${BASE}/api/v0/statistics/diagnostics`,
  },

  /** Internal messaging */
  messages: {
    bootstrap: `${BASE}/api/v0/messages/bootstrap`,
    all: `${BASE}/api/v0/messages`,
    byRoom: (roomId: string) => `${BASE}/api/v0/messages/room/${encodeURIComponent(roomId)}`,
    send: `${BASE}/api/v0/messages`,
    edit: (messageId: string) => `${BASE}/api/v0/messages/${encodeURIComponent(messageId)}`,
    delete: (messageId: string) => `${BASE}/api/v0/messages/${encodeURIComponent(messageId)}`,
    seen: (roomId: string) => `${BASE}/api/v0/messages/room/${encodeURIComponent(roomId)}/seen`,
  },

  /** Doctor suggestions */
  suggestions: {
    all: `${BASE}/api/v0/suggestions`,
    create: `${BASE}/api/v0/suggestions`,
    reply: (suggestionId: string) => `${BASE}/api/v0/suggestions/${encodeURIComponent(suggestionId)}/replies`,
    unreadCount: `${BASE}/api/v0/suggestions/unread-count`,
  },

  /** Tech assistance tickets */
  techAssistance: {
    all: `${BASE}/api/v0/tech-assistance`,
    create: `${BASE}/api/v0/tech-assistance`,
    message: (ticketId: string) =>
      `${BASE}/api/v0/tech-assistance/${encodeURIComponent(ticketId)}/messages`,
    notifyTechLead: (ticketId: string) =>
      `${BASE}/api/v0/tech-assistance/${encodeURIComponent(ticketId)}/notify-tech-lead`,
    close: (ticketId: string) =>
      `${BASE}/api/v0/tech-assistance/${encodeURIComponent(ticketId)}/close`,
    unreadCount: `${BASE}/api/v0/tech-assistance/unread-count`,
    publicReview: (ticketId: string) =>
      `${BASE}/api/v0/tech-assistance/public/review/${encodeURIComponent(ticketId)}`,
  },

  /** AI assistant */
  aiChat: {
    complete: `${BASE}/api/v0/ai-chat/complete`,
    sessions: `${BASE}/api/v0/ai-chat/sessions`,
    session: (sessionId: string) => `${BASE}/api/v0/ai-chat/sessions/${encodeURIComponent(sessionId)}`,
    messages: (sessionId: string) =>
      `${BASE}/api/v0/ai-chat/sessions/${encodeURIComponent(sessionId)}/messages`,
    message: (sessionId: string, messageId: string) =>
      `${BASE}/api/v0/ai-chat/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}`,
  },

  /** Interrogatoire + consultation initialization */
  interrogatoire: {
    initializeConsultation: `${BASE}/api/v0/interrogatoire/consultations/initialize`,
    getAnomalyCatalog: (section?: string) =>
      `${BASE}/api/v0/interrogatoire/consultations/anomalies/catalog${
        section ? `?section=${encodeURIComponent(section)}` : ''
      }`,
    addCustomAnomalyToCatalog: `${BASE}/api/v0/interrogatoire/consultations/anomalies/catalog/custom`,
    hideCustomAnomalyFromCatalog: (section: string, label: string) =>
      `${BASE}/api/v0/interrogatoire/consultations/anomalies/catalog/custom?section=${encodeURIComponent(section)}&label=${encodeURIComponent(label)}`,
    getTreatmentMedicineCatalog: `${BASE}/api/v0/interrogatoire/consultations/treatments/catalog/medicines`,
    addTreatmentMedicineCatalogItem: `${BASE}/api/v0/interrogatoire/consultations/treatments/catalog/medicines`,
    getTherapeuticClassCatalog: `${BASE}/api/v0/interrogatoire/consultations/treatments/catalog/therapeutic-classes`,
    addTherapeuticClassCatalogItem: `${BASE}/api/v0/interrogatoire/consultations/treatments/catalog/therapeutic-classes`,
    getTreatmentCategoryCatalog: `${BASE}/api/v0/interrogatoire/consultations/treatments/catalog/categories`,
    addTreatmentCategoryCatalogItem: `${BASE}/api/v0/interrogatoire/consultations/treatments/catalog/categories`,
    getTreatmentCatalogRelations: `${BASE}/api/v0/interrogatoire/consultations/treatments/catalog/relations`,
    getConsultationById: (consultationId: string) =>
      `${BASE}/api/v0/interrogatoire/consultations/${consultationId}`,
    getOrdonnanceHistory: (consultationId: string) =>
      `${BASE}/api/v0/interrogatoire/consultations/${consultationId}/ordonnances/history`,
    getDiagnosticsCatalog: (consultationId: string) =>
      `${BASE}/api/v0/interrogatoire/consultations/${consultationId}/diagnostics/catalog`,
    updateConsultationData: (consultationId: string) =>
      `${BASE}/api/v0/interrogatoire/consultations/${consultationId}`,
    updateConsultationTimer: (consultationId: string) =>
      `${BASE}/api/v0/interrogatoire/consultations/${consultationId}/timer`,
    deleteConsultation: (consultationId: string) =>
      `${BASE}/api/v0/interrogatoire/consultations/${consultationId}`,
  },

  /** Public self check-in kiosk endpoints */
  selfCheckin: {
    bootstrap: (doctorId: string, kioskKey: string) =>
      `${BASE}/api/v0/self-checkin/${doctorId}/${kioskKey}/bootstrap`,
    nextDossierNumber: (doctorId: string, kioskKey: string) =>
      `${BASE}/api/v0/self-checkin/${doctorId}/${kioskKey}/patient/next-dossier-number`,
    findPatient: (doctorId: string, kioskKey: string) =>
      `${BASE}/api/v0/self-checkin/${doctorId}/${kioskKey}/patient/find`,
    createPatient: (doctorId: string, kioskKey: string) =>
      `${BASE}/api/v0/self-checkin/${doctorId}/${kioskKey}/patient/create`,
    createConsultation: (doctorId: string, kioskKey: string) =>
      `${BASE}/api/v0/self-checkin/${doctorId}/${kioskKey}/consultation/create`,
    patchMotif: (doctorId: string, kioskKey: string, consultationId: string) =>
      `${BASE}/api/v0/self-checkin/${doctorId}/${kioskKey}/consultation/${consultationId}/motif`,
    patchInterrogatoire: (doctorId: string, kioskKey: string, consultationId: string) =>
      `${BASE}/api/v0/self-checkin/${doctorId}/${kioskKey}/consultation/${consultationId}/interrogatoire`,
  },

  /** Dedicated exam section endpoints */
  exam: {
    getConsultationById: (consultationId: string) =>
      `${BASE}/api/v0/exam/consultations/${consultationId}`,
    updateConsultation: (consultationId: string) =>
      `${BASE}/api/v0/exam/consultations/${consultationId}`,
    getFindingCatalog: (section?: string) =>
      `${BASE}/api/v0/exam/consultations/catalog/findings${
        section ? `?section=${encodeURIComponent(section)}` : ''
      }`,
    addFindingCatalogItem: `${BASE}/api/v0/exam/consultations/catalog/findings`,
  },

  /** Dedicated conduite section endpoints */
  conduite: {
    getActionCatalog: `${BASE}/api/v0/conduite/consultations/catalog/actions`,
    getConsigneCatalog: `${BASE}/api/v0/conduite/consultations/catalog/consignes`,
    getOrdonnanceTypeCatalog: `${BASE}/api/v0/conduite/consultations/catalog/ordonnance-types`,
    saveOrdonnanceTypeCatalogItem: `${BASE}/api/v0/conduite/consultations/catalog/ordonnance-types`,
    getConsultationById: (consultationId: string) =>
      `${BASE}/api/v0/conduite/consultations/${consultationId}`,
    getLatestPreviousOrdonnance: (consultationId: string) =>
      `${BASE}/api/v0/conduite/consultations/${consultationId}/ordonnance/latest`,
    updateConsultation: (consultationId: string) =>
      `${BASE}/api/v0/conduite/consultations/${consultationId}`,
    generateLettreConfrereAi: (consultationId: string) =>
      `${BASE}/api/v0/conduite/consultations/${consultationId}/lettre-confrere/ai/generate`,
    correctLettreConfrereAi: (consultationId: string) =>
      `${BASE}/api/v0/conduite/consultations/${consultationId}/lettre-confrere/ai/correct`,
    lettreConfrereAiJob: (consultationId: string, jobId: string) =>
      `${BASE}/api/v0/conduite/consultations/${consultationId}/lettre-confrere/ai/jobs/${jobId}`,
    printDocument: (
      consultationId: string,
      documentType: string,
      lang = 'fr',
      sections?: string[],
    ) =>
      `${BASE}/api/v0/conduite/consultations/${consultationId}/print/${encodeURIComponent(documentType)}?lang=${encodeURIComponent(lang)}${
        sections && sections.length > 0
          ? `&sections=${encodeURIComponent(sections.join(','))}`
          : ''
      }`,
    printParacliniquePdf: (consultationId: string, lang = 'fr') =>
      `${BASE}/api/v0/conduite/consultations/${consultationId}/print/paraclinique/pdf?lang=${encodeURIComponent(lang)}`,
    printCnamData: (consultationId: string) =>
      `${BASE}/api/v0/conduite/consultations/${consultationId}/print/cnam/data`,
  },

  /** Consultation documents */
  documents: {
    getConsultation: (consultationId: string) =>
      `${BASE}/api/v0/documents/consultations/${consultationId}`,
    createExplorationDocument: (consultationId: string) =>
      `${BASE}/api/v0/documents/consultations/${consultationId}/exploration`,
    deleteExplorationDocument: (consultationId: string, documentId: string) =>
      `${BASE}/api/v0/documents/consultations/${consultationId}/exploration/${documentId}`,
    cnamFile: (fileName: string) => `${BASE}/Cnam/${encodeURIComponent(fileName)}`,
  },

  realtime: {
    waitingRoomHub: `${BASE}/hubs/waiting-room`,
    internalMessagingHub: `${BASE}/hubs/internal-messaging`,
    suggestionHub: `${BASE}/hubs/suggestions`,
    techAssistanceHub: `${BASE}/hubs/tech-assistance`,
    consultationAiHub: `${BASE}/hubs/consultation-ai`,
  },
} as const;
