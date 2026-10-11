## Result

What changes and why? Link an existing issue if applicable; small fixes need no preliminary issue.

## Relevant evidence

List the focused checks that matter for this change. L0/L1 changes need only relevant checks; changed L2/L3 surfaces need applicable negative/security checks. Routine validation runs in CI.

## Security relevance

State any change to authority, effects, network access, credentials, data handling, schemas, cleanup or recovery. Write `None` when not applicable. Report vulnerability details privately through `SECURITY.md`.

## Checklist

- [ ] The change is focused; a draft or safe partial contribution is acceptable.
- [ ] I stated the result and checks honestly; compatibility changes are explained if applicable.
- [ ] I added no credentials, personal data, private prompts, local paths or non-public artifacts.
- [ ] Fork PRs require no production credentials.
- [ ] I preserved fail-closed authority and evidence boundaries, or explained every deliberate change.

## Conditional UI evidence (UI-QUALITY-01)

- [ ] UI applicability: changed UI behavior, or N/A with a concrete reason. A UI change cannot be exempted as documentation-only.
- [ ] I stated task/input/consequence, exact provider/consumer contract, persistence target and permission/revision boundary; proposal, decision, authority and effect remain separate and proposal before/after is visible before approval.
- [ ] Browser → backend → persisted target readback is observed on the actual entry, with request/frontend binding and required reopened target; a separate API success is not browser PASS.
- [ ] Current tenant/session/scope/revision and directly affected denied, stale, expired and unknown outcomes preserve rights and do not blind-retry effects; shell/plugin cleanup remains scoped.
- [ ] Desktop/390 px real screenshots are actually inspected, with positive page/control bounds and affected long text, keyboard/focus, zoom and empty/loading/error/denied states. Necessary domain tables scroll locally.
- [ ] Evidence identifies exact commit/build, viewport, data/context revision and state, applicable design reference/version, material departures and actual sighting or scoped unchanged whole-image reuse; a concept image is not a responsive baseline.
- [ ] One representative journey plus direct negative/consumer cases use pinned tools and synthetic data; #537/#538 retain their bug ownership and NOT_RUN is not PASS. Existing exact-candidate CI, independent focused review, integrity, release and anonymous readback remain required.
