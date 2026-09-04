import { describe, expect, it } from "vitest";
import { assignSourceIds, compileIntake } from "../src/core/intake.js";
import { applyUserOwnedEdits, confirmCriterion, createEditOwnership, createManualCriterion, recordCriterionEdit, recordFindingEdit, recordScalarEdit } from "../src/core/edit-ownership.js";
import { buildReviewedBrief, planSourceUpdate, replaceSourceInput } from "../src/core/source-updates.js";
import { toJson, toMarkdown, toPortableBrief } from "../src/core/export.js";
import { validateProvenance } from "../src/core/validate.js";

function desk() {
  const inputs = assignSourceIds([
    { name: "request.txt", kind: "text", content: "Export receipts\nMust preserve reviewed context." },
    { name: "failure.log", kind: "log", content: "ERROR: export fails\npnpm test" }
  ]);
  const ownership = createEditOwnership();
  return { inputs, ownership, brief: buildReviewedBrief(inputs, ownership) };
}
function replace(state, id, content) {
  const input = state.inputs.find(input => input.id === id);
  return planSourceUpdate({ ...state, nextInputs: replaceSourceInput(state.inputs, id, { ...input, content }) });
}

describe("source update review", () => {
  it("retains IDs through replace and removal, and rejects ambiguous source IDs", () => {
    const state = desk();
    const plan = replace(state, "S01", "Updated request\nMust preserve filenames.");
    expect(plan.inputs.map(input => [input.id, input.revision])).toEqual([["S01", 2], ["S02", 1]]);
    expect(compileIntake([plan.inputs[1]]).sources[0].id).toBe("S02");
    expect(() => compileIntake([{ id: "S01", content: "a" }, { id: "S01", content: "b" }])).toThrow(/Duplicate/);
    expect(() => compileIntake([{ id: 'S01"', content: "a" }])).toThrow(/Source IDs/);
    expect(() => compileIntake([{ revision: 0, content: "a" }])).toThrow(/revision/);
  });

  it("does not change the accepted brief or input when making or discarding a preview", () => {
    const state = desk();
    const before = toJson(state.brief);
    const raw = JSON.stringify(state.inputs);
    const plan = replace(state, "S01", "New request\nMust support a dry run.");
    expect(plan.changes.length).toBeGreaterThan(0);
    expect(plan.sourceChanges[0]).toMatchObject({ id: "S01", kind: "replaced", fromRevision: 1, toRevision: 2 });
    expect(toJson(state.brief)).toBe(before);
    expect(JSON.stringify(state.inputs)).toBe(raw);
  });

  it("keeps title, objective, manual criteria, finding edits, and exclusions without silently rebinding them", () => {
    const state = desk();
    recordScalarEdit(state.ownership, "title", "My reviewed task");
    recordScalarEdit(state.ownership, "objective", "My objective");
    const criterion = state.brief.doneWhen.find(item => item.rule === "failure-removed");
    recordCriterionEdit(state.ownership, criterion, "text", "My exact acceptance");
    recordCriterionEdit(state.ownership, criterion, "included", false);
    const finding = state.brief.findings.find(item => item.category === "problem");
    recordFindingEdit(state.ownership, state.brief, finding, "My reviewed incident");
    const manual = createManualCriterion(state.ownership);
    recordCriterionEdit(state.ownership, manual, "text", "Manual check remains");
    state.brief = buildReviewedBrief(state.inputs, state.ownership);
    const plan = replace(state, "S02", "ERROR: a different failure\npnpm test -- changed");
    expect(plan.brief).toMatchObject({ title: "My reviewed task", objective: "My objective" });
    expect(plan.brief.doneWhen.find(item => item.text === "My exact acceptance")).toMatchObject({ included: false, reviewStatus: "needs-review", pointer: { sourceId: "S02", sourceRevision: 1 } });
    expect(plan.brief.findings.find(item => item.text === "My reviewed incident")).toMatchObject({ reviewStatus: "needs-review", pointer: { sourceRevision: 1 } });
    expect(plan.brief.findings.some(item => item.text.includes("different failure") && item.pointer.sourceRevision === 2)).toBe(true);
    expect(plan.brief.doneWhen.some(item => item.text === "Manual check remains")).toBe(true);
    expect(plan.brief.sourceHistory).toHaveLength(1);
    expect(plan.brief.sourceHistory[0]).toMatchObject({ id: "S02", revision: 1 });
    expect(validateProvenance(plan.brief)).toEqual([]);
  });

  it("retains edited findings and requirements when their entire source is removed", () => {
    const state = desk();
    const finding = state.brief.findings.find(item => item.pointer.sourceId === "S02");
    recordFindingEdit(state.ownership, state.brief, finding, "Keep this incident note");
    const criterion = state.brief.doneWhen.find(item => item.rule === "failure-removed");
    confirmCriterion(state.ownership, state.brief, criterion);
    const plan = planSourceUpdate({ ...state, nextInputs: [state.inputs[0]] });
    expect(plan.brief.findings.find(item => item.text === "Keep this incident note").reviewStatus).toBe("needs-review");
    expect(plan.brief.doneWhen.find(item => item.editKey)).toMatchObject({ confirmed: false, reviewStatus: "needs-review" });
    expect(plan.brief.sourceHistory[0].id).toBe("S02");
    expect(validateProvenance(plan.brief)).toEqual([]);
  });

  it("undo restores original export bytes when no later edit was made", () => {
    const state = desk();
    recordScalarEdit(state.ownership, "objective", "Keep my objective");
    state.brief = buildReviewedBrief(state.inputs, state.ownership);
    const before = toJson(state.brief);
    const plan = replace(state, "S01", "New title\nMust change the workflow.");
    const undo = planSourceUpdate({ inputs: plan.inputs, brief: plan.brief, ownership: state.ownership, nextInputs: state.inputs, allowRollback: true });
    expect(toJson(undo.brief)).toBe(before);
  });

  it("undo preserves edits made after acceptance, even if their source will disappear", () => {
    const state = desk();
    const plan = planSourceUpdate({ ...state, nextInputs: [...state.inputs, { id: "S03", revision: 1, name: "new.txt", kind: "text", content: "Must keep the new option." }] });
    recordScalarEdit(state.ownership, "title", "Edited after acceptance");
    const item = plan.brief.findings.find(item => item.pointer.sourceId === "S03");
    recordFindingEdit(state.ownership, plan.brief, item, "Later user wording");
    const undo = planSourceUpdate({ inputs: plan.inputs, brief: plan.brief, ownership: state.ownership, nextInputs: state.inputs, allowRollback: true });
    expect(undo.brief.title).toBe("Edited after acceptance");
    expect(undo.brief.findings.find(item => item.text === "Later user wording")).toMatchObject({ reviewStatus: "needs-review" });
    expect(undo.brief.sourceHistory.some(source => source.id === "S03")).toBe(true);
  });

  it("confirmation applies to one source revision; keeping a stale requirement becomes an explicit user decision", () => {
    const state = desk();
    const item = state.brief.doneWhen.find(item => item.rule === "requirement-satisfied");
    expect(item.confirmed).toBe(false);
    confirmCriterion(state.ownership, state.brief, item);
    state.brief = buildReviewedBrief(state.inputs, state.ownership);
    expect(toPortableBrief(state.brief).doneWhen.find(item => item.rule === "requirement-satisfied").confirmation).toBe("user-confirmed");
    const plan = replace(state, "S01", "New request\nMust use another format.");
    const retained = plan.brief.doneWhen.find(item => item.reviewStatus === "needs-review");
    expect(retained.confirmed).toBe(false);
    confirmCriterion(state.ownership, plan.brief, retained);
    const accepted = buildReviewedBrief(plan.inputs, state.ownership, plan.brief);
    const manual = accepted.doneWhen.find(item => item.editKey === retained.editKey);
    expect(manual).toMatchObject({ authorship: "user-authored", confirmed: true, pointer: { sourceId: "USER" }, previousPointer: { sourceId: "S01", sourceRevision: 1 } });
    expect(toMarkdown(accepted)).toContain("Previous reference");
  });

  it("exports mask preserved edits and historical metadata without raw bodies or unresolved revision pointers", () => {
    const state = desk();
    const finding = state.brief.findings.find(item => item.pointer.sourceId === "S02");
    const secret = ["synthetic", "secret", "value"].join("");
    recordFindingEdit(state.ownership, state.brief, finding, ["password", secret].join("="));
    const plan = replace(state, "S02", "ERROR: replacement");
    const json = toJson(plan.brief);
    expect(json).not.toContain(secret);
    expect(json).not.toContain('"content"');
    expect(toMarkdown(plan.brief)).toContain("Retained source references");
    const invalid = structuredClone(plan.brief);
    invalid.sourceHistory = [];
    expect(validateProvenance(invalid).length).toBeGreaterThan(0);
  });

  it("rejects content changes with a reused revision and backwards revisions outside Undo", () => {
    const state = desk();
    expect(() => planSourceUpdate({ ...state, nextInputs: [{ ...state.inputs[0], content: "changed" }, state.inputs[1]] })).toThrow(/new source revision/);
    const plan = replace(state, "S01", "Updated content");
    expect(() => planSourceUpdate({ inputs: plan.inputs, brief: plan.brief, ownership: state.ownership, nextInputs: state.inputs })).toThrow(/outside Undo/);
  });

  it("keeps a manual brief when the final source is removed", () => {
    const state = desk();
    recordScalarEdit(state.ownership, "objective", "Preserved with no current source");
    createManualCriterion(state.ownership);
    const plan = planSourceUpdate({ ...state, nextInputs: [] });
    expect(plan.brief.sources).toHaveLength(0);
    expect(plan.brief.objective).toBe("Preserved with no current source");
    expect(plan.brief.doneWhen[0].pointer.sourceId).toBe("USER");
    expect(validateProvenance(plan.brief)).toEqual([]);
  });

  it("editing a confirmed manual requirement removes its confirmation immediately", () => {
    const state = desk();
    const manual = createManualCriterion(state.ownership);
    confirmCriterion(state.ownership, state.brief, manual);
    state.brief = buildReviewedBrief(state.inputs, state.ownership);
    const item = state.brief.doneWhen.find(item => item.ownershipId === manual.ownershipId);
    expect(item.confirmed).toBe(true);
    recordCriterionEdit(state.ownership, item, "text", "A changed manual decision");
    expect(item.confirmed).toBe(false);
  });
});
