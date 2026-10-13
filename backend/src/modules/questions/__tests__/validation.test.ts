import { describe, expect, it } from "vitest";
import {
  overDailyCap,
  QUESTION_DAILY_CAP,
  validateQuestionInput,
} from "../validation";

describe("question validation", () => {
  it("accepts a well-formed question", () => {
    expect(
      validateQuestionInput({
        name: "Quinn Tester",
        email: "quinn@example.com",
        question: "What fabric is this made of?",
      })
    ).toBeNull();
  });

  it("rejects short names, bad emails and short questions", () => {
    expect(
      validateQuestionInput({ name: "Q", email: "q@e.co", question: "x".repeat(10) })
    ).toBe("name must be 2-60 characters.");
    expect(
      validateQuestionInput({
        name: "Quinn",
        email: "not-an-email",
        question: "x".repeat(10),
      })
    ).toBe("a valid email is required.");
    expect(
      validateQuestionInput({
        name: "Quinn",
        email: "q@e.co",
        question: "Hi?",
      })
    ).toBe("question must be 10-2000 characters.");
  });

  it(`caps at ${QUESTION_DAILY_CAP} per day`, () => {
    expect(overDailyCap(2)).toBe(false);
    expect(overDailyCap(3)).toBe(true);
  });
});
