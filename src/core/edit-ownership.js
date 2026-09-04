import { fingerprint } from "./intake.js";

const SCALAR_FIELDS = new Set(["title", "objective"]);
const CRITERION_FIELDS = new Set(["text", "included"]);
const clone = value => structuredClone(value);
function requireField(allowed, field, label) {
  if (!allowed.has(field)) throw new Error(`${label} is not editable: ${field}`);
}
export function sourceReference(source) {
  if (!source) return null;
  return { id: source.id, revision: source.revision ?? 1, name: source.name,
    kind: source.kind, digest: source.digest, lineCount: source.lineCount,
    mimeType: source.mimeType, byteSize: source.byteSize };
}
function itemKey(item) {
  return [item.rule, item.pointer?.sourceId, item.pointer?.sourceRevision ?? 1,
    item.pointer?.locator, fingerprint(item.text)].join("\u0000");
}
function ownedRecord(item, brief, ownership) {
  const source = item.sourceSnapshot || sourceReference(brief?.sources.find(source => source.id === item.pointer?.sourceId));
  return { sequence: ownership.nextEditSequence++, origin: { ...clone(item), sourceSnapshot: source }, fields: new Map(), confirmed: false, detached: false };
}
function sourceKey(source) { return `${source.id}@${source.revision ?? 1}`; }
function pointerKey(pointer) { return `${pointer.sourceId}@${pointer.sourceRevision ?? 1}`; }
function stillSupported(candidate, record) {
  const original = record.origin;
  return candidate.rule === original.rule && candidate.text === original.text
    && candidate.pointer.sourceId === original.pointer.sourceId
    && (candidate.pointer.sourceRevision ?? 1) === (original.pointer.sourceRevision ?? 1)
    && candidate.pointer.locator === original.pointer.locator
    && candidate.pointer.excerpt === original.pointer.excerpt
    && candidate.sourceSnapshot?.digest === original.sourceSnapshot?.digest;
}
function materializeManualCriterion(record) {
  return { id: `U${String(record.sequence).padStart(2, "0")}`, text: record.text,
    included: record.included, confidence: "explicit", authorship: "user-authored",
    confirmed: record.confirmed, reviewStatus: "current", rule: "user-authored",
    pointer: { sourceId: "USER", locator: "manual", excerpt: "User-authored criterion" },
    ownershipId: record.ownershipId };
}
export function createEditOwnership() {
  return { scalars: new Map(), criteria: new Map(), findings: new Map(), manualCriteria: new Map(), nextManualSequence: 1, nextEditSequence: 1 };
}
export function applyUserOwnedEdits(compiled, ownership, previousBrief = null) {
  compiled.fieldOwnership = {};
  for (const field of SCALAR_FIELDS) compiled.fieldOwnership[field] = ownership.scalars.has(field) ? "user-edited" : "rule-derived";
  for (const [field, value] of ownership.scalars) compiled[field] = value;
  const history = new Map();
  for (const source of [...(previousBrief?.sourceHistory || []), ...(previousBrief?.sources || [])]) {
    history.set(sourceKey(source), sourceReference(source));
  }
  for (const collection of ["doneWhen", "findings"]) {
    for (const item of compiled[collection]) {
      item.sourceSnapshot = sourceReference(compiled.sources.find(source => source.id === item.pointer.sourceId));
      item.authorship = "rule-derived";
      item.reviewStatus = "current";
      if (collection === "doneWhen") item.confirmed = false;
    }
    const records = collection === "doneWhen" ? ownership.criteria : ownership.findings;
    for (const [key, record] of records) {
      let item = record.detached ? null : compiled[collection].find(candidate => stillSupported(candidate, record));
      const matched = Boolean(item);
      if (!item) {
        item = { ...clone(record.origin), id: `E-${collection}-${record.sequence}` };
        compiled[collection].push(item);
      }
      item.editKey = key;
      for (const [field, value] of record.fields) item[field] = value;
      item.authorship = "user-edited";
      item.confidence = "user-edited";
      item.reviewStatus = matched || record.detached ? "current" : "needs-review";
      if (collection === "doneWhen") item.confirmed = record.confirmed && item.reviewStatus === "current";
      if (record.detached) {
        item.previousPointer = clone(record.origin.pointer);
        item.pointer = { sourceId: "USER", locator: "manual", excerpt: "Requirement explicitly retained by user" };
        item.authorship = "user-authored";
        item.confidence = "explicit";
      }
      if (record.origin.sourceSnapshot) history.set(sourceKey(record.origin.sourceSnapshot), record.origin.sourceSnapshot);
    }
  }
  compiled.doneWhen.push(...[...ownership.manualCriteria.values()]
    .sort((left, right) => left.sequence - right.sequence).map(materializeManualCriterion));
  // Retain only metadata referenced by preserved edits, never raw bodies/File handles.
  const current = new Set(compiled.sources.map(sourceKey));
  const needed = new Set();
  for (const item of [...compiled.doneWhen, ...compiled.findings]) {
    for (const pointer of [item.pointer, item.previousPointer]) {
      if (pointer && pointer.sourceId !== "USER" && !current.has(pointerKey(pointer))) needed.add(pointerKey(pointer));
    }
  }
  compiled.sourceHistory = [...needed].sort().map(key => {
    if (!history.has(key)) throw new Error(`Retained edit has no historical source metadata: ${key}`);
    return clone(history.get(key));
  });
  return compiled;
}
export function recordScalarEdit(ownership, field, value) {
  requireField(SCALAR_FIELDS, field, "Brief field");
  ownership.scalars.set(field, String(value));
}
export function recordCriterionEdit(ownership, item, field, value, brief = null) {
  requireField(CRITERION_FIELDS, field, "Done-when field");
  const normalized = field === "included" ? Boolean(value) : String(value);
  if (item.rule === "user-authored" && item.ownershipId) {
    const record = ownership.manualCriteria.get(item.ownershipId);
    if (!record) throw new Error("User-authored criterion has no ownership record.");
    record[field] = normalized;
    if (field === "text") record.confirmed = false;
    item.confirmed = record.confirmed;
    return;
  }
  const key = item.editKey || itemKey(item);
  const record = ownership.criteria.get(key) || ownedRecord(item, brief, ownership);
  record.fields.set(field, normalized);
  if (field === "text") record.confirmed = false;
  ownership.criteria.set(key, record);
  item.editKey = key;
  item.authorship = "user-edited";
  item.confidence = "user-edited";
  if (field === "text") item.confirmed = false;
}
export function confirmCriterion(ownership, brief, item) {
  if (item.rule === "user-authored" && item.ownershipId) {
    const record = ownership.manualCriteria.get(item.ownershipId);
    if (!record) throw new Error("Manual criterion is missing.");
    record.confirmed = !record.confirmed;
    return;
  }
  const key = item.editKey || itemKey(item);
  const record = ownership.criteria.get(key) || ownedRecord(item, brief, ownership);
  record.fields.set("text", item.text);
  record.fields.set("included", item.included !== false);
  if (item.reviewStatus === "needs-review") {
    // Explicit user decision; never assert a changed source supports old wording.
    record.detached = true;
    record.confirmed = true;
  } else record.confirmed = !record.confirmed;
  ownership.criteria.set(key, record);
}
export function recordFindingEdit(ownership, brief, item, value) {
  const key = item.editKey || itemKey(item);
  const record = ownership.findings.get(key) || ownedRecord(item, brief, ownership);
  record.fields.set("text", String(value));
  ownership.findings.set(key, record);
  item.editKey = key;
  item.authorship = "user-edited";
  item.confidence = "user-edited";
}
export function createManualCriterion(ownership) {
  const sequence = ownership.nextManualSequence++;
  const record = { ownershipId: `manual-${sequence}`, sequence, text: "Define an observable completion check.", included: true, confirmed: false };
  ownership.manualCriteria.set(record.ownershipId, record);
  return materializeManualCriterion(record);
}
