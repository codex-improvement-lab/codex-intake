export function validateProvenance(brief) {
  const errors = [];
  const sourceIds = new Set(brief.sources.map((source) => source.id));

  const check = (item, collection) => {
    if (!item.pointer) {
      errors.push(`${collection}:${item.id} has no source pointer.`);
      return;
    }
    if (item.pointer.sourceId !== "USER" && !sourceIds.has(item.pointer.sourceId)) {
      errors.push(`${collection}:${item.id} points to unknown source ${item.pointer.sourceId}.`);
    }
    if (!item.pointer.locator) {
      errors.push(`${collection}:${item.id} has no locator.`);
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

