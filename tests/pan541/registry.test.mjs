import test from "node:test";
import assert from "node:assert/strict";

let module;
try { module = await import("../../dist/packages/browser-shell/src/registry-v1.js"); }
catch (error) { if (error.code !== "ERR_MODULE_NOT_FOUND") throw error; }
const descriptor = (id, factoryId) => ({
  schemaVersion: "pansphaira.browser-plugin/v1", id, version: "1.0.0", shellVersion: "1.0.0", enabled: true,
  trustBoundary: "TRUSTED_IN_PROCESS_CODE_OWNED_FACTORIES",
  contributions: [
    { id: id + ".route", kind: "ROUTE", slot: "shell.routes", routeId: id + ".route", path: "/workspace/" + id.split(".")[1], factoryId: null, label: "Fachmodul" },
    { id: id + ".view", kind: "VIEW", slot: "shell.main", routeId: id + ".route", path: null, factoryId, label: "Arbeitsplatz" },
  ], needs: { data: [], context: ["tenantId", "sessionId"], rights: [], dependencies: [] },
});

test("PUI-01-AC02/05 additive closed registry retires its own render lifetime and contains a throwing owned renderer", async () => {
  assert.equal(typeof module?.createBrowserShellRegistryV1, "function", "PAN541_OWNED_SLOT_REGISTRY_NOT_IMPLEMENTED");
  let disposed = 0; let signal; const faults = [];
  const registry = module.createBrowserShellRegistryV1({ factories: new Map([
    ["setup.view", { kind: "VIEW", render(frame) { signal = frame.signal; return () => { disposed++; }; } }],
    ["erv.view", { kind: "VIEW", render() { throw new Error("synthetic renderer failure"); } }],
  ]), reportFault: fault => faults.push(fault) });
  assert.equal(registry.register(descriptor("pan.setup", "setup.view")).outcome, "REGISTERED");
  assert.equal(registry.register(descriptor("pan.erv", "erv.view")).outcome, "REGISTERED");
  assert.equal((await registry.render("pan.setup.view", Object.freeze({}))).outcome, "RENDERED");
  assert.equal((await registry.render("pan.erv.view", Object.freeze({}))).outcome, "RENDER_FAILED");
  assert.equal(signal.aborted, true); assert.equal(disposed, 1);
  assert.deepEqual(registry.routes().map(x => x.routeId), ["pan.setup.route", "pan.erv.route"]);
  assert.equal(faults.at(-1).outcome, "RENDER_FAILED");
  assert.equal(registry.register(descriptor("pan.setup", "setup.view")).outcome, "DENIED");
  assert.equal(registry.unregister("pan.setup"), true);
  assert.deepEqual(registry.routes().map(x => x.routeId), ["pan.erv.route"]);
  registry.close(); registry.close();
  assert.throws(() => registry.register(descriptor("pan.setup", "setup.view")), /SHELL_REGISTRY_CLOSED/);
});

test("PUI-01-AC05 disabled/missing exact dependencies and factory-kind mismatch stay visible without invoking code", async () => {
  assert.equal(typeof module?.createBrowserShellRegistryV1, "function");
  let invocations = 0;
  const registry = module.createBrowserShellRegistryV1({ factories: new Map([
    ["setup.view", { kind: "VIEW", render() { invocations++; } }],
    ["wrong.panel", { kind: "PANEL", render() { invocations++; } }],
  ]), reportFault() {} });
  const disabled = descriptor("pan.disabled", "setup.view"); disabled.enabled = false;
  assert.equal(registry.register(disabled).outcome, "DISABLED");
  assert.equal((await registry.render("pan.disabled.view", {})).outcome, "DISABLED");
  const dependent = descriptor("pan.dependent", "setup.view"); dependent.needs.dependencies = [{ id: "pan.base", version: "1.0.0" }];
  assert.equal(registry.register(dependent).outcome, "MISSING_DEPENDENCY");
  assert.equal((await registry.render("pan.dependent.view", {})).outcome, "MISSING_DEPENDENCY");
  const wrong = descriptor("pan.wrong", "wrong.panel");
  assert.equal(registry.register(wrong).outcome, "DENIED");
  const base = descriptor("pan.base", "setup.view"); base.version = "2.0.0";
  assert.equal(registry.register(base).outcome, "REGISTERED");
  assert.equal(registry.status("pan.dependent").outcome, "MISSING_DEPENDENCY");
  registry.unregister("pan.base"); base.version = "1.0.0"; registry.register(base);
  assert.equal(registry.status("pan.dependent").outcome, "REGISTERED");
  assert.equal((await registry.render("pan.dependent.view", {})).outcome, "RENDERED");
  assert.equal(invocations, 1);
  const a = descriptor("pan.cyclea", "setup.view"), b = descriptor("pan.cycleb", "setup.view");
  a.needs.dependencies = [{ id: b.id, version: b.version }]; b.needs.dependencies = [{ id: a.id, version: a.version }];
  registry.register(a); registry.register(b);
  assert.equal(registry.status(a.id).outcome, "MISSING_DEPENDENCY");
  assert.equal(registry.status(b.id).outcome, "MISSING_DEPENDENCY");
  assert.equal(registry.routes().find(x => x.pluginId === disabled.id).state, "DISABLED");
  registry.close();
});

test("PUI-01-AC04 stale rejected render after module change is discarded instead of surfacing an old-session fault", async () => {
  let rejectOld; let disposed = 0; const faults = [];
  const registry = module.createBrowserShellRegistryV1({ factories: new Map([
    ["setup.view", { kind: "VIEW", render() { return new Promise((resolve, reject) => { rejectOld = reject; }); } }],
    ["erv.view", { kind: "VIEW", render() { return () => { disposed++; }; } }],
  ]), reportFault: fault => faults.push(fault) });
  registry.register(descriptor("pan.setup", "setup.view")); registry.register(descriptor("pan.erv", "erv.view"));
  const old = registry.render("pan.setup.view", {});
  assert.equal((await registry.render("pan.erv.view", {})).outcome, "RENDERED");
  rejectOld(new Error("old backend request failed after context retirement"));
  assert.equal((await old).outcome, "STALE_RENDER");
  assert.deepEqual(faults, []);
  registry.close(); assert.equal(disposed, 1);
});

// Producer-only regression for the existing PAN549 -> KS303 v39 composition.
// This is not the unchanged KS consumer's functional or original13AC acceptance.
test("PAN549 composition: original locked app leaves the pinned5486-byte addon inside131072", async () => {
  const {readFileSync} = await import("node:fs");
  const app = readFileSync("dist/browser-workspace/app.js");
  assert.ok(app.length + 5486 <= 131072, "PAN549_ORIGINAL_COMPOSITION_BOUND_EXCEEDED:" + app.length);
});

test("PAN549 composition: the shared tuple is exact immutable existing string data, not executable decoding", async () => {
  const {browserWorkspaceStringValuesV1: values} = await import("../../dist/packages/contracts/src/browser-shell-plugin-v1.js");
  const {createHash} = await import("node:crypto");
  assert.equal(values.length, 236);
  assert.ok(values.every(value => typeof value === "string"));
  assert.equal(new Set(values).size, values.length);
  assert.equal(createHash("sha256").update(JSON.stringify(values)).digest("hex"), "a972f1fb4c57e285649fcc2d56e82ddf1b3284684ae2c7470ded5f7315213749");
  assert.ok(Object.isFrozen(values));
  const original = values[0];
  assert.throws(() => { values[0] = "MUTATED_AUTHORITY"; }, TypeError);
  assert.throws(() => { values.push("EXTRA_CAPABILITY"); }, TypeError);
  assert.equal(values[0], original);
  assert.equal(values[values.length], undefined);
});

test("PAN549 composition: shared constants add no evaluator or mutable value loader", async () => {
  const {readFileSync} = await import("node:fs");
  const ts = (await import("typescript")).default;
  const source = ts.createSourceFile("tuple.ts", readFileSync("packages/contracts/src/browser-shell-plugin-v1.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const statements = source.statements.filter(statement => ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => declaration.name.getText(source) === "browserWorkspaceStringValuesV1"));
  assert.equal(statements.length, 1);
  const statement = statements[0];
  assert.ok(ts.isVariableStatement(statement));
  assert.ok(statement.declarationList.flags & ts.NodeFlags.Const);
  const init = statement.declarationList.declarations[0].initializer;
  assert.ok(ts.isCallExpression(init));
  assert.equal(init.expression.getText(source), "Object.freeze");
  assert.equal(init.arguments.length, 1);
  const argument = init.arguments[0];
  assert.ok(ts.isAsExpression(argument));
  assert.equal(argument.type.getText(source), "const");
  assert.ok(ts.isArrayLiteralExpression(argument.expression));
  assert.equal(argument.expression.elements.length, 236);
  assert.ok(argument.expression.elements.every(ts.isStringLiteral));
});
