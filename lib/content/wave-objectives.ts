// A short "objective" for each start-order column, keyed by [phase][wave] — the
// MODEL wave (not the re-ranked display number), so a title always follows the
// activities it describes even when a device profile hides some columns.
// Spine waves get crisp objectives; a few early waves are parallel grab-bags of
// independent processes, so their titles are honestly broad. The hint shows on
// hover. Authored against the full activity set (see content.json wave grouping).

export type WaveObjective = { title: string; hint: string };

// Objectives are keyed by MODEL wave. Since activities are now spread across
// columns by leverage (foundational-first) capped per column, each column's
// objective describes the priority batch that lands there.
export const WAVE_OBJECTIVES: Record<number, Record<number, WaveObjective>> = {
  1: {
    1: { title: "Stand up the QMS core", hint: "The foundational SOPs — design-control process, document & record control, regulatory monitoring, roles and infrastructure." },
    2: { title: "Define the product & QMS manual", hint: "Intended purpose, the quality manual, and the CSV and registration procedures." },
    3: { title: "Classify & set the strategy", hint: "Device classification, quality objectives, the management representative and the regulatory strategy." },
    4: { title: "Engage the Notified Body", hint: "Contract a Notified Body and book the review slot early — it's the usual bottleneck." },
  },
  2: {
    1: { title: "Write the master plans", hint: "The risk, clinical and performance-evaluation plans, the usability file, the ML description and change control." },
    2: { title: "Scope the device & requirements", hint: "IVD design, the GSPR checklists, biocompatibility and the AI/ML lifecycle." },
    3: { title: "Stand up the specialist tracks", hint: "Product security, privacy, incident response, deployment, combination products and DiGA." },
    4: { title: "Set up the operational procedures", hint: "CSV, ISMS, supplier surveillance, breach notification, custom-made and the risk-management procedure." },
    5: { title: "Turn plans into design inputs", hint: "Design inputs, formative usability, scientific validity, the D&D plan and the standards list." },
    6: { title: "Analyse risk & start building", hint: "Risk analysis, the software plan, model validation, the DPIA, the SOTA search and the analytical-performance plan." },
    7: { title: "Software design & the V&V plan", hint: "Software requirements and architecture, the PCCP, and the verification & validation plan." },
    8: { title: "Implement the software", hint: "Build the software under the IEC 62304 lifecycle." },
  },
  3: {
    1: { title: "Verify & prove — first pass", hint: "Design verification, summative usability, the clinical evidence base and investigation, feasibility, and the interim risk report." },
    2: { title: "Validate, make & run the QMS", hint: "Software V&V, analytical performance, complaints, CAPA, production and electrical-safety testing." },
    3: { title: "Operational controls", hint: "Nonconforming product, process-map upkeep, metrology, sales, continuity and contaminated products." },
    4: { title: "Complete the evidence", hint: "Design validation & release, analytical performance, CAPA operation, sterilization and the biological-evaluation report." },
    5: { title: "Finalise performance & traceability", hint: "Clinical performance and the design traceability matrix." },
  },
  4: {
    1: { title: "Finalise the reports", hint: "Clinical and performance evaluation reports, labelling setup, the PMS plan, release approval and post-market security." },
    2: { title: "Operate & transfer", hint: "Management review, internal audit, IVD PMS, servicing, design transfer and the risk-report sign-off." },
    3: { title: "Label & plan follow-up", hint: "Produce the label, UDI and IFU, write the PMCF plan and set up EU vigilance." },
    4: { title: "Compile the technical file", hint: "Assemble the technical documentation and execute PMCF." },
    5: { title: "Submit & release (US)", hint: "Notified Body Stage 1 documentation readiness and the US FDA release." },
    6: { title: "Pass the audit", hint: "Notified Body Stage 2 on-site audit, and US incident reporting." },
    7: { title: "Go to market (EU)", hint: "Place the device on the EU market under MDR / IVDR." },
    8: { title: "Operate post-market", hint: "Run proactive post-market surveillance — the PMS report and PSUR." },
    9: { title: "Close the risk loop", hint: "Feed post-market data back into the risk file and benefit-risk." },
  },
};
