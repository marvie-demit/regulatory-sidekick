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
    1: { title: "Define the procedures", hint: "The QMS procedures that govern development — risk management, performance evaluation and change control — plus the first master plans. Each procedure produces the records that follow." },
    2: { title: "Procedures & device scoping", hint: "The V&V and biological-evaluation procedures, the GSPR checklists, IVD design and the AI/ML lifecycle." },
    3: { title: "Stand up the specialist tracks", hint: "Product security and the threat model, privacy, incident response, deployment planning, combination products and the IVDR GSPR checklist." },
    4: { title: "Systems, security & the D&D plan", hint: "Computerised-system validation, the ISMS, breach notification, custom-made devices, DiGA and the design & development plan." },
    5: { title: "Plan risk & evidence", hint: "The risk-management plan and first hazards, formative usability, the performance-evaluation plan, biocompatibility and the standards list." },
    6: { title: "Design inputs & risk analysis", hint: "Design inputs and outputs, risk analysis and controls, scientific validity, the DPIA and the SOTA search." },
    7: { title: "Plan software & V&V", hint: "The software plan and safety class, the V&V plan, the analytical-performance plan, and self-test and companion-diagnostic design." },
    8: { title: "Design the software", hint: "Software requirements and architecture, and the release procedure." },
    9: { title: "Implement the software", hint: "Build the software under the IEC 62304 lifecycle." },
  },
  3: {
    1: { title: "Verify & prove — first pass", hint: "Design verification, summative usability, the clinical evidence base and investigation, and feasibility." },
    2: { title: "Test, transfer & run the QMS", hint: "Software V&V, model validation, the penetration test, design transfer, production, electrical-safety testing, complaints and CAPA." },
    3: { title: "Conclude risk & operational controls", hint: "The risk-management report on verified controls, nonconforming product, process-map upkeep, metrology, sales, continuity and contaminated products." },
    4: { title: "Complete the evidence", hint: "Design validation & release, analytical performance, CAPA operation, sterilization, the biological-evaluation report and lay-user validation." },
    5: { title: "Finalise performance & traceability", hint: "Clinical performance and the design traceability matrix." },
  },
  4: {
    1: { title: "Finalise the reports", hint: "Clinical and performance evaluation reports, the AI Act documentation and PCCP, software release, labelling setup, the PMS plan and post-market security." },
    2: { title: "Audit & review the QMS", hint: "Internal audit and management review — both due before the Notified Body — plus IVD PMS, supplier surveillance and servicing." },
    3: { title: "Label, sign off & plan follow-up", hint: "Produce the label, UDI and IFU, approve the release, sign off the risk report, write the PMCF plan and set up EU vigilance." },
    4: { title: "Compile the technical file", hint: "Assemble the technical documentation and draw up the Declaration of Conformity." },
    5: { title: "Submit & release (US)", hint: "Notified Body Stage 1 documentation readiness, the companion-diagnostic consultation and the US FDA release." },
    6: { title: "Pass the audit", hint: "Notified Body Stage 2 on-site audit, and US incident reporting." },
    7: { title: "Go to market (EU)", hint: "Place the device on the EU market under MDR / IVDR." },
    8: { title: "Operate post-market", hint: "Run proactive post-market surveillance — the PMS report and PSUR — and execute PMCF." },
    9: { title: "Close the risk loop", hint: "Feed post-market data back into the risk file and benefit-risk." },
  },
};
