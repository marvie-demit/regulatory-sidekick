// A short "objective" for each start-order column, keyed by [phase][wave] — the
// MODEL wave (not the re-ranked display number), so a title always follows the
// activities it describes even when a device profile hides some columns.
// Spine waves get crisp objectives; a few early waves are parallel grab-bags of
// independent processes, so their titles are honestly broad. The hint shows on
// hover. Authored against the full activity set (see content.json wave grouping).

export type WaveObjective = { title: string; hint: string };

export const WAVE_OBJECTIVES: Record<number, Record<number, WaveObjective>> = {
  1: {
    1: {
      title: "Set up the foundations",
      hint: "Stand up the lean framework — D&D process, doc control, regulatory, roles, infrastructure.",
    },
    2: {
      title: "Define the product & QMS",
      hint: "Pin down the intended purpose and the quality manual everything hangs off.",
    },
    3: {
      title: "Settle the gates & plan",
      hint: "Classify the device and lay the risk, evaluation and AI plans.",
    },
    4: {
      title: "Prove the concept",
      hint: "First evidence — scientific validity — and the software safety class.",
    },
  },
  2: {
    1: {
      title: "Kick off the parallel tracks",
      hint: "Workstreams with no prerequisites — usability plan, ML description, labeling, PMS plan.",
    },
    2: {
      title: "Stand up the QMS processes",
      hint: "Operational SOPs — complaints, CAPA, change control, nonconformity, vigilance, purchasing.",
    },
    3: {
      title: "Switch on the modules",
      hint: "Specialist modules — information & product security, privacy, incident response, sales & support.",
    },
    4: {
      title: "Production & specialist evidence",
      hint: "Formative usability, computerised-system validation, biocompatibility, production & process validation.",
    },
    5: {
      title: "Design inputs & build",
      hint: "Turn needs into design inputs/outputs, analyse risk, build the model and the evidence base.",
    },
    6: {
      title: "Verify & freeze the design",
      hint: "Design verification & freeze, software architecture, risk report, AI Act & GSPR documentation.",
    },
    7: {
      title: "Validate & implement",
      hint: "Design validation & transfer, software implementation, analytical performance.",
    },
    8: {
      title: "Prove performance",
      hint: "Software verification & validation, and clinical performance.",
    },
    9: {
      title: "Release & deploy",
      hint: "Software release with cybersecurity docs, and the release & deployment plan.",
    },
  },
  3: {
    1: {
      title: "Run the management system",
      hint: "Management review, internal audit, supplier surveillance, training effectiveness, continuity.",
    },
    2: {
      title: "Close the improvement loop",
      hint: "Operate and govern CAPA — run the loop, don't just define it.",
    },
  },
  4: {
    1: {
      title: "Finalize evidence & reports",
      hint: "Clinical/performance evaluation reports, labeling, release approval, post-market risk & security.",
    },
    2: {
      title: "Assemble the technical file",
      hint: "Compile the technical documentation & Declaration of Conformity; plan post-market clinical follow-up.",
    },
    3: {
      title: "Submit for assessment",
      hint: "Notified Body Stage 1 documentation readiness; US FDA release; PMCF report.",
    },
    4: {
      title: "Pass the audit",
      hint: "Notified Body Stage 2 on-site audit & certification; US incident reporting.",
    },
    5: {
      title: "Go to market",
      hint: "Place the device on the EU market (MDR / IVDR).",
    },
    6: {
      title: "Operate post-market",
      hint: "Run proactive post-market surveillance — PMS report & PSUR.",
    },
  },
};
