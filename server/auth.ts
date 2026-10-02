import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express, { NextFunction, Request, Response } from 'express';

export type UserRole = 'owner' | 'worker';

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

interface StoredUser extends AuthUser {
  pinHash: string;
}

interface AuthDatabase {
  users: StoredUser[];
  updatedAt: string;
}

interface SessionRecord {
  token: string;
  userId: string;
  createdAt: number;
  lastActivityAt: number;
}

const AUTH_FILE = path.join(process.cwd(), 'data', 'auth.json');
const SESSION_COOKIE = 'mp_session';
const OWNER_IDLE_MS = 15 * 60 * 1000;
const WORKER_IDLE_MS = 12 * 60 * 60 * 1000;
const sessions = new Map<string, SessionRecord>();
const failedLogins = new Map<string, { count: number; lockedUntil: number }>();

const publicUser = ({ pinHash: _pinHash, ...user }: StoredUser): AuthUser => user;

function hashPin(pin: string, salt = crypto.randomBytes(16).toString('hex')): string {
  const hash = crypto.scryptSync(pin, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPin(pin: string, stored: string): boolean {
  const [algorithm, salt, expectedHex] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = crypto.scryptSync(pin, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function saveAuthDatabase(database: AuthDatabase): void {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  const tempFile = `${AUTH_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(database, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tempFile, AUTH_FILE);
}

function loadAuthDatabase(): AuthDatabase {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')) as AuthDatabase;
      if (Array.isArray(parsed.users) && parsed.users.length > 0) return parsed;
    }
  } catch (error) {
    console.error('[Auth] auth.json o\'qilmadi:', error);
  }

  const initialPin = process.env.POS_OWNER_PIN || '2508';
  const now = new Date().toISOString();
  const database: AuthDatabase = {
    users: [{
      id: 'owner',
      name: process.env.POS_OWNER_NAME || 'Rahbar',
      role: 'owner',
      active: true,
      createdAt: now,
      pinHash: hashPin(initialPin)
    }],
    updatedAt: now
  };
  saveAuthDatabase(database);
  return database;
}

let authDatabase = loadAuthDatabase();

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])?.trim() || req.ip || 'unknown';
}

function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.cookie || '';
  return raw.split(';').reduce<Record<string, string>>((result, part) => {
    const separator = part.indexOf('=');
    if (separator > 0) result[part.slice(0, separator).trim()] = decodeURIComponent(part.slice(separator + 1).trim());
    return result;
  }, {});
}

function setSessionCookie(res: Response, token: string): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict${secure}`);
}

function clearSessionCookie(res: Response): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

/** Ishchi uchun Rahbar tasdig'i (masalan 7 kundan eski qaytarish). Muvaffaqiyatda Rahbar ismini qaytaradi. */
export function verifyOwnerApproval(req: Request, pin: unknown): { ok: true; ownerName: string } | { ok: false; status: number; error: string } {
  const attemptKey = `${clientIp(req)}:owner-approval`;
  const attempt = failedLogins.get(attemptKey) || { count: 0, lockedUntil: 0 };
  if (attempt.lockedUntil > Date.now()) {
    return { ok: false, status: 429, error: `${Math.ceil((attempt.lockedUntil - Date.now()) / 1000)} soniyadan keyin qayta urinib ko'ring.` };
  }
  const value = String(pin || '').trim();
  const owner = /^\d{4,8}$/.test(value)
    ? authDatabase.users.find(user => user.role === 'owner' && user.active && verifyPin(value, user.pinHash))
    : undefined;
  if (!owner) {
    const count = attempt.count + 1;
    failedLogins.set(attemptKey, { count: count >= 5 ? 0 : count, lockedUntil: count >= 5 ? Date.now() + 60_000 : 0 });
    return { ok: false, status: count >= 5 ? 429 : 403, error: count >= 5 ? "5 marta xato Rahbar PIN'i. 60 soniya kuting." : "Rahbar PIN'i noto'g'ri." };
  }
  failedLogins.delete(attemptKey);
  return { ok: true, ownerName: owner.name };
}

export function getRequestUser(req: Request): AuthUser | undefined {
  return (req as Request & { authUser?: AuthUser }).authUser;
}

function resolveSession(req: Request): { session: SessionRecord; user: StoredUser } | undefined {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return undefined;
  const session = sessions.get(token);
  if (!session) return undefined;
  const user = authDatabase.users.find(candidate => candidate.id === session.userId && candidate.active);
  if (!user) {
    sessions.delete(token);
    return undefined;
  }
  const idleLimit = user.role === 'owner' ? OWNER_IDLE_MS : WORKER_IDLE_MS;
  if (Date.now() - session.lastActivityAt > idleLimit) {
    sessions.delete(token);
    return undefined;
  }
  return { session, user };
}

export function attachSessionUser(req: Request): AuthUser | undefined {
  const resolved = resolveSession(req);
  if (!resolved) return undefined;
  const user = publicUser(resolved.user);
  (req as Request & { authUser?: AuthUser }).authUser = user;
  return user;
}

export function requireSession(req: Request, res: Response, next: NextFunction) {
  const user = attachSessionUser(req);
  if (!user) {
    clearSessionCookie(res);
    return res.status(401).json({ success: false, error: 'Sessiya tugagan. PIN bilan qayta kiring.' });
  }
  next();
}

export function requireOwner(req: Request, res: Response, next: NextFunction) {
  requireSession(req, res, () => {
    if (getRequestUser(req)?.role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Bu amal faqat rahbar uchun ruxsat etilgan.' });
    }
    next();
  });
}

export const authRouter = express.Router();

authRouter.get('/users', (_req, res) => {
  res.json({
    success: true,
    users: authDatabase.users.filter(user => user.active).map(publicUser)
  });
});

authRouter.post('/login', (req, res) => {
  const userId = String(req.body?.userId || '').trim();
  const pin = String(req.body?.pin || '').trim();
  const user = authDatabase.users.find(candidate => candidate.id === userId && candidate.active);
  const attemptKey = `${clientIp(req)}:${userId}`;
  const attempt = failedLogins.get(attemptKey) || { count: 0, lockedUntil: 0 };

  if (attempt.lockedUntil > Date.now()) {
    const retryAfter = Math.ceil((attempt.lockedUntil - Date.now()) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ success: false, error: `${retryAfter} soniyadan keyin qayta urinib ko'ring.`, retryAfter });
  }

  if (!user || !/^\d{4,8}$/.test(pin) || !verifyPin(pin, user.pinHash)) {
    const count = attempt.count + 1;
    const lockedUntil = count >= 5 ? Date.now() + 60_000 : 0;
    failedLogins.set(attemptKey, { count: count >= 5 ? 0 : count, lockedUntil });
    return res.status(lockedUntil ? 429 : 401).json({
      success: false,
      error: lockedUntil ? '5 marta xato PIN kiritildi. 60 soniya kuting.' : `PIN noto'g'ri. ${5 - count} ta urinish qoldi.`,
      retryAfter: lockedUntil ? 60 : undefined
    });
  }

  failedLogins.delete(attemptKey);
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(token, { token, userId: user.id, createdAt: Date.now(), lastActivityAt: Date.now() });
  setSessionCookie(res, token);
  return res.json({ success: true, user: publicUser(user) });
});

authRouter.get('/me', requireSession, (req, res) => {
  res.json({ success: true, user: getRequestUser(req) });
});

authRouter.post('/touch', requireSession, (req, res) => {
  const token = parseCookies(req)[SESSION_COOKIE];
  const session = token ? sessions.get(token) : undefined;
  if (session) session.lastActivityAt = Date.now();
  res.json({ success: true });
});

authRouter.post('/logout', (req, res) => {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) sessions.delete(token);
  clearSessionCookie(res);
  res.json({ success: true });
});

authRouter.get('/manage/users', requireOwner, (_req, res) => {
  res.json({ success: true, users: authDatabase.users.map(publicUser) });
});

authRouter.post('/manage/users', requireOwner, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const pin = String(req.body?.pin || '').trim();
  if (name.length < 2 || !/^\d{4,8}$/.test(pin)) {
    return res.status(400).json({ success: false, error: 'Ism va 4–8 xonali PIN kiriting.' });
  }
  const now = new Date().toISOString();
  const user: StoredUser = {
    id: `worker-${crypto.randomUUID()}`,
    name,
    role: 'worker',
    active: true,
    createdAt: now,
    pinHash: hashPin(pin)
  };
  authDatabase.users.push(user);
  authDatabase.updatedAt = now;
  saveAuthDatabase(authDatabase);
  res.status(201).json({ success: true, user: publicUser(user) });
});

authRouter.patch('/manage/users/:id', requireOwner, (req, res) => {
  const user = authDatabase.users.find(candidate => candidate.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, error: 'Xodim topilmadi.' });
  if (user.role === 'owner' && req.body?.active === false) {
    return res.status(400).json({ success: false, error: "Asosiy rahbar hisobini o'chirib bo'lmaydi." });
  }
  if (typeof req.body?.name === 'string' && req.body.name.trim().length >= 2) user.name = req.body.name.trim();
  if (typeof req.body?.active === 'boolean') user.active = req.body.active;
  if (typeof req.body?.pin === 'string') {
    if (!/^\d{4,8}$/.test(req.body.pin)) return res.status(400).json({ success: false, error: "PIN 4–8 xonali bo'lishi kerak." });
    user.pinHash = hashPin(req.body.pin);
  }
  authDatabase.updatedAt = new Date().toISOString();
  saveAuthDatabase(authDatabase);
  res.json({ success: true, user: publicUser(user) });
});
