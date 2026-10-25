import assert from "node:assert/strict";
import { test } from "node:test";
import { errorsOnStep, firstStepWithError, stepIndex, stepOf } from "./form-steps.ts";

test("maps error paths to the step that asks for them", () => {
  assert.equal(stepOf("repoUrl"), "repo");
  assert.equal(stepOf("liveUrl"), "repo");
  assert.equal(stepOf("tagline"), "intro");
  assert.equal(stepOf("keyPrompt"), "prompt");
  assert.equal(stepOf("suggestions.0.name"), "build");
  assert.equal(stepOf("lessons"), "story");
  assert.equal(stepOf("toolIdsExtra"), null);
  assert.equal(stepOf("unknown"), null);
});

test("keeps only the errors of one step", () => {
  const errors = { repoUrl: "required", title: "required", toolIds: "ai_tool_required" };
  assert.deepEqual(errorsOnStep(errors, "intro"), { title: "required" });
  assert.deepEqual(errorsOnStep(errors, "story"), {});
});

test("finds the earliest step with an error", () => {
  assert.equal(firstStepWithError({ lessons: "too_long", keyPrompt: "required" }), "prompt");
  assert.equal(firstStepWithError({}), null);
  assert.ok(stepIndex("repo") < stepIndex("review"));
});
