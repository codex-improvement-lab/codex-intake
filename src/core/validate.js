export function validateProvenance(brief) {
  const errors = [];
  const sourceIds = new Set(brief.sources.map((source) => source.id));
  const revisions = new Set([...brief.sources, ...(brief.sourceHistory || [])].map(source => `${source.id}@${source.revision ?? 1}`));
  if (sourceIds.size !== brief.sources.length) errors.push("Current source IDs must be unique.");

  const check = (item, collection) => {
    if (!item.pointer) {
      errors.push(`${collection}:${item.id} has no source pointer.`);
      return;
    }
    for (const pointer of [item.pointer, item.previousPointer].filter(Boolean)) {
      const revision = pointer.sourceRevision ?? 1;
      if (pointer.sourceId !== "USER" && (!Number.isSafeInteger(revision) || revision < 1 || !revisions.has(`${pointer.sourceId}@${revision}`))) {
        errors.push(`${collection}:${item.id} points to unknown source revision ${pointer.sourceId}@${revision}.`);
      }
      if (!pointer.locator) errors.push(`${collection}:${item.id} has no locator.`);
    }
  };

  for (const [name, items] of [
    ["finding", brief.findings],
    ["privacyRisk", brief.privacyRisks],
    ["doneWhen", brief.doneWhen],
    ["gap", brief.gaps]
  ]) {
    items.forEach((item) => check(item, name));
  }

  return errors;
}

export function assertValidProvenance(brief) {
  const errors = validateProvenance(brief);
  if (errors.length) {
    throw new Error(`Invalid intake provenance:\n${errors.join("\n")}`);
  }
  return brief;
}
