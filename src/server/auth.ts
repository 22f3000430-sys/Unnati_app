import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

interface PersistedAuthRecord {
  salt: string;
  hash: string;
  claimedAt: string;
}

const DEFAULT_AUTH_PATH = path.join(process.cwd(), '.data', 'auth.json');
const EPHEMERAL_SIGNING_SECRET = crypto.randomBytes(32);
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function getSigningSecret(): Buffer {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return crypto.createHash('sha256').update(envSecret).digest();
  }
  return EPHEMERAL_SIGNING_SECRET;
}

export function hashPasscode(passcode: string, saltHex?: string): { salt: string; hash: string } {
  const salt = saltHex ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, salt, 64).toString('hex');
  return { salt, hash: derived };
}

export function verifyPasscodeHash(passcode: string, salt: string, expectedHashHex: string): boolean {
  const derived = crypto.scryptSync(passcode, salt, 64);
  const expected = Buffer.from(expectedHashHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function createSessionToken(role = 'ADMIN'): string {
  const payload = {
    role,
    exp: Date.now() + TOKEN_TTL_MS,
    jti: crypto.randomBytes(12).toString('hex'),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return false;

  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as {
      exp?: number;
      role?: string;
    };
    if (!payload || typeof payload.exp !== 'number') return false;
    return payload.exp > Date.now();
  } catch {
    return false;
  }
}

export class AdminAuthManager {
  private authPath: string;
  private attempts = new Map<string, { count: number; resetAt: number }>();

  constructor(authPath = DEFAULT_AUTH_PATH) {
    this.authPath = authPath;
  }

  private getEnvPasscode(): string {
    return (process.env.ADMIN_PASSCODE ?? '').trim();
  }

  private readPersisted(): PersistedAuthRecord | null {
    try {
      if (!fs.existsSync(this.authPath)) return null;
      const raw = fs.readFileSync(this.authPath, 'utf-8');
      const parsed = JSON.parse(raw) as PersistedAuthRecord;
      if (parsed && typeof parsed.salt === 'string' && typeof parsed.hash === 'string') {
        return parsed;
      }
    } catch {
      // ignore unreadable auth file
    }
    return null;
  }

  public getStatus(): { configured: boolean; envManaged: boolean } {
    if (this.getEnvPasscode().length > 0) {
      return { configured: true, envManaged: true };
    }
    return { configured: this.readPersisted() !== null, envManaged: false };
  }

  public checkRateLimit(clientKey: string): { allowed: boolean; retryAfterSec: number } {
    const now = Date.now();
    const entry = this.attempts.get(clientKey);
    if (!entry || entry.resetAt <= now) {
      return { allowed: true, retryAfterSec: 0 };
    }
    if (entry.count >= 10) {
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      };
    }
    return { allowed: true, retryAfterSec: 0 };
  }

  public recordFailure(clientKey: string) {
    const now = Date.now();
    const entry = this.attempts.get(clientKey);
    if (!entry || entry.resetAt <= now) {
      this.attempts.set(clientKey, { count: 1, resetAt: now + 15 * 60 * 1000 });
    } else {
      entry.count++;
    }
  }

  public clearFailures(clientKey: string) {
    this.attempts.delete(clientKey);
  }

  public claimInitialPasscode(passcode: string): { ok: true; token: string } | { ok: false; status: number; error: string } {
    if (this.getEnvPasscode().length > 0 || this.readPersisted() !== null) {
      return { ok: false, status: 409, error: 'Admin passcode is already configured.' };
    }
    const clean = passcode.trim();
    if (clean.length < 6) {
      return { ok: false, status: 400, error: 'Passcode must be at least 6 characters.' };
    }

    const { salt, hash } = hashPasscode(clean);
    const dir = path.dirname(this.authPath);
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${this.authPath}.tmp`;
    fs.writeFileSync(
      tmpPath,
      JSON.stringify({ salt, hash, claimedAt: new Date().toISOString() }, null, 2),
      { encoding: 'utf-8', mode: 0o600 },
    );
    fs.renameSync(tmpPath, this.authPath);

    return { ok: true, token: createSessionToken('ADMIN') };
  }

  public login(passcode: string, clientKey: string): { ok: true; token: string } | { ok: false; status: number; error: string } {
    const limit = this.checkRateLimit(clientKey);
    if (!limit.allowed) {
      return {
        ok: false,
        status: 429,
        error: `Too many failed attempts. Try again in ${limit.retryAfterSec}s.`,
      };
    }

    const envPass = this.getEnvPasscode();
    const clean = passcode.trim();
    if (!clean) {
      return { ok: false, status: 400, error: 'Passcode is required.' };
    }

    let valid = false;
    if (envPass.length > 0) {
      const a = crypto.createHash('sha256').update(clean).digest();
      const b = crypto.createHash('sha256').update(envPass).digest();
      valid = crypto.timingSafeEqual(a, b);
    } else {
      const record = this.readPersisted();
      if (!record) {
        return { ok: false, status: 409, error: 'No admin passcode set yet. Claim setup first.' };
      }
      valid = verifyPasscodeHash(clean, record.salt, record.hash);
    }

    if (!valid) {
      this.recordFailure(clientKey);
      return { ok: false, status: 401, error: 'Invalid admin passcode.' };
    }

    this.clearFailures(clientKey);
    return { ok: true, token: createSessionToken('ADMIN') };
  }
}

export const authManager = new AdminAuthManager();
