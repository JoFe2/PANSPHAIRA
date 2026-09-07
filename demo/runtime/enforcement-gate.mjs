import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import {
  APPROVAL_PURPOSE,
  APPROVAL_REQUESTER,
  createAuthoritativeApprovalSnapshot,
  validateAuthoritativeApprovalSnapshot,
} from "./authoritative-approval-snapshot.mjs";

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function equalSecret(presented, expected) {
  const left = Buffer.from(presented ?? "");
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function authorizeLocalRequest(request, {
  apiToken,
  expectedOrigin,
  requireCsrf = true,
}) {
  const bearer = request.headers.authorization?.replace(/^Bearer /, "") ?? "";
  if (!equalSecret(bearer, apiToken)) throw new Error("AUTHENTICATION_REQUIRED");
  if (request.headers.origin !== expectedOrigin) {
    throw new Error("SAME_ORIGIN_REQUIRED");
  }
  if (request.headers.host !== new URL(expectedOrigin).host) {
    throw new Error("CANONICAL_HOST_REQUIRED");
  }
  if (requireCsrf && request.headers["x-cm-csrf"] !== "chimpmaera-local-v1") {
    throw new Error("CSRF_TOKEN_REQUIRED");
  }
}

function validateActionShape(action) {
  if (action === null || typeof action !== "object" || Array.isArray(action)) {
    throw new Error("ACTION_INVALID");
  }
  const allowedTop = ["actionType", "actor", "payload", "replayKey", "scope"];
  if (
    JSON.stringify(Object.keys(action).sort()) !== JSON.stringify(allowedTop)
    || action.actionType !== "PROVIDER_MUTATION"
    || !["installer:seed-and-flow", "agent:admin-ai-poc"].includes(action.actor)
    || typeof action.replayKey !== "string"
    || !/^[a-zA-Z0-9:._-]{8,180}$/.test(action.replayKey)
    || action.scope === null
    || typeof action.scope !== "object"
    || Array.isArray(action.scope)
    || action.payload === null
    || typeof action.payload !== "object"
    || Array.isArray(action.payload)
  ) throw new Error("UNKNOWN_ACTION_DENIED");
}

function validateAdminAiAction(action, authorityKind) {
  const contact = {
    actionType: "PROVIDER_MUTATION",
    actor: "agent:admin-ai-poc",
    payload: {
      body: {
        description: "PanSphaira Admin AI deterministic PoC contact",
        emailAddress: "admin-ai-poc@example.invalid",
        firstName: "Avery",
        lastName: "Admin AI PoC",
      },
      method: "POST",
      path: "/Contact",
    },
    replayKey: action.replayKey,
    scope: {
      actor: "agent:admin-ai-poc",
      entity: "Contact",
      operation: "CREATE_IF_ABSENT",
      provider: "espocrm",
      tenant: "panskys-zoo-demo",
    },
  };
  const order = {
    actionType: "PROVIDER_MUTATION",
    actor: "agent:admin-ai-poc",
    payload: {
      body: {
        date: 1767225600,
        ref_client: "CM-ADMIN-AI-ESCALATION-001",
        socid: 7,
      },
      method: "POST",
      path: "/orders",
    },
    replayKey: action.replayKey,
    scope: {
      actor: "agent:admin-ai-poc",
      entity: "Order",
      operation: "CREATE_IF_ABSENT",
      provider: "dolibarr",
      tenant: "panskys-zoo-demo",
    },
  };
  const expected = authorityKind === "ADMIN_AI_POC_HMAC_V1"
    ? contact
    : authorityKind === "OWNER_ESCALATION_LEASE_HMAC_V1"
      ? order
      : null;
  if (
    !/^admin-ai:poc:[a-zA-Z0-9:._-]{8,140}$/.test(action.replayKey)
    || expected === null
    || canonicalJson(action) !== canonicalJson(expected)
  ) throw new Error("AGENT_ACTION_SCOPE_DENIED");
}

function validateMutationScope(action) {
  const { scope, payload } = action;
  if (
    scope.tenant !== "panskys-zoo-demo"
    || payload.method !== "POST"
    || typeof payload.path !== "string"
    || payload.body === null
    || typeof payload.body !== "object"
    || Array.isArray(payload.body)
  ) throw new Error("SCOPE_MISMATCH_DENIED");

  const allowed = scope.provider === "espocrm"
    ? {
      Account: /^\/Account$/,
      Contact: /^\/Contact$/,
      Opportunity: /^\/Opportunity$/,
    }[scope.entity]
    : scope.provider === "dolibarr"
      ? {
        ThirdParty: /^\/thirdparties$/,
        Order: /^\/orders$/,
        OrderLine: /^\/orders\/[1-9][0-9]*\/lines$/,
      }[scope.entity]
      : undefined;
  if (
    allowed === undefined
    || scope.operation !== "CREATE_IF_ABSENT"
    || !allowed.test(payload.path)
  ) throw new Error("SCOPE_MISMATCH_DENIED");
}

function receiptCore(action, actionDigest, providerResult, readback, authority) {
  return {
    schemaVersion: authority?.kind === "OWNER_ESCALATION_LEASE_HMAC_V1"
      ? "chimpmaera.demo/effect-receipt/v3"
      : authority === undefined
        ? "chimpmaera.demo/effect-receipt/v1"
        : "chimpmaera.demo/effect-receipt/v2",
    actionDigest,
    actor: action.actor,
    scope: action.scope,
    replayKey: action.replayKey,
    provider: {
      objectType: action.scope.entity,
      objectReference: String(
        readback?.id ?? providerResult?.id ?? providerResult,
      ),
    },
    outcome: "PROVIDER_MUTATION_READBACK_VERIFIED",
    replayState: "FIRST_EXECUTION",
    readbackDigest: sha256(canonicalJson(readback)),
    ...(authority === undefined ? {} : {
      authority: {
        kind: authority.kind,
        policyId: authority.policyId,
        policyGeneration: authority.policyGeneration,
        ...(authority.leaseId === undefined ? {} : {
          leaseId: authority.leaseId,
          expiresAtMs: authority.expiresAtMs,
          maxUses: authority.maxUses,
        }),
      },
      decisionDigest: authority.decisionDigest,
      policyId: authority.policyId,
      policyGeneration: authority.policyGeneration,
      policyDigest: authority.policyDigest,
      ...(authority.ownerDecisionReceiptDigest === undefined ? {} : {
        ownerDecisionReceiptDigest: authority.ownerDecisionReceiptDigest,
        businessDiffDigest: authority.businessDiffDigest,
        snapshotDigest: authority.snapshotDigest,
        snapshotVersion: authority.snapshotVersion,
        requester: authority.requester,
        purpose: authority.purpose,
        profileId: authority.profileId,
        profileGeneration: authority.profileGeneration,
      }),
    }),
  };
}

function validateSemanticReadback(action, readback) {
  if (action.actor !== "agent:admin-ai-poc") return;
  if (action.scope.provider === "espocrm") {
    for (const field of ["description", "emailAddress", "firstName", "lastName"]) {
      if (readback[field] !== action.payload.body[field]) {
        throw new Error("PROVIDER_READBACK_MISMATCH_DENIED");
      }
    }
    return;
  }
  if (
    String(readback.ref_client ?? "") !== action.payload.body.ref_client
    || Number(readback.socid) !== action.payload.body.socid
    || Number(readback.date) !== action.payload.body.date
  ) throw new Error("PROVIDER_READBACK_MISMATCH_DENIED");
}

function normalizeEffectStore(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("EFFECT_STORE_INVALID_DENIED");
  }
  const keys = Object.keys(value).sort();
  const isV1 = value.schemaVersion === "chimpmaera.demo/effect-store/v1"
    && canonicalJson(keys) === canonicalJson(["effects", "schemaVersion"]);
  const isV2 = value.schemaVersion === "chimpmaera.demo/effect-store/v2"
    && canonicalJson(keys) === canonicalJson([
      "consumedAuthorityLeases",
      "effects",
      "reservations",
      "schemaVersion",
    ]);
  if (!isV1 && !isV2) throw new Error("EFFECT_STORE_INVALID_DENIED");
  for (const collection of [
    value.effects,
    ...(isV2 ? [value.reservations, value.consumedAuthorityLeases] : []),
  ]) {
    if (collection === null || typeof collection !== "object" || Array.isArray(collection)) {
      throw new Error("EFFECT_STORE_INVALID_DENIED");
    }
  }
  for (const [replayKey, record] of Object.entries(value.effects)) {
    if (
      record === null
      || typeof record !== "object"
      || Array.isArray(record)
      || canonicalJson(Object.keys(record).sort())
        !== canonicalJson(["actionDigest", "providerResult", "readback", "receipt"])
      || record.receipt?.replayKey !== replayKey
      || record.receipt?.actionDigest !== record.actionDigest
    ) throw new Error("EFFECT_STORE_INVALID_DENIED");
    const { receiptDigest, ...core } = record.receipt;
    if (
      !/^[a-f0-9]{64}$/.test(receiptDigest ?? "")
      || sha256(canonicalJson(core)) !== receiptDigest
    ) throw new Error("EFFECT_STORE_INVALID_DENIED");
  }
  if (isV2) {
    for (const [replayKey, record] of Object.entries(value.reservations)) {
      if (
        record === null
        || typeof record !== "object"
        || Array.isArray(record)
        || canonicalJson(Object.keys(record).sort()) !== canonicalJson([
          "actionDigest", "leaseId", "reservedAtMs", "status",
        ])
        || !["EXECUTING", "APPLIED", "AMBIGUOUS"].includes(record.status)
        || !/^[a-f0-9]{64}$/.test(record.actionDigest ?? "")
        || !/^[a-f0-9]{64}$/.test(record.leaseId ?? "")
        || !Number.isSafeInteger(record.reservedAtMs)
        || value.consumedAuthorityLeases[record.leaseId]?.replayKey !== replayKey
        || (record.status === "APPLIED") !== (value.effects[replayKey] !== undefined)
      ) throw new Error("EFFECT_STORE_INVALID_DENIED");
    }
    for (const [leaseId, record] of Object.entries(value.consumedAuthorityLeases)) {
      if (
        record === null
        || typeof record !== "object"
        || Array.isArray(record)
        || canonicalJson(Object.keys(record).sort()) !== canonicalJson([
          "actionDigest", "replayKey", "reservedAtMs",
        ])
        || !/^[a-f0-9]{64}$/.test(leaseId)
        || !/^[a-f0-9]{64}$/.test(record.actionDigest ?? "")
        || !Number.isSafeInteger(record.reservedAtMs)
      ) throw new Error("EFFECT_STORE_INVALID_DENIED");
    }
  }
  return {
    schemaVersion: "chimpmaera.demo/effect-store/v2",
    effects: value.effects,
    reservations: isV2 ? value.reservations : {},
    consumedAuthorityLeases: isV2 ? value.consumedAuthorityLeases : {},
  };
}

export class DemoMutationGate {
  constructor({
    apiToken,
    controlToken,
    expectedOrigin,
    receiptPath,
    provider,
    adminAiPolicyId = "admin-ai-poc-policy-v1",
    adminAiPolicyDigest,
    assertPolicyUse = () => true,
    ownerAuthorityToken = controlToken,
    now = () => Date.now(),
    authorityContext = {
      profileId: "SAFE_GUIDED",
      profileGeneration: randomUUID(),
      policyGeneration: 1,
    },
  }) {
    if (
      apiToken.length < 32
      || controlToken.length < 32
      || ownerAuthorityToken.length < 32
    ) {
      throw new Error("GATE_SECRET_INVALID");
    }
    this.apiToken = apiToken;
    this.controlToken = controlToken;
    this.ownerAuthorityToken = ownerAuthorityToken;
    this.expectedOrigin = expectedOrigin;
    this.receiptPath = receiptPath;
    this.provider = provider;
    this.adminAiPolicyDigest = adminAiPolicyDigest;
    if (
      typeof now !== "function"
      || authorityContext?.profileId !== "SAFE_GUIDED"
      || typeof authorityContext.profileGeneration !== "string"
      || authorityContext.profileGeneration.length < 8
      || !Number.isSafeInteger(authorityContext.policyGeneration)
      || authorityContext.policyGeneration < 1
      || adminAiPolicyId !== "admin-ai-poc-policy-v1"
      || (adminAiPolicyDigest !== undefined
        && !/^[a-f0-9]{64}$/.test(adminAiPolicyDigest))
      || typeof assertPolicyUse !== "function"
    ) throw new Error("AUTHORITY_CONTEXT_INVALID_DENIED");
    this.now = now;
    this.authorityContext = { ...authorityContext };
    this.adminAiPolicyId = adminAiPolicyId;
    this.assertPolicyUse = assertPolicyUse;
    this.state = {
      schemaVersion: "chimpmaera.demo/effect-store/v2",
      effects: {},
      reservations: {},
      consumedAuthorityLeases: {},
    };
    try {
      this.state = normalizeEffectStore(JSON.parse(readFileSync(receiptPath, "utf8")));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  authorize(request) {
    authorizeLocalRequest(request, {
      apiToken: this.apiToken,
      expectedOrigin: this.expectedOrigin,
    });
  }

  approvalBinding(actionDigest, action) {
    const scopeDigest = sha256(canonicalJson(action.scope));
    return createHmac("sha256", this.controlToken)
      .update(`${actionDigest}\n${action.actor}\n${scopeDigest}\n${action.replayKey}`)
      .digest("hex");
  }

  agentAuthority(fields) {
    const core = {
      kind: "ADMIN_AI_POC_HMAC_V1",
      actor: fields.actor,
      scope: fields.scope,
      actionDigest: fields.actionDigest,
      replayKey: fields.replayKey,
      policyId: fields.policyId,
      policyGeneration: fields.policyGeneration,
      policyDigest: fields.policyDigest,
      decisionDigest: fields.decisionDigest,
    };
    return {
      ...core,
      binding: createHmac("sha256", this.controlToken)
        .update(`admin-ai-poc-authority-v1\n${canonicalJson(core)}`)
        .digest("hex"),
    };
  }

  validateAgentAuthority(authority, action, computedDigest) {
    if (
      authority === null
      || typeof authority !== "object"
      || Array.isArray(authority)
      || JSON.stringify(Object.keys(authority).sort()) !== JSON.stringify([
        "actionDigest",
        "actor",
        "binding",
        "decisionDigest",
        "kind",
        "policyDigest",
        "policyGeneration",
        "policyId",
        "replayKey",
        "scope",
      ])
      || authority.kind !== "ADMIN_AI_POC_HMAC_V1"
      || typeof authority.actor !== "string"
      || typeof authority.actionDigest !== "string"
      || typeof authority.replayKey !== "string"
      || authority.policyId !== this.adminAiPolicyId
      || authority.policyGeneration !== this.authorityContext.policyGeneration
      || typeof authority.policyDigest !== "string"
      || typeof authority.decisionDigest !== "string"
      || typeof authority.binding !== "string"
      || authority.scope === null
      || typeof authority.scope !== "object"
      || Array.isArray(authority.scope)
      || !/^[a-f0-9]{64}$/.test(authority.actionDigest)
      || !/^[a-f0-9]{64}$/.test(authority.decisionDigest ?? "")
      || !/^[a-f0-9]{64}$/.test(authority.policyDigest ?? "")
      || !/^[a-f0-9]{64}$/.test(authority.binding)
      || !equalSecret(authority.policyDigest, this.adminAiPolicyDigest ?? "")
      || !equalSecret(authority.actor, action.actor)
      || canonicalJson(authority.scope) !== canonicalJson(action.scope)
      || !equalSecret(authority.actionDigest, computedDigest)
      || !equalSecret(authority.replayKey, action.replayKey)
    ) throw new Error("AGENT_AUTHORITY_INVALID_DENIED");
    const expected = this.agentAuthority({
      actor: action.actor,
      scope: action.scope,
      actionDigest: computedDigest,
      replayKey: action.replayKey,
      policyId: authority.policyId,
      policyGeneration: authority.policyGeneration,
      policyDigest: authority.policyDigest,
      decisionDigest: authority.decisionDigest,
    });
    if (!equalSecret(authority.binding, expected.binding)) {
      throw new Error("AGENT_AUTHORITY_INVALID_DENIED");
    }
  }

  ownerAuthority({
    proposal,
    ownerDecisionReceiptDigest,
    issuedAtMs,
    expiresAtMs,
  }) {
    const { proposalDigest, ...boundProposalCore } = proposal ?? {};
    let snapshotValid = false;
    try {
      validateAuthoritativeApprovalSnapshot(proposal?.snapshot, proposal?.action);
      snapshotValid = true;
    } catch {
      snapshotValid = false;
    }
    if (
      proposal?.outcome !== "OWNER_ESCALATION"
      || proposal.profileId !== this.authorityContext.profileId
      || proposal.profileGeneration !== this.authorityContext.profileGeneration
      || proposal.policyId !== this.adminAiPolicyId
      || proposal.policyGeneration !== this.authorityContext.policyGeneration
      || proposal.policyDigest !== this.adminAiPolicyDigest
      || sha256(canonicalJson(proposal.action)) !== proposal.actionDigest
      || sha256(canonicalJson(proposal.businessDiff)) !== proposal.businessDiffDigest
      || !snapshotValid
      || proposal.snapshotDigest !== proposal.snapshot.snapshotDigest
      || proposal.snapshotVersion !== proposal.snapshot.version
      || proposal.requester !== APPROVAL_REQUESTER
      || proposal.purpose !== APPROVAL_PURPOSE
      || !/^[a-f0-9]{64}$/.test(proposal.decisionDigest ?? "")
      || !/^[a-f0-9]{64}$/.test(proposal.proposalDigest ?? "")
      || sha256(canonicalJson(boundProposalCore)) !== proposalDigest
      || !/^[a-f0-9]{64}$/.test(ownerDecisionReceiptDigest ?? "")
      || !Number.isSafeInteger(issuedAtMs)
      || !Number.isSafeInteger(expiresAtMs)
      || expiresAtMs <= issuedAtMs
      || expiresAtMs - issuedAtMs > 300_000
    ) throw new Error("OWNER_AUTHORITY_INPUT_INVALID_DENIED");
    validateAdminAiAction(proposal.action, "OWNER_ESCALATION_LEASE_HMAC_V1");
    const unsigned = {
      kind: "OWNER_ESCALATION_LEASE_HMAC_V1",
      actor: proposal.actor,
      scope: proposal.action.scope,
      actionDigest: proposal.actionDigest,
      businessDiffDigest: proposal.businessDiffDigest,
      snapshotDigest: proposal.snapshotDigest,
      snapshotVersion: proposal.snapshotVersion,
      requester: proposal.requester,
      purpose: proposal.purpose,
      replayKey: proposal.replayKey,
      policyId: proposal.policyId,
      policyDigest: proposal.policyDigest,
      policyGeneration: proposal.policyGeneration,
      decisionDigest: proposal.decisionDigest,
      proposalDigest: proposal.proposalDigest,
      ownerDecisionReceiptDigest,
      approver: "owner:local-demo",
      profileId: proposal.profileId,
      profileGeneration: proposal.profileGeneration,
      issuedAtMs,
      notBeforeMs: issuedAtMs,
      expiresAtMs,
      maxUses: 1,
    };
    const leaseId = createHmac("sha256", this.ownerAuthorityToken)
      .update(`owner-escalation-lease-id-v1\n${canonicalJson(unsigned)}`)
      .digest("hex");
    const core = { ...unsigned, leaseId };
    return {
      ...core,
      binding: createHmac("sha256", this.ownerAuthorityToken)
        .update(`owner-escalation-authority-v1\n${canonicalJson(core)}`)
        .digest("hex"),
    };
  }

  validateOwnerAuthority(
    authority,
    action,
    computedDigest,
    businessDiff,
    businessDiffDigest,
  ) {
    const expectedKeys = [
      "actionDigest", "actor", "approver", "binding", "businessDiffDigest",
      "decisionDigest", "expiresAtMs", "issuedAtMs", "kind", "leaseId",
      "maxUses", "notBeforeMs", "ownerDecisionReceiptDigest", "policyDigest",
      "policyGeneration", "policyId", "profileGeneration", "profileId", "proposalDigest",
      "purpose", "replayKey", "requester", "scope", "snapshotDigest",
      "snapshotVersion",
    ];
    if (
      authority === null
      || typeof authority !== "object"
      || Array.isArray(authority)
      || canonicalJson(Object.keys(authority).sort())
        !== canonicalJson(expectedKeys.sort())
      || authority.kind !== "OWNER_ESCALATION_LEASE_HMAC_V1"
      || authority.approver !== "owner:local-demo"
      || authority.maxUses !== 1
      || authority.profileId !== this.authorityContext.profileId
      || authority.profileGeneration !== this.authorityContext.profileGeneration
      || authority.policyId !== this.adminAiPolicyId
      || authority.policyGeneration !== this.authorityContext.policyGeneration
      || !equalSecret(authority.policyDigest, this.adminAiPolicyDigest ?? "")
      || !equalSecret(authority.actor, action.actor)
      || canonicalJson(authority.scope) !== canonicalJson(action.scope)
      || !equalSecret(authority.actionDigest, computedDigest)
      || !equalSecret(authority.businessDiffDigest, businessDiffDigest)
      || sha256(canonicalJson(businessDiff)) !== businessDiffDigest
      || authority.requester !== APPROVAL_REQUESTER
      || authority.purpose !== APPROVAL_PURPOSE
      || !/^[a-f0-9]{64}$/.test(authority.snapshotDigest ?? "")
      || !/^[a-f0-9]{64}$/.test(authority.snapshotVersion ?? "")
      || !equalSecret(authority.replayKey, action.replayKey)
      || !/^[a-f0-9]{64}$/.test(authority.decisionDigest ?? "")
      || !/^[a-f0-9]{64}$/.test(authority.proposalDigest ?? "")
      || !/^[a-f0-9]{64}$/.test(authority.ownerDecisionReceiptDigest ?? "")
      || !/^[a-f0-9]{64}$/.test(authority.leaseId ?? "")
      || !/^[a-f0-9]{64}$/.test(authority.binding ?? "")
      || !Number.isSafeInteger(authority.issuedAtMs)
      || !Number.isSafeInteger(authority.notBeforeMs)
      || !Number.isSafeInteger(authority.expiresAtMs)
      || authority.notBeforeMs !== authority.issuedAtMs
      || authority.expiresAtMs <= authority.notBeforeMs
      || authority.expiresAtMs - authority.issuedAtMs > 300_000
    ) throw new Error("OWNER_AUTHORITY_INVALID_DENIED");
    const { binding, ...core } = authority;
    const expectedBinding = createHmac("sha256", this.ownerAuthorityToken)
      .update(`owner-escalation-authority-v1\n${canonicalJson(core)}`)
      .digest("hex");
    if (!equalSecret(binding, expectedBinding)) {
      throw new Error("OWNER_AUTHORITY_INVALID_DENIED");
    }
    const now = this.now();
    if (!Number.isSafeInteger(now)) throw new Error("AUTHORITY_CLOCK_INVALID_DENIED");
    if (now < authority.notBeforeMs) throw new Error("AUTHORITY_NOT_YET_VALID_DENIED");
    if (now >= authority.expiresAtMs) throw new Error("AUTHORITY_EXPIRED_DENIED");
    return now;
  }

  authorizeOwnerLeaseReservation({
    authority,
    action,
    computedDigest,
    businessDiff,
    businessDiffDigest,
  }) {
    // This is the local authorization/reservation point. It must remain after
    // the final authoritative snapshot await and before durable reservation.
    const reservedAtMs = this.validateOwnerAuthority(
      authority,
      action,
      computedDigest,
      businessDiff,
      businessDiffDigest,
    );
    this.assertPolicyUse({
      tenant: action.scope.tenant,
      policyId: authority.policyId,
      policyGeneration: authority.policyGeneration,
      policySourceDigest: authority.policyDigest,
    });
    if (this.state.consumedAuthorityLeases[authority.leaseId] !== undefined) {
      throw new Error("AUTHORITY_LEASE_REPLAY_DENIED");
    }
    if (
      this.state.effects[action.replayKey] !== undefined
      || this.state.reservations[action.replayKey] !== undefined
    ) throw new Error("EFFECT_REPLAY_OR_AMBIGUOUS_DENIED");
    const consumed = {
      actionDigest: computedDigest,
      replayKey: action.replayKey,
      reservedAtMs,
    };
    this.state.consumedAuthorityLeases[authority.leaseId] = consumed;
    this.state.reservations[action.replayKey] = {
      actionDigest: computedDigest,
      leaseId: authority.leaseId,
      reservedAtMs,
      status: "EXECUTING",
    };
    this.persist();
  }

  persist() {
    mkdirSync(dirname(this.receiptPath), { recursive: true });
    const temp = `${this.receiptPath}.tmp`;
    writeFileSync(temp, `${JSON.stringify(this.state, null, 2)}\n`, {
      mode: 0o600,
    });
    renameSync(temp, this.receiptPath);
  }

  async execute(request, envelope) {
    this.authorize(request);
    const {
      action,
      actionDigest,
      approval,
      authority,
      businessDiff,
      businessDiffDigest,
    } = envelope ?? {};
    if (
      authority?.kind === "OWNER_ESCALATION_LEASE_HMAC_V1"
      && canonicalJson(Object.keys(envelope).sort()) !== canonicalJson([
        "action",
        "actionDigest",
        "authority",
        "businessDiff",
        "businessDiffDigest",
      ])
    ) throw new Error("OWNER_EFFECT_ENVELOPE_INVALID_DENIED");
    validateActionShape(action);
    if (action.scope.actor !== action.actor) {
      throw new Error("IDENTITY_MISMATCH_DENIED");
    }
    validateMutationScope(action);
    const computedDigest = sha256(canonicalJson(action));
    if (!equalSecret(actionDigest, computedDigest)) {
      throw new Error("ACTION_DIGEST_MISMATCH_DENIED");
    }
    if (action.actor === "agent:admin-ai-poc") {
      if (authority?.kind === "OWNER_ESCALATION_LEASE_HMAC_V1") {
        validateAdminAiAction(action, authority.kind);
        this.validateOwnerAuthority(
          authority,
          action,
          computedDigest,
          businessDiff,
          businessDiffDigest,
        );
      } else {
        validateAdminAiAction(action, "ADMIN_AI_POC_HMAC_V1");
        this.validateAgentAuthority(authority, action, computedDigest);
      }
    } else if (
      approval?.decision !== "APPROVE"
      || approval?.approver !== "owner:local-demo"
      || !equalSecret(approval?.actionDigest, computedDigest)
      || !equalSecret(
        approval?.binding,
        this.approvalBinding(computedDigest, action),
      )
    ) throw new Error("APPROVAL_BINDING_INVALID_DENIED");

    if (action.actor === "agent:admin-ai-poc") {
      this.assertPolicyUse({
        tenant: action.scope.tenant,
        policyId: authority.policyId,
        policyGeneration: authority.policyGeneration,
        policySourceDigest: authority.policyDigest,
      });
    }

    const ownerLease = authority?.kind === "OWNER_ESCALATION_LEASE_HMAC_V1";
    if (ownerLease) {
      if (this.state.consumedAuthorityLeases[authority.leaseId] !== undefined) {
        throw new Error("AUTHORITY_LEASE_REPLAY_DENIED");
      }
      if (
        this.state.effects[action.replayKey] !== undefined
        || this.state.reservations[action.replayKey] !== undefined
      ) throw new Error("EFFECT_REPLAY_OR_AMBIGUOUS_DENIED");
      if (typeof this.provider.readAuthoritativeSnapshot !== "function") {
        throw new Error("APPROVAL_SNAPSHOT_UNAVAILABLE_DENIED");
      }
      const currentSnapshot = validateAuthoritativeApprovalSnapshot(
        await this.provider.readAuthoritativeSnapshot(action),
        action,
      );
      if (
        currentSnapshot.snapshotDigest !== authority.snapshotDigest
        || currentSnapshot.version !== authority.snapshotVersion
      ) throw new Error("APPROVAL_SNAPSHOT_STALE_DENIED");
      this.authorizeOwnerLeaseReservation({
        authority,
        action,
        computedDigest,
        businessDiff,
        businessDiffDigest,
      });
    }

    const prior = this.state.effects[action.replayKey];
    if (prior !== undefined) {
      if (prior.actionDigest !== computedDigest) {
        throw new Error("REPLAY_KEY_CONFLICT_DENIED");
      }
      if (
        action.actor === "agent:admin-ai-poc"
        && (
          !equalSecret(prior.receipt.decisionDigest, authority.decisionDigest)
          || prior.receipt.policyId !== authority.policyId
          || prior.receipt.policyGeneration !== authority.policyGeneration
          || !equalSecret(prior.receipt.policyDigest, authority.policyDigest)
        )
      ) throw new Error("REPLAY_AUTHORITY_CONFLICT_DENIED");
      return {
        status: "PASS",
        replayed: true,
        replayState: "REPLAY_NO_DUPLICATE",
        providerResult: prior.providerResult,
        readback: prior.readback,
        receipt: prior.receipt,
      };
    }

    try {
      const providerResult = await this.provider.mutate(action);
      const readback = await this.provider.readback(action, providerResult);
      if (
        readback === null
        || typeof readback !== "object"
        || Array.isArray(readback)
      ) throw new Error("PROVIDER_READBACK_REQUIRED");
      validateSemanticReadback(action, readback);
      const core = receiptCore(
        action,
        computedDigest,
        providerResult,
        readback,
        action.actor === "agent:admin-ai-poc" ? authority : undefined,
      );
      const receipt = {
        ...core,
        receiptDigest: sha256(canonicalJson(core)),
      };
      this.state.effects[action.replayKey] = {
        actionDigest: computedDigest,
        providerResult,
        readback,
        receipt,
      };
      if (ownerLease) {
        this.state.reservations[action.replayKey].status = "APPLIED";
      }
      this.persist();
      return {
        status: "PASS",
        replayed: false,
        providerResult,
        readback,
        receipt,
      };
    } catch (error) {
      if (ownerLease) {
        this.state.reservations[action.replayKey].status = "AMBIGUOUS";
        this.persist();
      }
      throw error;
    }
  }
}

export function createHttpProvider({
  espoPassword,
  doliApiKey,
  fetchImpl = fetch,
}) {
  const base = {
    espocrm: "http://espocrm/api/v1",
    dolibarr: "http://dolibarr/api/index.php",
  };
  const headersFor = (provider, json = false) => ({
    ...(provider === "espocrm"
      ? {
        authorization:
          `Basic ${Buffer.from(`admin:${espoPassword}`).toString("base64")}`,
      }
      : { DOLAPIKEY: doliApiKey }),
    ...(json ? { "content-type": "application/json" } : {}),
  });
  const call = async (provider, path, options = {}) => {
    const response = await fetchImpl(`${base[provider]}${path}`, options);
    const text = await response.text();
    if (!response.ok) throw new Error(`PROVIDER_${response.status}_DENIED`);
    try {
      return JSON.parse(text);
    } catch {
      return text.trim();
    }
  };
  return {
    async read(provider, path, query = {}) {
      if (
        !["espocrm", "dolibarr"].includes(provider)
        || typeof path !== "string"
        || !/^\/[A-Za-z0-9/_-]+$/.test(path)
      ) throw new Error("PROVIDER_READ_SCOPE_DENIED");
      const url = new URL(`${base[provider]}${path}`);
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.append(key, String(value));
      }
      const response = await fetchImpl(url, {
        headers: headersFor(provider),
      });
      const text = await response.text();
      if (response.status === 404 && provider === "dolibarr") return [];
      if (!response.ok) throw new Error(`PROVIDER_${response.status}_DENIED`);
      return JSON.parse(text);
    },
    async readAuthoritativeSnapshot(action) {
      const rows = await this.read("dolibarr", "/orders", {
        // Read one sentinel beyond the closed snapshot limit so a hidden third
        // match fails snapshot construction instead of being called complete.
        limit: "3",
        sqlfilters: "(t.ref_client:=:'CM-ADMIN-AI-ESCALATION-001')",
      });
      if (!Array.isArray(rows)) {
        throw new Error("APPROVAL_SNAPSHOT_SOURCE_INVALID_DENIED");
      }
      return createAuthoritativeApprovalSnapshot(
        action,
        rows.map((row) => ({
          id: Number(row?.id),
          ref_client: row?.ref_client,
          socid: Number(row?.socid),
          date: Number(row?.date),
        })),
      );
    },
    async mutate(action) {
      return call(action.scope.provider, action.payload.path, {
        method: "POST",
        headers: headersFor(action.scope.provider, true),
        body: JSON.stringify(action.payload.body),
      });
    },
    async readback(action, result) {
      const id = typeof result === "object" && result !== null
        ? result.id
        : result;
      if (action.scope.provider === "espocrm") {
        return call("espocrm", `${action.payload.path}/${id}`, {
          headers: headersFor("espocrm"),
        });
      }
      if (action.scope.entity === "OrderLine") {
        const orderPath = action.payload.path.replace(/\/lines$/, "");
        const order = await call("dolibarr", orderPath, {
          headers: headersFor("dolibarr"),
        });
        const matching = (order.lines ?? []).filter((line) =>
          line.desc === action.payload.body.desc
        );
        if (matching.length !== 1) throw new Error("PROVIDER_READBACK_REQUIRED");
        return { ...matching[0], parentOrderId: order.id };
      }
      return call("dolibarr", `${action.payload.path}/${id}`, {
        headers: headersFor("dolibarr"),
      });
    },
  };
}
