import { lookup } from 'node:dns/promises';
import net from 'node:net';

function isPrivateIpv4(address) {
  const [a, b] = address.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function isPrivateIp(address) {
  const version = net.isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) {
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
  }
  return false;
}

export function isPublicHttpUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { valid: false, reason: 'The url must be a valid absolute URL.' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, reason: 'Only http and https URLs are supported.' };
  }
  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'URLs with embedded credentials are not supported.' };
  }
  if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.localhost') || parsed.hostname.endsWith('.local')) {
    return { valid: false, reason: 'Local network targets are not supported.' };
  }
  if (net.isIP(parsed.hostname) && isPrivateIp(parsed.hostname)) {
    return { valid: false, reason: 'Private-network targets are not supported.' };
  }
  return { valid: true, url: parsed };
}

export async function assertSafePublicUrl(value, { allowPrivateNetworks = false } = {}) {
  const result = isPublicHttpUrl(value);
  if (!result.valid) {
    const error = new Error(result.reason);
    error.code = 'UNSAFE_URL';
    throw error;
  }

  if (allowPrivateNetworks) return result.url.toString();

  try {
    const records = await lookup(result.url.hostname, { all: true, verbatim: true });
    if (records.length === 0 || records.some((record) => isPrivateIp(record.address))) {
      const error = new Error('The URL resolves to a private or non-routable network address.');
      error.code = 'UNSAFE_URL';
      throw error;
    }
  } catch (error) {
    if (error.code === 'UNSAFE_URL') throw error;
    const lookupError = new Error('The target hostname could not be resolved safely.');
    lookupError.code = 'UNSAFE_URL';
    throw lookupError;
  }

  return result.url.toString();
}
