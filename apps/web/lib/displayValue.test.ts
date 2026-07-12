import { displayValue } from "./displayValue";

describe("displayValue", () => {
  it("formats primitive values and blanks", () => {
    expect(displayValue(null)).toBe("—");
    expect(displayValue(0)).toBe("0");
    expect(displayValue(false)).toBe("No");
  });

  it("uses a meaningful field for nested entities", () => {
    expect(displayValue({ id: "1", name: "Acme" })).toBe("Acme");
    expect(displayValue({ id: "1", number: "INV-001" })).toBe("INV-001");
  });

  it("never coerces unknown objects to object Object", () => {
    expect(displayValue({ id: "1" })).toBe("—");
    expect(displayValue([{ name: "One" }, { name: "Two" }])).toBe("One, Two");
    expect(displayValue({ id: "1" })).not.toContain("[object Object]");
  });
});
