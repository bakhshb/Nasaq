import { describe, expect, it } from "vitest";

import { createdAtLabel, formatFileDate } from "./formatFileDate";

describe("formatFileDate", () => {
  it("formats a valid ISO date", () => {
    const formatted = formatFileDate("2024-06-15T10:30:00.000Z");
    expect(formatted).not.toBe("غير متوفر");
  });

  it("returns fallback for missing date", () => {
    expect(formatFileDate(undefined)).toBe("غير متوفر");
  });
});

describe("createdAtLabel", () => {
  it("uses disk creation label when birthtime is available", () => {
    expect(createdAtLabel(true, "win32")).toBe("تاريخ الإنشاء على القرص");
  });

  it("warns on linux when birthtime is unavailable", () => {
    expect(createdAtLabel(false, "linux")).toContain("قد لا يكون");
  });
});
