// Reads the generated docs manifest (id -> file type + download name) produced
// by the one-time upload script. The master files themselves live in a private
// Supabase Storage bucket; this only maps a doc id to its file, so the download
// route can sign a URL with the right path + friendly filename.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type DocFile = { ext: string; name: string };

let _m: Record<string, DocFile> | null = null;

function manifest(): Record<string, DocFile> {
  if (_m) return _m;
  try {
    _m = JSON.parse(
      readFileSync(join(process.cwd(), "content", "docs.manifest.json"), "utf-8"),
    ) as Record<string, DocFile>;
    return _m;
  } catch {
    // Don't cache a failed read — caching {} would break every download until
    // the server restarts. Return empty this time and retry on the next call.
    return {};
  }
}

export function docFile(docId: string): DocFile | null {
  return manifest()[docId] ?? null;
}
