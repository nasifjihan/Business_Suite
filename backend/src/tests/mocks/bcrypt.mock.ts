import { vi } from "vitest";

declare global {
  var __BCRYPT_VALID_PASSWORD__: string | null | undefined;
}

const FIXED_HASH =
  "$2a$10$FIXEDSALTFIXEDSALTFIXEDSALTFIXEDSALTFIXEDSALTfixe1234";

export function applyBcryptMock() {
  vi.mock("bcryptjs", async (importOriginal) => {
    const actual = await importOriginal<typeof import("bcryptjs")>();
    const hashFn = vi.fn(async () => FIXED_HASH);
    const hashSyncFn = vi.fn(() => FIXED_HASH);
    const compareFn = vi.fn(async (password: string, _hash: string) => {
      if (globalThis.__BCRYPT_VALID_PASSWORD__ != null) {
        return password === (globalThis as any).__BCRYPT_VALID_PASSWORD__;
      }
      return password === "TestPass123!";
    });
    const compareSyncFn = vi.fn((password: string, _hash: string) => {
      if (globalThis.__BCRYPT_VALID_PASSWORD__ != null) {
        return password === (globalThis as any).__BCRYPT_VALID_PASSWORD__;
      }
      return password === "TestPass123!";
    });
    const genSaltFn = vi.fn(async () => "$2a$10$fixedsaltfixedsaltfixedsa");
    const genSaltSyncFn = vi.fn(() => "$2a$10$fixedsaltfixedsaltfixedsa");
    const bcryptDefault = {
      ...actual,
      hash: hashFn,
      hashSync: hashSyncFn,
      compare: compareFn,
      compareSync: compareSyncFn,
      genSalt: genSaltFn,
      genSaltSync: genSaltSyncFn,
    };
    return {
      default: bcryptDefault,
      hash: hashFn,
      hashSync: hashSyncFn,
      compare: compareFn,
      compareSync: compareSyncFn,
      genSalt: genSaltFn,
      genSaltSync: genSaltSyncFn,
    };
  });
}

export function setBcryptMockValidPassword(password: string | null) {
  (globalThis as any).__BCRYPT_VALID_PASSWORD__ = password;
}
