import { supabase, isSupabaseConfigured } from './supabase';

export async function signUp(email, password) {
  if (!isSupabaseConfigured) throw new Error('Kräver Supabase');
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw new Error(friendlyAuthError(error));
  return data;
}

export async function signIn(email, password) {
  if (!isSupabaseConfigured) throw new Error('Kräver Supabase');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new Error(friendlyAuthError(error));
  return data;
}

export async function signInWithGoogle() {
  if (!isSupabaseConfigured) throw new Error('Kräver Supabase');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw new Error(friendlyAuthError(error));
}

export async function signOut() {
  if (!isSupabaseConfigured) return;
  await supabase.auth.signOut();
}

export async function resetPassword(email) {
  if (!isSupabaseConfigured) throw new Error('Kräver Supabase');
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin,
  });
  if (error) throw new Error(friendlyAuthError(error));
}

export async function getSession() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export function onAuthChange(callback) {
  if (!isSupabaseConfigured) return { data: { subscription: { unsubscribe: () => {} } } };
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function setUserHousehold(householdId) {
  if (!isSupabaseConfigured) return;
  await supabase.auth.updateUser({ data: { household_id: householdId } });
}

function friendlyAuthError(error) {
  const msg = (error.message || '').toLowerCase();
  if (msg.includes('invalid login credentials')) return 'Fel e-post eller lösenord.';
  if (msg.includes('user already registered')) return 'Det finns redan ett konto med den e-posten.';
  if (msg.includes('password should be at least')) return 'Lösenordet måste vara minst 6 tecken.';
  if (msg.includes('invalid email')) return 'Ogiltig e-postadress.';
  if (msg.includes('email not confirmed')) return 'Bekräfta först din e-post via länken vi skickade.';
  if (msg.includes('rate limit')) return 'För många försök. Vänta en minut och försök igen.';
  return error.message || 'Något gick fel. Försök igen.';
}
