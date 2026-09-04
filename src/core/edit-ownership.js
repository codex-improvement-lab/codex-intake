const SCALAR_FIELDS = new Set(["title", "objective"]);
const CRITERION_FIELDS = new Set(["text", "included"]);

function requireField(allowed, field, label) {
  if (!allowed.has(field)) throw new Error(`${label} is not editable: ${field}`);
}

function sourceIdentity(brief, sourceId) {
  const source = brief.sources.find((candidate) => candidate.id === sourceId);
  if (!source) return `missing:${sourceId}`;
  return `${source.kind}\u0000${source.digest}\u0000${source.name}`;
}

function findingIdentity(brief, item) {
  return [
    sourceIdentity(brief, item.pointer.sourceId),
    item.pointer.locator,
    item.category,
    item.rule
  ].join("\u0000");
}

function materializeManualCriterion(record) {
  return {
    id: `U${String(record.sequence).padStart(2, "0")}`,
    text: record.text,
    included: record.included,
    confidence: "explicit",
    rule: "user-authored",
    pointer: { sourceId: "USER", locator: "manual", excerpt: "User-authored criterion" },
    ownershipId: record.ownershipId
  };
}

export function createEditOwnership() {
  return {
    scalars: new Map(),
    criteria: new Map(),
    findings: new Map(),
    manualCriteria: new Map(),
    nextManualSequence: 1
  };
}

export function applyUserOwnedEdits(compiled, ownership) {
  for (const [field, value] of ownership.scalars) compiled[field] = value;

  for (const item of compiled.doneWhen) {
    const fields = ownership.criteria.get(item.rule);
    if (!fields) continue;
    if (fields.has("text")) item.text = fields.get("text");
    if (fields.has("included")) item.included = fields.get("included");
  }

  for (const item of compiled.findings) {
    const text = ownership.findings.get(findingIdentity(compiled, item));
    if (text !== undefined) item.text = text;
  }

  compiled.doneWhen.push(
    ...[...ownership.manualCriteria.values()]
      .sort((left, right) => left.sequence - right.sequence)
      .map(materializeManualCriterion)
  );
  return compiled;
}

export function recordScalarEdit(ownership, field, value) {
  requireField(SCALAR_FIELDS, field, "Brief field");
  ownership.scalars.set(field, String(value));
}

export function recordCriterionEdit(ownership, item, field, value) {
  requireField(CRITERION_FIELDS, field, "Done-when field");
  const normalized = field === "included" ? Boolean(value) : String(value);

  if (item.rule === "user-authored") {
    const record = ownership.manualCriteria.get(item.ownershipId);
    if (!record) throw new Error("User-authored criterion has no ownership record.");
    record[field] = normalized;
    return;
  }

  const fields = ownership.criteria.get(item.rule) || new Map();
  fields.set(field, normalized);
  ownership.criteria.set(item.rule, fields);
}

export function recordFindingEdit(ownership, brief, item, value) {
  ownership.findings.set(findingIdentity(brief, item), String(value));
}

export function createManualCriterion(ownership) {
  const sequence = ownership.nextManualSequence;
  ownership.nextManualSequence += 1;
  const record = {
    ownershipId: `manual-${sequence}`,
    sequence,
    text: "Define an observable completion check.",
    included: true
  };
  ownership.manualCriteria.set(record.ownershipId, record);
  return materializeManualCriterion(record);
}
