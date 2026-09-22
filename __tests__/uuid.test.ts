import { generateUUID, isUUID, ensureUUID } from '../src/utils/uuid';

describe('UUID Utilities', () => {
  it('generates a valid RFC 4122 v4 UUID', () => {
    const id = generateUUID();
    expect(isUUID(id)).toBe(true);
    // Version 4 check
    expect(id.charAt(14)).toBe('4');
    // Variant check (8, 9, a, or b)
    expect(['8', '9', 'a', 'b', '8', '9', 'A', 'B']).toContain(id.charAt(19).toLowerCase());
  });

  it('generates unique UUIDs across multiple calls', () => {
    const set = new Set<string>();
    for (let i = 0; i < 50; i++) {
      set.add(generateUUID());
    }
    expect(set.size).toBe(50);
  });

  it('correctly validates valid UUIDs', () => {
    expect(isUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    expect(isUUID('c9bf9e57-1685-4c89-bafb-ff5af830be8a')).toBe(true);
  });

  it('rejects legacy non-UUID identifiers', () => {
    expect(isUUID('t1')).toBe(false);
    expect(isUUID('h1')).toBe(false);
    expect(isUUID('g1')).toBe(false);
    expect(isUUID('m1')).toBe(false);
    expect(isUUID('EVR-DUO1')).toBe(false);
    expect(isUUID('1726000000000-abcde')).toBe(false);
    expect(isUUID('')).toBe(false);
    expect(isUUID(undefined)).toBe(false);
    expect(isUUID(null)).toBe(false);
  });

  it('ensureUUID preserves valid UUIDs and generates new UUIDs for invalid IDs', () => {
    const valid = 'c9bf9e57-1685-4c89-bafb-ff5af830be8a';
    expect(ensureUUID(valid)).toBe(valid);

    const fromLegacy = ensureUUID('t1');
    expect(fromLegacy).not.toBe('t1');
    expect(isUUID(fromLegacy)).toBe(true);
  });
});
