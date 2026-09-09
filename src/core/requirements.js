import { redactText } from "./intake.js";

import { REQUIREMENTS_SCHEMA, validateRequirements } from "./requirements-schema.js";
export { REQUIREMENTS_SCHEMA, validateRequirements } from "./requirements-schema.js";
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export async function contentDigest(text) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
function pointer(value) {
  return { sourceId: value.sourceId, ...(value.sourceId === "USER" ? {} : { sourceRevision: value.sourceRevision ?? 1 }),
    locator: value.locator, excerpt: redactText(value.excerpt ?? "") };
}
function sourceKey(source) { return `${source.id}@${source.revision}`; }

// Snapshot creation never confirms a new rule candidate. Prior explicit decisions
// survive only an identical, unambiguous signal and identical acceptance text.
export async function createRequirements(brief, { scope, previous = null } = {}) {
  if (typeof scope !== "string" || scope.length > 64 || !TOKEN.test(scope || "")) throw new Error("Choose a portable, project-specific --scope token of 1 to 64 characters.");
  if (previous) {
    validateRequirements(previous);
    if (previous.scope !== scope) throw new Error("Snapshot scope cannot change during an update.");
  }
  const sources = await Promise.all(brief.sources.map(async source => ({ id: source.id, revision: source.revision ?? 1,
    name: redactText(source.name), kind: source.kind, lineCount: source.lineCount,
    digest: await contentDigest(source.content || ""), digestAlgorithm: "sha256" })));
  const history = new Map([...(brief.sourceHistory || []), ...(previous?.sourceHistory || []), ...(previous?.sources || [])]
    .map(source => [sourceKey(source), { id: source.id, revision: source.revision, name: redactText(source.name),
      kind: source.kind, lineCount: source.lineCount, digest: source.digest,
      digestAlgorithm: source.digestAlgorithm ?? (source.digest?.length === 64 ? "sha256" : "fnv1a32") }]));
  let nextId = previous?.nextId ?? 1;
  const seen = new Set();
  const requirements = [];
  for (const item of brief.doneWhen) {
    const supportDigest = await contentDigest(item.sourceSignal ?? item.ownershipId ?? item.editKey ?? item.pointer.excerpt ?? item.text);
    const ambiguous = (item.signalMultiplicity ?? 1) > 1;
    const identityPointer = item.previousPointer ?? item.pointer;
    const identityKey = await contentDigest(JSON.stringify([scope, identityPointer.sourceId, item.rule, supportDigest,
      ambiguous ? item.pointer.locator : null]));
    const old = previous?.requirements.find(candidate => candidate.identityKey === identityKey && !seen.has(candidate.id)
      && !(candidate.authorship === "user-authored" && candidate.pointer.sourceId === "USER" && item.pointer.sourceId !== "USER"));
    const id = old?.id ?? `${scope}-R${String(nextId++).padStart(3, "0")}`;
    seen.add(id);
    const text = redactText(item.text);
    const same = old && old.text === text && old.supportDigest === supportDigest && old.confirmation !== "withdrawn"
      && old.pointer.sourceId === item.pointer.sourceId
      && ((!ambiguous && item.signalExact) || old.pointer.sourceRevision === item.pointer.sourceRevision);
    const confirmation = item.included === false ? "withdrawn" : item.reviewStatus === "needs-review" ? "needs-review"
      : item.confirmed ? "user-confirmed"
        : same && old.confirmation === "user-confirmed" && item.authorship !== "user-edited" ? "user-confirmed" : "candidate";
    requirements.push({ id, revision: old ? old.revision + (same ? 0 : 1) : 1, identityKey, supportDigest,
      supportKind: item.signalExact ? "full-signal" : "metadata", text,
      confirmation, authorship: item.authorship ?? "rule-derived", pointer: pointer(item.pointer),
      ...(item.previousPointer ? { previousPointer: pointer(item.previousPointer) } : {}),
      disposition: same ? "unchanged-signal" : old ? "revised" : "added", ambiguous });
  }
  for (const old of previous?.requirements || []) {
    if (seen.has(old.id)) continue;
    const retained = old.authorship === "user-authored" && old.pointer.sourceId === "USER" && old.confirmation !== "withdrawn";
    requirements.push({ ...structuredClone(old), confirmation: retained ? old.confirmation : "withdrawn",
      disposition: retained ? "retained-manually" : "source-removed-or-changed" });
  }
  const current = new Set(sources.map(sourceKey));
  const needed = new Set(requirements.flatMap(item => [item.pointer, item.previousPointer].filter(ref => ref && ref.sourceId !== "USER")
    .map(ref => `${ref.sourceId}@${ref.sourceRevision}`).filter(key => !current.has(key))));
  return validateRequirements({ schemaVersion: REQUIREMENTS_SCHEMA, scope, revision: (previous?.revision ?? 0) + 1, nextId,
    nextSourceId: Math.max(previous?.nextSourceId ?? 1, ...sources.map(source => Number(source.id.slice(1)) + 1)),
    sources, sourceHistory: [...needed].sort().map(key => {
      if (!history.has(key)) throw new Error(`Missing historical source metadata: ${key}.`);
      return history.get(key);
    }), requirements: requirements.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) });
}

export function reviewRequirement(snapshot, id, decision, text = null) {
  validateRequirements(snapshot);
  const result = structuredClone(snapshot);
  const item = result.requirements.find(candidate => candidate.id === id);
  if (!item) throw new Error(`Unknown requirement: ${id}.`);
  if (!["confirm", "candidate", "exclude", "keep", "revise"].includes(decision)) throw new Error("Unknown review decision.");
  if (decision === "confirm" && ["withdrawn", "needs-review"].includes(item.confirmation)) {
    throw new Error("Old-source requirements require an explicit keep decision, not confirmation against the replacement source.");
  }
  if (decision === "keep" || decision === "revise") {
    if (decision === "revise" && (typeof text !== "string" || !text.trim())) throw new Error("revise requires non-empty --text.");
    if (item.pointer.sourceId !== "USER") item.previousPointer = pointer(item.pointer);
    item.pointer = { sourceId: "USER", locator: "manual", excerpt: "Explicit reviewer requirement" };
    item.authorship = "user-authored";
    item.revision += 1;
    if (decision === "revise") item.text = redactText(text);
  }
  item.confirmation = decision === "exclude" ? "withdrawn" : ["confirm", "keep"].includes(decision) ? "user-confirmed" : "candidate";
  item.disposition = `reviewer-${decision}`;
  result.revision += 1;
  return validateRequirements(result);
}

export function reviewRequirements(snapshot, ids, decision, expectedRevision) {
  validateRequirements(snapshot);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 || expectedRevision !== snapshot.revision) {
    throw new Error("Snapshot revision does not match --revision; read the current snapshot before reviewing.");
  }
  if (snapshot.revision === Number.MAX_SAFE_INTEGER) throw new Error("Snapshot revision range exhausted.");
  if (!["confirm", "candidate"].includes(decision)) throw new Error("Multiple-ID review supports confirm or candidate only.");
  if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== "string" || !id)) throw new Error("Select at least one explicit requirement ID.");
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate requirement ID in review selection.");
  const byId = new Map(snapshot.requirements.map(item => [item.id, item]));
  for (const id of ids) {
    const item = byId.get(id);
    if (!item) throw new Error(`Unknown requirement: ${id}.`);
    if (["withdrawn", "needs-review"].includes(item.confirmation)) {
      throw new Error(`Requirement ${id} needs a separate explicit keep decision; the batch was not applied.`);
    }
  }
  // Validate the entire selection before cloning or applying any decision.
  const selected = new Set(ids);
  const result = structuredClone(snapshot);
  for (const item of result.requirements) {
    if (!selected.has(item.id)) continue;
    item.confirmation = decision === "confirm" ? "user-confirmed" : "candidate";
    item.disposition = `reviewer-${decision}`;
  }
  result.revision += 1;
  return validateRequirements(result);
}
