import { describe, expect, it } from "vitest";
import { decrypt, decryptJSON, encrypt, encryptJSON } from "@/lib/crypto/vault";

describe("crypto vault", () => {
  it("round-trips arbitrary strings (sanity check)", () => {
    const samples = ["hello", "", "🔥 unicode + spaces", "a".repeat(10_000)];
    for (const s of samples) {
      expect(decrypt(encrypt(s))).toBe(s);
    }
  });

  it("round-trips JSON objects (used for OAuth/IMAP creds)", () => {
    const value = {
      accessToken: "secret-token",
      refreshToken: "refresh-secret",
      expiresAt: Date.now(),
    };
    expect(decryptJSON(encryptJSON(value))).toEqual(value);
  });

  it("rejects tampered ciphertext — this is the whole point of GCM", () => {
    const payload = encrypt("important credentials");
    const parts = payload.split(":");
    const ct = Buffer.from(parts[3]!, "base64url");
    ct[0] = (ct[0] ?? 0) ^ 0x01;
    parts[3] = ct.toString("base64url");
    expect(() => decrypt(parts.join(":"))).toThrow();
  });

  it("rejects payloads with the wrong version prefix", () => {
    expect(() => decrypt("v2:abc:def:ghi")).toThrow(/format/);
  });

  it("produces distinct ciphertexts for the same plaintext (random IV)", () => {
    const a = encrypt("same input");
    const b = encrypt("same input");
    expect(a).not.toBe(b);
  });
});
