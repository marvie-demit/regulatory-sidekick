"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addEvidence, deleteEvidence } from "@/lib/db/evidence";
import {
  EVIDENCE_ACCEPT,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MAX_MB,
  EVIDENCE_MIME,
  type EvidenceItem,
} from "@/lib/db/evidence-types";

function fmtSize(b: number | null): string {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function EvidenceSection({
  activityId,
  orgId,
  canUpload,
  items,
}: {
  activityId: string;
  orgId: string;
  canUpload: boolean;
  items: EvidenceItem[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const supabase = createClient();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    if (file.size > EVIDENCE_MAX_BYTES) {
      setErr(`Files must be ${EVIDENCE_MAX_MB} MB or smaller.`);
      e.target.value = "";
      return;
    }
    if (file.type && !EVIDENCE_MIME.has(file.type)) {
      setErr("Unsupported type. Use PDF, Word, Excel, PNG or JPG.");
      e.target.value = "";
      return;
    }
    setBusy(true);
    const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 100);
    const path = `org/${orgId}/${activityId}/${crypto.randomUUID()}-${safe}`;
    const up = await supabase.storage
      .from("evidence")
      .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (up.error) {
      setErr("Upload failed. " + up.error.message);
      setBusy(false);
      e.target.value = "";
      return;
    }
    const res = await addEvidence({
      activityId,
      storagePath: path,
      fileName: file.name,
      mimeType: file.type || null,
      sizeBytes: file.size,
    });
    if (res.error) {
      // Roll back the orphaned object if the row couldn't be recorded.
      await supabase.storage.from("evidence").remove([path]);
      setErr(res.error);
      setBusy(false);
      e.target.value = "";
      return;
    }
    setBusy(false);
    e.target.value = "";
    router.refresh();
  }

  async function onDownload(item: EvidenceItem) {
    setErr(null);
    const { data, error } = await supabase.storage
      .from("evidence")
      .createSignedUrl(item.storagePath, 60, { download: item.fileName });
    if (error || !data) {
      setErr("Could not prepare the download.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function onDelete(item: EvidenceItem) {
    if (!window.confirm(`Remove "${item.fileName}"?`)) return;
    setErr(null);
    setBusy(true);
    const res = await deleteEvidence(item.id);
    setBusy(false);
    if (res.error) {
      setErr(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Attach the records that prove this activity was done — reports, signed
        forms, screenshots. Files stay private to your workspace.
      </p>

      {items.length > 0 ? (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <span className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onDownload(it)}
                  className="block max-w-full truncate text-left text-sm font-medium text-teal-800 hover:underline"
                >
                  {it.fileName}
                </button>
                <span className="block text-[11px] text-muted">
                  {fmtSize(it.sizeBytes)}
                  {it.uploaderEmail ? ` · ${it.uploaderEmail}` : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onDelete(it)}
                disabled={busy}
                className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted transition hover:text-coral disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line bg-cream px-4 py-5 text-center text-sm text-muted">
          No evidence attached yet.
        </p>
      )}

      {canUpload ? (
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept={EVIDENCE_ACCEPT}
            onChange={onPick}
            disabled={busy}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-teal-800 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "Uploading…" : "↑ Attach a file"}
          </button>
          <span className="text-[11px] text-muted">
            PDF, Word, Excel, PNG, JPG · up to {EVIDENCE_MAX_MB} MB
          </span>
        </div>
      ) : (
        <a
          href="/pricing"
          className="inline-flex items-center gap-1.5 rounded-full border border-coral px-4 py-2 text-sm font-semibold text-coral transition hover:bg-coral hover:text-white"
        >
          Attach evidence · Full access
        </a>
      )}

      {err ? (
        <p role="alert" className="text-sm text-coral">
          {err}
        </p>
      ) : null}
    </div>
  );
}
