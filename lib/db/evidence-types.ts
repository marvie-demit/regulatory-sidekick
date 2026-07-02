// Shared evidence types + upload constraints. Plain module (no "use server") so
// both the server actions and the client component can import it.

export type EvidenceItem = {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  storagePath: string;
  uploaderEmail: string | null;
  createdAt: string;
};

export const EVIDENCE_MAX_MB = 25;
export const EVIDENCE_MAX_BYTES = EVIDENCE_MAX_MB * 1024 * 1024;
export const EVIDENCE_ACCEPT = ".pdf,.docx,.xlsx,.png,.jpg,.jpeg";
export const EVIDENCE_MIME = new Set<string>([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
]);
