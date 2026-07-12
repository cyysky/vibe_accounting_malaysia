export function displayValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toLocaleString("en-MY");
  if (Array.isArray(value)) {
    const values = value.map(displayValue).filter((item) => item !== "—");
    return values.length > 0 ? values.join(", ") : "—";
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["name", "number", "code", "label", "title", "message"]) {
      const candidate = record[key];
      if (typeof candidate === "string" || typeof candidate === "number") return String(candidate);
    }
    return "—";
  }
  return String(value);
}
