import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { LicensePlan, LicenseStatusResponse } from '../types/seating.ts';

export interface SignedLicensePayload {
  v: 1;
  machineId: string;
  schoolName: string;
  centerCode: string;
  plan: Exclude<LicensePlan, 'TRIAL'>;
  issuedAt: string;
  expiresAt: string | null;
}

interface PersistedLicenseState {
  machineId: string;
  trialStartedAt: string;
  lastSeenAt: string;
  licenseKey: string | null;
}

const DEFAULT_LICENSE_PATH = path.join(process.cwd(), '.data', 'license.dat');
const TRIAL_DAYS = 14;
const CLOCK_SKEW_GRACE_MS = 5 * 60 * 1000;

// Built-in Ed25519 SPKI Public Key (safe to ship; private key stays strictly with the vendor)
const DEFAULT_PUBLIC_KEY_PEM = [
  '-----BEGIN PUBLIC KEY-----',
  'MCowBQYDK2VwAyEAzCeoCOiQ4fe4SeX9Ol7c6QUCvtXkNnb02cFp7+LjPw4=',
  '-----END PUBLIC KEY-----',
].join('\n');

function safeExec(command: string): string {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1500,
    }).trim();
  } catch {
    return '';
  }
}

function collectHardwareSignals(): string[] {
  const signals: string[] = [os.platform(), os.arch(), os.hostname()];

  if (process.platform === 'win32') {
    const regOut = safeExec(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
    );
    const match = regOut.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/i);
    if (match?.[1]) signals.push(`win-guid:${match[1].trim()}`);

    const biosUuid = safeExec(
      'powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"',
    );
    if (biosUuid) signals.push(`win-uuid:${biosUuid}`);
  } else if (process.platform === 'darwin') {
    const ioOut = safeExec('ioreg -rd1 -c IOPlatformExpertDevice');
    const match = ioOut.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
    if (match?.[1]) signals.push(`mac-uuid:${match[1].trim()}`);
  } else {
    for (const p of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
      try {
        if (fs.existsSync(p)) {
          const val = fs.readFileSync(p, 'utf-8').trim();
          if (val) {
            signals.push(`linux-id:${val}`);
            break;
          }
        }
      } catch {
        // ignore unreadable machine-id path
      }
    }
  }

  const nets = os.networkInterfaces();
  const macs: string[] = [];
  for (const iface of Object.values(nets)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (!addr.internal && addr.mac && addr.mac !== '00:00:00:00:00:00') {
        macs.push(addr.mac.toLowerCase());
      }
    }
  }
  macs.sort();
  if (macs.length > 0) {
    signals.push(`macs:${Array.from(new Set(macs)).join(',')}`);
  }

  return signals;
}

export function formatMachineIdFromSeed(seed: string): string {
  const digest = crypto.createHash('sha256').update(seed).digest('hex').toUpperCase();
  return `UNN-${digest.slice(0, 4)}-${digest.slice(4, 8)}-${digest.slice(8, 12)}`;
}

let cachedMachineId: string | null = null;

export function getMachineId(): string {
  if (cachedMachineId) return cachedMachineId;
  const override = process.env.UNNATI_MACHINE_SEED?.trim();
  const seed = override ? `override:${override}` : collectHardwareSignals().join('|');
  cachedMachineId = formatMachineIdFromSeed(seed);
  return cachedMachineId;
}

export function resolvePublicKeyPem(customPem?: string): string {
  if (customPem && customPem.trim()) return customPem.trim();
  const envPem = process.env.UNNATI_LICENSE_PUBLIC_KEY?.trim();
  if (envPem) {
    return envPem.replace(/\\n/g, '\n');
  }
  return DEFAULT_PUBLIC_KEY_PEM;
}

export function verifySignedLicenseKey(
  rawKey: string,
  expectedMachineId: string,
  publicKeyPem?: string,
): { ok: true; payload: SignedLicensePayload } | { ok: false; reason: 'INVALID_FORMAT' | 'INVALID_SIGNATURE' | 'MACHINE_MISMATCH'; error: string } {
  const clean = rawKey.trim();
  const parts = clean.split('.');
  if (parts.length !== 3 || parts[0] !== 'UNN1' || !parts[1] || !parts[2]) {
    return {
      ok: false,
      reason: 'INVALID_FORMAT',
      error: 'License key must follow the format UNN1.<payload>.<signature>.',
    };
  }

  const signingInput = `${parts[0]}.${parts[1]}`;
  let sigBuf: Buffer;
  try {
    sigBuf = Buffer.from(parts[2], 'base64url');
  } catch {
    return { ok: false, reason: 'INVALID_FORMAT', error: 'Malformed license signature.' };
  }

  let validSig = false;
  try {
    const pubKey = crypto.createPublicKey(resolvePublicKeyPem(publicKeyPem));
    validSig = crypto.verify(null, Buffer.from(signingInput, 'utf-8'), pubKey, sigBuf);
  } catch {
    validSig = false;
  }

  if (!validSig) {
    return {
      ok: false,
      reason: 'INVALID_SIGNATURE',
      error: 'License signature could not be verified.',
    };
  }

  let payload: SignedLicensePayload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')) as SignedLicensePayload;
  } catch {
    return { ok: false, reason: 'INVALID_FORMAT', error: 'Corrupt license payload.' };
  }

  if (
    !payload ||
    payload.v !== 1 ||
    typeof payload.machineId !== 'string' ||
    typeof payload.schoolName !== 'string' ||
    (payload.plan !== 'ANNUAL' && payload.plan !== 'PERPETUAL')
  ) {
    return { ok: false, reason: 'INVALID_FORMAT', error: 'Unsupported license payload structure.' };
  }

  if (payload.machineId.trim().toUpperCase() !== expectedMachineId.trim().toUpperCase()) {
    return {
      ok: false,
      reason: 'MACHINE_MISMATCH',
      error: `This license key is bound to device ${payload.machineId}, not ${expectedMachineId}.`,
    };
  }

  return { ok: true, payload };
}

export class LicenseManager {
  private licensePath: string;
  private publicKeyPem?: string;
  private machineIdFn: () => string;
  private nowFn: () => number;

  constructor(opts?: {
    licensePath?: string;
    publicKeyPem?: string;
    machineIdFn?: () => string;
    nowFn?: () => number;
  }) {
    this.licensePath = opts?.licensePath ?? DEFAULT_LICENSE_PATH;
    this.publicKeyPem = opts?.publicKeyPem;
    this.machineIdFn = opts?.machineIdFn ?? getMachineId;
    this.nowFn = opts?.nowFn ?? (() => Date.now());
  }

  private readState(): PersistedLicenseState | null {
    try {
      if (!fs.existsSync(this.licensePath)) return null;
      const raw = fs.readFileSync(this.licensePath, 'utf-8');
      const parsed = JSON.parse(raw) as PersistedLicenseState;
      if (parsed && typeof parsed.machineId === 'string' && typeof parsed.trialStartedAt === 'string') {
        return parsed;
      }
    } catch {
      // ignore corrupt state file
    }
    return null;
  }

  private writeState(state: PersistedLicenseState) {
    const dir = path.dirname(this.licensePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${this.licensePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(tmp, this.licensePath);
  }

  private ensureState(currentMachineId: string, nowMs: number): PersistedLicenseState {
    const existing = this.readState();
    const nowIso = new Date(nowMs).toISOString();
    if (!existing) {
      const fresh: PersistedLicenseState = {
        machineId: currentMachineId,
        trialStartedAt: nowIso,
        lastSeenAt: nowIso,
        licenseKey: null,
      };
      this.writeState(fresh);
      return fresh;
    }

    const lastSeenMs = Date.parse(existing.lastSeenAt);
    if (!Number.isFinite(lastSeenMs) || nowMs > lastSeenMs) {
      const updated: PersistedLicenseState = {
        ...existing,
        lastSeenAt: nowIso,
      };
      this.writeState(updated);
      return updated;
    }

    return existing;
  }

  public getStatus(): LicenseStatusResponse {
    const currentMachineId = this.machineIdFn();
    const nowMs = this.nowFn();
    const state = this.ensureState(currentMachineId, nowMs);

    const lastSeenMs = Date.parse(state.lastSeenAt);
    const clockTampered = Number.isFinite(lastSeenMs) && nowMs + CLOCK_SKEW_GRACE_MS < lastSeenMs;

    if (state.licenseKey) {
      const verified = verifySignedLicenseKey(
        state.licenseKey,
        currentMachineId,
        this.publicKeyPem,
      );

      if (!verified.ok) {
        return {
          machineId: currentMachineId,
          status: verified.reason === 'MACHINE_MISMATCH' ? 'MACHINE_MISMATCH' : 'EXPIRED',
          writeAllowed: false,
          plan: 'ANNUAL',
          schoolName: 'Unverified Device',
          centerCode: '-',
          issuedAt: state.trialStartedAt,
          expiresAt: null,
          daysRemaining: 0,
          lastSeenAt: state.lastSeenAt,
          message: verified.error,
        };
      }

      const { payload } = verified;
      if (clockTampered) {
        return {
          machineId: currentMachineId,
          status: 'CLOCK_TAMPERED',
          writeAllowed: false,
          plan: payload.plan,
          schoolName: payload.schoolName,
          centerCode: payload.centerCode,
          issuedAt: payload.issuedAt,
          expiresAt: payload.expiresAt,
          daysRemaining: 0,
          lastSeenAt: state.lastSeenAt,
          message: 'System clock rollback detected. Restore accurate date/time to resume.',
        };
      }

      if (payload.expiresAt) {
        const expMs = Date.parse(payload.expiresAt);
        if (Number.isFinite(expMs) && nowMs > expMs) {
          return {
            machineId: currentMachineId,
            status: 'EXPIRED',
            writeAllowed: false,
            plan: payload.plan,
            schoolName: payload.schoolName,
            centerCode: payload.centerCode,
            issuedAt: payload.issuedAt,
            expiresAt: payload.expiresAt,
            daysRemaining: 0,
            lastSeenAt: state.lastSeenAt,
            message: `Subscription expired on ${payload.expiresAt.slice(0, 10)}. Saved reports remain readable.`,
          };
        }
        const daysLeft = Math.max(1, Math.ceil((expMs - nowMs) / (24 * 60 * 60 * 1000)));
        return {
          machineId: currentMachineId,
          status: 'LICENSED',
          writeAllowed: true,
          plan: payload.plan,
          schoolName: payload.schoolName,
          centerCode: payload.centerCode,
          issuedAt: payload.issuedAt,
          expiresAt: payload.expiresAt,
          daysRemaining: daysLeft,
          lastSeenAt: state.lastSeenAt,
          message: `Licensed to ${payload.schoolName} (${payload.plan}) · ${daysLeft}d remaining.`,
        };
      }

      return {
        machineId: currentMachineId,
        status: 'LICENSED',
        writeAllowed: true,
        plan: payload.plan,
        schoolName: payload.schoolName,
        centerCode: payload.centerCode,
        issuedAt: payload.issuedAt,
        expiresAt: null,
        daysRemaining: null,
        lastSeenAt: state.lastSeenAt,
        message: `Licensed to ${payload.schoolName} (Perpetual Device License).`,
      };
    }

    // Hardware-bound trial state
    if (state.machineId !== currentMachineId) {
      return {
        machineId: currentMachineId,
        status: 'MACHINE_MISMATCH',
        writeAllowed: false,
        plan: 'TRIAL',
        schoolName: 'Copied Installation',
        centerCode: '-',
        issuedAt: state.trialStartedAt,
        expiresAt: null,
        daysRemaining: 0,
        lastSeenAt: state.lastSeenAt,
        message: 'Installation data belongs to a different device. Enter a valid license key for this Machine ID.',
      };
    }

    if (clockTampered) {
      return {
        machineId: currentMachineId,
        status: 'CLOCK_TAMPERED',
        writeAllowed: false,
        plan: 'TRIAL',
        schoolName: 'Evaluation Center',
        centerCode: 'TRIAL',
        issuedAt: state.trialStartedAt,
        expiresAt: null,
        daysRemaining: 0,
        lastSeenAt: state.lastSeenAt,
        message: 'System clock rollback detected. Restore accurate date/time or activate a key.',
      };
    }

    const trialStartMs = Date.parse(state.trialStartedAt);
    const trialEndMs = trialStartMs + TRIAL_DAYS * 24 * 60 * 60 * 1000;
    const trialEndIso = new Date(trialEndMs).toISOString();
    if (nowMs > trialEndMs) {
      return {
        machineId: currentMachineId,
        status: 'EXPIRED',
        writeAllowed: false,
        plan: 'TRIAL',
        schoolName: 'Evaluation Center',
        centerCode: 'TRIAL',
        issuedAt: state.trialStartedAt,
        expiresAt: trialEndIso,
        daysRemaining: 0,
        lastSeenAt: state.lastSeenAt,
        message: '14-day device trial has ended. Activate a subscription key to generate new plans.',
      };
    }

    const daysLeft = Math.max(1, Math.ceil((trialEndMs - nowMs) / (24 * 60 * 60 * 1000)));
    return {
      machineId: currentMachineId,
      status: 'TRIAL_ACTIVE',
      writeAllowed: true,
      plan: 'TRIAL',
      schoolName: 'Evaluation Center',
      centerCode: 'TRIAL',
      issuedAt: state.trialStartedAt,
      expiresAt: trialEndIso,
      daysRemaining: daysLeft,
      lastSeenAt: state.lastSeenAt,
      message: `${daysLeft}-day device evaluation active on ${currentMachineId}.`,
    };
  }

  public activateLicense(
    licenseKey: string,
  ): { ok: true; status: LicenseStatusResponse } | { ok: false; error: string } {
    const currentMachineId = this.machineIdFn();
    const nowMs = this.nowFn();
    const state = this.ensureState(currentMachineId, nowMs);

    const verified = verifySignedLicenseKey(licenseKey, currentMachineId, this.publicKeyPem);
    if (!verified.ok) {
      return { ok: false, error: verified.error };
    }

    if (verified.payload.expiresAt) {
      const expMs = Date.parse(verified.payload.expiresAt);
      if (Number.isFinite(expMs) && nowMs > expMs) {
        return {
          ok: false,
          error: `This license key already expired on ${verified.payload.expiresAt.slice(0, 10)}.`,
        };
      }
    }

    const updated: PersistedLicenseState = {
      ...state,
      machineId: currentMachineId,
      licenseKey: licenseKey.trim(),
      lastSeenAt: new Date(Math.max(nowMs, Date.parse(state.lastSeenAt) || nowMs)).toISOString(),
    };
    this.writeState(updated);
    return { ok: true, status: this.getStatus() };
  }
}

export const licenseManager = new LicenseManager();
