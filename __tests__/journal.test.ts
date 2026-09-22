import { journalCrypto, EncryptedPayload, JournalSecurity } from '../src/services/encryption';
import { evoryzDay } from '../src/services/evoryzDay';

describe('Journal Comprehensive Unit & Flow Tests (12 Requirements)', () => {
  const pin = '5678';
  const wrongPin = '1234';

  beforeEach(() => {
    journalCrypto.lock();
  });

  // 1. First-time PIN creation
  test('1. First-time PIN creation generates proper salt, verifierHash, and unlocks immediately', async () => {
    const config = await journalCrypto.setupPin(pin);

    expect(config.salt).toBeDefined();
    expect(config.salt.length).toBe(32); // 16 bytes hex
    expect(config.verifierHash).toBeDefined();
    expect(config.verifierHash.length).toBe(64); // 32 bytes hex
    expect(config.iterations).toBe(100000);
    expect(config.failedAttempts).toBe(0);
    expect(config.lockedUntil).toBeFalsy();
    expect(journalCrypto.isUnlocked()).toBe(true);
  });

  // 2. Correct PIN unlock
  test('2. Correct PIN unlock verifies successfully and unlocks', async () => {
    const config = await journalCrypto.setupPin(pin);
    journalCrypto.lock();
    expect(journalCrypto.isUnlocked()).toBe(false);

    const res = await journalCrypto.verifyPin(pin, config);
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(journalCrypto.isUnlocked()).toBe(true);
  });

  // 3. Wrong PIN
  test('3. Wrong PIN rejects unlock and increments failedAttempts', async () => {
    const config = await journalCrypto.setupPin(pin);
    journalCrypto.lock();

    const res = await journalCrypto.verifyPin(wrongPin, config);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Incorrect PIN');
    expect(res.updatedSecurity?.failedAttempts).toBe(1);
    expect(journalCrypto.isUnlocked()).toBe(false);
  });

  // 4. Lockout behavior
  test('4. Lockout behavior triggers progressive lock after 3 failed attempts', async () => {
    let config = await journalCrypto.setupPin(pin);
    journalCrypto.lock();

    // 1st fail
    let res = await journalCrypto.verifyPin('1111', config);
    config = res.updatedSecurity!;
    expect(config.failedAttempts).toBe(1);

    // 2nd fail
    res = await journalCrypto.verifyPin('2222', config);
    config = res.updatedSecurity!;
    expect(config.failedAttempts).toBe(2);

    // 3rd fail -> triggers 30s lockout
    res = await journalCrypto.verifyPin('3333', config);
    config = res.updatedSecurity!;
    expect(config.failedAttempts).toBe(3);
    expect(config.lockedUntil).toBeDefined();
    expect(new Date(config.lockedUntil!).getTime()).toBeGreaterThan(Date.now());

    // Even correct PIN fails while locked out
    const lockedAttempt = await journalCrypto.verifyPin(pin, config);
    expect(lockedAttempt.success).toBe(false);
    expect(lockedAttempt.error).toContain('locked');
    expect(journalCrypto.isUnlocked()).toBe(false);
  });

  // 5. Encryption/decryption round trip
  test('5. Encryption/decryption round trip preserves original text with AES-GCM-256', async () => {
    await journalCrypto.setupPin(pin);

    const secretText = 'This is a deeply personal private thought with special chars: 🔒 ✨ & <script>';
    const payload = await journalCrypto.encrypt(secretText);

    expect(payload.algorithm).toBe('AES-GCM-256');
    expect(payload.ciphertext).toBeDefined();
    expect(payload.iv).toBeDefined();
    expect(payload.ciphertext.length).toBeGreaterThan(32); // ciphertext + 16-byte authentication tag
    expect(payload.ciphertext).not.toContain('secret');

    const decrypted = await journalCrypto.decrypt(payload);
    expect(decrypted).toBe(secretText);
  });

  // 6. Multiple journal entries on the same EvoRyz day
  test('6. Multiple journal entries on the same EvoRyz day group under that day', async () => {
    await journalCrypto.setupPin(pin);

    const day = '2026-09-22';
    const rawEntries = [
      { id: 'uuid-1', text: 'Morning reflection 08:30', date: day },
      { id: 'uuid-2', text: 'Midday check-in 13:45', date: day },
      { id: 'uuid-3', text: 'Night reflection 22:15', date: day },
    ];

    const encryptedEntries = await Promise.all(
      rawEntries.map(async (e) => {
        const payload = await journalCrypto.encrypt(e.text);
        return {
          id: e.id,
          date: e.date,
          encryptedContent: payload.ciphertext,
          iv: payload.iv,
          tag: payload.tag,
        };
      })
    );

    // Decrypt all
    const decryptedEntries = await Promise.all(
      encryptedEntries.map(async (e) => ({
        id: e.id,
        date: e.date,
        plaintext: await journalCrypto.decrypt({
          ciphertext: e.encryptedContent,
          iv: e.iv,
          tag: e.tag,
          algorithm: 'AES-GCM-256',
        }),
      }))
    );

    // Filter by day
    const dayEntries = decryptedEntries.filter((e) => e.date === day);
    expect(dayEntries.length).toBe(3);
    expect(dayEntries[0].plaintext).toBe('Morning reflection 08:30');
    expect(dayEntries[1].plaintext).toBe('Midday check-in 13:45');
    expect(dayEntries[2].plaintext).toBe('Night reflection 22:15');
  });

  // 7. Entries across different EvoRyz days
  test('7. Entries across different EvoRyz days respect 2:00 AM boundary and sort chronologically', async () => {
    // 01:59:59 AM on 2026-09-22 is EvoRyz day 2026-09-21
    const lateNightDate = new Date(2026, 8, 22, 1, 59, 59);
    const lateNightDay = evoryzDay(lateNightDate);
    expect(lateNightDay).toBe('2026-09-21');

    // 02:00:00 AM on 2026-09-22 is EvoRyz day 2026-09-22
    const nextMorningDate = new Date(2026, 8, 22, 2, 0, 0);
    const nextMorningDay = evoryzDay(nextMorningDate);
    expect(nextMorningDay).toBe('2026-09-22');

    // Chronological descending order of days
    const recordedDays = [lateNightDay, nextMorningDay].sort((a, b) => b.localeCompare(a));
    expect(recordedDays).toEqual(['2026-09-22', '2026-09-21']);
  });

  // 8. Per-user journal isolation
  test('8. Per-user journal isolation ensures separate encryption keys and separate ownership', async () => {
    // User A sets up with PIN 1111
    const userAConfig = await journalCrypto.setupPin('1111');
    const userAPayload = await journalCrypto.encrypt("User A's confidential entry");
    journalCrypto.lock();

    // User B sets up with PIN 2222
    const userBConfig = await journalCrypto.setupPin('2222');
    const userBPayload = await journalCrypto.encrypt("User B's confidential entry");

    // Keys and verifiers must be distinct
    expect(userAConfig.salt).not.toBe(userBConfig.salt);
    expect(userAConfig.verifierHash).not.toBe(userBConfig.verifierHash);

    // User B can decrypt User B's entry
    expect(await journalCrypto.decrypt(userBPayload)).toBe("User B's confidential entry");

    // User B CANNOT decrypt User A's entry with User B's active key
    await expect(journalCrypto.decrypt(userAPayload)).rejects.toThrow('Failed to decrypt journal entry');
  });

  // 9. Empty history
  test('9. Empty history handles zero records gracefully without fabricating days', () => {
    const today = evoryzDay();
    const decryptedEntries: { id: string; date: string; plaintext: string }[] = [];

    const recordedDays = Array.from(
      new Set(decryptedEntries.map((e) => e.date).filter(Boolean))
    ).sort((a, b) => b.localeCompare(a));

    expect(recordedDays).toEqual([]);

    // Available days only contains today for composition, never fake historical dates
    const availableDays = Array.from(new Set([today, ...recordedDays]));
    expect(availableDays).toEqual([today]);
  });

  // 10. Malformed encrypted entry handling
  test('10. Malformed encrypted entry handling does not throw unhandled exception or crash batch', async () => {
    await journalCrypto.setupPin(pin);

    // Valid entry
    const validPayload = await journalCrypto.encrypt('Valid secret note');

    // Corrupted payload with garbage ciphertext
    const malformedPayload: EncryptedPayload = {
      ciphertext: '00000000000000000000000000000000',
      iv: '0102030405060708090a0b0c',
      tag: '0102030405060708090a0b0c0d0e0f10',
      algorithm: 'AES-GCM-256',
    };

    // Incomplete payload (empty IV)
    const incompletePayload: EncryptedPayload = {
      ciphertext: 'deadbeef',
      iv: '',
      algorithm: 'AES-GCM-256',
    };

    const entriesToDecrypt = [
      { id: '1', payload: validPayload },
      { id: '2', payload: malformedPayload },
      { id: '3', payload: incompletePayload },
    ];

    const results: { id: string; plaintext: string }[] = [];
    for (const item of entriesToDecrypt) {
      try {
        const text = await journalCrypto.decrypt(item.payload);
        results.push({ id: item.id, plaintext: text });
      } catch {
        // Safe fallback as implemented in AppContext
        results.push({ id: item.id, plaintext: '[Encrypted Entry — Unable to decrypt]' });
      }
    }

    expect(results.length).toBe(3);
    expect(results[0].plaintext).toBe('Valid secret note');
    expect(results[1].plaintext).toBe('[Encrypted Entry — Unable to decrypt]');
    expect(results[2].plaintext).toBe('[Encrypted Entry — Unable to decrypt]');
  });

  // 11. PIN timeout / background lock
  test('11. PIN timeout / background lock clears key from memory and rejects crypto operations', async () => {
    await journalCrypto.setupPin(pin);
    expect(journalCrypto.isUnlocked()).toBe(true);

    const payload = await journalCrypto.encrypt('Sensitive data');

    // Explicit background lock
    journalCrypto.lock();
    expect(journalCrypto.isUnlocked()).toBe(false);

    // Rejects operations
    await expect(journalCrypto.encrypt('More data')).rejects.toThrow('Journal is locked');
    await expect(journalCrypto.decrypt(payload)).rejects.toThrow('Journal is locked');
  });

  // 12. App restart / session restoration
  test('12. App restart / session restoration restores access using persisted security config and PIN', async () => {
    // Session 1: Setup PIN and create entry
    const persistedSecurityConfig: JournalSecurity = await journalCrypto.setupPin(pin);
    const entryPayload = await journalCrypto.encrypt('Entry from session 1');

    // Simulate app killed / restarted (new process, fresh in-memory state)
    journalCrypto.lock();
    expect(journalCrypto.isUnlocked()).toBe(false);

    // Session 2: User opens app and unlocks with PIN and stored config
    const unlockRes = await journalCrypto.verifyPin(pin, persistedSecurityConfig);
    expect(unlockRes.success).toBe(true);
    expect(journalCrypto.isUnlocked()).toBe(true);

    // Verify key was accurately restored and decrypts previous session data
    const decryptedAfterRestart = await journalCrypto.decrypt(entryPayload);
    expect(decryptedAfterRestart).toBe('Entry from session 1');
  });
});
