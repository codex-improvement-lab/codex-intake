import { redactText } from "./intake.js";

export function pointerLabel(pointer) {
  return pointer ? `${pointer.sourceId}:${pointer.locator}` : "NO-SOURCE";
}

function portablePointer(pointer) {
  return pointer
    ? {
        sourceId: pointer.sourceId,
        locator: pointer.locator,
        excerpt: redactText(pointer.excerpt)
      }
    : null;
}

export function toPortableBrief(brief) {
  return {
    schemaVersion: brief.schemaVersion,
    engine: { ...brief.engine },
    title: redactText(brief.title),
    objective: redactText(brief.objective),
    situation: redactText(brief.situation),
    primaryPointer: portablePointer(brief.primaryPointer),
    doneWhen: brief.doneWhen
      .filter((item) => item.included !== false)
      .map((item) => ({
        id: item.id,
        text: redactText(item.text),
        confidence: item.confidence,
        rule: item.rule,
        pointer: portablePointer(item.pointer)
      })),
    findings: brief.findings.map((item) => ({
      id: item.id,
      category: item.category,
      text: redactText(item.text),
      confidence: item.confidence,
      rule: item.rule,
      pointer: portablePointer(item.pointer)
    })),
    privacyRisks: brief.privacyRisks.map((risk) => ({
      id: risk.id,
      type: risk.type,
      label: risk.label,
      severity: risk.severity,
      maskedPreview: redactText(risk.maskedPreview),
      guidance: risk.guidance,
      pointer: portablePointer(risk.pointer)
    })),
    gaps: brief.gaps.map((gap) => ({
      id: gap.id,
      text: redactText(gap.text),
      pointer: portablePointer(gap.pointer)
    })),
    sources: brief.sources.map((source) => ({
      id: source.id,
      name: redactText(source.name),
      kind: source.kind,
      mimeType: source.mimeType,
      byteSize: source.byteSize,
      digest: source.digest,
      lineCount: source.lineCount,
      ocr: source.ocr ? { ...source.ocr } : null,
      rawContentIncluded: false
    }))
  };
}

function mdPointer(pointer) {
  if (!pointer) return "`NO-SOURCE`";
  const label = pointerLabel(pointer);
  if (pointer.sourceId === "USER") return `\`${label}\``;
  return `[\`${label}\`](#source-${pointer.sourceId.toLowerCase()})`;
}

function escapeCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function toMarkdown(brief) {
  const portable = toPortableBrief(brief);
  const lines = [
    "# Task brief",
    "",
    "> Compiled locally with deterministic rules. Raw source content is not embedded in this export.",
    "",
    `## ${portable.title}`,
    "",
    portable.objective,
    "",
    `Primary evidence: ${mdPointer(portable.primaryPointer)}`,
    "",
    "## Done when",
    ""
  ];

  for (const item of portable.doneWhen) {
    lines.push(`- [ ] ${item.text} — ${mdPointer(item.pointer)}`);
  }

  lines.push("", "## Context ledger", "");
  for (const item of portable.findings) {
    lines.push(`- **${item.category}** · ${item.text} — ${mdPointer(item.pointer)}`);
  }

  lines.push("", "## Privacy review", "");
  if (!portable.privacyRisks.length) {
    lines.push("- No rule-based privacy risks detected. This is not a guarantee that the material is safe to share.");
  } else {
    for (const risk of portable.privacyRisks) {
      lines.push(`- **${risk.severity} · ${risk.label}** · ${risk.maskedPreview} — ${mdPointer(risk.pointer)}`);
    }
  }

  lines.push("", "## Open gaps", "");
  if (!portable.gaps.length) {
    lines.push("- No deterministic intake gaps detected.");
  } else {
    for (const gap of portable.gaps) {
      lines.push(`- ${gap.text} — ${mdPointer(gap.pointer)}`);
    }
  }

  lines.push(
    "",
    "## Source register",
    "",
    "| ID | Source | Kind | Fingerprint | Lines | Raw embedded |",
    "| --- | --- | --- | --- | ---: | --- |"
  );
  for (const source of portable.sources) {
    lines.push(
      `| <a id="source-${source.id.toLowerCase()}"></a>${source.id} | ${escapeCell(source.name)} | ${source.kind} | \`${source.digest}\` | ${source.lineCount} | no |`
    );
  }

  lines.push(
    "",
    "---",
    "",
    `Engine: \`${portable.engine.name}@${portable.engine.version}\` · Mode: \`${portable.engine.mode}\``
  );

  return `${lines.join("\n")}\n`;
}

export function toJson(brief) {
  return `${JSON.stringify(toPortableBrief(brief), null, 2)}\n`;
}

export function toCodexPrompt(brief) {
  return [
    "Use the following local intake as the task contract.",
    "Preserve source pointers when reporting claims. Treat open gaps as questions, not facts.",
    "Do not reproduce or request redacted secrets. Verify each included done-when before declaring completion.",
    "",
    toMarkdown(brief)
  ].join("\n");
}
