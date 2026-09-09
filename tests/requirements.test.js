import { describe, expect, it } from "vitest";
import { compileIntake } from "../src/core/intake.js";
import { confirmCriterion, createEditOwnership } from "../src/core/edit-ownership.js";
import { buildReviewedBrief, planSourceUpdate, replaceSourceInput } from "../src/core/source-updates.js";
import { createRequirements, reviewRequirement, reviewRequirements } from "../src/core/requirements.js";
import { toJson } from "../src/core/export.js";

const source = content => ({ id: "S01", name: "request.txt", kind: "text", revision: 1, content });
describe("reviewed requirement snapshots", () => {
  it("confirms and revokes explicit selections atomically at one snapshot revision", async () => {
    const first = await createRequirements(compileIntake([source("Must preserve signals.\nMust mask credentials.\nMust retain pointers.")]), { scope: "lab" });
    const ids = first.requirements.slice(0, 2).map(item => item.id);
    const saved = structuredClone(first);
    const confirmed = reviewRequirements(first, ids, "confirm", first.revision);
    expect(first).toEqual(saved);
    expect(confirmed.revision).toBe(first.revision + 1);
    expect(confirmed.requirements.map(item => item.confirmation)).toEqual(["user-confirmed", "user-confirmed", "candidate"]);
    expect(confirmed.requirements.map(item => item.revision)).toEqual([1, 1, 1]);
    expect(reviewRequirements(first, [...ids].reverse(), "confirm", first.revision)).toEqual(confirmed);
    const revoked = reviewRequirements(confirmed, ids, "candidate", confirmed.revision);
    expect(revoked.requirements.map(item => item.confirmation)).toEqual(["candidate", "candidate", "candidate"]);
    for (const [selected, decision, revision] of [[ids, "confirm", undefined], [ids, "confirm", 99], [[ids[0], ids[0]], "confirm", 1],
      [[ids[0], "lab-UNKNOWN"], "confirm", 1], [[], "confirm", 1], [ids, "keep", 1]]) {
      expect(() => reviewRequirements(first, selected, decision, revision)).toThrow();
      expect(first).toEqual(saved);
    }
    for (const state of ["needs-review", "withdrawn"]) {
      const mixed = structuredClone(first); mixed.requirements[1].confirmation = state;
      const before = structuredClone(mixed);
      for (const decision of ["confirm", "candidate"]) expect(() => reviewRequirements(mixed, ids, decision, 1)).toThrow(/batch was not applied/);
      expect(mixed).toEqual(before);
    }
  });
  it("keeps scoped IDs and confirmations for unchanged signals when another line changes or moves", async () => {
    const ownership = createEditOwnership();
    const inputs = [source("Must preserve all signals.\nMust mask credentials.")];
    let brief = buildReviewedBrief(inputs, ownership);
    for (const item of brief.doneWhen) confirmCriterion(ownership, brief, item);
    brief = buildReviewedBrief(inputs, ownership);
    const first = await createRequirements(brief, { scope: "lab" });
    expect(first.requirements.every(item => item.confirmation === "user-confirmed")).toBe(true);
    const plan = planSourceUpdate({ inputs, ownership, brief, nextInputs: replaceSourceInput(inputs, "S01", source(
      "Changed heading\nMust preserve thirty signals.\nMust mask credentials.")) });
    const unchanged = plan.brief.doneWhen.find(item => item.text.includes("Must mask credentials."));
    expect(unchanged).toMatchObject({ confirmed: true, reviewStatus: "current", pointer: { sourceRevision: 2, locator: "L3" } });
    const next = await createRequirements(plan.brief, { scope: "lab", previous: first });
    const oldPrivacy = first.requirements.find(item => item.text.includes("mask credentials"));
    expect(next.requirements.find(item => item.id === oldPrivacy.id)).toMatchObject({ revision: 1, confirmation: "user-confirmed" });
    expect(next.requirements.find(item => item.text.includes("thirty"))).toMatchObject({ confirmation: "candidate" });
    expect(next.requirements.find(item => item.text.includes("all signals"))).toMatchObject({ confirmation: "needs-review", pointer: { sourceRevision: 1 } });
    expect(JSON.stringify(next)).not.toContain("sourceSignal");
    expect(toJson(plan.brief)).not.toContain("sourceSignal");
  });

  it("never transfers confirmation when only a masked value changes", async () => {
    const ownership = createEditOwnership();
    const inputs = [source("Must use password=abcdef123")];
    let brief = buildReviewedBrief(inputs, ownership);
    confirmCriterion(ownership, brief, brief.doneWhen[0]);
    brief = buildReviewedBrief(inputs, ownership);
    const first = await createRequirements(brief, { scope: "lab" });
    const plan = planSourceUpdate({ inputs, ownership, brief, nextInputs: replaceSourceInput(inputs, "S01", source("Must use password=zyxwv987")) });
    const next = await createRequirements(plan.brief, { scope: "lab", previous: first });
    expect(next.requirements.filter(item => item.confirmation === "user-confirmed")).toHaveLength(0);
    expect(JSON.stringify(next)).not.toMatch(/abcdef123|zyxwv987/);
  });

  it("requires explicit review, keeps old pointers for manual retention and revisions, and preserves scope", async () => {
    const first = await createRequirements(compileIntake([source("Must preserve signals.")]), { scope: "lab" });
    const id = first.requirements[0].id;
    expect(first.requirements[0].confirmation).toBe("candidate");
    const confirmed = reviewRequirement(first, id, "confirm");
    const revised = reviewRequirement(confirmed, id, "revise", "Preserve thirty signals.");
    expect(revised.requirements[0]).toMatchObject({ id, revision: 2, confirmation: "candidate", pointer: { sourceId: "USER" }, previousPointer: { sourceId: "S01", sourceRevision: 1 } });
    const removed = await createRequirements(compileIntake([{ ...source("Must keep another requirement."), revision: 2 }]), { scope: "lab", previous: confirmed });
    expect(removed.requirements.find(item => item.id === id).confirmation).toBe("withdrawn");
    expect(() => reviewRequirement(removed, id, "confirm")).toThrow(/keep decision/);
    const kept = reviewRequirement(removed, id, "keep");
    expect(kept.requirements.find(item => item.id === id)).toMatchObject({ confirmation: "user-confirmed", pointer: { sourceId: "USER" }, previousPointer: { sourceRevision: 1 } });
    const reselected = await createRequirements(compileIntake([source("Must preserve signals.")]), { scope: "lab", previous: kept });
    expect(reselected.requirements.find(item => item.id === id)).toMatchObject({ confirmation: "user-confirmed", pointer: { sourceId: "USER" } });
    expect(reselected.requirements.find(item => item.pointer.sourceId === "S01" && item.text.includes("preserve signals"))).toMatchObject({ confirmation: "candidate" });
    expect(() => reviewRequirement(kept, "foreign-R001", "confirm")).toThrow(/Unknown/);
    await expect(createRequirements(compileIntake([source("Must preserve signals.")]), { scope: "other", previous: first })).rejects.toThrow(/scope/);
    expect(await createRequirements(compileIntake([source("Must preserve signals.")]), { scope: "lab" })).toEqual(first);
  });

  it("treats duplicate identical signals conservatively after their source changes", () => {
    const ownership = createEditOwnership();
    const inputs = [source("Must preserve signals.\nMust preserve signals.")];
    let brief = buildReviewedBrief(inputs, ownership);
    confirmCriterion(ownership, brief, brief.doneWhen[0]);
    brief = buildReviewedBrief(inputs, ownership);
    const plan = planSourceUpdate({ inputs, brief, ownership, nextInputs: replaceSourceInput(inputs, "S01", source("Heading\nMust preserve signals.\nMust preserve signals.")) });
    expect(plan.brief.doneWhen.filter(item => item.confirmed)).toHaveLength(0);
  });
});
