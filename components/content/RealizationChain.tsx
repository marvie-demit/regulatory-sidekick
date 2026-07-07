"use client";

// The realization chain: the curated, high-level process map — 7 lanes ×
// 4 phases with the trigger / hand-off arrows and the improvement feedback
// loop. The one view of how the processes interact across the lifecycle
// (ISO 13485 §4.1.2). Editorial by design (not derived from the model) so it
// stays a readable one-glance map.

type Lane = {
  key: string;
  label: string;
  tone?: "coral";
  cells: Record<number, string[]>; // phase -> up to 2 text lines
};

const LANES: Lane[] = [
  {
    key: "design",
    label: "Design & dev",
    cells: {
      1: ["Intended purpose", "+ D&D plan"],
      2: ["Design controls", "V&V · transfer"],
      4: ["Design changes"],
    },
  },
  {
    key: "risk",
    label: "Risk mgmt",
    cells: {
      1: ["RM plan + hazards"],
      2: ["Analysis + controls", "RM report"],
      3: ["Risk review"],
      4: ["Post-market", "risk update"],
    },
  },
  {
    key: "evidence",
    label: "Evidence",
    cells: {
      1: ["Eval plan", "+ state of art"],
      2: ["Evidence", "SV→AP→CP / lit"],
      4: ["CER / PER", "+ PMCF / PMPF"],
    },
  },
  {
    key: "sw",
    label: "Software / AI",
    cells: {
      1: ["SW & AI plans"],
      2: ["Build · V&V", "cyber · usability"],
    },
  },
  {
    key: "tech",
    label: "Tech file",
    cells: {
      1: ["Classification (gate)"],
      2: ["GSPR + labeling"],
      4: ["TD · DoC · CE", "IFU / UDI"],
    },
  },
  {
    key: "pms",
    label: "Post-market",
    cells: {
      2: ["PMS plan", "+ vigilance set-up"],
      4: ["Release · operate", "PMS / vigilance"],
    },
  },
  {
    key: "improve",
    label: "Improvement",
    tone: "coral",
    cells: {
      2: ["CAPA · change", "· NCP set-up"],
      3: ["Operate & govern"],
      4: ["Feedback → improve"],
    },
  },
];

const COL: Record<number, number> = { 1: 190, 2: 440, 3: 690, 4: 940 };
const CW = 215;
const CH = 64;
const LANE_Y = [100, 193, 286, 379, 472, 565, 658];

// brand palette (looks native on the cream page)
const TEAL_FILL = "#0F3B35";
const TEAL_TEXT = "#EAF3EF";
const CORAL_FILL = "#BE4A2C";
const CORAL_TEXT = "#FBE7DF";
const INK = "#0B2A26";
const TEAL_LINE = "#1D6E62";
const CORAL_LINE = "#D8593A";

export function RealizationChain() {
  return (
    <div className="mt-5 overflow-x-auto rounded-xl border border-line bg-card p-2">
      <svg
        viewBox="0 0 1160 858"
        role="img"
        aria-label="Realization chain: processes by phase, with triggers"
        style={{ width: "100%", minWidth: 760, display: "block" }}
      >
        <defs>
          <marker
            id="rc-tri-teal"
            markerWidth="9"
            markerHeight="9"
            refX="7.5"
            refY="4.5"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L9,4.5 L0,9 z" fill={TEAL_LINE} />
          </marker>
          <marker
            id="rc-tri-coral"
            markerWidth="9"
            markerHeight="9"
            refX="7.5"
            refY="4.5"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L9,4.5 L0,9 z" fill={CORAL_LINE} />
          </marker>
        </defs>

        {/* phase headers */}
        {[1, 2, 3, 4].map((p) => (
          <text
            key={p}
            x={COL[p] + CW / 2}
            y={62}
            textAnchor="middle"
            fontSize={24}
            fontWeight={600}
            fill={INK}
          >
            Phase {p}
          </text>
        ))}

        {/* lane labels + cells */}
        {LANES.map((lane, i) => {
          const y = LANE_Y[i];
          const coral = lane.tone === "coral";
          return (
            <g key={lane.key}>
              <text
                x={18}
                y={y + CH / 2 + 6}
                fontSize={18}
                fill={INK}
                fontWeight={500}
              >
                {lane.label}
              </text>
              {[1, 2, 3, 4].map((p) => {
                const lines = lane.cells[p];
                if (!lines) return null;
                const cx = COL[p];
                const midY = y + CH / 2;
                return (
                  <g key={p}>
                    <rect
                      x={cx}
                      y={y}
                      width={CW}
                      height={CH}
                      rx={10}
                      fill={coral ? CORAL_FILL : TEAL_FILL}
                    />
                    {lines.length === 1 ? (
                      <text
                        x={cx + CW / 2}
                        y={midY + 6}
                        textAnchor="middle"
                        fontSize={17}
                        fill={coral ? CORAL_TEXT : TEAL_TEXT}
                      >
                        {lines[0]}
                      </text>
                    ) : (
                      <>
                        <text
                          x={cx + CW / 2}
                          y={midY - 5}
                          textAnchor="middle"
                          fontSize={17}
                          fill={coral ? CORAL_TEXT : TEAL_TEXT}
                        >
                          {lines[0]}
                        </text>
                        <text
                          x={cx + CW / 2}
                          y={midY + 16}
                          textAnchor="middle"
                          fontSize={17}
                          fill={coral ? CORAL_TEXT : TEAL_TEXT}
                        >
                          {lines[1]}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* trigger / hand-off arrows */}
        {/* design P1 -> risk P1 */}
        <line x1={297.5} y1={164} x2={297.5} y2={191} stroke={TEAL_LINE} strokeWidth={2.5} markerEnd="url(#rc-tri-teal)" />
        {/* design P2 <-> risk P2 */}
        <line x1={547.5} y1={162} x2={547.5} y2={193} stroke={TEAL_LINE} strokeWidth={2.5} markerStart="url(#rc-tri-teal)" markerEnd="url(#rc-tri-teal)" />
        {/* tech P2 -> tech P4 (class -> route) */}
        <line x1={657} y1={504} x2={936} y2={504} stroke={TEAL_LINE} strokeWidth={2.5} markerEnd="url(#rc-tri-teal)" />
        <text x={797} y={492} textAnchor="middle" fontSize={17} fill={INK}>class → route</text>
        {/* evidence P4 -> tech P4 (evidence -> TD) */}
        <line x1={1047.5} y1={352} x2={1047.5} y2={470} stroke={TEAL_LINE} strokeWidth={2.5} markerEnd="url(#rc-tri-teal)" />
        <text x={1035} y={416} textAnchor="end" fontSize={17} fill={INK}>evidence → TD</text>
        {/* tech P4 -> pms P4 (-> market) */}
        <line x1={1047.5} y1={538} x2={1047.5} y2={563} stroke={TEAL_LINE} strokeWidth={2.5} markerEnd="url(#rc-tri-teal)" />
        <text x={1058} y={554} textAnchor="start" fontSize={17} fill={INK}>→ market</text>

        {/* feedback loop */}
        <text x={680} y={752} textAnchor="middle" fontSize={18} fill={CORAL_LINE}>
          post-market · complaints · audit → CAPA → change → back into design &amp; risk
        </text>
        <line x1={1150} y1={768} x2={210} y2={768} stroke={CORAL_LINE} strokeWidth={2.5} strokeDasharray="7 6" markerEnd="url(#rc-tri-coral)" />

        {/* legend */}
        <line x1={300} y1={812} x2={344} y2={812} stroke={TEAL_LINE} strokeWidth={2.5} markerEnd="url(#rc-tri-teal)" />
        <text x={354} y={817} fontSize={17} fill={INK}>triggers / hands off</text>
        <line x1={600} y1={812} x2={644} y2={812} stroke={CORAL_LINE} strokeWidth={2.5} strokeDasharray="7 6" markerEnd="url(#rc-tri-coral)" />
        <text x={654} y={817} fontSize={17} fill={INK}>feedback loop</text>
      </svg>
    </div>
  );
}
