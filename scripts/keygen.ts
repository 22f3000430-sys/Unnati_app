import crypto from 'node:crypto';
import fs from 'node:fs';
import type { SignedLicensePayload } from '../src/server/license.ts';

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

export function signLicensePayload(
  payload: SignedLicensePayload,
  privateKeyPem: string,
): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `UNN1.${encoded}`;
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, Buffer.from(signingInput, 'utf-8'), privateKey);
  return `${signingInput}.${signature.toString('base64url')}`;
}

function main() {
  if (hasFlag('--init-keys')) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString().trim();
    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trim();
    console.log('=== Ed25519 Vendor Keypair Generated ===');
    console.log('\nPublic Key (set as UNNATI_LICENSE_PUBLIC_KEY in center .env):\n' + pubPem);
    console.log(
      '\nPrivate Key (KEEP SECRET — set UNNATI_LICENSE_PRIVATE_KEY when signing):\n' + privPem,
    );
    return;
  }

  const machineId = getArg('--machineId');
  const schoolName = getArg('--school') ?? 'Exam Center';
  const centerCode = getArg('--center') ?? '1001';
  const rawPlan = (getArg('--plan') ?? 'ANNUAL').toUpperCase();
  const plan: 'ANNUAL' | 'PERPETUAL' = rawPlan === 'PERPETUAL' ? 'PERPETUAL' : 'ANNUAL';
  const days = Number(getArg('--days') ?? '365');
  const keyFile = getArg('--private-key-file');

  if (!machineId) {
    console.error(
      'Usage:\n' +
        '  npx tsx scripts/keygen.ts --init-keys\n' +
        '  UNNATI_LICENSE_PRIVATE_KEY="..." npx tsx scripts/keygen.ts --machineId UNN-XXXX-XXXX-XXXX --school "School Name" --center 1011 --plan ANNUAL --days 365',
    );
    process.exit(1);
  }

  let privateKeyPem = process.env.UNNATI_LICENSE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim() ?? '';
  if (!privateKeyPem && keyFile) {
    privateKeyPem = fs.readFileSync(keyFile, 'utf-8').trim();
  }
  if (!privateKeyPem) {
    console.error('Error: Provide UNNATI_LICENSE_PRIVATE_KEY env var or --private-key-file <path>.');
    process.exit(1);
  }

  const now = new Date();
  const expiresAt =
    plan === 'PERPETUAL'
      ? null
      : new Date(now.getTime() + Math.max(1, days) * 24 * 60 * 60 * 1000).toISOString();

  const payload: SignedLicensePayload = {
    v: 1,
    machineId: machineId.trim().toUpperCase(),
    schoolName: schoolName.trim(),
    centerCode: centerCode.trim().toUpperCase(),
    plan,
    issuedAt: now.toISOString(),
    expiresAt,
  };

  const token = signLicensePayload(payload, privateKeyPem);
  console.log('\nIssued Unnati Exam App License Key:\n');
  console.log(token);
  console.log('\nPayload:', JSON.stringify(payload, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
