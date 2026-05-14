// Vitest setup — only providing the secrets needed for unit tests.
// Real API calls are mocked at the import boundary; we don't hit Anthropic
// or any IMAP host from unit tests.
process.env.BEACON_ENCRYPTION_KEY =
  process.env.BEACON_ENCRYPTION_KEY ??
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "file::memory:";
// Dummy key — the real Anthropic SDK is vi.mock'd; this just stops the
// guard in client() from throwing before the mock takes over.
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "test-key-not-used";