export const C = {
  bg:           '#F2EBDB',
  cream:        '#FBF7EE',
  surface:      '#FFFFFF',
  primary:      '#2C4A3E',
  primaryLight: '#3E6855',
  primarySoft:  '#E4ECE7',
  accent:       '#C97B2C',
  accentSoft:   '#F9EBD7',
  text:         '#1B1B17',
  textMuted:    '#8A847A',
  border:       '#E0D6BD',
  borderSoft:   '#EFE7D2',
};

export const FONT_DISPLAY = "'Fraunces', Georgia, serif";
export const FONT_SANS    = "'Geist', system-ui, -apple-system, sans-serif";

export const DEFAULT_CHILDREN = [];
export const DEFAULT_ENTRIES = [];

export const REASONS = [
  { id: 'feber',      label: 'Feber',      emoji: '🤒', color: '#C97B2C' },
  { id: 'forkyld',    label: 'Förkyld',    emoji: '🤧', color: '#5B7FA8' },
  { id: 'magsjuk',    label: 'Magsjuk',    emoji: '🤮', color: '#7B9166' },
  { id: 'tandvark',   label: 'Tandvärk',   emoji: '🦷', color: '#A85D7E' },
  { id: 'lakarbesok', label: 'Läkarbesök', emoji: '🩺', color: '#5B7FA8' },
  { id: 'annat',      label: 'Annat',      emoji: '✏️', color: '#8A847A' },
];

export const DAY_NAMES   = ['sön','mån','tis','ons','tor','fre','lör'];
export const MONTH_SHORT = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
export const MONTH_LONG  = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December'];

export function formatDate(dateStr) {
  const date   = new Date(dateStr);
  const today  = new Date(); today.setHours(0,0,0,0);
  const cmp    = new Date(dateStr); cmp.setHours(0,0,0,0);
  const diff   = Math.round((today - cmp) / 86400000);
  if (diff === 0) return 'Idag';
  if (diff === 1) return 'Igår';
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
}

export function extentLabel(e) {
  if (e === 1)    return 'Heldag';
  if (e === 0.75) return '¾ dag';
  if (e === 0.5)  return 'Halvdag';
  if (e === 0.25) return '¼ dag';
  return `${e} dag`;
}

export function getReasonObj(id) {
  return REASONS.find(r => r.id === id) ?? REASONS[REASONS.length - 1];
}

// Ny FK-regel from 1 april 2026: ansökan inom 30 dagar från vabdagen.
export const DEADLINE_DAYS = 30;

export function daysSince(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.round((today - d) / 86400000);
}

/**
 * @param {string} dateStr
 * @returns {{ status: 'ok' | 'soon' | 'late', daysLeft: number, label: string }}
 */
export function deadlineStatus(dateStr) {
  const elapsed = daysSince(dateStr);
  const daysLeft = DEADLINE_DAYS - elapsed;
  if (elapsed > DEADLINE_DAYS) {
    return { status: 'late', daysLeft, label: 'För sent att ansöka' };
  }
  if (daysLeft <= 7) {
    return { status: 'soon', daysLeft, label: `${daysLeft} dagar kvar att ansöka` };
  }
  return { status: 'ok', daysLeft, label: `${daysLeft} dagar kvar` };
}

export function isoDate(d = new Date()) {
  return d.toISOString().split('T')[0];
}

// Färgpaletter att välja mellan när man lägger till ett barn.
export const CHILD_PALETTE = [
  { accent: '#2C4A3E', accent_soft: '#E4ECE7' },
  { accent: '#C97B2C', accent_soft: '#F9EBD7' },
  { accent: '#5B7FA8', accent_soft: '#DCE6F1' },
  { accent: '#A85D7E', accent_soft: '#F1DCE6' },
  { accent: '#7B9166', accent_soft: '#E6EDDC' },
  { accent: '#8A5620', accent_soft: '#EEDFCB' },
];

export function initialsFromName(name) {
  const clean = (name || '').trim();
  if (!clean) return '??';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
