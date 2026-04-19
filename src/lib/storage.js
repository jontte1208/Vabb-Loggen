import { supabase, isSupabaseConfigured } from './supabase';
import { DEFAULT_CHILDREN, DEFAULT_ENTRIES } from './constants';

const KEYS = {
  children:     'vab-loggen.children',
  entries:      'vab-loggen.entries',
  user_name:    'vab-loggen.user_name',
  household_id: 'vab-loggen.household_id',
  onboarded:    'vab-loggen.onboarded',
};

export function isOnboarded() {
  try { return localStorage.getItem(KEYS.onboarded) === 'true'; }
  catch { return false; }
}

export function markOnboarded() {
  try { localStorage.setItem(KEYS.onboarded, 'true'); } catch {}
}

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function writeLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/* ---------- user name ---------- */

export function loadUserName() {
  try { return localStorage.getItem(KEYS.user_name) || ''; }
  catch { return ''; }
}

export function saveUserName(name) {
  try {
    if (name) localStorage.setItem(KEYS.user_name, name);
    else localStorage.removeItem(KEYS.user_name);
  } catch {}
}

/* ---------- household ---------- */

export function getLocalHouseholdId() {
  try { return localStorage.getItem(KEYS.household_id) || null; }
  catch { return null; }
}

function setLocalHouseholdId(id) {
  try {
    if (id) localStorage.setItem(KEYS.household_id, id);
    else localStorage.removeItem(KEYS.household_id);
  } catch {}
}

function generateCode() {
  // No confusable characters (0/O, 1/I/L)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function getHousehold() {
  if (!isSupabaseConfigured) return null;
  const id = getLocalHouseholdId();
  if (!id) return null;
  const { data } = await supabase.from('households').select().eq('id', id).single();
  return data ?? null;
}

export async function createHousehold(localChildren, localEntries) {
  if (!isSupabaseConfigured) throw new Error('Kräver Supabase');
  const id = crypto.randomUUID();
  const invite_code = generateCode();

  const { error } = await supabase.from('households').insert({ id, invite_code });
  if (error) throw new Error('Kunde inte skapa familjehem.');

  setLocalHouseholdId(id);

  // Upload local data to the new household
  if (localChildren.length > 0) {
    await supabase.from('children').upsert(
      localChildren.map(c => ({ ...c, household_id: id }))
    );
  }
  if (localEntries.length > 0) {
    await supabase.from('entries').upsert(
      localEntries.map(e => ({ ...e, household_id: id }))
    );
  }

  return { id, invite_code };
}

export async function joinHousehold(code) {
  if (!isSupabaseConfigured) throw new Error('Kräver Supabase');
  const { data, error } = await supabase
    .from('households')
    .select()
    .ilike('invite_code', code.trim())
    .single();
  if (error || !data) throw new Error('Ingen familj hittades med den koden.');
  setLocalHouseholdId(data.id);
  return data;
}

export async function leaveHousehold() {
  setLocalHouseholdId(null);
}

/* ---------- children ---------- */

export async function loadChildren() {
  if (isSupabaseConfigured) {
    const hid = getLocalHouseholdId();
    if (hid) {
      const { data, error } = await supabase
        .from('children').select('*').eq('household_id', hid).order('id');
      if (!error && data) {
        writeLocal(KEYS.children, data);
        return data;
      }
    }
  }
  return readLocal(KEYS.children, DEFAULT_CHILDREN);
}

export async function saveChildren(children) {
  writeLocal(KEYS.children, children);
  if (isSupabaseConfigured) {
    await supabase.from('children').upsert(children);
  }
}

export async function addChild(child, currentChildren) {
  const hid = getLocalHouseholdId();
  const record = hid ? { ...child, household_id: hid } : child;
  const updated = [...currentChildren, record];
  writeLocal(KEYS.children, updated);
  if (isSupabaseConfigured) {
    const { id, ...rest } = record;
    await supabase.from('children').insert({ id, ...rest });
  }
  return updated;
}

export async function updateChild(child, currentChildren) {
  const updated = currentChildren.map(c => (c.id === child.id ? child : c));
  writeLocal(KEYS.children, updated);
  if (isSupabaseConfigured) {
    await supabase.from('children').update(child).eq('id', child.id);
  }
  return updated;
}

export async function deleteChild(childId, currentChildren, currentEntries) {
  const updatedChildren = currentChildren.filter(c => c.id !== childId);
  const updatedEntries  = currentEntries.filter(e => e.child_id !== childId);
  writeLocal(KEYS.children, updatedChildren);
  writeLocal(KEYS.entries, updatedEntries);
  if (isSupabaseConfigured) {
    await supabase.from('children').delete().eq('id', childId);
  }
  return { children: updatedChildren, entries: updatedEntries };
}

/* ---------- entries ---------- */

export async function loadEntries() {
  if (isSupabaseConfigured) {
    const hid = getLocalHouseholdId();
    if (hid) {
      const { data, error } = await supabase
        .from('entries').select('*').eq('household_id', hid).order('date', { ascending: false });
      if (!error && data) {
        writeLocal(KEYS.entries, data);
        return data;
      }
    }
  }
  return readLocal(KEYS.entries, DEFAULT_ENTRIES);
}

export async function saveEntries(entries) {
  writeLocal(KEYS.entries, entries);
  if (isSupabaseConfigured) {
    const hid = getLocalHouseholdId();
    const records = hid ? entries.map(e => ({ ...e, household_id: hid })) : entries;
    await supabase.from('entries').upsert(records);
  }
}

export async function addEntry(entry, currentEntries) {
  const updated = [entry, ...currentEntries];
  await saveEntries(updated);
  return updated;
}

export async function updateEntry(entry, currentEntries) {
  const updated = currentEntries.map(e => (e.id === entry.id ? entry : e));
  await saveEntries(updated);
  return updated;
}

export async function deleteEntry(entryId, currentEntries) {
  const updated = currentEntries.filter(e => e.id !== entryId);
  writeLocal(KEYS.entries, updated);
  if (isSupabaseConfigured) {
    await supabase.from('entries').delete().eq('id', entryId);
  }
  return updated;
}
