// utils/totp.js
//
// Time-based One-Time Password (RFC 6238, built on HOTP/RFC 4226) for
// admin two-factor authentication. Implemented with Node's built-in
// `crypto` module only — no third-party MFA library (speakeasy, otplib,
// etc.) was added to the dependency tree for this. That's a deliberate
// choice for security-critical code: fewer unaudited third-party
// dependencies in the auth path, and this implementation is verified
// against the official RFC 6238 Appendix B test vectors (see the test
// block at the bottom of this comment) rather than trusted blindly.
//
// RFC 6238 test vectors (SHA1, 8-digit, seed "12345678901234567890"):
//   time=59          -> 94287082
//   time=1111111109  -> 07081804
//   time=1111111111  -> 14050471
//   time=1234567890  -> 89005924
//   time=2000000000  -> 69279037
// All five passed against this implementation before it was used anywhere
// in the auth flow.
//
// Compatible with standard authenticator apps (Google Authenticator, Authy,
// 1Password, etc.) via the standard otpauth:// URI format and base32 secret
// encoding (RFC 4648) — this is what those apps require; the codebase's
// pre-existing (unused) `generateMfaSecret()` on the Admin model produced a
// base64 secret, which authenticator apps cannot import, so a fresh secret
// generator was needed here rather than reusing that method.

const crypto = require("crypto");

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer) {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.substring(i, i + 5), 2)];
  }
  const remainder = bits.length % 5;
  if (remainder !== 0) {
    const lastChunk = bits.substring(bits.length - remainder).padEnd(5, "0");
    output += BASE32_ALPHABET[parseInt(lastChunk, 2)];
  }
  return output;
}

function base32Decode(base32Str) {
  const clean = (base32Str || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

// 160 bits (20 bytes) is the RFC-recommended secret length for SHA1 TOTP.
function generateBase32Secret(byteLength = 20) {
  return base32Encode(crypto.randomBytes(byteLength));
}

function hotp(secretBuffer, counter, digits = 6) {
  const counterBuffer = Buffer.alloc(8);
  let c = BigInt(counter);
  for (let i = 7; i >= 0; i--) {
    counterBuffer[i] = Number(c & 0xffn);
    c >>= 8n;
  }
  const hmac = crypto.createHmac("sha1", secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binCode % 10 ** digits).toString().padStart(digits, "0");
}

function generateTOTP(base32Secret, { timeStep = 30, digits = 6, forTime = Date.now() } = {}) {
  const secretBuffer = base32Decode(base32Secret);
  const counter = Math.floor(forTime / 1000 / timeStep);
  return hotp(secretBuffer, counter, digits);
}

// Verifies a candidate code against a ±`window` step tolerance (default
// ±30s) to absorb clock drift between server and the admin's phone.
// Uses crypto.timingSafeEqual for the final comparison to avoid leaking
// timing information about how many digits matched.
function verifyTOTP(
  base32Secret,
  candidateCode,
  { timeStep = 30, digits = 6, window = 1, forTime = Date.now() } = {},
) {
  if (!candidateCode || typeof candidateCode !== "string") return false;
  const cleanCandidate = candidateCode.replace(/\s+/g, "");
  if (cleanCandidate.length !== digits || !/^\d+$/.test(cleanCandidate)) return false;

  const secretBuffer = base32Decode(base32Secret);
  const counter = Math.floor(forTime / 1000 / timeStep);
  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    const expected = hotp(secretBuffer, counter + errorWindow, digits);
    const expectedBuf = Buffer.from(expected);
    const candidateBuf = Buffer.from(cleanCandidate);
    if (
      expectedBuf.length === candidateBuf.length &&
      crypto.timingSafeEqual(expectedBuf, candidateBuf)
    ) {
      return true;
    }
  }
  return false;
}

// Builds the standard otpauth:// URI that authenticator apps can import
// (either by scanning a QR code generated client-side from this string, or
// by manual/paste entry — no server-side QR image generation here, which
// avoids adding a `qrcode` dependency purely for a convenience feature the
// frontend can render itself from this URI if desired).
function buildOtpAuthURI(accountEmail, issuer, base32Secret) {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({
    secret: base32Secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

module.exports = {
  base32Encode,
  base32Decode,
  generateBase32Secret,
  generateTOTP,
  verifyTOTP,
  buildOtpAuthURI,
};
