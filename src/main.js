import "./styles.css";
import { assignSourceIds, redactText } from "./core/intake.js";
import {
  confirmCriterion,
  createEditOwnership,
  createManualCriterion,
  recordCriterionEdit,
  recordFindingEdit,
  recordScalarEdit
} from "./core/edit-ownership.js";
import { pointerLabel, toCodexPrompt, toJson, toMarkdown } from "./core/export.js";
import { DEMO_SOURCES } from "./demo.js";
import { buildReviewedBrief, planSourceUpdate, replaceSourceInput } from "./core/source-updates.js";

const elements = {
  sourceCount: document.querySelector("#source-count"),
  sourceList: document.querySelector("#source-list"),
  dropzone: document.querySelector("#dropzone"),
  fileInput: document.querySelector("#file-input"),
  replaceFileInput: document.querySelector("#replace-file-input"),
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
let pendingUpdate = null;
let undoInputs = null;
let nextSourceNumber = 1;
let composerSourceId = null;
let replacementSourceId = null;
let sourceBusy = false;
let deskEpoch = 0;
let ocrAbort = null;
const previewUrls = new Set();
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

  inputs = assignSourceIds(inputs);
  nextSourceNumber = Math.max(nextSourceNumber, ...inputs.map(input => Number(input.id.slice(1)) + 1));
  brief = buildReviewedBrief(inputs, editOwnership, brief);
  render();
}

function syncUpdateControls() {
  const controls = [elements.chooseFiles, elements.fileInput, elements.replaceFileInput, elements.addNote, elements.addUrl,
    elements.demo, elements.emptyDemo, ...elements.sourceList.querySelectorAll("[data-remove],[data-ocr],[data-edit-source],[data-replace-file]"),
    elements.composer.querySelector("button[type=submit]")];
  for (const control of controls) if (control) control.disabled = sourceBusy || Boolean(pendingUpdate);
  elements.dropzone.setAttribute("aria-disabled", String(sourceBusy || Boolean(pendingUpdate)));
  for (const control of elements.briefContent.querySelectorAll("input,textarea,button")) control.disabled = Boolean(pendingUpdate);
  for (const control of [elements.downloadJson, elements.downloadMarkdown, elements.copy]) control.disabled = Boolean(pendingUpdate);
  document.querySelector("#undo-source-update").disabled = sourceBusy || Boolean(pendingUpdate);
}

function mayChangeSources() {
  if (pendingUpdate) { notify("Accept or discard the pending source update first."); return false; }
  if (sourceBusy) { notify("Wait for the selected source to finish reading."); return false; }
  return true;
}

function releaseUnusedPreviews() {
  const used = new Set([...inputs, ...(pendingUpdate?.inputs || []), ...(undoInputs || [])].map(input => input.previewUrl).filter(Boolean));
  for (const url of previewUrls) if (!used.has(url)) { URL.revokeObjectURL(url); previewUrls.delete(url); }
}

function stageSourceInputs(nextInputs, message) {
  if (!inputs.length && !brief) {
    inputs = nextInputs;
    compile();
    notify(message);
    return;
  }
  pendingUpdate = planSourceUpdate({ inputs, brief, ownership: editOwnership, nextInputs });
  clearTimeout(toastTimer);
  elements.toast.classList.remove("toast-visible");
  hideComposer();
  render();
  document.querySelector("#source-update-review").scrollIntoView({ behavior: "smooth", block: "start" });
  document.querySelector("#accept-source-update").focus({ preventScroll: true });
}

function acceptSourceUpdate() {
  if (!pendingUpdate) return;
  undoInputs = inputs.map(input => ({ ...input }));
  inputs = pendingUpdate.inputs;
  brief = pendingUpdate.brief;
  pendingUpdate = null;
  render();
  releaseUnusedPreviews();
  notify("Source update accepted. Review retained edits marked as source-changed.");
}

function discardSourceUpdate() {
  pendingUpdate = null;
  render();
  releaseUnusedPreviews();
  notify("Source update discarded. Your accepted brief and edits are unchanged.");
}

function undoSourceUpdate() {
  if (!undoInputs || pendingUpdate || sourceBusy) return;
  const restored = planSourceUpdate({ inputs, brief, ownership: editOwnership, nextInputs: undoInputs, allowRollback: true });
  inputs = restored.inputs;
  brief = restored.brief;
  undoInputs = null;
  render();
  releaseUnusedPreviews();
  notify("Last source update undone. Your manual edits are kept.");
}

function renderSourceUpdate() {
  document.body.classList.toggle("has-source-update", Boolean(pendingUpdate));
  const panel = document.querySelector("#source-update-review");
  panel.hidden = !pendingUpdate;
  document.querySelector("#source-update-undo").hidden = !undoInputs || Boolean(pendingUpdate);
  if (!pendingUpdate) { panel.innerHTML = ""; return; }
  const plan = pendingUpdate;
  const sources = plan.sourceChanges.map(change => `<li><strong>${change.id}</strong> ${escapeHtml(redactText(change.name))} <span>${change.kind} · ${change.fromRevision ? `r${change.fromRevision} → ` : ""}${change.toRevision ? `r${change.toRevision}` : "removed"}</span></li>`).join("");
  const changes = plan.changes.map(change => `<li class="update-change ${change.needsReview ? "update-needs-review" : ""}">
    <div><strong>${escapeHtml(change.collection)} · ${change.kind}</strong>${change.retainedEdit ? '<span class="ownership-badge">manual edit kept</span>' : ""}</div>
    ${change.before ? `<p class="update-before"><b>Before</b> ${escapeHtml(redactText(change.before))}</p>` : ""}
    ${change.after ? `<p class="update-after"><b>After</b> ${escapeHtml(redactText(change.after))}</p>` : ""}
    ${change.needsReview ? '<small>Old source reference retained · review required</small>' : ""}</li>`).join("");
  panel.innerHTML = `<div class="update-heading"><span class="eyebrow">SOURCE UPDATE</span><h3>Review what will change</h3></div>
    <p class="update-summary">${plan.sourceChanges.length} source change${plan.sourceChanges.length === 1 ? "" : "s"} · ${plan.changes.length} brief changes · ${plan.preservedEdits} manual edit record${plan.preservedEdits === 1 ? "" : "s"} kept</p>
    <ul class="update-sources">${sources}</ul>
    ${plan.needsReview ? `<p class="update-warning">${plan.needsReview} retained edit${plan.needsReview === 1 ? " needs" : "s need"} source review.</p>` : ""}
    <details open><summary>Before and after · ${plan.changes.length} changes</summary><ul class="update-changes">${changes || '<li>No rule suggestion text changed.</li>'}</ul></details>
    <p class="update-note">Accepting this batch updates the sources. Rule candidates still need your separate confirmation.</p>
    <div class="update-actions"><button id="accept-source-update" class="button button-primary" type="button">Accept all source changes</button><button id="discard-source-update" class="button button-secondary" type="button">Discard update</button></div>`;
  panel.querySelector("#accept-source-update").addEventListener("click", acceptSourceUpdate);
  panel.querySelector("#discard-source-update").addEventListener("click", discardSourceUpdate);
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
          <div><strong>${escapeHtml(source.name)}</strong><small>r${source.revision} · ${kindLabel(source.kind)} · ${bytes(source.byteSize)} · #${source.digest}</small></div>
          <button class="icon-button remove-source" data-remove="${source.id}" type="button" aria-label="Remove ${escapeHtml(source.name)}">×</button>
        </div>
        ${image}
        <pre>${escapeHtml(preview)}</pre>
        <div class="source-card-foot">
          <span class="source-risk ${sourceRisks.length ? "has-risk" : ""}">${sourceRisks.length ? `${sourceRisks.length} privacy flag${sourceRisks.length === 1 ? "" : "s"}` : "no flags"}</span>
          <div class="source-card-actions">
            <button class="mini-button trace-source" data-trace="${source.id}" type="button" aria-label="Trace every brief signal linked to ${escapeHtml(source.name)}">Trace links <span aria-hidden="true">↗</span></button>
            ${source.kind !== "screenshot" ? `<button class="mini-button" data-edit-source="${source.id}" type="button">Update source</button>` : ""}
            <button class="mini-button" data-replace-file="${source.id}" type="button">Replace file</button>
            ${ocrButton}
          </div>
        </div>
      </article>`;
    })
    .join("");
  if (brief.sourceHistory?.length) {
    elements.sourceList.innerHTML += `<section class="source-history" aria-label="Retained source references"><h3>Retained references</h3><p>Older or removed source revisions used by your preserved edits.</p>${brief.sourceHistory.map(source => `<article data-history-source="${source.id}" data-history-revision="${source.revision}"><strong>${source.id} · r${source.revision}</strong><span>${escapeHtml(redactText(source.name))}</span><small>Previous fingerprint #${source.digest} · raw content omitted</small></article>`).join("")}</section>`;
  }
}

function pointerButton(pointer) {
  return `<button class="pointer-chip" data-pointer="${escapeHtml(pointer.sourceId)}" data-pointer-revision="${pointer.sourceRevision ?? ""}" type="button" title="${escapeHtml(redactText(pointer.excerpt || "Open source"))}">${escapeHtml(pointerLabel(pointer))}</button>`;
}

function reviewLabel(item) {
  if (item.reviewStatus === "needs-review") return "Source changed · review";
  if (item.confirmed) return "User confirmed";
  if (item.authorship === "user-authored") return "User-authored candidate";
  if (item.authorship === "user-edited") return "Edited candidate";
  return "Rule candidate";
}

function renderBrief() {
  const hasBrief = Boolean(brief);
  elements.briefEmpty.hidden = hasBrief;
  elements.briefContent.hidden = !hasBrief;
  elements.exportBar.hidden = !hasBrief || Boolean(pendingUpdate);

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
      (item, index) => `<li class="criterion ${item.included === false ? "criterion-off" : ""} ${item.reviewStatus === "needs-review" ? "item-needs-review" : ""}">
        <label class="criterion-check">
          <input type="checkbox" aria-label="Include criterion ${index + 1}" data-done-included="${index}" ${item.included === false ? "" : "checked"} />
          <span></span>
        </label>
        <textarea rows="2" data-done-text="${index}" aria-label="Done-when criterion ${index + 1}">${escapeHtml(item.text)}</textarea>
        ${pointerButton(item.pointer)}
        <div class="criterion-meta"><span class="status-text ownership-badge">${reviewLabel(item)}</span><button class="mini-button" data-confirm-criterion="${index}" type="button">${item.reviewStatus === "needs-review" ? "Keep as my requirement" : item.confirmed ? "Mark as candidate" : "Confirm requirement"}</button>${item.previousPointer ? `<small>Previous ${pointerButton(item.previousPointer)}</small>` : ""}</div>
      </li>`
    )
    .join("");

  const findings = brief.findings
    .map(
      (item, index) => `<li class="ledger-row ${item.reviewStatus === "needs-review" ? "item-needs-review" : ""}">
        <span class="finding-type type-${item.category}">${escapeHtml(item.category)}</span>
        <textarea rows="2" data-finding-text="${index}" aria-label="Context finding ${index + 1}">${escapeHtml(item.text)}</textarea>
        ${pointerButton(item.pointer)}
        <div class="finding-meta"><span class="status-text ownership-badge">${reviewLabel(item)}</span></div>
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
      <span>TASK TITLE <small id="title-ownership" class="field-ownership">${brief.fieldOwnership?.title === "user-edited" ? "user edited" : "rule candidate"}</small></span>
      <textarea id="brief-title" rows="2">${escapeHtml(brief.title)}</textarea>
    </label>
    <div class="objective-grid">
      <label>
        <span>OBJECTIVE <small id="objective-ownership" class="field-ownership">${brief.fieldOwnership?.objective === "user-edited" ? "user edited" : "rule candidate"}</small></span>
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
    brief.fieldOwnership.title = "user-edited";
    document.querySelector("#title-ownership").textContent = "user edited";
  });
  document.querySelector("#brief-objective").addEventListener("input", (event) => {
    brief.objective = event.target.value;
    recordScalarEdit(editOwnership, "objective", event.target.value);
    brief.fieldOwnership.objective = "user-edited";
    document.querySelector("#objective-ownership").textContent = "user edited";
  });
  document.querySelectorAll("[data-done-text]").forEach((control) => {
    control.addEventListener("input", (event) => {
      const item = brief.doneWhen[Number(event.target.dataset.doneText)];
      recordCriterionEdit(editOwnership, item, "text", event.target.value, brief);
      item.text = event.target.value;
      event.target.closest(".criterion").querySelector(".status-text").textContent = reviewLabel(item);
      if (item.reviewStatus !== "needs-review") event.target.closest(".criterion").querySelector("[data-confirm-criterion]").textContent = "Confirm requirement";
    });
  });
  document.querySelectorAll("[data-done-included]").forEach((control) => {
    control.addEventListener("change", (event) => {
      const item = brief.doneWhen[Number(event.target.dataset.doneIncluded)];
      item.included = event.target.checked;
      recordCriterionEdit(editOwnership, item, "included", event.target.checked);
      event.target.closest(".criterion").querySelector(".status-text").textContent = reviewLabel(item);
      event.target.closest(".criterion").classList.toggle("criterion-off", !event.target.checked);
    });
  });
  document.querySelectorAll("[data-finding-text]").forEach((control) => {
    control.addEventListener("input", (event) => {
      const item = brief.findings[Number(event.target.dataset.findingText)];
      recordFindingEdit(editOwnership, brief, item, event.target.value);
      item.text = event.target.value;
      event.target.closest(".ledger-row").querySelector(".status-text").textContent = reviewLabel(item);
    });
  });
  document.querySelectorAll("[data-confirm-criterion]").forEach(control => {
    control.addEventListener("click", () => {
      confirmCriterion(editOwnership, brief, brief.doneWhen[Number(control.dataset.confirmCriterion)]);
      brief = buildReviewedBrief(inputs, editOwnership, brief);
      render();
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
  renderSourceUpdate();
  applyTrace();
  syncUpdateControls();
}

function applyTrace() {
  const sourceExists = brief?.sources.some((source) => source.id === traceSourceId);
  if (!sourceExists) traceSourceId = null;
  const active = Boolean(traceSourceId);
  const revision = brief?.sources.find(source => source.id === traceSourceId)?.revision;
  document.body.classList.toggle("trace-active", active);
  elements.traceLens.hidden = !active;

  const pointers = [...document.querySelectorAll("[data-pointer]")];
  const sourceCards = [...document.querySelectorAll("[data-source-card]")];
  const signalGroups = [...document.querySelectorAll(".situation-card, .criterion, .ledger-row, .risk-row, .gap-list li")];

  pointers.forEach((pointer) => {
    pointer.classList.toggle("pointer-traced", active && pointer.dataset.pointer === traceSourceId && Number(pointer.dataset.pointerRevision || 1) === revision);
  });
  sourceCards.forEach((card) => {
    card.classList.toggle("source-traced", active && card.dataset.sourceCard === traceSourceId);
    card.classList.toggle("trace-dim", active && card.dataset.sourceCard !== traceSourceId);
  });
  signalGroups.forEach((group) => {
    const linked = Boolean(active && group.querySelector(`[data-pointer="${CSS.escape(traceSourceId)}"][data-pointer-revision="${revision}"]`));
    group.classList.toggle("trace-linked", linked);
    group.classList.toggle("trace-dim", active && !linked);
  });

  if (active) {
    const linkedCount = pointers.filter((pointer) => pointer.dataset.pointer === traceSourceId && Number(pointer.dataset.pointerRevision || 1) === revision).length;
    elements.traceSummary.textContent = `${traceSourceId} r${revision} · ${linkedCount} linked brief signal${linkedCount === 1 ? "" : "s"}`;
  }
}

function activateTrace(sourceId, scrollToSource = true, sourceRevision = null) {
  const current = brief?.sources.find(source => source.id === sourceId);
  if (sourceRevision && current?.revision !== sourceRevision) {
    clearTrace();
    const reference = document.querySelector(`[data-history-source="${CSS.escape(sourceId)}"][data-history-revision="${sourceRevision}"]`);
    reference?.scrollIntoView({ behavior: "smooth", block: "center" });
    reference?.classList.add("source-pulse");
    notify(`${sourceId} r${sourceRevision} is a retained reference from an older or removed source.`);
    return;
  }
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

function showComposer(mode, sourceId = null) {
  if (!mayChangeSources()) return;
  composerMode = mode;
  composerSourceId = sourceId;
  const source = inputs.find(input => input.id === sourceId);
  const urlMode = mode === "url";
  elements.composer.hidden = false;
  elements.composerTitle.textContent = source ? `Update ${source.id} · r${source.revision}` : urlMode ? "Register URL" : "Paste input";
  elements.composerKindWrap.hidden = urlMode;
  elements.composerKind.value = source?.kind || "text";
  elements.composerName.value = source?.name || (urlMode ? "reference-url" : "pasted-note.txt");
  elements.composerContentLabel.textContent = urlMode ? "URL (registered, never fetched)" : "Content";
  elements.composerContent.placeholder = urlMode ? "https://example.com/issue/123" : "Paste the unorganized task material here…";
  elements.composerContent.value = source?.content || "";
  elements.composer.querySelector("button[type=submit]").textContent = source ? "Review source replacement" : "Add to desk";
  elements.composerContent.focus();
}

function hideComposer() {
  elements.composer.hidden = true;
}

function loadDemo() {
  clearDesk(false);
  inputs = assignSourceIds(DEMO_SOURCES.map((source) => ({ ...source })));
  compile();
  document.querySelector(".workspace").scrollIntoView({ behavior: "smooth", block: "start" });
  notify("Demo compiled locally: 3 sources, 1 task contract.");
}

function clearDesk(showNotice = true) {
  deskEpoch += 1;
  ocrAbort?.abort();
  ocrAbort = null;
  sourceBusy = false;
  for (const url of previewUrls) URL.revokeObjectURL(url);
  previewUrls.clear();
  inputs = [];
  brief = null;
  pendingUpdate = null;
  undoInputs = null;
  nextSourceNumber = 1;
  composerSourceId = null;
  replacementSourceId = null;
  traceSourceId = null;
  editOwnership = createEditOwnership();
  hideComposer();
  render();
  if (showNotice) notify("Local desk cleared.");
}

function fileKind(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  if (IMAGE_EXTENSIONS.has(extension)) return "screenshot";
  if (["log", "out", "trace"].includes(extension)) return "log";
  if (["files", "lst"].includes(extension)) return "file-list";
  if (TEXT_EXTENSIONS.has(extension) || file.type.startsWith("text/")) return "text";
  return null;
}

async function addFiles(fileList, replaceId = null) {
  if (!mayChangeSources()) return;
  const selected = [...fileList];
  if (!selected.length) return;
  if (replaceId && selected.length !== 1) { notify("Choose one file to replace this source."); return; }
  const epoch = deskEpoch;
  sourceBusy = true;
  syncUpdateControls();
  const added = [];
  try {
    for (const file of selected) {
      if (epoch !== deskEpoch) return;
      if (file.size > 12 * 1024 * 1024) { notify(`${redactText(file.name)} is larger than the 12 MB local limit.`); continue; }
      const kind = fileKind(file);
      if (!kind) { notify(`${redactText(file.name)} is not extracted. Use a text export or transcript.`); continue; }
      const input = { name: file.name, kind, mimeType: file.type || "text/plain", byteSize: file.size, content: "", file };
      if (kind === "screenshot") {
        input.previewUrl = URL.createObjectURL(file);
        previewUrls.add(input.previewUrl);
      } else input.content = await file.text();
      if (epoch !== deskEpoch) return;
      if (!replaceId) { input.id = `S${String(nextSourceNumber++).padStart(2, "0")}`; input.revision = 1; }
      added.push(input);
    }
    sourceBusy = false;
    if (added.length) {
      const next = replaceId ? replaceSourceInput(inputs, replaceId, added[0]) : [...inputs, ...added];
      stageSourceInputs(next, `${added.length} selected source${added.length === 1 ? "" : "s"} added.`);
    }
  } catch (error) {
    if (epoch === deskEpoch) notify(error instanceof Error ? error.message : "Could not read the selected source.");
  } finally {
    if (epoch === deskEpoch) { sourceBusy = false; syncUpdateControls(); releaseUnusedPreviews(); }
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
  if (!mayChangeSources()) return;
  const input = inputs.find(item => item.id === sourceId);
  if (!input?.file) {
    notify("This demo image has no local file handle. Add the screenshot again.");
    return;
  }

  const epoch = deskEpoch;
  const revision = input.revision;
  const controller = new AbortController();
  ocrAbort = controller;
  sourceBusy = true;
  syncUpdateControls();
  button.textContent = "OCR running…";
  try {
    const response = await fetch("/api/ocr", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataBase64: await fileAsBase64(input.file) })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Local OCR failed.");
    if (epoch !== deskEpoch || inputs.find(item => item.id === sourceId)?.revision !== revision) return;
    sourceBusy = false;
    stageSourceInputs(replaceSourceInput(inputs, sourceId, { ...input, content: result.text, ocr: result }), "Local OCR ready.");
  } catch (error) {
    if (epoch === deskEpoch && !controller.signal.aborted) notify(error instanceof Error ? error.message : "Local OCR failed.");
  } finally {
    if (epoch === deskEpoch) { sourceBusy = false; ocrAbort = null; if (pendingUpdate) syncUpdateControls(); else render(); }
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
  if (!mayChangeSources()) return;
  elements.fileInput.click();
});
elements.dropzone.addEventListener("click", (event) => {
  if (event.target.closest("button,input") || !mayChangeSources()) return;
  elements.fileInput.click();
});
elements.dropzone.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && mayChangeSources()) { event.preventDefault(); elements.fileInput.click(); }
});
elements.fileInput.addEventListener("change", (event) => { void addFiles(event.target.files); event.target.value = ""; });
elements.replaceFileInput.addEventListener("change", (event) => { void addFiles(event.target.files, replacementSourceId); event.target.value = ""; });
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
  if (!mayChangeSources()) return;
  const content = elements.composerContent.value.trim();
  if (!content) {
    notify("Add some source content first.");
    return;
  }
  const source = inputs.find(input => input.id === composerSourceId);
  if (composerSourceId && !source) { notify("The source being edited is no longer on the desk."); return; }
  const next = {
    name: elements.composerName.value.trim() || (composerMode === "url" ? "reference-url" : "pasted-note.txt"),
    kind: composerMode === "url" ? "url" : elements.composerKind.value,
    content,
    mimeType: "text/plain",
    byteSize: new TextEncoder().encode(content).byteLength
  };
  let nextInputs;
  if (source) nextInputs = replaceSourceInput(inputs, source.id, next);
  else {
    next.id = `S${String(nextSourceNumber++).padStart(2, "0")}`;
    next.revision = 1;
    nextInputs = [...inputs, next];
  }
  hideComposer();
  stageSourceInputs(nextInputs, composerMode === "url" ? "URL registered without fetching." : "Pasted source added.");
});
elements.sourceList.addEventListener("click", (event) => {
  const remove = event.target.closest("[data-remove]");
  if (remove) {
    if (!mayChangeSources()) return;
    stageSourceInputs(inputs.filter(input => input.id !== remove.dataset.remove), "Source removed.");
    return;
  }
  const edit = event.target.closest("[data-edit-source]");
  if (edit) {
    const source = inputs.find(input => input.id === edit.dataset.editSource);
    if (source) showComposer(source.kind === "url" ? "url" : "text", source.id);
    return;
  }
  const replace = event.target.closest("[data-replace-file]");
  if (replace) {
    if (!mayChangeSources()) return;
    replacementSourceId = replace.dataset.replaceFile;
    elements.replaceFileInput.click();
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
  activateTrace(pointer.dataset.pointer, true, pointer.dataset.pointerRevision ? Number(pointer.dataset.pointerRevision) : null);
});
document.querySelector("#undo-source-update").addEventListener("click", undoSourceUpdate);
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
