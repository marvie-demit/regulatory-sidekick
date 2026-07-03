// Server-only content loader. Reads the generated content.json at runtime so TypeScript
// never has to infer the 380 KB literal, and the file is bundled via outputFileTracing
// (configured in next.config for production). Content is shared across all tenants.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Activity, Content, DocItem, Profile } from "./types";

let _content: Content | null = null;

export function getContent(): Content {
  if (!_content) {
    const p = join(process.cwd(), "content", "content.json");
    _content = JSON.parse(readFileSync(p, "utf-8")) as Content;
  }
  return _content;
}

export const content: Content = getContent();

export function pnum(phase: string): number {
  const m = String(phase).match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

export function getActivity(id: string): Activity | undefined {
  return content.activities.find((a) => a.id === id);
}

export function activitiesByPhase(n: number): Activity[] {
  return content.activities.filter((a) => pnum(a.phase) === n);
}

// device-profile scoping — ported verbatim from the existing app (inScopeAct / inScopeDoc)
export function inScopeAct(a: Activity, prof: Profile): boolean {
  if (!prof) return true;
  if (!a.mods || a.mods.indexOf("Core") >= 0) return true;
  return a.mods.some((m) => !!prof[m]);
}

export function inScopeDoc(moduleCode: string, prof: Profile): boolean {
  if (moduleCode === "Core" || !prof) return true;
  return !!prof[moduleCode];
}

export type ContentCounts = {
  activities: number;
  subActivities: number;
  checklistItems: number;
  documents: number;
  quizQuestions: number;
  phases: number;
};

export function counts(): ContentCounts {
  const subActivities = content.activities.reduce(
    (s, a) => s + (a.subs?.length ?? 0),
    0,
  );
  const checklistItems = content.activities.reduce(
    (s, a) => s + (a.how2?.reduce((x, g) => x + (g.steps?.length ?? 0), 0) ?? 0),
    0,
  );
  const quizQuestions = Object.values(content.questions).reduce(
    (s, q) => s + (q?.length ?? 0),
    0,
  );
  return {
    activities: content.activities.length,
    subActivities,
    checklistItems,
    documents: content.documents.length,
    quizQuestions,
    phases: content.phases.length,
  };
}

// ---- dependency graph + critical path (ported verbatim from build_site.py) ----
const byId: Record<string, Activity> = {};
content.activities.forEach((a) => {
  byId[a.id] = a;
});

export function idnum(id: string): number {
  const m = String(id).match(/(\d+)\.(\d+)/);
  return m ? parseInt(m[1], 10) * 100 + parseInt(m[2], 10) : 0;
}

export const EDGES: [string, string][] = [];
content.activities.forEach((a) => {
  if (a.depends && a.depends !== "-") {
    a.depends.split(",").forEach((d) => {
      const t = d.trim();
      if (t && t !== "-") EDGES.push([t, a.id]);
    });
  }
});

const preds: Record<string, string[]> = {};
EDGES.forEach(([u, v]) => {
  (preds[v] = preds[v] || []).push(u);
});

export function critPath(): string[] {
  const order = content.activities
    .map((a) => a.id)
    .sort(
      (x, y) =>
        pnum(byId[x].phase) - pnum(byId[y].phase) || idnum(x) - idnum(y),
    );
  const dist: Record<string, number> = {};
  const par: Record<string, string | null> = {};
  order.forEach((v) => {
    dist[v] = 0;
    par[v] = null;
    (preds[v] || []).forEach((u) => {
      if (dist[u] + 1 > dist[v]) {
        dist[v] = dist[u] + 1;
        par[v] = u;
      }
    });
  });
  let end = order[0];
  order.forEach((v) => {
    if (dist[v] > dist[end]) end = v;
  });
  const path: string[] = [];
  let c: string | null = end;
  while (c) {
    path.unshift(c);
    c = par[c];
  }
  return path;
}

export const CRIT: string[] = critPath();
export const CRITset: Record<string, 1> = {};
CRIT.forEach((x) => {
  CRITset[x] = 1;
});
export const CRITe: Record<string, 1> = {};
for (let i = 0; i < CRIT.length - 1; i++) CRITe[`${CRIT[i]}>${CRIT[i + 1]}`] = 1;

// ---- documents: lookup + workflow grouping (ported from build_site.py) ----
export const byDocId: Record<string, DocItem> = {};
content.documents.forEach((d) => {
  byDocId[d.id] = d;
});

// expand "DOC-TPL-01/02/03" shorthand into ["DOC-TPL-01","DOC-TPL-02","DOC-TPL-03"]
export function expandRefs(s?: string): string[] {
  const out: string[] = [];
  (s || "").split(";").forEach((tok) => {
    const m = tok.trim().match(/^([A-Z]{2,4}-[A-Z]{2,4}-)(\d+(?:\/\d+)*)/);
    if (!m) return;
    m[2].split("/").forEach((nraw) => {
      const n = nraw.length < 2 ? `0${nraw}` : nraw;
      out.push(m[1] + n);
    });
  });
  return out.filter((id, i) => out.indexOf(id) === i);
}

export type DocGroups = {
  adopt: DocItem[];
  templates: DocItem[];
  record: DocItem[];
  registers: DocItem[];
  other: DocItem[];
};

export function docWorkflow(documents?: string): DocGroups {
  const g: DocGroups = {
    adopt: [],
    templates: [],
    record: [],
    registers: [],
    other: [],
  };
  expandRefs(documents).forEach((id) => {
    const cls = id.split("-")[1] || "";
    const d: DocItem =
      byDocId[id] || ({ id, title: "", cls, domain: "", module: "" } as DocItem);
    if (cls === "SOP" || cls === "WI" || cls === "POL" || cls === "MAN")
      g.adopt.push(d);
    else if (cls === "TPL") g.templates.push(d);
    else if (cls === "FOR") g.record.push(d);
    else if (cls === "LIS") g.registers.push(d);
    else g.other.push(d);
  });
  return g;
}

// ---- library grouping by process (ported from build_site.py renderLib) ----
const CLS_ORDER: Record<string, number> = {
  SOP: 0,
  WI: 1,
  TPL: 2,
  FOR: 3,
  LIS: 4,
  POL: 5,
  MAN: 6,
};

export type ProcGroup = {
  domain: string;
  name: string;
  module: string;
  docs: DocItem[];
};

export function documentsByProcess(profile: Profile = null): ProcGroup[] {
  const procs = (content.procs || {}) as Record<
    string,
    { name: string; module: string }
  >;
  const byDom: Record<string, DocItem[]> = {};
  content.documents
    .filter((d) => inScopeDoc(d.module, profile))
    .forEach((d) => {
      (byDom[d.domain] = byDom[d.domain] || []).push(d);
    });
  const order = (content.procOrder || []).filter((dm) => byDom[dm]);
  Object.keys(byDom).forEach((dm) => {
    if (order.indexOf(dm) < 0) order.push(dm);
  });
  return order.map((dm) => {
    const p = procs[dm] || { name: dm, module: "" };
    const docs = byDom[dm].slice().sort((a, b) => {
      const ra = CLS_ORDER[a.cls] ?? 7;
      const rb = CLS_ORDER[b.cls] ?? 7;
      return ra - rb || a.id.localeCompare(b.id);
    });
    return { domain: dm, name: p.name, module: p.module, docs };
  });
}

export function docActivities(docId: string): string[] {
  return (content.docActs?.[docId] || []).slice().sort((a, b) => idnum(a) - idnum(b));
}

// ---- doc → producing step (from the process model, via doc-steps.json) ----
// Answers "when/where is this document created": the process + step that
// produces it, plus the phase and maturity. Covers every document, including
// the ones no activity used to reference.
export type DocStep = { p: string; pn: string; s: string; st: string; ph: number; m: string };

let _docSteps: Record<string, DocStep> | null = null;
function docStepsMap(): Record<string, DocStep> {
  if (_docSteps) return _docSteps;
  try {
    _docSteps = JSON.parse(
      readFileSync(join(process.cwd(), "content", "doc-steps.json"), "utf-8"),
    ) as Record<string, DocStep>;
    return _docSteps;
  } catch {
    return {}; // don't cache a failed read
  }
}

export function docStep(docId: string): DocStep | null {
  return docStepsMap()[docId] ?? null;
}

export const PHASE_NAMES: Record<number, string> = {
  1: "Research & foundations",
  2: "Develop under control",
  3: "Govern & lead",
  4: "Certify, launch & improve",
};

