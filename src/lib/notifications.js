import { deadlineStatus } from './constants';

const NOTIFIED_KEY = 'vab-loggen.notified';

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied')  return 'denied';
  return await Notification.requestPermission();
}

async function showNotification(title, body, tag) {
  if (Notification.permission !== 'granted') return;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        reg.showNotification(title, { body, tag, icon: '/icon-192.png', badge: '/icon-192.png' });
        return;
      }
    }
    new Notification(title, { body, tag, icon: '/icon-192.png' });
  } catch {}
}

function readNotified() {
  try { return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}'); }
  catch { return {}; }
}

function writeNotified(m) {
  try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(m)); } catch {}
}

/**
 * Kollar alla poster och visar notis för brådskande ärenden.
 * En post notifieras en gång per dag + status.
 */
export async function checkDeadlineNotifications(entries, children) {
  if (notificationPermission() !== 'granted') return;
  const today  = new Date().toISOString().split('T')[0];
  const seen   = readNotified();
  const nextSeen = { ...seen };
  let fired = 0;

  for (const e of entries) {
    const dl = deadlineStatus(e.date);
    if (dl.status === 'ok') continue;
    const key = `${e.id}:${dl.status}:${today}`;
    if (seen[key]) continue;

    const child = children.find(c => c.id === e.child_id);
    const title = dl.status === 'late'
      ? 'VAB-ansökan försenad'
      : `Ansök om VAB — ${dl.daysLeft} dagar kvar`;
    const body  = `${child?.name ?? 'Barn'} · ${e.date}`;

    await showNotification(title, body, `vab-${e.id}`);
    nextSeen[key] = true;
    fired++;
  }

  const pruned = {};
  for (const [k, v] of Object.entries(nextSeen)) {
    if (k.endsWith(today)) pruned[k] = v;
  }
  writeNotified(pruned);
  return fired;
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try { await navigator.serviceWorker.register('/sw.js'); } catch {}
}
