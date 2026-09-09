/**
 * PS374-ERV-UI-01 — neutral, local-synthetic ERV UI package descriptors.
 *
 * These are the bound requirement/configuration/scenario/core descriptors and
 * the declared UI trees for the baseline LEAN and the dialogue-derived
 * SEGREGATED_ENTERPRISE packages. All data is local and synthetic (no customer
 * data, no external provider, no ERP, no productive posting).
 *
 * The renderer/consumer engine (reference.mjs) never hard-codes the concrete
 * field/action/component identifiers below — they live here so the generic
 * engine stays renderer-neutral and carries no ERV business allowlist.
 */

const LEAN_BASE_SCREENS = [
  {
    screenId: "screen-main",
    order: 0,
    sections: [
      {
        sectionId: "section-summary",
        order: 0,
        components: [
          {
            componentId: "comp-amount",
            order: 0,
            kind: "METRIC",
            field: {
              fieldId: "amount",
              label: "Amount",
              accessibilityLabel: "Amount",
              displayKind: "CURRENCY",
              state: "VALUE",
              value: 1250,
              evidenceRefs: ["ev-invoice-amount"],
            },
            actions: [],
          },
          {
            componentId: "comp-status",
            order: 1,
            kind: "BADGE",
            field: {
              fieldId: "status",
              label: "Status",
              accessibilityLabel: "Status",
              displayKind: "ENUM",
              state: "VALUE",
              value: "MATCHED",
              evidenceRefs: ["ev-invoice-amount"],
            },
            actions: [],
          },
          {
            componentId: "comp-notes",
            order: 2,
            kind: "CALLOUT",
            field: {
              fieldId: "notes",
              label: "Notes",
              // `help` is an optional hint: present here, omitted elsewhere, to
              // prove hints stay optional (kept optional by design).
              help: "Advisory notes derived from evidence.",
              accessibilityLabel: "Notes",
              displayKind: "TEXT",
              state: "UNKNOWN",
              reasonCode: "NOT_PROVIDED",
              evidenceRefs: ["ev-invoice-amount"],
            },
            actions: [
              {
                actionId: "act-open",
                order: 0,
                enabled: true,
                requiredEvidenceRefs: ["ev-invoice-amount"],
                authority: "NONE",
                confirmationIntent: { required: true, label: "Open invoice" },
                readbackIntent: { label: "Opened" },
                evidenceRefs: ["ev-invoice-amount"],
              },
            ],
          },
        ],
      },
      {
        sectionId: "section-detail",
        order: 1,
        components: [
          {
            componentId: "comp-lines",
            order: 0,
            kind: "LIST",
            field: {
              fieldId: "lines",
              label: "Line items",
              accessibilityLabel: "Line items",
              displayKind: "LIST",
              state: "VALUE",
              value: [{ line: 1, amount: 1000 }, { line: 2, amount: 250 }],
              evidenceRefs: ["ev-line-1", "ev-line-2"],
            },
            actions: [],
          },
        ],
      },
    ],
  },
];

const SEGREGATED_COMPLIANCE_SECTION = {
  sectionId: "section-compliance",
  order: 2,
  components: [
    {
      componentId: "comp-compliance",
      order: 0,
      kind: "FIELD",
      field: {
        fieldId: "compliance",
        label: "Compliance hold",
        accessibilityLabel: "Compliance hold",
        displayKind: "BOOLEAN",
        state: "CONFLICT",
        reasonCode: "SEGREGATION_POLICY_CONFLICT",
        evidenceRefs: ["ev-compliance"],
      },
      actions: [],
    },
    {
      componentId: "comp-approver",
      order: 1,
      kind: "FIELD",
      field: {
        fieldId: "approver",
        label: "Approver",
        accessibilityLabel: "Approver",
        displayKind: "TEXT",
        state: "UNSUPPORTED",
        reasonCode: "ERP_APPROVER_UNAVAILABLE",
        evidenceRefs: ["ev-compliance"],
      },
      actions: [
        {
          actionId: "act-escalate",
          order: 0,
          enabled: false,
          disabledReason: "SEGREGATION_POLICY_CONFLICT",
          requiredEvidenceRefs: ["ev-compliance"],
          authority: "NONE",
          confirmationIntent: { required: true, label: "Escalate" },
          readbackIntent: { label: "Escalation requested" },
          evidenceRefs: ["ev-compliance"],
        },
      ],
    },
  ],
};

const LEAN_BASE_SCREEN = LEAN_BASE_SCREENS[0];

export const LEAN_DESCRIPTOR = {
  contextId: "ctx-erv-ui-lean",
  scenario: "LEAN",
  requirement: { id: "req-erv-incoming-invoice", version: "1" },
  configuration: { id: "cfg-lean", mode: "LEAN", version: "1" },
  scenarioDescriptor: { id: "scn-lean-baseline", contextId: "ctx-erv-ui-lean", version: "1" },
  core: { id: "core-erv-incoming-invoice", caseCount: 8, version: "1" },
  evidence: [
    { ref: "ev-invoice-amount", kind: "INVOICE", content: { n: 1250, unit: "minor" } },
    { ref: "ev-line-1", kind: "INVOICE_LINE", content: { line: 1, amount: 1000 } },
    { ref: "ev-line-2", kind: "INVOICE_LINE", content: { line: 2, amount: 250 } },
  ],
  screens: LEAN_BASE_SCREENS,
};

export const SEGREGATED_ENTERPRISE_DESCRIPTOR = {
  contextId: "ctx-erv-ui-segregated",
  scenario: "SEGREGATED_ENTERPRISE",
  // Shared bound requirement + core (same digests as the baseline).
  requirement: LEAN_DESCRIPTOR.requirement,
  core: LEAN_DESCRIPTOR.core,
  // Dialogue-derived adaptation: distinct configuration and scenario digests.
  configuration: { id: "cfg-segregated", mode: "SEGREGATED_ENTERPRISE", version: "2" },
  scenarioDescriptor: { id: "scn-segregated-adapted", contextId: "ctx-erv-ui-segregated", version: "2" },
  evidence: [
    ...LEAN_DESCRIPTOR.evidence,
    { ref: "ev-compliance", kind: "COMPLIANCE", content: { policy: "segregation", hold: true } },
  ],
  // Baseline tree plus the dialogue-derived compliance section (the exact delta).
  screens: [
    {
      screenId: LEAN_BASE_SCREEN.screenId,
      order: 0,
      sections: [...LEAN_BASE_SCREEN.sections, SEGREGATED_COMPLIANCE_SECTION],
    },
  ],
};