import { describe, it, expect } from "vitest";
import { extractCommitmentsFromText } from "./extractCommitments";

describe("extractCommitmentsFromText", () => {
  it("extracts a task", () => {
    const commitments = extractCommitmentsFromText("tengo que llamar al proveedor");
    expect(commitments).toHaveLength(1);
    expect(commitments[0].title).toMatch(/llamar al proveedor/i);
    expect(commitments[0].status).toBe("open");
  });

  it("extracts tomorrow hint", () => {
    const commitments = extractCommitmentsFromText("tengo que llamar al proveedor mañana");
    expect(commitments[0].dueHint).toBe("mañana");
  });

  it("ignores text without task cues", () => {
    const commitments = extractCommitmentsFromText("hoy hizo mucho calor");
    expect(commitments).toHaveLength(0);
  });
});
