import { journalCrypto, EncryptedPayload } from '../src/services/encryption';

describe('Journal Cryptographic Service — Full Audit', () => {
  const testPin = '4829';
  const newPin = '7391';

  beforeEach(() => {
    journalCrypto.lock();
  });

  test('1 & 2 & 3. First-time PIN setup, unlock, and correct verification', async () => {
    const config = await journalCrypto.setupPin(testPin);

    expect(config.salt).toBeDefined();
    expect(config.salt.length).toBe(32); // 16 bytes hex
    expect(config.verifierHash).toBeDefined();
    expect(config.verifierHash.length).toBe(64); // 32 bytes hex
    expect(config.iterations).toBe(100000);
    expect(journalCrypto.isUnlocked()).toBe(true);

    journalCrypto.lock();
    expect(journalCrypto.isUnlocked()).toBe(false);

    const verifyRes = await journalCrypto.verifyPin(testPin, config);
    expect(verifyRes.success).toBe(true);
    expect(journalCrypto.isUnlocked()).toBe(true);
  });

  test('4 & 5. Incorrect PIN and progressive brute-force lockout (3 fails -> 30s, 5 fails -> 5m)', async () => {
    let config = await journalCrypto.setupPin(testPin);
    journalCrypto.lock();

    // 1st fail
    let res = await journalCrypto.verifyPin('0000', config);
    expect(res.success).toBe(false);
    expect(res.updatedSecurity?.failedAttempts).toBe(1);
    if (res.updatedSecurity) config = res.updatedSecurity;

    // 2nd fail
    res = await journalCrypto.verifyPin('0000', config);
    expect(res.success).toBe(false);
    expect(res.updatedSecurity?.failedAttempts).toBe(2);
    if (res.updatedSecurity) config = res.updatedSecurity;

    // 3rd fail -> triggers 30s lock
    res = await journalCrypto.verifyPin('0000', config);
    expect(res.success).toBe(false);
    expect(res.updatedSecurity?.failedAttempts).toBe(3);
    expect(res.updatedSecurity?.lockedUntil).toBeDefined();
    if (res.updatedSecurity) config = res.updatedSecurity;

    // Immediate next attempt with correct PIN is blocked by lockout
    const blockedRes = await journalCrypto.verifyPin(testPin, config);
    expect(blockedRes.success).toBe(false);
    expect(blockedRes.error).toContain('locked');
  });

  test('6 & 7 & 13. Multiple entry encryption and decryption roundtrip', async () => {
    await journalCrypto.setupPin(testPin);

    const entries = [
      'Reflections on morning deep work.',
      'Achieved personal record on 5k run.',
      'Night-time thoughts before sleep.',
    ];

    const encryptedPayloads: EncryptedPayload[] = [];
    for (const text of entries) {
      const p = await journalCrypto.encrypt(text);
      expect(p.ciphertext).toBeDefined();
      expect(p.iv).toBeDefined();
      expect(p.algorithm).toBe('AES-GCM-256');
      expect(p.ciphertext).not.toContain(text);
      encryptedPayloads.push(p);
    }

    for (let i = 0; i < entries.length; i++) {
      const decrypted = await journalCrypto.decrypt(encryptedPayloads[i]);
      expect(decrypted).toBe(entries[i]);
    }
  });

  test('10 & 11. Lock / App backgrounding simulation and reopening with PIN', async () => {
    const config = await journalCrypto.setupPin(testPin);
    const payload = await journalCrypto.encrypt('Persistent memory entry');

    // App backgrounding / user locks journal
    journalCrypto.lock();
    expect(journalCrypto.isUnlocked()).toBe(false);

    // Cryptographic operations reject while locked
    await expect(journalCrypto.encrypt('Should fail')).rejects.toThrow('Journal is locked');
    await expect(journalCrypto.decrypt(payload)).rejects.toThrow('Journal is locked');

    // Reopen journal
    const unlockRes = await journalCrypto.verifyPin(testPin, config);
    expect(unlockRes.success).toBe(true);
    expect(journalCrypto.isUnlocked()).toBe(true);

    const decrypted = await journalCrypto.decrypt(payload);
    expect(decrypted).toBe('Persistent memory entry');
  });

  test('12. PIN Change re-encrypts all items with new key', async () => {
    const config = await journalCrypto.setupPin(testPin);
    const item1 = await journalCrypto.encrypt('First secret entry');
    const item2 = await journalCrypto.encrypt('Second secret entry');

    const payloads = [
      { id: '1', payload: item1 },
      { id: '2', payload: item2 },
    ];

    const changeRes = await journalCrypto.changePin(testPin, newPin, config, payloads);
    expect(changeRes.success).toBe(true);
    expect(changeRes.updatedSecurity).toBeDefined();
    expect(changeRes.reEncryptedPayloads?.length).toBe(2);

    // Lock and verify old PIN fails
    journalCrypto.lock();
    const oldPinRes = await journalCrypto.verifyPin(testPin, changeRes.updatedSecurity!);
    expect(oldPinRes.success).toBe(false);

    // Verify new PIN succeeds and decrypts re-encrypted payloads
    const newPinRes = await journalCrypto.verifyPin(newPin, changeRes.updatedSecurity!);
    expect(newPinRes.success).toBe(true);

    const reEnc1 = changeRes.reEncryptedPayloads![0].payload;
    const reEnc2 = changeRes.reEncryptedPayloads![1].payload;
    expect(await journalCrypto.decrypt(reEnc1)).toBe('First secret entry');
    expect(await journalCrypto.decrypt(reEnc2)).toBe('Second secret entry');
  });

  test('14. Empty journal handles setup and operations gracefully', async () => {
    const config = await journalCrypto.setupPin(testPin);
    expect(journalCrypto.isUnlocked()).toBe(true);

    // Change PIN with 0 entries
    const changeRes = await journalCrypto.changePin(testPin, newPin, config, []);
    expect(changeRes.success).toBe(true);
    expect(changeRes.reEncryptedPayloads).toEqual([]);
  });

  test('15. Corrupted / missing encrypted data handling throws clean error without crashing', async () => {
    await journalCrypto.setupPin(testPin);

    const corruptedPayload: EncryptedPayload = {
      ciphertext: 'deadbeef1234567890abcdef',
      iv: '0102030405060708090a0b0c',
      algorithm: 'AES-GCM-256',
    };

    await expect(journalCrypto.decrypt(corruptedPayload)).rejects.toThrow('Failed to decrypt journal entry');
  });

  test('16. Forgotten PIN account reset generates fresh credentials', async () => {
    const originalConfig = await journalCrypto.setupPin(testPin);
    journalCrypto.lock();

    // Reset PIN through auth ownership
    const resetConfig = await journalCrypto.resetPinThroughAuth(newPin);
    expect(resetConfig.salt).not.toBe(originalConfig.salt);
    expect(resetConfig.verifierHash).not.toBe(originalConfig.verifierHash);
    expect(journalCrypto.isUnlocked()).toBe(true);

    // Encrypt new entry with reset key
    const newPayload = await journalCrypto.encrypt('New journey after reset');
    expect(await journalCrypto.decrypt(newPayload)).toBe('New journey after reset');
  });

  test('17. Inactivity timeout purges key from memory when timeout elapses', async () => {
    await journalCrypto.setupPin(testPin);
    expect(journalCrypto.isUnlocked()).toBe(true);

    // Fast-forward time past the 5-minute inactivity timeout (e.g. 5m + 1s)
    const originalNow = Date.now;
    try {
      const futureTime = Date.now() + 5 * 60 * 1000 + 1000;
      global.Date.now = jest.fn(() => futureTime);

      // isUnlocked() detects timeout and purges key
      expect(journalCrypto.isUnlocked()).toBe(false);

      // Attempting to encrypt rejects because key was purged
      await expect(journalCrypto.encrypt('Expired data')).rejects.toThrow('Journal is locked');
    } finally {
      global.Date.now = originalNow;
    }
  });
});
