import { assignSourceIds, compileIntake } from "./intake.js";
import { applyUserOwnedEdits } from "./edit-ownership.js";
import { assertValidProvenance } from "./validate.js";

function emptyBrief() {
  return {
    schemaVersion: "1.1", engine: { name: "codex-intake-rules", version: "0.2.0", mode: "local-deterministic" },
    title: "Untitled intake", objective: "Add selected source material to define this task.",
    situation: "No current sources; retained user edits require review.",
    primaryPointer: { sourceId: "USER", locator: "manual", excerpt: "No current source" },
    sources: [], findings: [], privacyRisks: [], doneWhen: [], gaps: []
  };
}
export function buildReviewedBrief(inputs, ownership, previousBrief = null) {
  return assertValidProvenance(applyUserOwnedEdits(inputs.length ? compileIntake(inputs) : emptyBrief(), ownership, previousBrief));
}
function comparable(item) { return JSON.stringify([item.text, item.maskedPreview, item.pointer, item.reviewStatus, item.confirmed]); }
export function describeBriefChanges(before, after) {
  const changes = [];
  for (const field of ["title", "objective"]) {
    if (before?.[field] !== after[field]) changes.push({ collection: "brief", id: field, kind: "changed", before: before?.[field] || "", after: after[field] });
  }
  for (const collection of ["findings", "doneWhen", "privacyRisks", "gaps"]) {
    const previous = new Map((before?.[collection] || []).map(item => [item.id, item]));
    for (const item of after[collection]) {
      const old = previous.get(item.id); previous.delete(item.id);
      if (!old || comparable(old) !== comparable(item)) changes.push({ collection, id: item.id, kind: old ? "changed" : "added",
        before: old?.text || old?.maskedPreview || "", after: item.text || item.maskedPreview || "", pointer: item.pointer,
        retainedEdit: item.authorship !== undefined && item.authorship !== "rule-derived", needsReview: item.reviewStatus === "needs-review" });
    }
    for (const item of previous.values()) changes.push({ collection, id: item.id, kind: "removed", before: item.text || item.maskedPreview || "", after: "", pointer: item.pointer });
  }
  return changes;
}
function sourceBody(input) {
  return JSON.stringify([input.name, input.kind, input.content, input.mimeType, input.byteSize, input.ocr || null]);
}
export function planSourceUpdate({ inputs, brief, ownership, nextInputs, allowRollback = false }) {
  const proposedInputs = assignSourceIds(nextInputs);
  const oldIds = new Map(assignSourceIds(inputs).map(input => [input.id, input]));
  const sourceChanges = [];
  for (const input of proposedInputs) {
    const previous = oldIds.get(input.id); oldIds.delete(input.id);
    if (previous && input.revision === previous.revision && (sourceBody(input) !== sourceBody(previous) || input.file !== previous.file)) {
      throw new Error("Changed source content requires a new source revision.");
    }
    if (previous && input.revision < previous.revision && !allowRollback) throw new Error("Source revision cannot move backwards outside Undo.");
    if (!previous) sourceChanges.push({ id: input.id, name: input.name, kind: "added", fromRevision: null, toRevision: input.revision });
    else if (previous.revision !== input.revision) sourceChanges.push({ id: input.id, name: input.name, kind: "replaced", fromRevision: previous.revision, toRevision: input.revision });
  }
  for (const input of oldIds.values()) sourceChanges.push({ id: input.id, name: input.name, kind: "removed", fromRevision: input.revision, toRevision: null });
  const proposedBrief = buildReviewedBrief(proposedInputs, ownership, brief);
  return { inputs: proposedInputs, brief: proposedBrief, sourceChanges, changes: describeBriefChanges(brief, proposedBrief),
    preservedEdits: ownership.scalars.size + ownership.criteria.size + ownership.findings.size + ownership.manualCriteria.size,
    needsReview: [...proposedBrief.findings, ...proposedBrief.doneWhen].filter(item => item.reviewStatus === "needs-review").length };
}
export function replaceSourceInput(inputs, sourceId, replacement) {
  const previous = inputs.find(input => input.id === sourceId);
  if (!previous) throw new Error("The selected source is no longer on the desk.");
  const revision = (previous.revision ?? 1) + 1;
  if (!Number.isSafeInteger(revision)) throw new Error("Source revision range exhausted.");
  return inputs.map(input => input.id === sourceId ? { ...replacement, id: sourceId, revision } : input);
}
