# PAN441 bounded read-only employee-agent profile

PAN441 is a local synthetic proof of a reusable employee business-help profile. It is not a provider connector, identity-provider integration, production authorization, or universal compatibility claim.

## Journey

An authenticated synthetic employee asks the assistant for their own directory display name, department, job title, or employee alias. The request carries the requesting user identity, tenant, fixed profile identity and generation, selected capability identity/version, and requested projection fields. The implementation returns only the requested allowed fields from the local immutable fixture.

The profile does not read another employee, infer missing identity or permission, read critical identity fields, activate catalogue actions, install or activate a skill, write, export, publish, or use credentials. The selected governed skill is `skill:employee-business-help@1.0.0`; its admitted local package digest is independently pinned in the profile. The selected inactive catalogue capability is `employee.directory.read_own@1.0.0` on `employee.directory.own`, and the profile binds the catalogue action digest rather than treating action names alone as authority.

## Reuse map

| Foundation | PAN441 use | Classification |
| --- | --- | --- |
| `builder-authority.ts` | SAFE_GUIDED intersection; own read is AUTO_EXECUTE and the write right is outside assignment/constraint | REUSE |
| `effective-rights.ts` | Four-way profile/assignment/capability/constraint intersection, extended with the employee read vocabulary | EXTEND |
| `capability-catalogue.ts` | Independently verifies the released inactive catalogue, resolves `employee.directory.read_own@1.0.0`, and asserts no activation/execution authority | EXTEND |
| `integration-profile.ts` | Verifies the pinned POWER_APPS_READ_ONLY synthetic profile and rejects drift/write actions | REUSE |
| `skill-admission.ts` | Validates the bound `skill:employee-business-help@1.0.0` package bytes and SAFE_GUIDED admission; activation remains false | REUSE |
| `skill-bundle.ts` | No new bundle or runtime is introduced; the existing governed-skill boundary remains the lifecycle authority | MAP |

No second agent framework, provider/runtime change, live identity-provider change, public write, GPU, or credential is introduced.

## Replacement and gates

The trusted narrow replacement is pinned and read back as a profile with `allowedFields: ["displayName"]`; it permits that own-field read, denies `department`, and rejects a genuinely rehashed widening. The replacement is not accepted from an arbitrary caller or activated at runtime.

Focused proof: `npm run pan441:test`. The canonical `npm test` command includes `dist/tests/pan441-employee-profile.test.js` exactly once. Canonical compilation/lint gate: `npm run build` and `npm run lint`. The focused tests exercise real authorization for own-scope allow, other-user denial, missing identity/permission denial, unavailable capability denial, write denial, critical identity denial, profile replacement denial, skill tamper denial, and integration-profile drift denial.

## Evidence boundary

The proof is local synthetic fixture evidence only. It proves deterministic contract behavior and fail-closed authorization composition. It does not prove a live provider, enterprise IAM, customer permissions, network boundary, runtime deployment, or production data qualification. Parent `#431` owns independent review, merge, release, public delivery, and public readback.
