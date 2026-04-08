/**
 * Encryption helpers for data at rest and in transit.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

/**
 * Encrypt data using AES-256-GCM.
 *
 * Returns a base64-encoded string containing salt + IV + auth tag + ciphertext.
 */
export function encrypt(plaintext: string, password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = scryptSync(password, salt, KEY_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: salt (32) + iv (16) + authTag (16) + ciphertext
  const result = Buffer.concat([salt, iv, authTag, encrypted]);
  return result.toString("base64");
}

/**
 * Decrypt data encrypted with the encrypt function.
 */
export function decrypt(encryptedBase64: string, password: string): string {
  const data = Buffer.from(encryptedBase64, "base64");

  const salt = data.subarray(0, SALT_LENGTH);
  const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = data.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const ciphertext = data.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const key = scryptSync(password, salt, KEY_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/**
 * Generate a secure random encryption key.
 */
export function generateKey(): string {
  return randomBytes(KEY_LENGTH).toString("hex");
}
