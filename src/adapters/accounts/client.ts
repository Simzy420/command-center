import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { LayoutDocument } from '@/types/layout';
import { DEFAULT_BOARDS } from '@/types/layout';
import { assertOwnerEmail, assertPassword, normalizeEmail, OWNER_EMAIL } from '@/adapters/accounts/allowlist';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/adapters/accounts/publicConfig';

export const ACCOUNTS_UNAVAILABLE =
  'Sign-in could not reach Supabase. This page stays on Casey\'s board.';

/** Shown when the account exists but the inbox still has to confirm it. */
export class AccountNotice extends Error {}

export interface AccountSession {
  username: string;
  layout: LayoutDocument | null;
}

const LAYOUT_TABLE = 'command_center_layouts';
const META_KEY = 'cc_layout';
const MAX_LAYOUT_CHARS = 100_000;

let client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

function redirectTo(): string | undefined {
  if (typeof location === 'undefined') return undefined;
  return `${location.origin}${import.meta.env.BASE_URL}`;
}

function emptyLayout(): LayoutDocument {
  return {
    version: 1,
    boards: DEFAULT_BOARDS.map((board) => ({ ...board })),
    widgets: [],
    updatedAt: Date.now(),
  };
}

function layoutFrom(value: unknown): LayoutDocument | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as LayoutDocument;
  if (record.version !== 1 || !Array.isArray(record.widgets)) return null;
  return record;
}

function tableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const text = `${error.code ?? ''} ${error.message ?? ''}`;
  return /PGRST205|42P01|schema cache|does not exist|Could not find the table/i.test(text);
}

async function readLayout(user: User): Promise<LayoutDocument> {
  const stored = await supabase()
    .from(LAYOUT_TABLE)
    .select('layout')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!stored.error) {
    return layoutFrom(stored.data?.layout) ?? emptyLayout();
  }
  if (!tableMissing(stored.error)) {
    const meta = layoutFrom(user.user_metadata?.[META_KEY]);
    if (meta) return meta;
    throw new Error('Could not load this board.');
  }
  return layoutFrom(user.user_metadata?.[META_KEY]) ?? emptyLayout();
}

async function writeLayout(user: User, layout: LayoutDocument): Promise<void> {
  const body = JSON.stringify(layout);
  if (body.length > MAX_LAYOUT_CHARS) throw new Error('That board is too large to save.');
  const saved = await supabase()
    .from(LAYOUT_TABLE)
    .upsert(
      { user_id: user.id, layout, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (!saved.error) return;
  if (!tableMissing(saved.error)) throw new Error(saved.error.message || 'Could not save this board.');
  const updated = await supabase().auth.updateUser({ data: { [META_KEY]: layout } });
  if (updated.error) throw new Error(updated.error.message || 'Could not save this board.');
}

function authMessage(message: string, code?: string): Error {
  if (/email not confirmed/i.test(message) || code === 'email_not_confirmed') {
    return new AccountNotice('Confirm the email from Supabase, then log in with the same password.');
  }
  if (/invalid login|invalid credentials/i.test(message) || code === 'invalid_credentials') {
    return new Error('Wrong email or password.');
  }
  if (/already registered|already been registered/i.test(message)) {
    return new Error('That email is already registered. Confirm it, then log in.');
  }
  return new Error(message || 'Could not open that profile.');
}

async function sessionFor(user: User): Promise<AccountSession> {
  if (normalizeEmail(user.email ?? '') !== OWNER_EMAIL) {
    await supabase().auth.signOut();
    throw new Error('Sign-up and sign-in are limited to caseylsims@gmail.com.');
  }
  return { username: user.email ?? OWNER_EMAIL, layout: await readLayout(user) };
}

async function currentUser(): Promise<User | null> {
  const { data, error } = await supabase().auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function loadAccountSession(): Promise<AccountSession> {
  try {
    const user = await currentUser();
    if (!user) return { username: '', layout: null };
    if (normalizeEmail(user.email ?? '') !== OWNER_EMAIL) {
      await supabase().auth.signOut();
      return { username: '', layout: null };
    }
    return { username: user.email ?? OWNER_EMAIL, layout: await readLayout(user) };
  } catch (err) {
    if (err instanceof AccountNotice) throw err;
    if (err instanceof Error && /limited to caseylsims/.test(err.message)) throw err;
    throw new Error(ACCOUNTS_UNAVAILABLE);
  }
}

export async function registerAccount(username: string, password: string): Promise<AccountSession> {
  const email = assertOwnerEmail(username);
  const secret = assertPassword(password);
  const { data, error } = await supabase().auth.signUp({
    email,
    password: secret,
    options: {
      emailRedirectTo: redirectTo(),
      data: { [META_KEY]: emptyLayout() },
    },
  });
  if (error) throw authMessage(error.message, error.code);
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('That email is already registered. Confirm it, then log in.');
  }
  if (!data.session || !data.user) {
    throw new AccountNotice(
      `Check ${OWNER_EMAIL} for a Supabase confirmation email, then log in with the same password.`,
    );
  }
  return sessionFor(data.user);
}

export async function loginAccount(username: string, password: string): Promise<AccountSession> {
  const email = assertOwnerEmail(username);
  const secret = assertPassword(password);
  const { data, error } = await supabase().auth.signInWithPassword({ email, password: secret });
  if (error) throw authMessage(error.message, error.code);
  if (!data.user) throw new Error('Could not open that profile.');
  return sessionFor(data.user);
}

export async function logoutAccount(): Promise<AccountSession> {
  await supabase().auth.signOut();
  return { username: '', layout: null };
}

export async function saveAccountLayout(layout: LayoutDocument): Promise<AccountSession> {
  const user = await currentUser();
  if (!user || normalizeEmail(user.email ?? '') !== OWNER_EMAIL) {
    throw new Error('Sign in to save this board.');
  }
  await writeLayout(user, layout);
  return { username: user.email ?? OWNER_EMAIL, layout };
}
