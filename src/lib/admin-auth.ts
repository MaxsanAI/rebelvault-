const COOKIE_NAME = 'rebelvault_admin';
const SESSION_MAX_AGE = 60 * 60 * 24;

interface SessionPayload {
  exp: number;
  nonce: string;
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);

  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value: string): string | null {
  try {
    const normalized = value
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const padded =
      normalized +
      '='.repeat((4 - (normalized.length % 4)) % 4);

    const binary = atob(padded);

    const bytes = Uint8Array.from(
      binary,
      (character) => character.charCodeAt(0)
    );

    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

async function createSignature(
  payload: string,
  secret: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign', 'verify']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload)
  );

  const bytes = new Uint8Array(signature);

  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function verifySignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const normalized = signature
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const padded =
      normalized +
      '='.repeat((4 - (normalized.length % 4)) % 4);

    const binary = atob(padded);

    const signatureBytes = Uint8Array.from(
      binary,
      (character) => character.charCodeAt(0)
    );

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      {
        name: 'HMAC',
        hash: 'SHA-256',
      },
      false,
      ['verify']
    );

    return await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      new TextEncoder().encode(payload)
    );
  } catch {
    return false;
  }
}

function getCookie(
  request: Request,
  name: string
): string | null {
  const cookieHeader = request.headers.get('Cookie') || '';

  const cookies = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim());

  for (const cookie of cookies) {
    const separator = cookie.indexOf('=');

    if (separator === -1) {
      continue;
    }

    const cookieName = cookie.slice(0, separator);
    const cookieValue = cookie.slice(separator + 1);

    if (cookieName === name) {
      return cookieValue;
    }
  }

  return null;
}

export async function createAdminCookie(
  secret: string
): Promise<string> {
  const payloadObject: SessionPayload = {
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
    nonce: crypto.randomUUID(),
  };

  const payload = base64UrlEncode(
    JSON.stringify(payloadObject)
  );

  const signature = await createSignature(
    payload,
    secret
  );

  return [
    `${COOKIE_NAME}=${payload}.${signature}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${SESSION_MAX_AGE}`,
  ].join('; ');
}

export async function isAdminAuthenticated(
  request: Request,
  secret: string
): Promise<boolean> {
  if (!secret) {
    return false;
  }

  const cookie = getCookie(
    request,
    COOKIE_NAME
  );

  if (!cookie) {
    return false;
  }

  const separator = cookie.lastIndexOf('.');

  if (separator <= 0) {
    return false;
  }

  const payload = cookie.slice(0, separator);
  const signature = cookie.slice(separator + 1);

  if (!payload || !signature) {
    return false;
  }

  const validSignature = await verifySignature(
    payload,
    signature,
    secret
  );

  if (!validSignature) {
    return false;
  }

  const decoded = base64UrlDecode(payload);

  if (!decoded) {
    return false;
  }

  try {
    const session =
      JSON.parse(decoded) as SessionPayload;

    if (
      !session.exp ||
      session.exp <= Math.floor(Date.now() / 1000)
    ) {
      return false;
    }

    if (!session.nonce) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export { COOKIE_NAME };
