import { vi } from 'vitest';

const FIXED_HASH = '$2a$10$FIXEDSALTFIXEDSALTFIXEDSALTFIXEDSALTFIXEDSALTfixe1234';

export function applyBcryptMock() {
  vi.mock('bcryptjs', () => {
    const hashFn = vi.fn(async () => FIXED_HASH);
    const hashSyncFn = vi.fn(() => FIXED_HASH);
    const compareFn = vi.fn(async () => true);
    const compareSyncFn = vi.fn(() => true);
    const genSaltFn = vi.fn(async () => '$2a$10$fixedsaltfixedsaltfixedsa');
    const genSaltSyncFn = vi.fn(() => '$2a$10$fixedsaltfixedsaltfixedsa');
    const bcryptDefault = {
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

