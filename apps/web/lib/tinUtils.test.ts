import { formatTin, isPlausibleLhdnmTin, pickMyInvoisIdType, pickMyInvoisIdValue } from "./tinUtils";

describe("formatTin", () => {
  it("strips spaces, hyphens and lowercases the result", () => {
    expect(formatTin("ig 12345678")).toBe("IG12345678");
    expect(formatTin("EI-123456789012")).toBe("EI123456789012");
    expect(formatTin("12345678")).toBe("12345678");
  });
  it("returns empty string for empty/null/undefined", () => {
    expect(formatTin("")).toBe("");
    expect(formatTin(undefined)).toBe("");
    expect(formatTin(null)).toBe("");
  });
  it("drops every non-alphanumeric character", () => {
    expect(formatTin("A.B-C 1_2 3@4")).toBe("ABC1234");
  });
});

describe("isPlausibleLhdnmTin", () => {
  it("accepts 8-12 digits with no prefix", () => {
    expect(isPlausibleLhdnmTin("12345678")).toBe(true);
    expect(isPlausibleLhdnmTin("123456789012")).toBe(true);
  });
  it("accepts 1-2 letter prefix plus 8-12 digits", () => {
    expect(isPlausibleLhdnmTin("IG12345678")).toBe(true);
    expect(isPlausibleLhdnmTin("EI123456789012")).toBe(true);
  });
  it("rejects too-few digits", () => {
    expect(isPlausibleLhdnmTin("1234567")).toBe(false);
  });
  it("rejects too-many digits", () => {
    expect(isPlausibleLhdnmTin("1234567890123")).toBe(false);
  });
  it("rejects 3+ letter prefix", () => {
    expect(isPlausibleLhdnmTin("ABC12345678")).toBe(false);
  });
  it("rejects letters mixed into the digit block", () => {
    expect(isPlausibleLhdnmTin("IG1234567X")).toBe(false);
  });
  it("treats empty/null as not plausible", () => {
    expect(isPlausibleLhdnmTin("")).toBe(false);
    expect(isPlausibleLhdnmTin(undefined)).toBe(false);
  });
});

describe("pickMyInvoisIdType", () => {
  it("prefers BRN when present", () => {
    expect(pickMyInvoisIdType({ brn: "123456" })).toBe("BRN");
    expect(pickMyInvoisIdType({ brn: "123456", nric: "111111-11-1111" })).toBe("BRN");
  });
  it("falls back to NRIC when no BRN", () => {
    expect(pickMyInvoisIdType({ nric: "111111-11-1111" })).toBe("NRIC");
  });
  it("uses PASSPORT when only passport present", () => {
    expect(pickMyInvoisIdType({ passport: "A1234567" })).toBe("PASSPORT");
  });
  it("defaults to NRIC when nothing provided", () => {
    expect(pickMyInvoisIdType({})).toBe("NRIC");
  });
});

describe("pickMyInvoisIdValue", () => {
  it("uses BRN when present", () => {
    expect(pickMyInvoisIdValue("IG12345678", { brn: "202101012345" })).toBe("202101012345");
  });
  it("normalises the BRN (strip spaces, uppercase)", () => {
    expect(pickMyInvoisIdValue("IG12345678", { brn: " 2021-0101-2345 " })).toBe("202101012345");
  });
  it("falls back to the normalised TIN when no BRN", () => {
    expect(pickMyInvoisIdValue("ig 12345678", {})).toBe("IG12345678");
  });
});
