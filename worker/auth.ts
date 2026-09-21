import {scryptAsync} from '@noble/hashes/scrypt.js';
import {db, json, readJSON, InputError, type Env, type Database} from './shared.ts';

const SESSION_SECONDS = 7 * 24 * 60 * 60;
const SCRYPT = {N: 16384, r: 8, p: 5, dkLen: 32, maxmem: 32 * 1024 * 1024, asyncTick: 8};
const encoder = new TextEncoder();
function hex(bytes: Uint8Array) {return Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');}
function unhex(value: string) {return Uint8Array.from(value.match(/.{2}/g) || [], v => parseInt(v, 16));}
export function randomToken() {return hex(crypto.getRandomValues(new Uint8Array(32)));}
export async function digest(value: string) {return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));}
function equal(a: string, b: string) {if (a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0;}
export async function hashPassword(password: string) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const derived = await scryptAsync(password, unhex(salt), SCRYPT);
  const encoded = `scrypt$16384$8$5$${salt}$${hex(derived)}`;
  derived.fill(0);
  return encoded;
}
export async function checkPassword(password: string, encoded: string) {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts.slice(0, 4).join('$') !== 'scrypt$16384$8$5' || !/^[a-f0-9]{32}$/.test(parts[4]) || !/^[a-f0-9]{64}$/.test(parts[5])) return false;
  const derived = await scryptAsync(password, unhex(parts[4]), SCRYPT);
  const valid = equal(hex(derived), parts[5]);
  derived.fill(0);
  return valid;
}
function validatePassword(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length < 15 || value.length > 128) throw new InputError('Use a password between 15 and 128 characters. A memorable passphrase works well.');
}
function normalizeEmail(value: unknown) {
  if (typeof value !== 'string') throw new InputError('Enter a valid email address.');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InputError('Enter a valid email address.');
  return email;
}
function cookieName(request: Request) {return new URL(request.url).protocol === 'https:' ? '__Host-globalcv_session' : 'globalcv_session_local';}
function cookie(request: Request, token: string, clear = false) {
  return `${cookieName(request)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_SECONDS}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
function sessionToken(request: Request) {
  const pairs = (request.headers.get('cookie') || '').split(';').map(x => x.trim());
  const values = pairs.filter(x => x.startsWith(`${cookieName(request)}=`));
  if (values.length !== 1) return null;
  const token = values[0].slice(cookieName(request).length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export type Account = {id: string; name: string; email: string};
export async function getAccount(request: Request, env: Env): Promise<Account | null> {
  const token = sessionToken(request);
  if (!token) return null;
  return await db(env).prepare('SELECT u.id,u.name,u.email FROM auth_sessions s JOIN accounts u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?').bind(await digest(token), Date.now()).first();
}
async function newSession(request: Request, database: Database, userId: string) {
  const token = randomToken(), now = Date.now();
  const previous = sessionToken(request);
  // Rotation prevents session fixation. Expired tokens are removed without touching other users' valid sessions.
  const statements = [database.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').bind(now)];
  if (previous) statements.push(database.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(await digest(previous)));
  statements.push(database.prepare('INSERT INTO auth_sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').bind(await digest(token), userId, now + SESSION_SECONDS * 1000, now));
  await database.batch(statements);
  return cookie(request, token);
}
async function rateLimit(request: Request, database: Database, action: string, email: string) {
  const now = Date.now(), window = Math.floor(now / 900000);
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const keys = [{key: `${action}:ip:${await digest(ip)}:${window}`, limit: action === 'register' ? 12 : 40}, {key: `${action}:email:${await digest(email)}:${window}`, limit: 10}];
  await database.batch(keys.map(k => database.prepare('INSERT INTO auth_attempts (bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count = count + 1').bind(k.key, (window + 2) * 900000)));
  for (const k of keys) {const row = await database.prepare('SELECT count FROM auth_attempts WHERE bucket = ?').bind(k.key).first(); if (row.count > k.limit) return false;}
  await database.prepare('DELETE FROM auth_attempts WHERE expires_at < ?').bind(now).run();
  return true;
}
export async function authRoute(request: Request, env: Env): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path === '/api/me' && request.method === 'GET') return json({user: await getAccount(request, env)});
  if (!path.startsWith('/api/auth/')) return null;
  if (request.method !== 'POST') return json({error: 'Use POST for this action.'}, 405);
  const database = db(env);
  if (path === '/api/auth/logout') {
    const token = sessionToken(request);
    if (token) await database.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(await digest(token)).run();
    return json({success: true}, 200, {'Set-Cookie': cookie(request, '', true)});
  }
  if (!['/api/auth/register', '/api/auth/login', '/api/auth/recover', '/api/auth/change-password'].includes(path)) return json({error: 'Route not found.'}, 404);
  const payload = await readJSON(request);
  if (path === '/api/auth/change-password') {
    const account = await getAccount(request, env);
    if (!account) return json({error: 'Please log in again.'}, 401);
    if (!await rateLimit(request, database, 'password', account.email)) return json({error: 'Too many attempts. Please try again in 15 minutes.'}, 429, {'Retry-After': '900'});
    validatePassword(payload.newPassword);
    if (typeof payload.currentPassword !== 'string' || payload.currentPassword.length > 128) throw new InputError('Enter your current password.');
    const record = await database.prepare('SELECT password_hash FROM accounts WHERE id = ?').bind(account.id).first();
    if (!await checkPassword(payload.currentPassword, record.password_hash)) return json({error: 'Your current password is incorrect.'}, 401);
    const recoveryCode = randomToken();
    const changes=await database.batch([
      database.prepare('UPDATE accounts SET password_hash = ?, recovery_hash = ? WHERE id = ? AND password_hash = ?').bind(await hashPassword(payload.newPassword), await digest(recoveryCode), account.id, record.password_hash),
      database.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(account.id),
    ]);
    if(!changes[0].meta.changes)return json({error:'Your password changed in another session. Please log in again.'},409);
    return json({user: account, recoveryCode}, 200, {'Set-Cookie': await newSession(request, database, account.id)});
  }
  const email = normalizeEmail(payload.email);
  const action = path.split('/').pop()!;
  if (!await rateLimit(request, database, action, email)) return json({error: 'Too many attempts. Please try again in 15 minutes.'}, 429, {'Retry-After': '900'});
  if (action === 'register') {
    validatePassword(payload.password);
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    if (!name || name.length > 100) throw new InputError('Enter your name (up to 100 characters).');
    const existing = await database.prepare('SELECT id FROM accounts WHERE email = ?').bind(email).first();
    if (existing) return json({error: 'Unable to create an account with these details. Try logging in or using account recovery.'}, 409);
    const account = {id: crypto.randomUUID(), email, name};
    const recoveryCode = randomToken();
    const passwordHash = await hashPassword(payload.password);
    try {await database.prepare('INSERT INTO accounts (id,email,name,password_hash,recovery_hash,created_at) VALUES (?,?,?,?,?,?)').bind(account.id, email, name, passwordHash, await digest(recoveryCode), new Date().toISOString()).run();}
    catch (error) {if ((error as Error).message.includes('UNIQUE')) return json({error: 'Unable to create an account with these details. Try logging in.'}, 409); throw error;}
    return json({user: account, recoveryCode}, 201, {'Set-Cookie': await newSession(request, database, account.id)});
  }
  if (action === 'login') {
    if (typeof payload.password !== 'string' || payload.password.length > 128) throw new InputError('Enter your email and password.');
    const record = await database.prepare('SELECT id,email,name,password_hash FROM accounts WHERE email = ?').bind(email).first();
    // Perform equivalent work for nonexistent accounts to avoid a fast username probe.
    const fallback = `scrypt$16384$8$5$${'0'.repeat(32)}$${'0'.repeat(64)}`;
    const valid = await checkPassword(payload.password, record?.password_hash || fallback);
    if (!record || !valid) return json({error: 'Email or password is incorrect.'}, 401);
    const account = {id: record.id, email: record.email, name: record.name};
    return json({user: account}, 200, {'Set-Cookie': await newSession(request, database, account.id)});
  }
  validatePassword(payload.password);
  const code = typeof payload.recoveryCode === 'string' ? payload.recoveryCode.trim().toLowerCase().replace(/[ -]/g, '') : '';
  if (!/^[a-f0-9]{64}$/.test(code)) return json({error: 'Email or recovery code is incorrect.'}, 401);
  const record = await database.prepare('SELECT id,recovery_hash FROM accounts WHERE email = ?').bind(email).first();
  const codeHash = await digest(code);
  if (!record || !equal(codeHash, record.recovery_hash)) return json({error: 'Email or recovery code is incorrect.'}, 401);
  const recoveryCode = randomToken();
  const update = await database.prepare('UPDATE accounts SET password_hash = ?, recovery_hash = ? WHERE id = ? AND recovery_hash = ?').bind(await hashPassword(payload.password), await digest(recoveryCode), record.id, codeHash).run();
  if (!update.meta.changes) return json({error: 'That recovery code has already been used.'}, 409);
  await database.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(record.id).run();
  return json({success: true, recoveryCode}, 200, {'Set-Cookie': cookie(request, '', true)});
}
