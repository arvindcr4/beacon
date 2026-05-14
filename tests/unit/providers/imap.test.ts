import { describe, expect, it } from "vitest";
import { IMAP_PRESETS } from "@/lib/providers";

describe("IMAP presets", () => {
  it("supports the providers we promise to support in the spec", () => {
    // The assignment names Yahoo and AOL explicitly — verify the table.
    expect(IMAP_PRESETS.yahoo.host).toBe("imap.mail.yahoo.com");
    expect(IMAP_PRESETS.yahoo.smtpHost).toBe("smtp.mail.yahoo.com");
    expect(IMAP_PRESETS.aol.host).toBe("imap.aol.com");
    expect(IMAP_PRESETS.aol.smtpHost).toBe("smtp.aol.com");
  });

  it("uses TLS on the standard IMAP port for every preset — security regression guard", () => {
    for (const [name, p] of Object.entries(IMAP_PRESETS)) {
      expect(p.port, `${name} IMAP port should be 993`).toBe(993);
      expect(p.secure, `${name} IMAP should be implicit TLS`).toBe(true);
    }
  });

  it("ships a human-readable note for each preset (UI surfaces it during onboarding)", () => {
    for (const [name, p] of Object.entries(IMAP_PRESETS)) {
      expect(p.note, `${name} should have a setup note`).toBeTruthy();
      expect(p.note.toLowerCase()).toContain("password");
    }
  });
});
