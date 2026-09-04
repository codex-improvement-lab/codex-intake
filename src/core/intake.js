const PROBLEM_PATTERN = /\b(?:error|exception|fatal|failed|failure|panic|crash(?:ed|es|ing)?|timeout|timed out|traceback|segmentation fault)\b|错误|异常|失败|崩溃|超时/i;
const REQUIREMENT_PATTERN = /\b(?:must|should|need(?:s|ed)?|expected?|want(?:s|ed)?|acceptance|done when)\b|必须|需要|应该|期望|预期|目标|完成条件|验收/i;
const COMMAND_PATTERN = /^(?:[$>]\s*)?(?:pnpm|npm|npx|yarn|bun|node|python|python3|py|pytest|uv|cargo|go\s+test|dotnet|mvn|gradle|git|docker|kubectl)\b/i;
const URL_PATTERN = /https?:\/\/[^\s<>()"']+/i;
const PATH_PATTERN = /(?:[A-Za-z]:\\|\.\.?[\\/]|\/Users\/|\/home\/)[^\s"'<>]+|\b[\w.-]+\.(?:js|mjs|cjs|ts|tsx|jsx|py|rs|go|java|cs|json|ya?ml|toml|md|log|txt|png|jpe?g|webp|pdf)(?::\d+)?\b/i;

const RISK_RULES = [
  {
    type: "private-key-material",
    label: "private key material",
    severity: "critical",
    source: "-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    flags: "g"
  },
  {
    type: "api-key",
    label: "API key",
    severity: "critical",
    source: "\\bsk-(?:proj-)?[A-Za-z0-9_-]{12,}\\b|\\bgh[opusr]_[A-Za-z0-9]{20,}\\b",
    flags: "gi"
  },
  {
    type: "authorization-token",
    label: "authorization token",
    severity: "critical",
    source: "\\bBearer\\s+[A-Za-z0-9._~+\\/=-]{12,}",
    flags: "gi"
  },
  {
    type: "jwt",
    label: "JWT",
    severity: "critical",
    source: "\\beyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\b",
    flags: "g"
  },
  {
    type: "credential-assignment",
    label: "credential assignment",
    severity: "high",
    source: "\\b(?:password|passwd|pwd|client_secret|access_token|auth_token)\\s*[:=]\\s*[\\\"']?[^\\s\\\"'`,;]{6,}",
    flags: "gi"
  },
  {
    type: "email-address",
    label: "email address",
    severity: "medium",
    source: "\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b",
    flags: "gi"
  },
  {
    type: "personal-home-path",
    label: "personal home path",
    severity: "medium",
    source: "(?:[A-Za-z]:\\\\Users\\\\|\\/Users\\/|\\/home\\/)[^\\s\\\\/]+",
    flags: "g"
  },
  {
    type: "ip-address",
    label: "IP address",
    severity: "low",
    source: "\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b",
    flags: "g"
  }
];

const CATEGORY_PRIORITY = {
  problem: 0,
  requirement: 1,
  command: 2,
  url: 3,
  path: 4,
  context: 5
};

const SEVERITY_PRIORITY = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

export function normalizeText(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+$/gm, "")
    .trim();
}

export function fingerprint(value) {
  const text = String(value ?? "");
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function riskRegex(rule) {
  return new RegExp(rule.source, rule.flags);
}

function replacementFor(rule, match) {
  if (rule.type === "authorization-token") {
    return "Bearer <redacted:authorization-token>";
  }
  if (rule.type === "credential-assignment") {
    const divider = match.search(/[:=]/);
    const prefix = divider >= 0 ? match.slice(0, divider + 1) : "credential=";
    return `${prefix}<redacted:credential>`;
  }
  return `<redacted:${rule.type}>`;
}

export function redactText(value) {
  let text = String(value ?? "");

  for (const rule of RISK_RULES) {
    text = text.replace(riskRegex(rule), (match) => replacementFor(rule, match));
  }

  return text;
}

function concise(value, length = 150) {
  const clean = redactText(String(value ?? "").replace(/\s+/g, " ").trim());
  return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
}

function locatorFor(source, lineIndex) {
  if (source.kind === "screenshot") {
    return source.content ? `OCR:L${lineIndex + 1}` : "image";
  }
  if (source.kind === "file-list") {
    return `entry ${lineIndex + 1}`;
  }
  if (source.kind === "url") {
    return "URL";
  }
  return `L${lineIndex + 1}`;
}

function pointerFor(source, lineIndex, excerpt) {
  return {
    sourceId: source.id,
    locator: locatorFor(source, lineIndex),
    excerpt: concise(excerpt)
  };
}

function prepareSource(input, index) {
  const kind = ["text", "log", "file-list", "screenshot", "url"].includes(input.kind)
    ? input.kind
    : "text";
  const content = normalizeText(input.content);
  const id = `S${String(index + 1).padStart(2, "0")}`;
  const byteSize = Number.isFinite(input.byteSize)
    ? input.byteSize
    : new TextEncoder().encode(content).byteLength;

  return {
    id,
    name: String(input.name || `${kind}-${index + 1}`),
    kind,
    mimeType: String(input.mimeType || "text/plain"),
    byteSize,
    digest: fingerprint(`${kind}\u0000${input.name || ""}\u0000${content}`),
    lineCount: content ? content.split("\n").length : 0,
    content,
    ocr: input.ocr
      ? {
          engine: String(input.ocr.engine || "unknown"),
          languages: Array.isArray(input.ocr.languages) ? [...input.ocr.languages] : [],
          confidence: Number.isFinite(input.ocr.confidence) ? input.ocr.confidence : null
        }
      : null,
    previewUrl: input.previewUrl || null,
    file: input.file || null
  };
}

function scanRisks(source) {
  if (!source.content) return [];
  const risks = [];
  const seen = new Set();

  source.content.split("\n").forEach((line, lineIndex) => {
    for (const rule of RISK_RULES) {
      for (const match of line.matchAll(riskRegex(rule))) {
        const key = `${rule.type}:${lineIndex}:${match.index}`;
        if (seen.has(key)) continue;
        seen.add(key);
        risks.push({
          id: `R-${source.id}-${String(risks.length + 1).padStart(2, "0")}`,
          type: rule.type,
          label: rule.label,
          severity: rule.severity,
          maskedPreview: concise(line),
          pointer: pointerFor(source, lineIndex, line),
          guidance:
            rule.severity === "critical" || rule.severity === "high"
              ? "Remove or rotate this value before sharing the brief."
              : "Confirm this context is necessary before sharing."
        });
      }
    }
  });

  return risks;
}

function finding(source, lineIndex, category, text, rule) {
  return {
    id: `F-${source.id}-${String(lineIndex + 1).padStart(3, "0")}-${category}`,
    category,
    text: concise(text),
    confidence: "rule-derived",
    rule,
    pointer: pointerFor(source, lineIndex, text)
  };
}

function scanFindings(source) {
  if (!source.content) {
    if (source.kind !== "screenshot") return [];
    return [
      {
        id: `F-${source.id}-image-context`,
        category: "context",
        text: `Screenshot “${concise(source.name, 80)}” is registered; OCR has not been run.`,
        confidence: "explicit",
        rule: "selected-image-metadata",
        pointer: pointerFor(source, 0, source.name)
      }
    ];
  }

  const results = [];
  const lines = source.content.split("\n");

  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.trim();
    if (!line) return;

    if (PROBLEM_PATTERN.test(line)) {
      results.push(finding(source, lineIndex, "problem", line, "problem-signal"));
      return;
    }
    if (REQUIREMENT_PATTERN.test(line)) {
      results.push(finding(source, lineIndex, "requirement", line, "requirement-language"));
      return;
    }
    if (COMMAND_PATTERN.test(line)) {
      results.push(finding(source, lineIndex, "command", line.replace(/^[$>]\s*/, ""), "command-shape"));
      return;
    }
    if (URL_PATTERN.test(line)) {
      results.push(finding(source, lineIndex, "url", line.match(URL_PATTERN)[0], "url-shape"));
      return;
    }
    if (source.kind === "file-list" || PATH_PATTERN.test(line)) {
      results.push(finding(source, lineIndex, "path", line, "path-shape"));
    }
  });

  if (!results.length) {
    const firstIndex = lines.findIndex((line) => line.trim());
    if (firstIndex >= 0) {
      results.push(finding(source, firstIndex, "context", lines[firstIndex], "first-context-line"));
    }
  }

  return results.slice(0, 24);
}

function firstUsefulLine(sources) {
  for (const source of sources) {
    if (!source.content) continue;
    const line = source.content
      .split("\n")
      .map((item) => item.trim())
      .find((item) => item && !COMMAND_PATTERN.test(item));
    if (line) return concise(line, 84);
  }
  return sources.length ? `Review ${concise(sources[0].name, 64)}` : "Untitled intake";
}

function titleFrom(sources, findings) {
  const opening = firstUsefulLine(sources).replace(/^[-*#\d.)\s]+/, "").trim();
  if (opening && !/^(?:error|fatal|exception|traceback|panic|错误|异常|失败)\b/i.test(opening)) return opening;
  const problem = findings.find((item) => item.category === "problem");
  if (problem) return `Resolve ${problem.text.replace(/^(?:error|fatal|failed)\s*[:=-]?\s*/i, "")}`;
  return opening || "Untitled intake";
}

function deriveDoneWhen(findings, risks) {
  const criteria = [];
  const add = (text, pointer, rule) => {
    if (!pointer || criteria.some((item) => item.rule === rule)) return;
    criteria.push({
      id: `D${String(criteria.length + 1).padStart(2, "0")}`,
      text: concise(text, 220),
      included: true,
      confidence: "rule-derived",
      rule,
      pointer
    });
  };

  const requirement = findings.find((item) => item.category === "requirement");
  const problem = findings.find((item) => item.category === "problem");
  const command = findings.find((item) => item.category === "command");
  const anchor = requirement || problem || findings[0];

  if (requirement) {
    add(`The requested behavior is observably satisfied: “${requirement.text}”`, requirement.pointer, "requirement-satisfied");
  }
  if (problem) {
    add(`The recorded failure no longer occurs: “${problem.text}”`, problem.pointer, "failure-removed");
    add("Automated regression coverage exercises the observed failure path and passes.", problem.pointer, "regression-coverage");
  }
  if (command) {
    add(`The recorded verification command completes successfully: ${command.text}`, command.pointer, "command-passes");
  }
  if (risks.length) {
    add(
      `The exported handoff contains no unmasked ${[...new Set(risks.map((risk) => risk.label))].join(", ")}.`,
      risks[0].pointer,
      "privacy-cleared"
    );
  }
  if (!criteria.length && anchor) {
    add("A reviewer can verify the intended outcome against the supplied source context.", anchor.pointer, "reviewable-outcome");
  }

  return criteria.slice(0, 6);
}

function deriveGaps(sources, findings) {
  const gaps = [];
  const anchor = findings[0]?.pointer || (sources[0] ? pointerFor(sources[0], 0, sources[0].name) : null);

  for (const source of sources.filter((item) => item.kind === "screenshot" && !item.content)) {
    gaps.push({
      id: `G-${source.id}-ocr`,
      text: "Screenshot content is not yet searchable; run local OCR or add a manual note.",
      pointer: pointerFor(source, 0, source.name)
    });
  }

  if (anchor && !findings.some((item) => item.category === "requirement")) {
    gaps.push({
      id: "G-expected-outcome",
      text: "No explicit expected outcome was detected; confirm the intended behavior before execution.",
      pointer: anchor
    });
  }
  if (anchor && findings.some((item) => item.category === "problem") && !findings.some((item) => item.category === "command")) {
    gaps.push({
      id: "G-reproduction-command",
      text: "A failing command or minimal reproduction step was not detected.",
      pointer: findings.find((item) => item.category === "problem").pointer
    });
  }

  return gaps;
}

export function compileIntake(inputSources) {
  if (!Array.isArray(inputSources) || inputSources.length === 0) {
    throw new Error("Add at least one source before compiling an intake.");
  }

  const sources = inputSources.map(prepareSource);
  const findings = sources
    .flatMap(scanFindings)
    .sort((left, right) => {
      const category = CATEGORY_PRIORITY[left.category] - CATEGORY_PRIORITY[right.category];
      if (category !== 0) return category;
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    });
  const privacyRisks = sources
    .flatMap(scanRisks)
    .sort((left, right) => {
      const severity = SEVERITY_PRIORITY[left.severity] - SEVERITY_PRIORITY[right.severity];
      if (severity !== 0) return severity;
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    });
  const requirement = findings.find((item) => item.category === "requirement");
  const problem = findings.find((item) => item.category === "problem");
  const primary = requirement || problem || findings[0];
  const title = titleFrom(sources, findings);
  const objective = requirement
    ? `Make the requested behavior demonstrably true: ${requirement.text}`
    : problem
      ? `Resolve the observed failure: ${problem.text}`
      : `Turn the supplied context into a verified outcome for “${title}”.`;

  return {
    schemaVersion: "1.0",
    engine: {
      name: "codex-intake-rules",
      version: "0.1.0",
      mode: "local-deterministic"
    },
    title: concise(title, 96),
    objective: concise(objective, 260),
    situation: `${sources.length} source${sources.length === 1 ? "" : "s"}; ${findings.length} extracted signal${findings.length === 1 ? "" : "s"}; ${privacyRisks.length} privacy risk${privacyRisks.length === 1 ? "" : "s"}.`,
    primaryPointer: primary?.pointer || pointerFor(sources[0], 0, sources[0].name),
    sources,
    findings,
    privacyRisks,
    doneWhen: deriveDoneWhen(findings, privacyRisks),
    gaps: deriveGaps(sources, findings)
  };
}
