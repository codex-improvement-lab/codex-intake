import { describe, expect, it } from "vitest";
import { compileIntake, redactText } from "../src/core/intake.js";
import {
  applyUserOwnedEdits,
  createEditOwnership,
  createManualCriterion,
  recordCriterionEdit,
  recordFindingEdit,
  recordScalarEdit
} from "../src/core/edit-ownership.js";
import { toJson, toMarkdown, toPortableBrief } from "../src/core/export.js";
import { validateProvenance } from "../src/core/validate.js";
import { DEMO_AUTH_FIXTURE, DEMO_SOURCES } from "../src/demo.js";

describe("deterministic intake compiler", () => {
  it("turns the demo pile into a traceable task contract", () => {
    const brief = compileIntake(DEMO_SOURCES);

    expect(brief.title).toBe("Checkout export crashes after redaction");
    expect(brief.sources.map((source) => source.id)).toEqual(["S01", "S02", "S03"]);
    expect(brief.findings.some((item) => item.category === "problem")).toBe(true);
    expect(brief.findings.some((item) => item.category === "requirement")).toBe(true);
    expect(brief.findings.some((item) => item.category === "command")).toBe(true);
    expect(brief.findings.some((item) => item.pointer.locator.startsWith("entry"))).toBe(true);
    expect(brief.doneWhen.length).toBeGreaterThanOrEqual(4);
    expect(validateProvenance(brief)).toEqual([]);
  });

  it("is stable for identical ordered inputs", () => {
    expect(compileIntake(DEMO_SOURCES)).toEqual(compileIntake(DEMO_SOURCES));
  });

  it("keeps screenshot uncertainty explicit until OCR runs", () => {
    const brief = compileIntake([
      { name: "failure.png", kind: "screenshot", byteSize: 1200, content: "" }
    ]);

    expect(brief.findings[0].text).toContain("OCR has not been run");
    expect(brief.gaps[0].pointer).toMatchObject({ sourceId: "S01", locator: "image" });
    expect(validateProvenance(brief)).toEqual([]);
  });

  it("keeps every directly edited field user-owned across source and OCR recompiles", () => {
    const ownership = createEditOwnership();
    const initial = applyUserOwnedEdits(compileIntake(DEMO_SOURCES), ownership);
    const editedCriterion = initial.doneWhen[0];
    const editedFinding = initial.findings[0];

    recordScalarEdit(ownership, "title", "User-owned title");
    recordScalarEdit(ownership, "objective", "User-owned objective");
    recordCriterionEdit(ownership, editedCriterion, "text", "User-owned completion check");
    recordCriterionEdit(ownership, editedCriterion, "included", false);
    recordFindingEdit(ownership, initial, editedFinding, "User-reviewed context");
    const manual = createManualCriterion(ownership);
    recordCriterionEdit(ownership, manual, "text", "Manual acceptance check");

    const withScreenshot = applyUserOwnedEdits(
      compileIntake([
        ...DEMO_SOURCES,
        { name: "mac handoff.png", kind: "screenshot", byteSize: 1200, content: "" }
      ]),
      ownership
    );
    expect(withScreenshot).toMatchObject({ title: "User-owned title", objective: "User-owned objective" });
    expect(withScreenshot.doneWhen.find((item) => item.rule === editedCriterion.rule)).toMatchObject({
      text: "User-owned completion check",
      included: false
    });
    expect(withScreenshot.findings.find((item) => item.id === editedFinding.id)?.text).toBe("User-reviewed context");
    expect(withScreenshot.doneWhen.at(-1)).toMatchObject({
      text: "Manual acceptance check",
      rule: "user-authored",
      pointer: { sourceId: "USER", locator: "manual" }
    });

    const afterOcr = applyUserOwnedEdits(
      compileIntake([
        ...DEMO_SOURCES,
        {
          name: "mac handoff.png",
          kind: "screenshot",
          byteSize: 1200,
          content: "ERROR: export still fails\npnpm test -- export",
          ocr: { engine: "tesseract.js", languages: ["eng"], confidence: 90 }
        }
      ]),
      ownership
    );
    expect(afterOcr.objective).toBe("User-owned objective");
    expect(afterOcr.doneWhen.at(-1)?.text).toBe("Manual acceptance check");
    expect(afterOcr.findings.some((item) => item.pointer.locator.startsWith("OCR:L"))).toBe(true);
    expect(validateProvenance(afterOcr)).toEqual([]);
  });
});

describe("privacy-safe exports", () => {
  it("masks common secret and personal-data patterns", () => {
    const bearerFixture = ["Bearer ", "abcdefghijklmnopqrstuvwxyz"].join("");
    const raw = `password=hunter123 jane@example.com ${bearerFixture} C:\\Users\\jane\\repo`;
    const masked = redactText(raw);

    expect(masked).not.toContain("hunter123");
    expect(masked).not.toContain("jane@example.com");
    expect(masked).not.toContain("abcdefghijklmnopqrstuvwxyz");
    expect(masked).not.toContain("C:\\Users\\jane");
    expect(masked).toContain("<redacted:credential>");
  });

  it("never embeds raw source bodies in JSON or Markdown", () => {
    const brief = compileIntake(DEMO_SOURCES);
    const json = toJson(brief);
    const markdown = toMarkdown(brief);

    for (const secret of ["dev@example.com", DEMO_AUTH_FIXTURE, "C:\\Users\\alex"]) {
      expect(json).not.toContain(secret);
      expect(markdown).not.toContain(secret);
    }
    expect(toPortableBrief(brief).sources.every((source) => source.rawContentIncluded === false)).toBe(true);
    expect(markdown).toContain("S02:L2");
    expect(markdown).toContain("Raw source content is not embedded");
  });
});
