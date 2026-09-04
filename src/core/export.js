import { redactText } from "./intake.js";

export function pointerLabel(pointer) {
  return pointer ? `${pointer.sourceId}:${pointer.locator}${pointer.sourceId !== "USER" && pointer.sourceRevision ? ` · r${pointer.sourceRevision}` : ""}` : "NO-SOURCE";
}

function portablePointer(pointer) {
  return pointer
    ? {
        sourceId: pointer.sourceId,
        ...(pointer.sourceId === "USER" ? {} : { sourceRevision: pointer.sourceRevision ?? 1 }),
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
    fieldOwnership: { title: brief.fieldOwnership?.title || "rule-derived", objective: brief.fieldOwnership?.objective || "rule-derived" },
    situation: redactText(brief.situation),
    primaryPointer: portablePointer(brief.primaryPointer),
    doneWhen: brief.doneWhen
      .filter((item) => item.included !== false)
      .map((item) => ({
        id: item.id,
        text: redactText(item.text),
        confidence: item.confidence,
        rule: item.rule,
        authorship: item.authorship || (item.rule === "user-authored" ? "user-authored" : "rule-derived"),
        confirmation: item.reviewStatus === "needs-review" ? "needs-review" : item.confirmed ? "user-confirmed" : "candidate",
        pointer: portablePointer(item.pointer),
        ...(item.previousPointer ? { previousPointer: portablePointer(item.previousPointer) } : {})
      })),
    findings: brief.findings.map((item) => ({
      id: item.id,
      category: item.category,
      text: redactText(item.text),
      confidence: item.confidence,
      rule: item.rule,
      authorship: item.authorship || "rule-derived",
      reviewStatus: item.reviewStatus || "current",
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
      revision: source.revision ?? 1,
      name: redactText(source.name),
      kind: source.kind,
      mimeType: source.mimeType,
      byteSize: source.byteSize,
      digest: source.digest,
      lineCount: source.lineCount,
      ocr: source.ocr ? { ...source.ocr } : null,
      rawContentIncluded: false
    })),
    sourceHistory: (brief.sourceHistory || []).map(source => ({
      id: source.id, revision: source.revision, name: redactText(source.name),
      kind: source.kind, digest: source.digest, lineCount: source.lineCount,
      rawContentIncluded: false
    }))
  };
}

function mdPointer(pointer) {
  if (!pointer) return "`NO-SOURCE`";
  const label = pointerLabel(pointer);
  if (pointer.sourceId === "USER") return `\`${label}\``;
  return `[\`${label}\`](#source-${pointer.sourceId.toLowerCase()}-r${pointer.sourceRevision ?? 1})`;
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
    const state = item.confirmation === "user-confirmed" ? "User-confirmed" : item.confirmation === "needs-review" ? "Source changed — review required" : "Candidate";
    lines.push(`- [ ] **${state}** · ${item.text} — ${mdPointer(item.pointer)}${item.previousPointer ? ` · Previous reference: ${mdPointer(item.previousPointer)}` : ""}`);
  }

  lines.push("", "## Context ledger", "");
  for (const item of portable.findings) {
    lines.push(`- **${item.category}** · ${item.text} — ${mdPointer(item.pointer)}${item.reviewStatus === "needs-review" ? " · **Source changed — retained user edit; review required**" : ""}`);
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
      `| <a id="source-${source.id.toLowerCase()}-r${source.revision}"></a>${source.id} r${source.revision} | ${escapeCell(source.name)} | ${source.kind} | \`${source.digest}\` | ${source.lineCount} | no |`
    );
  }

  if (portable.sourceHistory.length) {
    lines.push("", "## Retained source references", "", "These older or removed revisions support traceability of retained edits; they are not current-source confirmation.", "");
    for (const source of portable.sourceHistory) {
      lines.push(`- <a id="source-${source.id.toLowerCase()}-r${source.revision}"></a>**${source.id} r${source.revision}** · ${escapeCell(source.name)} · fingerprint \`${source.digest}\` · raw content omitted`);
    }
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
    "Rule candidates are not confirmed requirements. Review source-changed items and distinguish them from user-confirmed requirements.",
    "Do not reproduce or request redacted secrets. Verify each included done-when before declaring completion.",
    "",
    toMarkdown(brief)
  ].join("\n");
}
