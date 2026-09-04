import "./styles.css";
import { compileIntake, redactText } from "./core/intake.js";
import {
  applyUserOwnedEdits,
  createEditOwnership,
  createManualCriterion,
  recordCriterionEdit,
  recordFindingEdit,
  recordScalarEdit
} from "./core/edit-ownership.js";
import { pointerLabel, toCodexPrompt, toJson, toMarkdown } from "./core/export.js";
import { assertValidProvenance } from "./core/validate.js";
import { DEMO_SOURCES } from "./demo.js";

const elements = {
  sourceCount: document.querySelector("#source-count"),
  sourceList: document.querySelector("#source-list"),
  dropzone: document.querySelector("#dropzone"),
  fileInput: document.querySelector("#file-input"),
  chooseFiles: document.querySelector("#choose-files-button"),
  demo: document.querySelector("#demo-button"),
  emptyDemo: document.querySelector("#empty-demo-button"),
  clear: document.querySelector("#clear-button"),
  addNote: document.querySelector("#add-note-button"),
  addUrl: document.querySelector("#add-url-button"),
  composer: document.querySelector("#composer"),
  composerTitle: document.querySelector("#composer-title"),
  composerName: document.querySelector("#composer-name"),
  composerKind: document.querySelector("#composer-kind"),
  composerKindWrap: document.querySelector("#composer-kind-wrap"),
  composerContent: document.querySelector("#composer-content"),
  composerContentLabel: document.querySelector("#composer-content-label"),
  closeComposer: document.querySelector("#close-composer-button"),
  briefEmpty: document.querySelector("#brief-empty"),
  briefContent: document.querySelector("#brief-content"),
  exportBar: document.querySelector("#export-bar"),
  riskMeter: document.querySelector("#risk-meter"),
  riskCount: document.querySelector("#risk-count"),
  riskSummary: document.querySelector("#risk-summary"),
  traceLens: document.querySelector("#trace-lens"),
  traceSummary: document.querySelector("#trace-summary"),
  traceClear: document.querySelector("#trace-clear-button"),
  downloadJson: document.querySelector("#download-json-button"),
  downloadMarkdown: document.querySelector("#download-md-button"),
  copy: document.querySelector("#copy-button"),
  toast: document.querySelector("#toast")
};

let inputs = [];
let brief = null;
let editOwnership = createEditOwnership();
let composerMode = "text";
let toastTimer;
let traceSourceId = null;
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff"]);
const TEXT_EXTENSIONS = new Set([
  "txt", "md", "log", "out", "trace", "json", "yaml", "yml", "toml", "csv", "xml", "html", "css",
  "js", "mjs", "cjs", "ts", "tsx", "jsx", "py", "rs", "go", "java", "cs", "sh", "ps1", "files", "lst"
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function bytes(value) {
  if (!value) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 102.4) / 10} KB`;
  return `${Math.round(value / 1024 / 102.4) / 10} MB`;
}

function kindLabel(kind) {
  return {
    text: "NOTE",
    log: "LOG",
    "file-list": "FILES",
    screenshot: "IMAGE",
    url: "URL"
  }[kind] || "TEXT";
}

function notify(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("toast-visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("toast-visible"), 2800);
}

function compile() {
  if (!inputs.length) {
    brief = null;
    render();
    return;
  }

  brief = applyUserOwnedEdits(assertValidProvenance(compileIntake(inputs)), editOwnership);
  render();
}

function renderSources() {
  elements.sourceCount.textContent = String(brief?.sources.length || 0);
  if (!brief) {
    elements.sourceList.innerHTML = "";
    return;
  }

  elements.sourceList.innerHTML = brief.sources
    .map((source) => {
      const sourceRisks = brief.privacyRisks.filter((risk) => risk.pointer.sourceId === source.id);
      const preview = source.content
        ? redactText(source.content).split("\n").slice(0, 7).join("\n")
        : "No searchable text yet.";
      const image = source.previewUrl
        ? `<img class="source-image" src="${escapeHtml(source.previewUrl)}" alt="Local preview of ${escapeHtml(source.name)}" />`
        : "";
      const ocrButton =
        source.kind === "screenshot"
          ? `<button class="mini-button" data-ocr="${source.id}" type="button">${source.content ? "Run OCR again" : "Run local OCR"}</button>`
          : "";

      return `<article class="source-card" id="source-${source.id.toLowerCase()}" data-source-card="${source.id}">
        <div class="source-card-head">
          <span class="source-index">${source.id}</span>
          <div><strong>${escapeHtml(source.name)}</strong><small>${kindLabel(source.kind)} · ${bytes(source.byteSize)} · #${source.digest}</small></div>
          <button class="icon-button remove-source" data-remove="${source.id}" type="button" aria-label="Remove ${escapeHtml(source.name)}">×</button>
        </div>
        ${image}
        <pre>${escapeHtml(preview)}</pre>
        <div class="source-card-foot">
          <span class="source-risk ${sourceRisks.length ? "has-risk" : ""}">${sourceRisks.length ? `${sourceRisks.length} privacy flag${sourceRisks.length === 1 ? "" : "s"}` : "no flags"}</span>
          <div class="source-card-actions">
            <button class="mini-button trace-source" data-trace="${source.id}" type="button" aria-label="Trace every brief signal linked to ${escapeHtml(source.name)}">Trace links <span aria-hidden="true">↗</span></button>
            ${ocrButton}
          </div>
        </div>
      </article>`;
    })
    .join("");
}

function pointerButton(pointer) {
  return `<button class="pointer-chip" data-pointer="${escapeHtml(pointer.sourceId)}" type="button" title="${escapeHtml(pointer.excerpt || "Open source")}">${escapeHtml(pointerLabel(pointer))}</button>`;
}

function renderBrief() {
  const hasBrief = Boolean(brief);
  elements.briefEmpty.hidden = hasBrief;
  elements.briefContent.hidden = !hasBrief;
  elements.exportBar.hidden = !hasBrief;

  if (!brief) {
    elements.briefContent.innerHTML = "";
    elements.riskCount.textContent = "0";
    elements.riskSummary.textContent = "desk is clear";
    elements.riskMeter.dataset.level = "clear";
    return;
  }

  const highestRisk = brief.privacyRisks[0]?.severity || "clear";
  elements.riskCount.textContent = String(brief.privacyRisks.length);
  elements.riskSummary.textContent = highestRisk === "clear" ? "desk is clear" : `${highestRisk} review needed`;
  elements.riskMeter.dataset.level = highestRisk;

  const doneWhen = brief.doneWhen
    .map(
      (item, index) => `<li class="criterion ${item.included === false ? "criterion-off" : ""}">
        <label class="criterion-check">
          <input type="checkbox" data-done-included="${index}" ${item.included === false ? "" : "checked"} />
          <span></span>
        </label>
        <textarea rows="2" data-done-text="${index}" aria-label="Done-when criterion ${index + 1}">${escapeHtml(item.text)}</textarea>
        ${pointerButton(item.pointer)}
      </li>`
    )
    .join("");

  const findings = brief.findings
    .map(
      (item, index) => `<li class="ledger-row">
        <span class="finding-type type-${item.category}">${escapeHtml(item.category)}</span>
        <textarea rows="2" data-finding-text="${index}" aria-label="Context finding ${index + 1}">${escapeHtml(item.text)}</textarea>
        ${pointerButton(item.pointer)}
      </li>`
    )
    .join("");

  const risks = brief.privacyRisks.length
    ? brief.privacyRisks
        .map(
          (risk) => `<li class="risk-row severity-${risk.severity}">
            <span class="severity-mark">${escapeHtml(risk.severity)}</span>
            <div><strong>${escapeHtml(risk.label)}</strong><p>${escapeHtml(risk.maskedPreview)}</p><small>${escapeHtml(risk.guidance)}</small></div>
            ${pointerButton(risk.pointer)}
          </li>`
        )
        .join("")
    : `<li class="risk-clear"><span>✓</span><div><strong>No rule-based flags</strong><p>Still review the source register before sharing.</p></div></li>`;

  const gaps = brief.gaps.length
    ? brief.gaps
        .map((gap) => `<li><span>?</span><p>${escapeHtml(gap.text)}</p>${pointerButton(gap.pointer)}</li>`)
        .join("")
    : `<li><span>✓</span><p>No deterministic intake gaps detected.</p></li>`;

  elements.briefContent.innerHTML = `<div class="brief-sheet">
    <div class="sheet-index"><span>BRIEF / ${brief.sources.map((source) => source.id).join("+")}</span><span>${escapeHtml(brief.engine.mode)}</span></div>
    <label class="title-field">
      <span>TASK TITLE</span>
      <textarea id="brief-title" rows="2">${escapeHtml(brief.title)}</textarea>
    </label>
    <div class="objective-grid">
      <label>
        <span>OBJECTIVE</span>
        <textarea id="brief-objective" rows="4">${escapeHtml(brief.objective)}</textarea>
      </label>
      <div class="situation-card">
        <span>INTAKE SIGNAL</span>
        <strong>${escapeHtml(brief.situation)}</strong>
        ${pointerButton(brief.primaryPointer)}
      </div>
    </div>

    <section class="brief-section done-section">
      <div class="section-heading"><div><span>01</span><h3>Done when</h3></div><button class="mini-button" id="add-criterion-button" type="button">+ add criterion</button></div>
      <ol class="criteria-list">${doneWhen}</ol>
    </section>

    <section class="brief-section">
      <div class="section-heading"><div><span>02</span><h3>Context ledger</h3></div><small>editable candidates · source-linked</small></div>
      <ul class="ledger-list">${findings}</ul>
    </section>

    <section class="brief-section privacy-section">
      <div class="section-heading"><div><span>03</span><h3>Privacy review</h3></div><small>values masked in exports</small></div>
      <ul class="risk-list">${risks}</ul>
    </section>

    <section class="brief-section gaps-section">
      <div class="section-heading"><div><span>04</span><h3>Open gaps</h3></div><small>questions, not facts</small></div>
      <ul class="gap-list">${gaps}</ul>
    </section>
  </div>`;

  document.querySelector("#brief-title").addEventListener("input", (event) => {
    brief.title = event.target.value;
    recordScalarEdit(editOwnership, "title", event.target.value);
  });
  document.querySelector("#brief-objective").addEventListener("input", (event) => {
    brief.objective = event.target.value;
    recordScalarEdit(editOwnership, "objective", event.target.value);
  });
  document.querySelectorAll("[data-done-text]").forEach((control) => {
    control.addEventListener("input", (event) => {
      const item = brief.doneWhen[Number(event.target.dataset.doneText)];
      item.text = event.target.value;
      recordCriterionEdit(editOwnership, item, "text", event.target.value);
    });
  });
  document.querySelectorAll("[data-done-included]").forEach((control) => {
    control.addEventListener("change", (event) => {
      const item = brief.doneWhen[Number(event.target.dataset.doneIncluded)];
      item.included = event.target.checked;
      recordCriterionEdit(editOwnership, item, "included", event.target.checked);
      event.target.closest(".criterion").classList.toggle("criterion-off", !event.target.checked);
    });
  });
  document.querySelectorAll("[data-finding-text]").forEach((control) => {
    control.addEventListener("input", (event) => {
      const item = brief.findings[Number(event.target.dataset.findingText)];
      recordFindingEdit(editOwnership, brief, item, event.target.value);
      item.text = event.target.value;
    });
  });
  document.querySelector("#add-criterion-button").addEventListener("click", () => {
    brief.doneWhen.push(createManualCriterion(editOwnership));
    renderBrief();
    document.querySelector("[data-done-text]:last-of-type")?.focus();
  });
}

function render() {
  renderSources();
  renderBrief();
  applyTrace();
}

function applyTrace() {
  const sourceExists = brief?.sources.some((source) => source.id === traceSourceId);
  if (!sourceExists) traceSourceId = null;
  const active = Boolean(traceSourceId);
  document.body.classList.toggle("trace-active", active);
  elements.traceLens.hidden = !active;

  const pointers = [...document.querySelectorAll("[data-pointer]")];
  const sourceCards = [...document.querySelectorAll("[data-source-card]")];
  const signalGroups = [...document.querySelectorAll(".situation-card, .criterion, .ledger-row, .risk-row, .gap-list li")];

  pointers.forEach((pointer) => {
    pointer.classList.toggle("pointer-traced", active && pointer.dataset.pointer === traceSourceId);
  });
  sourceCards.forEach((card) => {
    card.classList.toggle("source-traced", active && card.dataset.sourceCard === traceSourceId);
    card.classList.toggle("trace-dim", active && card.dataset.sourceCard !== traceSourceId);
  });
  signalGroups.forEach((group) => {
    const linked = Boolean(active && group.querySelector(`[data-pointer="${CSS.escape(traceSourceId)}"]`));
    group.classList.toggle("trace-linked", linked);
    group.classList.toggle("trace-dim", active && !linked);
  });

  if (active) {
    const linkedCount = pointers.filter((pointer) => pointer.dataset.pointer === traceSourceId).length;
    elements.traceSummary.textContent = `${traceSourceId} · ${linkedCount} linked brief signal${linkedCount === 1 ? "" : "s"}`;
  }
}

function activateTrace(sourceId, scrollToSource = true) {
  if (!brief || sourceId === "USER" || !brief.sources.some((source) => source.id === sourceId)) return;
  traceSourceId = sourceId;
  applyTrace();
  const card = document.querySelector(`[data-source-card="${CSS.escape(sourceId)}"]`);
  if (scrollToSource) card?.scrollIntoView({ behavior: "smooth", block: "center" });
  if (card) {
    card.classList.remove("source-pulse");
    requestAnimationFrame(() => card.classList.add("source-pulse"));
  }
}

function clearTrace() {
  traceSourceId = null;
  applyTrace();
}

function showComposer(mode) {
  composerMode = mode;
  const urlMode = mode === "url";
  elements.composer.hidden = false;
  elements.composerTitle.textContent = urlMode ? "Register URL" : "Paste input";
  elements.composerKindWrap.hidden = urlMode;
  elements.composerName.value = urlMode ? "reference-url" : "pasted-note.txt";
  elements.composerContentLabel.textContent = urlMode ? "URL (registered, never fetched)" : "Content";
  elements.composerContent.placeholder = urlMode ? "https://example.com/issue/123" : "Paste the unorganized task material here…";
  elements.composerContent.value = "";
  elements.composerContent.focus();
}

function hideComposer() {
  elements.composer.hidden = true;
}

function loadDemo() {
  for (const source of inputs) {
    if (source.previewUrl) URL.revokeObjectURL(source.previewUrl);
  }
  inputs = DEMO_SOURCES.map((source) => ({ ...source }));
  brief = null;
  traceSourceId = null;
  editOwnership = createEditOwnership();
  compile();
  document.querySelector(".workspace").scrollIntoView({ behavior: "smooth", block: "start" });
  notify("Demo compiled locally: 3 sources, 1 task contract.");
}

function clearDesk() {
  for (const source of inputs) {
    if (source.previewUrl) URL.revokeObjectURL(source.previewUrl);
  }
  inputs = [];
  brief = null;
  traceSourceId = null;
  editOwnership = createEditOwnership();
  hideComposer();
  render();
  notify("Local desk cleared.");
}

function fileKind(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  if (IMAGE_EXTENSIONS.has(extension)) return "screenshot";
  if (["log", "out", "trace"].includes(extension)) return "log";
  if (["files", "lst"].includes(extension)) return "file-list";
  if (TEXT_EXTENSIONS.has(extension) || file.type.startsWith("text/")) return "text";
  return null;
}

async function addFiles(fileList) {
  const selected = [...fileList];
  let added = 0;
  for (const file of selected) {
    if (file.size > 12 * 1024 * 1024) {
      notify(`${file.name} is larger than the 12 MB local limit.`);
      continue;
    }
    const kind = fileKind(file);
    if (!kind) {
      notify(`${file.name} is not extracted in v0.1. Use a text export or transcript.`);
      continue;
    }
    if (kind === "screenshot") {
      inputs.push({
        name: file.name,
        kind,
        mimeType: file.type,
        byteSize: file.size,
        content: "",
        previewUrl: URL.createObjectURL(file),
        file
      });
    } else {
      inputs.push({
        name: file.name,
        kind,
        mimeType: file.type || "text/plain",
        byteSize: file.size,
        content: await file.text(),
        file
      });
    }
    added += 1;
  }
  if (added) {
    compile();
    notify(`${added} selected source${added === 1 ? "" : "s"} added.`);
  }
}

function fileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error || new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

async function runOcr(sourceId, button) {
  const source = brief.sources.find((item) => item.id === sourceId);
  const input = inputs[brief.sources.indexOf(source)];
  if (!input?.file) {
    notify("This demo image has no local file handle. Add the screenshot again.");
    return;
  }

  button.disabled = true;
  button.textContent = "OCR running…";
  try {
    const response = await fetch("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataBase64: await fileAsBase64(input.file) })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Local OCR failed.");
    input.content = result.text;
    input.ocr = result;
    compile();
    notify(`Local OCR complete · ${result.confidence ?? "—"}% confidence.`);
  } catch (error) {
    button.disabled = false;
    button.textContent = "Run local OCR";
    notify(error instanceof Error ? error.message : "Local OCR failed.");
  }
}

function download(name, content, type) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

async function copyForCodex() {
  if (!brief) return;
  const content = toCodexPrompt(brief);
  try {
    await navigator.clipboard.writeText(content);
  } catch {
    const helper = document.createElement("textarea");
    helper.value = content;
    document.body.append(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }
  notify("Redacted task contract copied for Codex.");
}

elements.demo.addEventListener("click", loadDemo);
elements.emptyDemo.addEventListener("click", loadDemo);
elements.clear.addEventListener("click", clearDesk);
elements.addNote.addEventListener("click", () => showComposer("text"));
elements.addUrl.addEventListener("click", () => showComposer("url"));
elements.closeComposer.addEventListener("click", hideComposer);
elements.chooseFiles.addEventListener("click", (event) => {
  event.stopPropagation();
  elements.fileInput.click();
});
elements.dropzone.addEventListener("click", (event) => {
  if (event.target.closest("button")) return;
  elements.fileInput.click();
});
elements.dropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") elements.fileInput.click();
});
elements.fileInput.addEventListener("change", (event) => addFiles(event.target.files));
elements.dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  elements.dropzone.classList.add("dropzone-active");
});
elements.dropzone.addEventListener("dragleave", () => elements.dropzone.classList.remove("dropzone-active"));
elements.dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  elements.dropzone.classList.remove("dropzone-active");
  addFiles(event.dataTransfer.files);
});
elements.composer.addEventListener("submit", (event) => {
  event.preventDefault();
  const content = elements.composerContent.value.trim();
  if (!content) {
    notify("Add some source content first.");
    return;
  }
  inputs.push({
    name: elements.composerName.value.trim() || (composerMode === "url" ? "reference-url" : "pasted-note.txt"),
    kind: composerMode === "url" ? "url" : elements.composerKind.value,
    content
  });
  hideComposer();
  compile();
  notify(composerMode === "url" ? "URL registered without fetching." : "Pasted source added.");
});
elements.sourceList.addEventListener("click", (event) => {
  const remove = event.target.closest("[data-remove]");
  if (remove) {
    const source = brief.sources.find((item) => item.id === remove.dataset.remove);
    const index = brief.sources.indexOf(source);
    if (inputs[index]?.previewUrl) URL.revokeObjectURL(inputs[index].previewUrl);
    inputs.splice(index, 1);
    compile();
    notify("Source removed; the brief was regenerated.");
    return;
  }
  const ocr = event.target.closest("[data-ocr]");
  if (ocr) {
    runOcr(ocr.dataset.ocr, ocr);
    return;
  }
  const trace = event.target.closest("[data-trace]");
  if (trace) {
    activateTrace(trace.dataset.trace, false);
    return;
  }
  const sourceCard = event.target.closest("[data-source-card]");
  if (sourceCard) activateTrace(sourceCard.dataset.sourceCard, false);
});
document.addEventListener("click", (event) => {
  const pointer = event.target.closest("[data-pointer]");
  if (!pointer || pointer.dataset.pointer === "USER") return;
  activateTrace(pointer.dataset.pointer);
});
elements.traceClear.addEventListener("click", clearTrace);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && traceSourceId) clearTrace();
});
elements.downloadJson.addEventListener("click", () => {
  download("codex-intake-brief.json", toJson(brief), "application/json");
  notify("Redacted JSON downloaded.");
});
elements.downloadMarkdown.addEventListener("click", () => {
  download("codex-intake-brief.md", toMarkdown(brief), "text/markdown");
  notify("Redacted Markdown downloaded.");
});
elements.copy.addEventListener("click", copyForCodex);

render();
