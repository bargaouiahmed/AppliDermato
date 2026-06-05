export interface ConsultationExplorationDocumentResponse {
  id: string;
  consultationId: string;
  typeLabels: string[];
  clinic: string;
  forfait: string;
  operator: string;
  precaution: string;
  additionalInformation: string;
  originalFileName: string;
  fileUrl: string;
  contentType: string;
  fileSizeBytes: number;
  createdAt: string;
}

export interface ConsultationDocumentsResponse {
  consultationId: string;
  explorationDocuments: ConsultationExplorationDocumentResponse[];
}

export interface CreateExplorationDocumentRequest {
  typeLabels: string[];
  clinic: string;
  forfait: string;
  operator: string;
  precaution: string;
  additionalInformation: string;
  file: File;
}
