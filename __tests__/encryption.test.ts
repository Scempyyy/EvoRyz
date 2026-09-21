import { journalCrypto } from '../src/services/encryption';

describe('Journal Cryptographic Service', () => {
  const testPin = '4829';

  beforeEach(() => {
    journalCrypto.lock();
  });

  test('setupPin generates valid salt and verifierHash and unlocks journal', async () => {
    const config = await journalCrypto.setupPin(testPin);

    expect(config.salt).toBeDefined();
    expect(config.salt.length).toBe(32); // 16 bytes hex
    expect(config.verifierHash).toBeDefined();
    expect(config.verifierHash.length).toBe(64); // 32 bytes hex
    expect(config.iterations).toBe(100000);
    expect(journalCrypto.isUnlocked()).toBe(true);
  });

  test('encrypt and decrypt roundtrip successfully with active key', async () => {
    await journalCrypto.setupPin(testPin);

    const plaintext = 'Zero-knowledge reflection at 2 AM.';
    const payload = await journalCrypto.encrypt(plaintext);

    expect(payload.ciphertext).toBeDefined();
    expect(payload.iv).toBeDefined();
    expect(payload.algorithm).toBe('AES-GCM-256');
    expect(payload.ciphertext).not.toContain(plaintext);

    const decrypted = await journalCrypto.decrypt(payload);
    expect(decrypted).toBe(plaintext);
  });

  test('lock purges key and prevents encryption or decryption', async () => {
    const config = await journalCrypto.setupPin(testPin);
    const payload = await journalCrypto.encrypt('Secret thought');

    journalCrypto.lock();
    expect(journalCrypto.isUnlocked()).toBe(false);

    await expect(journalCrypto.encrypt('New thought')).rejects.toThrow('Journal is locked');
    await expect(journalCrypto.decrypt(payload)).rejects.toThrow('Journal is locked');

    // Unlock with valid PIN
    const verifyRes = await journalCrypto.verifyPin(testPin, config);
    expect(verifyRes.success).toBe(true);
    expect(journalCrypto.isUnlocked()).toBe(true);

    const decrypted = await journalCrypto.decrypt(payload);
    expect(decrypted).toBe('Secret thought');
  });

  test('verifyPin with incorrect PIN fails and increments failedAttempts', async () => {
    const config = await journalCrypto.setupPin(testPin);
    journalCrypto.lock();

    const verifyRes = await journalCrypto.verifyPin('0000', config);
    expect(verifyRes.success).toBe(false);
    expect(verifyRes.updatedSecurity?.failedAttempts).toBe(1);
    expect(journalCrypto.isUnlocked()).toBe(false);
  });

  test('brute-force lockout is triggered after repeated failures', async () => {
    let config = await journalCrypto.setupPin(testPin);
    journalCrypto.lock();

    // 3 failed attempts
    for (let i = 0; i < 3; i++) {
      const res = await journalCrypto.verifyPin('9999', config);
      if (res.updatedSecurity) config = res.updatedSecurity;
    }

    expect(config.failedAttempts).toBe(3);
    expect(config.lockedUntil).toBeDefined();

    // Next attempt is immediately locked
    const lockedRes = await journalCrypto.verifyPin(testPin, config);
    expect(lockedRes.success).toBe(false);
    expect(lockedRes.error).toContain('locked');
  });
});
