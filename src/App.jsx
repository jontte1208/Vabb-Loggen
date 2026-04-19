import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Home as HomeIcon, Calendar, FileText, ArrowLeft, Check,
  TrendingUp, Download, BarChart3, ArrowRight, Battery, Trash2,
  AlertTriangle, Clock, Settings, Bell, BellOff, UserPlus, Users,
  Copy, ExternalLink,
} from 'lucide-react';
import {
  C, FONT_DISPLAY, FONT_SANS, REASONS, MONTH_LONG, MONTH_SHORT, DAY_NAMES,
  CHILD_PALETTE, initialsFromName,
  formatDate, extentLabel, getReasonObj, deadlineStatus, isoDate, daysSince,
} from './lib/constants';
import {
  loadChildren, loadEntries, addEntry, updateEntry, deleteEntry,
  addChild, updateChild, deleteChild,
  loadUserName, saveUserName,
  getHousehold, createHousehold, joinHousehold, leaveHousehold,
  isOnboarded, markOnboarded,
} from './lib/storage';
import Onboarding from './Onboarding.jsx';
import Auth from './Auth.jsx';
import { isSupabaseConfigured } from './lib/supabase';
import {
  getSession, onAuthChange, signOut, setUserHousehold,
} from './lib/auth';
import {
  notificationPermission, requestNotificationPermission,
  checkDeadlineNotifications, registerServiceWorker,
} from './lib/notifications';

export default function VabLoggen() {
  const [screen, setScreen]     = useState('main');
  const [tab, setTab]           = useState('home');
  const [children, setChildren] = useState([]);
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [session, setSession]   = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editingChildId, setEditingChildId] = useState(null);
  const [notifStatus, setNotifStatus] = useState('default');
  const [userName, setUserName] = useState('');
  const [household, setHousehold] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [regChild,  setRegChild]  = useState(null);
  const [regDate,   setRegDate]   = useState(isoDate());
  const [regExtent, setRegExtent] = useState(1);
  const [regReason, setRegReason] = useState('feber');
  const [regReasonNote, setRegReasonNote] = useState('');
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Geist:wght@400;500;600&display=swap';
    link.rel  = 'stylesheet';
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, []);

  useEffect(() => {
    getSession().then(s => {
      setSession(s);
      setAuthChecked(true);
    });
    const { data } = onAuthChange(s => setSession(s));
    return () => data?.subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    async function init() {
      setLoading(true);
      registerServiceWorker();
      const metaHid = session.user?.user_metadata?.household_id;
      if (metaHid) {
        try { localStorage.setItem('vab-loggen.household_id', metaHid); } catch {}
      }
      let [c, e] = await Promise.all([loadChildren(), loadEntries()]);

      // Auto-create household on first login so data syncs across devices.
      // Uploads any existing local children/entries into the new household.
      if (!metaHid) {
        try {
          const h = await createHousehold(c, e);
          await setUserHousehold(h.id);
          [c, e] = await Promise.all([loadChildren(), loadEntries()]);
        } catch (err) {
          // Non-fatal: fall through with local-only data
          console.warn('Auto-create household failed:', err);
        }
      }

      setChildren(c);
      setEntries(e);
      setRegChild(c[0]?.id ?? null);
      setNotifStatus(notificationPermission());
      setUserName(loadUserName());
      const h = await getHousehold();
      setHousehold(h);
      setLoading(false);
      if (c.length > 0) {
        markOnboarded();
      } else if (!isOnboarded()) {
        setShowOnboarding(true);
      }
      checkDeadlineNotifications(e, c);
    }
    init();
  }, [session?.user?.id]);

  async function handleSignOut() {
    await signOut();
    try {
      localStorage.removeItem('vab-loggen.household_id');
      localStorage.removeItem('vab-loggen.children');
      localStorage.removeItem('vab-loggen.entries');
    } catch {}
    setChildren([]);
    setEntries([]);
    setHousehold(null);
    setScreen('main');
    setTab('home');
  }

  function handleUserNameChange(name) {
    setUserName(name);
    saveUserName(name);
  }

  async function handleCreateHousehold() {
    const h = await createHousehold(children, entries);
    await setUserHousehold(h.id);
    setHousehold(h);
    const fresh = await Promise.all([loadChildren(), loadEntries()]);
    setChildren(fresh[0]);
    setEntries(fresh[1]);
  }

  async function handleJoinHousehold(code) {
    const h = await joinHousehold(code);
    await setUserHousehold(h.id);
    setHousehold(h);
    const fresh = await Promise.all([loadChildren(), loadEntries()]);
    setChildren(fresh[0]);
    setEntries(fresh[1]);
  }

  async function handleOnboardingComplete(firstChild) {
    if (firstChild) {
      const updated = await addChild(firstChild, children);
      setChildren(updated);
      setRegChild(firstChild.id);
    }
    markOnboarded();
    setShowOnboarding(false);
  }

  async function handleLeaveHousehold() {
    await leaveHousehold();
    await setUserHousehold(null);
    setHousehold(null);
  }

  async function enableNotifications() {
    const result = await requestNotificationPermission();
    setNotifStatus(result);
    if (result === 'granted') {
      await checkDeadlineNotifications(entries, children);
    }
  }

  const thisYear = new Date().getFullYear();

  const getDaysUsed = (childId) =>
    entries
      .filter(e => e.child_id === childId && new Date(e.date).getFullYear() === thisYear)
      .reduce((sum, e) => sum + e.extent, 0);

  const totalDaysThisYear = useMemo(
    () => children.reduce((sum, c) => sum + getDaysUsed(c.id), 0),
    [children, entries],
  );

  function openRegister(entry = null) {
    if (children.length === 0) {
      openChildEditor(null);
      return;
    }
    if (entry) {
      setEditingEntryId(entry.id);
      setRegChild(entry.child_id);
      setRegDate(entry.date);
      setRegExtent(entry.extent);
      setRegReason(entry.reason);
      setRegReasonNote(entry.reason_note ?? '');
    } else {
      setEditingEntryId(null);
      setRegChild(children[0]?.id ?? null);
      setRegDate(isoDate());
      setRegExtent(1);
      setRegReason('feber');
      setRegReasonNote('');
    }
    setScreen('register');
  }

  async function handleSave() {
    const entry = {
      id:       editingEntryId ?? Date.now(),
      child_id: regChild,
      date:     regDate,
      extent:   regExtent,
      reason:   regReason,
      reason_note: regReason === 'annat' ? (regReasonNote.trim() || null) : null,
    };
    const updated = editingEntryId
      ? await updateEntry(entry, entries)
      : await addEntry(entry, entries);
    setEntries(updated);
    setShowSaved(true);
    setTimeout(() => {
      setShowSaved(false);
      setScreen('main');
      setTab('home');
      setEditingEntryId(null);
    }, 1400);
  }

  async function handleDelete() {
    if (!editingEntryId) return;
    const updated = await deleteEntry(editingEntryId, entries);
    setEntries(updated);
    setScreen('main');
    setTab('home');
    setEditingEntryId(null);
  }

  function openChildEditor(child = null) {
    setEditingChildId(child ? child.id : 'new');
    setScreen('child');
  }

  async function handleChildSave(child) {
    const exists = children.some(c => c.id === child.id);
    const updated = exists
      ? await updateChild(child, children)
      : await addChild(child, children);
    setChildren(updated);
    setScreen('settings');
    setEditingChildId(null);
  }

  async function handleChildDelete(childId) {
    const result = await deleteChild(childId, children, entries);
    setChildren(result.children);
    setEntries(result.entries);
    setScreen('settings');
    setEditingChildId(null);
  }

  return (
    <>
    <div
      className="app-frame-container"
      style={{
        minHeight: '100vh',
        background: C.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        fontFamily: FONT_SANS,
        backgroundImage:
          'radial-gradient(circle at 20% 10%, rgba(44,74,62,0.06), transparent 40%),' +
          'radial-gradient(circle at 80% 90%, rgba(201,123,44,0.05), transparent 45%)',
      }}
    >
      <div
        className="app-frame"
        style={{
          width: '100%',
          maxWidth: 400,
          height: 780,
          background: C.cream,
          borderRadius: 36,
          border: `1px solid ${C.border}`,
          boxShadow: '0 30px 60px -20px rgba(44,74,62,0.35), 0 12px 24px -12px rgba(27,27,23,0.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <StatusBar />
        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
          {!authChecked ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>Laddar…</div>
          ) : !session ? (
            <Auth onAuthed={() => {}} />
          ) : loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>Laddar…</div>
          ) : showOnboarding ? (
            <Onboarding onComplete={handleOnboardingComplete} />
          ) : screen === 'main' ? (
            tab === 'home'    ? <HomeScreen  userName={userName} children={children} entries={entries} totalDays={totalDaysThisYear} getDaysUsed={getDaysUsed} onRegister={() => openRegister(null)} onEdit={openRegister} onSettings={() => setScreen('settings')} onAddChild={() => openChildEditor(null)} />
          : tab === 'calendar'? <CalendarScreen children={children} entries={entries} onEdit={openRegister} />
          : <SummaryScreen children={children} entries={entries} totalDays={totalDaysThisYear} getDaysUsed={getDaysUsed} onEdit={openRegister} />
          ) : screen === 'settings' ? (
            <SettingsScreen
              userName={userName}
              onUserNameChange={handleUserNameChange}
              children={children}
              entries={entries}
              notifStatus={notifStatus}
              onEnableNotifications={enableNotifications}
              onEditChild={openChildEditor}
              onAddChild={() => openChildEditor(null)}
              onBack={() => setScreen('main')}
              household={household}
              onCreateHousehold={handleCreateHousehold}
              onJoinHousehold={handleJoinHousehold}
              onLeaveHousehold={handleLeaveHousehold}
              userEmail={session?.user?.email}
              onSignOut={handleSignOut}
            />
          ) : screen === 'child' ? (
            <ChildEditorScreen
              child={editingChildId === 'new' ? null : children.find(c => c.id === editingChildId)}
              existingCount={children.length}
              onBack={() => { setScreen('settings'); setEditingChildId(null); }}
              onSave={handleChildSave}
              onDelete={handleChildDelete}
            />
          ) : (
            <RegisterScreen
              isEditing={!!editingEntryId}
              children={children}
              regChild={regChild}   setRegChild={setRegChild}
              regDate={regDate}     setRegDate={setRegDate}
              regExtent={regExtent} setRegExtent={setRegExtent}
              regReason={regReason} setRegReason={setRegReason}
              regReasonNote={regReasonNote} setRegReasonNote={setRegReasonNote}
              onBack={() => { setScreen('main'); setEditingEntryId(null); }}
              onSave={handleSave}
              onDelete={handleDelete}
              showSaved={showSaved}
              getDaysUsed={getDaysUsed}
            />
          )}
        </div>
        {session && screen === 'main' && !showOnboarding && <BottomNav tab={tab} setTab={setTab} />}
      </div>
    </div>

    <PrintView children={children} entries={entries}
      totalDays={totalDaysThisYear} getDaysUsed={getDaysUsed} />
    </>
  );
}

/* ---------------- Status bar ---------------- */

function StatusBar() {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 24px 6px', fontSize: 13, fontWeight: 600, color: C.text,
    }}>
      <span>{time}</span>
      <Battery size={18} strokeWidth={2} />
    </div>
  );
}

/* ---------------- Bottom nav ---------------- */

function BottomNav({ tab, setTab }) {
  const items = [
    { id: 'home',     label: 'Hem',      icon: HomeIcon },
    { id: 'calendar', label: 'Kalender', icon: Calendar },
    { id: 'summary',  label: 'FK',       icon: FileText },
  ];
  return (
    <div style={{
      display: 'flex', borderTop: `1px solid ${C.borderSoft}`,
      background: C.cream, padding: '10px 16px 18px',
    }}>
      {items.map(({ id, label, icon: Icon }) => {
        const active = tab === id;
        return (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 4, padding: '6px 0',
              color: active ? C.primary : C.textMuted,
              transition: 'color 160ms',
            }}
          >
            <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
            <span style={{ fontSize: 11, fontWeight: active ? 600 : 500 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Home screen ---------------- */

function HomeScreen({ userName, children, entries, totalDays, getDaysUsed, onRegister, onEdit, onSettings, onAddChild }) {
  const greeting = greet(new Date().getHours());
  const recent = [...entries]
    .sort((a,b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const urgent = entries
    .filter(e => {
      const s = deadlineStatus(e.date);
      return s.status === 'soon' || s.status === 'late';
    })
    .sort((a,b) => a.date.localeCompare(b.date));

  return (
    <div style={{ padding: '8px 22px 24px' }}>
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: C.textMuted, fontSize: 13, fontWeight: 500 }}>
            {userName ? `${greeting}, ${userName}` : greeting}
          </div>
          <h1 style={{
            fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 500,
            margin: '4px 0 0', letterSpacing: '-0.01em', color: C.text,
          }}>Vab-loggen</h1>
        </div>
        <button
          onClick={onSettings}
          style={{
            width: 40, height: 40, borderRadius: 14,
            background: C.surface, border: `1px solid ${C.borderSoft}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: C.text, marginTop: 4,
          }}
          aria-label="Inställningar"
        >
          <Settings size={18} />
        </button>
      </div>

      {children.length === 0 ? (
        <EmptyChildrenCard onAddChild={onAddChild} />
      ) : (
        <>
          <PrimaryButton onClick={onRegister} style={{ marginTop: 22 }}>
            <Plus size={20} strokeWidth={2.2} />
            <span>Vabba idag</span>
          </PrimaryButton>
          <div style={{
            marginTop: 10, textAlign: 'center', color: C.textMuted,
            fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontSize: 13,
          }}>
            Två tryck. Klart.
          </div>

          {urgent.length > 0 && (
            <DeadlineAlert entries={urgent} children={children} onEdit={onEdit} />
          )}
        </>
      )}

      {children.length > 0 && (
      <>
      <div style={{
        marginTop: 22, background: C.primarySoft, borderRadius: 20,
        padding: '20px 22px',
      }}>
        <div style={{
          fontFamily: FONT_DISPLAY, fontSize: 44, fontWeight: 500,
          lineHeight: 1, color: C.primary,
        }}>
          {formatDays(totalDays)}
        </div>
        <div style={{ color: C.primary, fontSize: 14, fontWeight: 500, marginTop: 4 }}>
          vab-dagar i år
        </div>
      </div>

      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {children.map(child => {
          const used = getDaysUsed(child.id);
          return (
            <div key={child.id} style={{
              background: C.surface, borderRadius: 18, padding: 16,
              border: `1px solid ${C.borderSoft}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar child={child} size={32} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{child.name}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{child.age} år</div>
                </div>
              </div>
              <div style={{
                marginTop: 12, fontFamily: FONT_DISPLAY, fontSize: 26,
                fontWeight: 500, color: C.text, lineHeight: 1,
              }}>
                {formatDays(used)}<span style={{ color: C.textMuted, fontSize: 14 }}>/120</span>
              </div>
              <div style={{
                marginTop: 10, height: 3, background: C.borderSoft,
                borderRadius: 2, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.min(100, (used / 120) * 100)}%`,
                  height: '100%', background: child.accent,
                }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Senaste</div>
          <div style={{
            fontFamily: FONT_DISPLAY, fontStyle: 'italic',
            fontSize: 12, color: C.textMuted,
          }}>tryck för att redigera</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recent.map(e => {
            const child  = children.find(c => c.id === e.child_id);
            const reason = getReasonObj(e.reason);
            const dl = deadlineStatus(e.date);
            if (!child) return null;
            return (
              <button key={e.id} onClick={() => onEdit(e)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: C.surface, borderRadius: 14, padding: '10px 12px',
                border: `1px solid ${C.borderSoft}`, width: '100%', textAlign: 'left',
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12,
                  background: child.accent_soft, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>{reason.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                    {child.name} · {extentLabel(e.extent)}
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>
                    {formatDate(e.date)} · {reason.label}
                  </div>
                </div>
                <DeadlineBadge dl={dl} />
              </button>
            );
          })}
        </div>
      </div>
      </>
      )}
    </div>
  );
}

function EmptyChildrenCard({ onAddChild }) {
  return (
    <div style={{
      marginTop: 24, background: C.surface, borderRadius: 22,
      border: `1px solid ${C.borderSoft}`, padding: '28px 22px',
      textAlign: 'center',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: C.primarySoft, color: C.primary,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 14px',
      }}>
        <UserPlus size={24} />
      </div>
      <div style={{
        fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 500, color: C.text,
      }}>
        Välkommen
      </div>
      <div style={{
        fontFamily: FONT_DISPLAY, fontStyle: 'italic',
        fontSize: 13, color: C.textMuted, marginTop: 4,
      }}>
        Börja med att lägga till ett barn.
      </div>
      <PrimaryButton onClick={onAddChild} style={{ marginTop: 20 }}>
        <UserPlus size={18} />
        <span>Lägg till barn</span>
      </PrimaryButton>
    </div>
  );
}

function DeadlineAlert({ entries, children, onEdit }) {
  const late = entries.filter(e => deadlineStatus(e.date).status === 'late');
  const soon = entries.filter(e => deadlineStatus(e.date).status === 'soon');
  const primary = late[0] ?? soon[0];
  if (!primary) return null;
  const child = children.find(c => c.id === primary.child_id);
  const dl = deadlineStatus(primary.date);
  const isLate = dl.status === 'late';

  return (
    <button
      onClick={() => onEdit(primary)}
      style={{
        marginTop: 18, width: '100%', textAlign: 'left',
        background: isLate ? '#FBEAE4' : '#FDF3E4',
        borderRadius: 16, padding: '14px 16px',
        border: `1px solid ${isLate ? '#E7A58E' : '#E8C58A'}`,
        display: 'flex', gap: 12, alignItems: 'center',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: isLate ? '#C9522C' : '#C97B2C', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isLate ? <AlertTriangle size={18} /> : <Clock size={18} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
          {isLate ? 'Ansökan försenad' : 'Ansök snart'}
        </div>
        <div style={{ fontSize: 12, color: C.text, opacity: 0.75, marginTop: 2 }}>
          {formatDate(primary.date)} · {child?.name}
          {entries.length > 1 && ` · +${entries.length - 1} till`}
        </div>
      </div>
      <ArrowRight size={16} color={C.textMuted} />
    </button>
  );
}

function DeadlineBadge({ dl }) {
  if (dl.status === 'ok') return null;
  const isLate = dl.status === 'late';
  return (
    <div style={{
      fontSize: 10, fontWeight: 600,
      padding: '4px 8px', borderRadius: 999, whiteSpace: 'nowrap',
      background: isLate ? '#FBEAE4' : '#FDF3E4',
      color: isLate ? '#9A3F21' : '#8A5620',
      border: `1px solid ${isLate ? '#E7A58E' : '#E8C58A'}`,
    }}>
      {isLate ? 'För sent' : `${dl.daysLeft}d kvar`}
    </div>
  );
}

function PrimaryButton({ children, onClick, style }) {
  const [down, setDown] = useState(false);
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setDown(true)}
      onMouseUp={() => setDown(false)}
      onMouseLeave={() => { setDown(false); setHover(false); }}
      onMouseEnter={() => setHover(true)}
      onTouchStart={() => setDown(true)}
      onTouchEnd={() => setDown(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 10, padding: '18px 20px',
        borderRadius: 20, background: hover ? C.primaryLight : C.primary,
        color: '#fff', fontSize: 16, fontWeight: 600,
        transform: down ? 'scale(0.98)' : 'scale(1)',
        transition: 'background 160ms, transform 80ms',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Avatar({ child, size = 40 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: child.accent, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 600, letterSpacing: '0.02em',
      flexShrink: 0,
    }}>
      {child.initials}
    </div>
  );
}

function greet(hour) {
  if (hour < 5)  return 'God natt';
  if (hour < 10) return 'God morgon';
  if (hour < 13) return 'God förmiddag';
  if (hour < 18) return 'God eftermiddag';
  return 'God kväll';
}

function formatDays(n) {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString().replace('.', ',');
}

/* ---------------- Register / edit screen ---------------- */

function RegisterScreen({
  isEditing, children, regChild, setRegChild,
  regDate, setRegDate, regExtent, setRegExtent,
  regReason, setRegReason,
  regReasonNote, setRegReasonNote,
  onBack, onSave, onDelete,
  showSaved, getDaysUsed,
}) {
  if (showSaved) {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div className="pop" style={{
          width: 96, height: 96, borderRadius: '50%',
          background: C.primary, display: 'flex', alignItems: 'center',
          justifyContent: 'center', marginBottom: 20,
        }}>
          <Check size={48} color="#fff" strokeWidth={2.4} />
        </div>
        <div style={{
          fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 500, color: C.text,
        }}>Sparat</div>
        <div style={{
          fontFamily: FONT_DISPLAY, fontStyle: 'italic',
          fontSize: 15, color: C.textMuted, marginTop: 6,
        }}>Sköt om de små.</div>
      </div>
    );
  }

  const selectedChild = children.find(c => c.id === regChild);
  const remaining = selectedChild ? Math.max(0, 120 - getDaysUsed(selectedChild.id)) : 0;
  const extentOptions = [
    { v: 1,    label: 'Heldag' },
    { v: 0.75, label: '¾ dag' },
    { v: 0.5,  label: '½ dag' },
    { v: 0.25, label: '¼ dag' },
  ];

  const dl = deadlineStatus(regDate);

  return (
    <div style={{ padding: '8px 22px 28px' }}>
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          color: C.textMuted, fontSize: 13, fontWeight: 500,
          padding: '4px 0',
        }}
      >
        <ArrowLeft size={16} /> Tillbaka
      </button>
      <h1 style={{
        fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 500,
        margin: '6px 0 18px', color: C.text, letterSpacing: '-0.01em',
      }}>{isEditing ? 'Redigera vab' : 'Registrera vab'}</h1>

      <SectionTitle>Datum</SectionTitle>
      <DateField value={regDate} onChange={setRegDate} />
      {dl.status !== 'ok' && (
        <div style={{
          marginTop: 8, fontSize: 12,
          color: dl.status === 'late' ? '#9A3F21' : '#8A5620',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {dl.status === 'late' ? <AlertTriangle size={14} /> : <Clock size={14} />}
          {dl.label}
        </div>
      )}

      <SectionTitle>Barn</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {children.map(child => {
          const selected = regChild === child.id;
          return (
            <button
              key={child.id}
              onClick={() => setRegChild(child.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px', borderRadius: 16,
                background: selected ? child.accent_soft : C.surface,
                border: selected
                  ? `1.5px solid ${child.accent}`
                  : `1px solid ${C.borderSoft}`,
                transition: 'all 140ms', textAlign: 'left',
              }}
            >
              <Avatar child={child} size={34} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{child.name}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{child.age} år</div>
              </div>
            </button>
          );
        })}
      </div>

      <SectionTitle>Omfattning</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {extentOptions.map(opt => {
          const selected = regExtent === opt.v;
          return (
            <button
              key={opt.v}
              onClick={() => setRegExtent(opt.v)}
              style={{
                padding: '12px 4px', borderRadius: 14,
                background: selected ? C.primary : C.surface,
                color: selected ? '#fff' : C.text,
                border: selected ? 'none' : `1px solid ${C.borderSoft}`,
                fontSize: 12, fontWeight: 600, transition: 'all 140ms',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <SectionTitle>Anledning</SectionTitle>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {REASONS.map(r => {
          const selected = regReason === r.id;
          return (
            <button
              key={r.id}
              onClick={() => setRegReason(r.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 14px', borderRadius: 999,
                background: selected ? r.color : C.surface,
                color: selected ? '#fff' : C.text,
                border: `1px solid ${selected ? r.color : C.borderSoft}`,
                fontSize: 13, fontWeight: 500, transition: 'all 140ms',
              }}
            >
              <span>{r.emoji}</span><span>{r.label}</span>
            </button>
          );
        })}
      </div>

      {regReason === 'annat' && (
        <input
          type="text"
          value={regReasonNote}
          onChange={e => setRegReasonNote(e.target.value)}
          placeholder="Beskriv anledningen"
          maxLength={120}
          style={{
            marginTop: 10, width: '100%', padding: '12px 14px', borderRadius: 14,
            background: C.surface, border: `1px solid ${C.borderSoft}`,
            fontFamily: 'inherit', fontSize: 14, color: C.text, outline: 'none',
          }}
        />
      )}

      {selectedChild && (
        <div style={{
          marginTop: 22, background: selectedChild.accent_soft,
          borderRadius: 16, padding: '14px 16px', fontSize: 13,
          color: C.text, lineHeight: 1.5,
        }}>
          Du har <strong>{formatDays(remaining)}</strong> vab-dagar kvar för {selectedChild.name} i år.
        </div>
      )}

      <PrimaryButton onClick={onSave} style={{ marginTop: 22, borderRadius: 18 }}>
        {isEditing ? 'Spara ändringar' : 'Spara'}
      </PrimaryButton>

      {isEditing && (
        <button
          onClick={() => {
            if (confirm('Ta bort den här registreringen?')) onDelete();
          }}
          style={{
            marginTop: 12, width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 20px', borderRadius: 18,
            background: 'transparent', color: '#9A3F21',
            border: `1px solid #E7A58E`, fontSize: 14, fontWeight: 500,
          }}
        >
          <Trash2 size={16} /> Ta bort
        </button>
      )}
    </div>
  );
}

function DateField({ value, onChange }) {
  const today = isoDate();
  const diff = daysSince(value);
  const label = diff === 0 ? 'Idag'
    : diff === 1 ? 'Igår'
    : diff > 0 ? `${diff} dagar sedan`
    : `om ${-diff} dagar`;

  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 14px', borderRadius: 14,
      background: C.surface, border: `1px solid ${C.borderSoft}`,
      cursor: 'pointer',
    }}>
      <Calendar size={16} color={C.primary} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
          {formatDate(value)}
        </div>
        <div style={{ fontSize: 11, color: C.textMuted }}>{label}</div>
      </div>
      <input
        type="date"
        value={value}
        max={today}
        onChange={e => onChange(e.target.value)}
        style={{
          border: 'none', background: 'transparent',
          fontFamily: 'inherit', fontSize: 12, color: C.primary,
          width: 130, textAlign: 'right',
        }}
      />
    </label>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: C.textMuted,
      textTransform: 'uppercase', letterSpacing: '0.08em',
      margin: '22px 0 10px',
    }}>{children}</div>
  );
}

/* ---------------- Calendar screen ---------------- */

function CalendarScreen({ children, entries, onEdit }) {
  const [dayDetail, setDayDetail] = useState(null); // { date, entries }
  const today = new Date();
  // offset = antal månader från nuvarande månad (0 = nu, -1 = förra, +1 = nästa)
  const [offset, setOffset] = useState(0);

  const WINDOW = 3; // antal månader som visas
  const months = Array.from({ length: WINDOW }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() + offset + i, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const isAtToday = offset === 0;
  const firstVisible = months[0];
  const lastVisible  = months[WINDOW - 1];

  return (
    <div style={{ padding: '8px 22px 24px' }}>
      <div style={{ color: C.textMuted, fontSize: 13, fontWeight: 500 }}>
        Översikt {today.getFullYear()}
      </div>
      <h1 style={{
        fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 500,
        margin: '4px 0 14px', color: C.text, letterSpacing: '-0.01em',
      }}>Kalender</h1>

      {/* Navigering */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, gap: 8,
      }}>
        <button onClick={() => setOffset(o => o - 1)} style={navBtnStyle}>
          ‹ Bakåt
        </button>
        <button
          onClick={() => setOffset(0)}
          style={{
            ...navBtnStyle,
            background: isAtToday ? C.primary : C.surface,
            color:      isAtToday ? '#fff'    : C.textMuted,
            border:     isAtToday ? 'none'    : `1px solid ${C.borderSoft}`,
            fontWeight: 600,
          }}
        >
          Idag
        </button>
        <button onClick={() => setOffset(o => o + 1)} style={navBtnStyle}>
          Framåt ›
        </button>
      </div>

      {/* Legend */}
      {children.length > 0 && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
          {children.map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: C.text,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.accent }} />
              {c.name}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {months.map((m, i) => (
          <MonthGrid key={`${m.year}-${m.month}`} year={m.year} month={m.month}
            entries={entries} children={children} today={today}
            onDayClick={(dateStr, dayEntries) => setDayDetail({ date: dateStr, entries: dayEntries })}
          />
        ))}
      </div>

      {dayDetail && (
        <DayDetailOverlay
          detail={dayDetail}
          children={children}
          onClose={() => setDayDetail(null)}
          onEdit={(e) => { setDayDetail(null); onEdit(e); }}
        />
      )}
    </div>
  );
}

function DayDetailOverlay({ detail, children, onClose, onEdit }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20,20,20,0.45)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, background: C.bg,
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          padding: '20px 22px 26px', maxHeight: '70vh', overflowY: 'auto',
        }}
      >
        <div style={{
          width: 40, height: 4, borderRadius: 2, background: C.borderSoft,
          margin: '0 auto 16px',
        }} />
        <div style={{
          fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 500,
          color: C.text, marginBottom: 14,
        }}>{formatDate(detail.date)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {detail.entries.map(e => {
            const c = children.find(x => x.id === e.child_id);
            const r = getReasonObj(e.reason);
            return (
              <button
                key={e.id}
                onClick={() => onEdit(e)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 14,
                  background: c?.accent_soft ?? C.surface,
                  border: `1px solid ${C.borderSoft}`,
                  textAlign: 'left',
                }}
              >
                <Avatar child={c} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                    {c?.name ?? '—'} · {extentLabel(e.extent)}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                    {r.emoji} {r.label}{e.reason_note ? ` — ${e.reason_note}` : ''}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const navBtnStyle = {
  flex: 1, padding: '9px 0', borderRadius: 12,
  background: C.surface, border: `1px solid ${C.borderSoft}`,
  fontSize: 13, fontWeight: 500, color: C.textMuted,
  cursor: 'pointer',
};

function MonthGrid({ year, month, entries, children, today, onDayClick }) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const entriesByDay = new Map();
  for (const e of entries) {
    const d = new Date(e.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!entriesByDay.has(day)) entriesByDay.set(day, []);
      entriesByDay.get(day).push(e);
    }
  }

  const isToday = (d) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  return (
    <div>
      <div style={{
        fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 500,
        color: C.text, marginBottom: 8,
      }}>
        {MONTH_LONG[month]} {year}
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4,
        marginBottom: 4,
      }}>
        {['M','T','O','T','F','L','S'].map((d, i) => (
          <div key={i} style={{
            textAlign: 'center', fontSize: 10, fontWeight: 600,
            color: C.textMuted, padding: '2px 0',
          }}>{d}</div>
        ))}
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4,
      }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const dayEntries = entriesByDay.get(d) || [];
          const todayCell = isToday(d);
          const hasEntries = dayEntries.length > 0;
          const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          return (
            <button
              key={i}
              onClick={hasEntries ? () => onDayClick(dateStr, dayEntries) : undefined}
              disabled={!hasEntries}
              style={{
                aspectRatio: '1', borderRadius: 10, position: 'relative',
                background: todayCell ? C.primary : 'transparent',
                color: todayCell ? '#fff' : C.text,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: todayCell ? 600 : 500,
                border: 'none', padding: 0,
                cursor: hasEntries ? 'pointer' : 'default',
              }}>
              <span>{d}</span>
              {dayEntries.length > 0 && (
                <div style={{
                  position: 'absolute', bottom: 4, left: 0, right: 0,
                  display: 'flex', justifyContent: 'center', gap: 2,
                }}>
                  {Array.from(new Set(dayEntries.map(e => e.child_id))).map(cid => {
                    const ch = children.find(c => c.id === cid);
                    if (!ch) return null;
                    return (
                      <span key={cid} style={{
                        width: 4, height: 4, borderRadius: '50%',
                        background: todayCell ? '#fff' : ch.accent,
                      }} />
                    );
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Summary screen ---------------- */

function SummaryScreen({ children, entries, totalDays, getDaysUsed, onEdit }) {
  const thisYear = new Date().getFullYear();
  const entriesThisYear = entries
    .filter(e => new Date(e.date).getFullYear() === thisYear)
    .sort((a,b) => b.date.localeCompare(a.date));

  const lateCount = entries.filter(e => deadlineStatus(e.date).status === 'late').length;
  const [copied, setCopied] = useState(false);

  async function handleCopyDates() {
    const sorted = [...entriesThisYear].sort((a,b) => a.date.localeCompare(b.date));
    const blocks = children.map(c => {
      const childRows = sorted.filter(e => e.child_id === c.id);
      if (childRows.length === 0) return null;
      const totalDays = childRows.reduce((sum, e) => sum + e.extent, 0);
      const lines = childRows.map(e =>
        `  ${e.date}  ${extentLabel(e.extent)}`
      );
      const pnr = c.personal_id ? ` · ${c.personal_id}` : '';
      return `${c.name} (${c.age} år)${pnr} — ${formatDays(totalDays)} dagar\n${lines.join('\n')}`;
    }).filter(Boolean);

    const header = `Underlag VAB ${thisYear} — ${formatDays(totalDays)} dagar totalt`;
    const text = blocks.length
      ? `${header}\n\n${blocks.join('\n\n')}`
      : 'Inga registreringar i år.';

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div style={{ padding: '8px 22px 24px' }}>
      <div style={{ color: C.textMuted, fontSize: 13, fontWeight: 500 }}>
        För Försäkringskassan
      </div>
      <h1 style={{
        fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 500,
        margin: '4px 0 18px', color: C.text, letterSpacing: '-0.01em',
      }}>Sammanställning</h1>

      <div style={{
        position: 'relative', background: C.primary, color: '#fff',
        borderRadius: 22, padding: '22px 24px', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', right: -40, top: -40, width: 140, height: 140,
          borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
        }} />
        <div style={{
          position: 'absolute', right: 20, bottom: -50, width: 100, height: 100,
          borderRadius: '50%', background: 'rgba(255,255,255,0.05)',
        }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 500 }}>{thisYear}</div>
          <div style={{
            fontFamily: FONT_DISPLAY, fontSize: 48, fontWeight: 500,
            lineHeight: 1, marginTop: 4,
          }}>{formatDays(totalDays)}</div>
          <div style={{ fontSize: 14, marginTop: 4, opacity: 0.92 }}>vab-dagar</div>
          {lateCount > 0 && (
            <div style={{
              marginTop: 12, fontSize: 12, display: 'flex', gap: 6, alignItems: 'center',
              background: 'rgba(255,255,255,0.15)', padding: '6px 10px',
              borderRadius: 999, width: 'fit-content',
            }}>
              <AlertTriangle size={12} />
              {lateCount} försenade ansökningar
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children.map(c => {
          const childEntries = entriesThisYear.filter(e => e.child_id === c.id);
          return (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: c.accent_soft, borderRadius: 18, padding: '14px 16px',
            }}>
              <Avatar child={c} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{c.name}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>
                  {childEntries.length} tillfällen
                </div>
              </div>
              <div style={{
                fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 500, color: C.text,
              }}>{formatDays(getDaysUsed(c.id))}</div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ActionRow
          icon={<ExternalLink size={18} />}
          label="Ansök hos Försäkringskassan"
          sublabel="Öppnar Mina sidor (BankID)"
          onClick={() => window.open('https://www.forsakringskassan.se/privatperson/foralder/vard-av-barn-vab', '_blank', 'noopener')}
        />
        <ActionRow
          icon={<Copy size={18} />}
          label={copied ? 'Kopierat!' : 'Kopiera alla datum'}
          sublabel="Klistra in i FK:s formulär"
          onClick={handleCopyDates}
        />
        <ActionRow
          icon={<Download size={18} />}
          label="Spara som PDF"
          sublabel="För eget arkiv eller arbetsgivare"
          onClick={() => window.print()}
        />
      </div>

      <div style={{
        marginTop: 14, padding: '14px 16px', borderRadius: 16,
        background: C.primarySoft, color: C.primary,
        fontSize: 12, lineHeight: 1.55,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Innan du ansöker</div>
        <div style={{ color: C.text, opacity: 0.85 }}>
          • Du behöver <strong>BankID</strong> och registrerad <strong>SGI</strong> hos FK<br/>
          • <strong>Läkarintyg</strong> krävs från dag 8 av barnets sjukperiod<br/>
          • Ansök inom <strong>90 dagar</strong> från första VAB-dagen
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: C.textMuted,
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
        }}>Alla registreringar</div>
        <div style={{
          background: C.surface, borderRadius: 16,
          border: `1px solid ${C.borderSoft}`, overflow: 'hidden',
        }}>
          {entriesThisYear.map((e, i) => {
            const c = children.find(x => x.id === e.child_id);
            const r = getReasonObj(e.reason);
            const dl = deadlineStatus(e.date);
            if (!c) return null;
            return (
              <button key={e.id} onClick={() => onEdit(e)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 14px', width: '100%', textAlign: 'left',
                background: 'transparent',
                borderBottom: i < entriesThisYear.length - 1
                  ? `1px solid ${C.borderSoft}` : 'none',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: c.accent,
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                    {formatDate(e.date)} · {c.name}
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{r.label}</div>
                </div>
                <DeadlineBadge dl={dl} />
                <div style={{ fontSize: 12, fontWeight: 500, color: C.text, marginLeft: 8 }}>
                  {formatDays(e.extent)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ActionRow({ icon, label, sublabel, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', borderRadius: 16,
        background: hover ? C.cream : C.surface,
        border: `1px solid ${C.borderSoft}`,
        transition: 'background 140ms', width: '100%', textAlign: 'left',
      }}
    >
      <span style={{ color: C.primary }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{label}</div>
        {sublabel && (
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{sublabel}</div>
        )}
      </div>
      <ArrowRight size={16} color={C.textMuted} />
    </button>
  );
}

/* ---------------- Settings screen ---------------- */

function SettingsScreen({
  userName, onUserNameChange,
  children, entries, notifStatus, onEnableNotifications,
  onEditChild, onAddChild, onBack,
  household, onCreateHousehold, onJoinHousehold, onLeaveHousehold,
  userEmail, onSignOut,
}) {
  const [nameInput, setNameInput] = useState(userName);
  const [nameSaved, setNameSaved] = useState(false);
  const isStandalone = typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
     window.navigator.standalone === true);
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const iosNeedsInstall = isIOS && !isStandalone;

  function handleSaveName() {
    onUserNameChange(nameInput.trim());
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 1800);
  }

  return (
    <div style={{ padding: '8px 22px 28px' }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        color: C.textMuted, fontSize: 13, fontWeight: 500, padding: '4px 0',
      }}>
        <ArrowLeft size={16} /> Tillbaka
      </button>
      <h1 style={{
        fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 500,
        margin: '6px 0 18px', color: C.text, letterSpacing: '-0.01em',
      }}>Inställningar</h1>

      <SectionTitle>Ditt namn</SectionTitle>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={nameInput}
          onChange={e => { setNameInput(e.target.value); setNameSaved(false); }}
          onKeyDown={e => e.key === 'Enter' && handleSaveName()}
          placeholder="t.ex. Anna"
          style={{
            flex: 1, padding: '12px 14px', borderRadius: 14,
            background: C.surface, border: `1px solid ${C.borderSoft}`,
            fontFamily: 'inherit', fontSize: 15, color: C.text, outline: 'none',
          }}
        />
        <button
          onClick={handleSaveName}
          style={{
            padding: '12px 18px', borderRadius: 14,
            background: nameSaved ? C.primarySoft : C.primary,
            color: nameSaved ? C.primary : '#fff',
            fontSize: 14, fontWeight: 600,
            transition: 'all 200ms', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {nameSaved ? <><Check size={15} /> Sparat</> : 'Spara'}
        </button>
      </div>
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
        Visas i hälsningen på startsidan.
      </div>

      <SectionTitle>Dela med partner</SectionTitle>
      <SharingCard
        household={household}
        onCreate={onCreateHousehold}
        onJoin={onJoinHousehold}
        onLeave={onLeaveHousehold}
      />

      <SectionTitle>Notiser</SectionTitle>
      <NotificationsCard
        status={notifStatus}
        onEnable={onEnableNotifications}
        iosNeedsInstall={iosNeedsInstall}
      />

      <SectionTitle>Barn</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children.map(c => {
          const count = entries.filter(e => e.child_id === c.id).length;
          return (
            <button
              key={c.id}
              onClick={() => onEditChild(c)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: C.surface, borderRadius: 14,
                border: `1px solid ${C.borderSoft}`,
                padding: '12px 14px', width: '100%', textAlign: 'left',
              }}
            >
              <Avatar child={c} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{c.name}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>
                  {c.age} år · {count} registreringar
                </div>
              </div>
              <ArrowRight size={16} color={C.textMuted} />
            </button>
          );
        })}
        <button
          onClick={onAddChild}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 18px', borderRadius: 14,
            background: 'transparent', color: C.primary,
            border: `1.5px dashed ${C.primary}`,
            fontSize: 14, fontWeight: 600, marginTop: 4,
          }}
        >
          <UserPlus size={18} /> Lägg till barn
        </button>
      </div>

      {userEmail && (
        <>
          <SectionTitle>Konto</SectionTitle>
          <div style={{
            background: C.surface, borderRadius: 14,
            border: `1px solid ${C.borderSoft}`,
            padding: '12px 14px', marginBottom: 10,
          }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>Inloggad som</div>
            <div style={{ fontSize: 14, color: C.text, fontWeight: 500, wordBreak: 'break-all' }}>
              {userEmail}
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm('Logga ut? Din data förblir sparad och synkas tillbaka när du loggar in igen.')) {
                onSignOut();
              }
            }}
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 14,
              background: 'transparent', color: '#9A3F21',
              border: '1px solid #E7A58E', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: FONT_SANS,
            }}
          >
            Logga ut
          </button>
        </>
      )}
    </div>
  );
}

function NotificationsCard({ status, onEnable, iosNeedsInstall }) {
  if (status === 'unsupported') {
    return (
      <InfoBanner
        tone="muted"
        icon={<BellOff size={18} />}
        title="Notiser stöds inte"
        body="Den här webbläsaren stödjer inte notiser."
      />
    );
  }
  if (status === 'denied') {
    return (
      <InfoBanner
        tone="warn"
        icon={<BellOff size={18} />}
        title="Notiser är blockerade"
        body="Tillåt notiser för Vab-loggen i telefonens inställningar för att få påminnelser."
      />
    );
  }
  if (status === 'granted') {
    return (
      <InfoBanner
        tone="ok"
        icon={<Bell size={18} />}
        title="Notiser påslagna"
        body="Du får påminnelse innan 30-dagarsgränsen för ansökan går ut."
      />
    );
  }
  return (
    <div>
      <button
        onClick={onEnable}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', borderRadius: 16,
          background: C.primary, color: '#fff',
          fontSize: 14, fontWeight: 600,
        }}
      >
        <Bell size={18} />
        <span style={{ flex: 1, textAlign: 'left' }}>Slå på påminnelser</span>
        <ArrowRight size={16} />
      </button>
      {iosNeedsInstall && (
        <div style={{
          marginTop: 10, padding: '12px 14px', borderRadius: 12,
          background: C.accentSoft, border: `1px solid ${C.border}`,
          fontSize: 12, color: C.text, lineHeight: 1.5,
        }}>
          <strong>iPhone:</strong> För att få notiser måste du först lägga till appen på hemskärmen.
          Tryck på <em>Dela</em> i Safari → <em>Lägg till på hemskärmen</em>, öppna appen därifrån,
          och tryck sedan på den här knappen.
        </div>
      )}
    </div>
  );
}

function SharingCard({ household, onCreate, onJoin, onLeave }) {
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining]   = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied]     = useState(false);
  const [error, setError]       = useState('');

  if (!isSupabaseConfigured) {
    return (
      <InfoBanner
        tone="muted"
        icon={<Users size={18} />}
        title="Kräver molnsynk"
        body="Konfigurera Supabase i .env-filen för att aktivera delning."
      />
    );
  }

  async function handleCreate() {
    setCreating(true);
    setError('');
    try { await onCreate(); }
    catch (e) { setError(e.message); }
    finally { setCreating(false); }
  }

  async function handleJoin() {
    if (joinCode.trim().length < 6) return;
    setJoining(true);
    setError('');
    try { await onJoin(joinCode); setJoinCode(''); }
    catch (e) { setError(e.message); }
    finally { setJoining(false); }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(household.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  if (household) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{
          background: C.primarySoft, borderRadius: 16, padding: '16px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.primary,
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Din kod
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 500,
              letterSpacing: '0.12em', color: C.primary, flex: 1,
            }}>
              {household.invite_code}
            </div>
            <button
              onClick={handleCopy}
              style={{
                padding: '8px 14px', borderRadius: 10,
                background: copied ? C.primary : C.surface,
                color: copied ? '#fff' : C.primary,
                border: `1px solid ${C.primary}`,
                fontSize: 13, fontWeight: 600, transition: 'all 180ms',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {copied ? <><Check size={14}/> Kopierad</> : 'Kopiera'}
            </button>
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
            Dela koden med din partner. De anger den i sin app under Inställningar → Dela med partner.
          </div>
        </div>
        <button
          onClick={() => {
            if (confirm('Lämna detta familjehem? Du tappar tillgång till den delade datan på den här enheten.')) {
              onLeave();
            }
          }}
          style={{
            padding: '12px 16px', borderRadius: 14, width: '100%',
            background: 'transparent', color: '#9A3F21',
            border: '1px solid #E7A58E', fontSize: 13, fontWeight: 500,
          }}
        >
          Lämna detta hem
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button
        onClick={handleCreate}
        disabled={creating}
        style={{
          padding: '16px', borderRadius: 16, width: '100%',
          background: creating ? C.primarySoft : C.primary,
          color: creating ? C.primary : '#fff',
          fontSize: 14, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 10,
          opacity: creating ? 0.7 : 1, transition: 'all 160ms',
        }}
      >
        <Users size={18} />
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div>{creating ? 'Skapar…' : 'Skapa delat familjehem'}</div>
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2, fontWeight: 400 }}>
            Du får en kod att dela med din partner
          </div>
        </div>
      </button>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        color: C.textMuted, fontSize: 12,
      }}>
        <div style={{ flex: 1, height: 1, background: C.borderSoft }} />
        eller
        <div style={{ flex: 1, height: 1, background: C.borderSoft }} />
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 8 }}>
          Ange din partners kod
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={joinCode}
            onChange={e => { setJoinCode(e.target.value.toUpperCase()); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="ABC123"
            maxLength={6}
            style={{
              flex: 1, padding: '12px 14px', borderRadius: 14,
              background: C.surface, border: `1px solid ${error ? '#E7A58E' : C.borderSoft}`,
              fontFamily: FONT_DISPLAY, fontSize: 20, letterSpacing: '0.12em',
              color: C.text, outline: 'none', textTransform: 'uppercase',
            }}
          />
          <button
            onClick={handleJoin}
            disabled={joining || joinCode.trim().length < 6}
            style={{
              padding: '12px 18px', borderRadius: 14,
              background: joinCode.trim().length < 6 ? C.borderSoft : C.primary,
              color: joinCode.trim().length < 6 ? C.textMuted : '#fff',
              fontSize: 14, fontWeight: 600, transition: 'all 160ms',
            }}
          >
            {joining ? '…' : 'Gå med'}
          </button>
        </div>
        {error && (
          <div style={{ marginTop: 6, fontSize: 12, color: '#9A3F21' }}>{error}</div>
        )}
      </div>
    </div>
  );
}

function InfoBanner({ tone, icon, title, body }) {
  const tones = {
    ok:    { bg: C.primarySoft, fg: C.primary, border: 'transparent' },
    warn:  { bg: '#FBEAE4',     fg: '#9A3F21', border: '#E7A58E' },
    muted: { bg: C.surface,     fg: C.textMuted, border: C.borderSoft },
  };
  const t = tones[tone] || tones.muted;
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      padding: '14px 16px', borderRadius: 16,
      background: t.bg, border: `1px solid ${t.border}`, color: t.fg,
    }}>
      <div style={{ marginTop: 2 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 12, marginTop: 2, opacity: 0.85 }}>{body}</div>
      </div>
    </div>
  );
}

/* ---------------- Child editor ---------------- */

function ChildEditorScreen({ child, existingCount, onBack, onSave, onDelete }) {
  const isNew = !child;
  const paletteIdx = isNew
    ? existingCount % CHILD_PALETTE.length
    : CHILD_PALETTE.findIndex(p => p.accent === child.accent);
  const [name,       setName]       = useState(child?.name ?? '');
  const [age,        setAge]        = useState(child?.age ?? 0);
  const [personalId, setPersonalId] = useState(child?.personal_id ?? '');
  const [colorIx,    setColorIx]    = useState(paletteIdx >= 0 ? paletteIdx : 0);

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const palette = CHILD_PALETTE[colorIx];
    onSave({
      id: child?.id ?? Date.now(),
      name: trimmed,
      initials: initialsFromName(trimmed),
      age: Number(age) || 0,
      personal_id: personalId.trim() || null,
      accent: palette.accent,
      accent_soft: palette.accent_soft,
    });
  }

  const preview = {
    name: name.trim() || 'Nytt barn',
    initials: initialsFromName(name || '??'),
    accent: CHILD_PALETTE[colorIx].accent,
    accent_soft: CHILD_PALETTE[colorIx].accent_soft,
  };

  return (
    <div style={{ padding: '8px 22px 28px' }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        color: C.textMuted, fontSize: 13, fontWeight: 500, padding: '4px 0',
      }}>
        <ArrowLeft size={16} /> Tillbaka
      </button>
      <h1 style={{
        fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 500,
        margin: '6px 0 18px', color: C.text, letterSpacing: '-0.01em',
      }}>{isNew ? 'Lägg till barn' : 'Redigera barn'}</h1>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: preview.accent_soft, borderRadius: 18, padding: '14px 16px',
        marginBottom: 18,
      }}>
        <Avatar child={preview} size={44} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{preview.name}</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>{age || 0} år</div>
        </div>
      </div>

      <SectionTitle>Namn</SectionTitle>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="t.ex. Elsa"
        autoFocus={isNew}
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 14,
          background: C.surface, border: `1px solid ${C.borderSoft}`,
          fontFamily: 'inherit', fontSize: 15, color: C.text, outline: 'none',
        }}
      />

      <SectionTitle>Ålder</SectionTitle>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => setAge(Math.max(0, Number(age) - 1))}
          style={ageBtnStyle}
        >−</button>
        <div style={{
          flex: 1, textAlign: 'center', padding: '12px 14px',
          borderRadius: 14, background: C.surface,
          border: `1px solid ${C.borderSoft}`,
          fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 500, color: C.text,
        }}>
          {age} år
        </div>
        <button
          onClick={() => setAge(Math.min(18, Number(age) + 1))}
          style={ageBtnStyle}
        >+</button>
      </div>

      <SectionTitle>Personnummer (valfritt)</SectionTitle>
      <input
        type="text"
        inputMode="numeric"
        value={personalId}
        onChange={e => setPersonalId(e.target.value)}
        placeholder="ÅÅÅÅMMDD-XXXX"
        autoComplete="off"
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 14,
          background: C.surface, border: `1px solid ${C.borderSoft}`,
          fontFamily: 'inherit', fontSize: 15, color: C.text, outline: 'none',
          letterSpacing: '0.02em',
        }}
      />
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6, lineHeight: 1.4 }}>
        Krävs för att ansöka hos Försäkringskassan. Sparas endast hos dig (och ev. delat familjehem).
      </div>

      <SectionTitle>Färg</SectionTitle>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {CHILD_PALETTE.map((p, i) => {
          const selected = colorIx === i;
          return (
            <button
              key={i}
              onClick={() => setColorIx(i)}
              aria-label={`Färg ${i + 1}`}
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: p.accent,
                border: selected ? `3px solid ${C.text}` : `3px solid transparent`,
                boxShadow: selected ? `0 0 0 2px ${C.bg}` : 'none',
                transition: 'all 120ms',
              }}
            />
          );
        })}
      </div>

      <PrimaryButton onClick={handleSave} style={{ marginTop: 26, borderRadius: 18 }}>
        {isNew ? 'Lägg till' : 'Spara ändringar'}
      </PrimaryButton>

      {!isNew && (
        <button
          onClick={() => {
            if (confirm(`Ta bort ${child.name}? Detta raderar även alla VAB-poster för ${child.name}.`)) {
              onDelete(child.id);
            }
          }}
          style={{
            marginTop: 12, width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 20px', borderRadius: 18,
            background: 'transparent', color: '#9A3F21',
            border: `1px solid #E7A58E`, fontSize: 14, fontWeight: 500,
          }}
        >
          <Trash2 size={16} /> Ta bort barn
        </button>
      )}
    </div>
  );
}

const ageBtnStyle = {
  width: 44, height: 44, borderRadius: 12,
  background: C.surface, border: `1px solid ${C.borderSoft}`,
  fontSize: 22, fontWeight: 500, color: C.text,
};

/* ---------------- Print view (PDF export) ---------------- */

function PrintView({ children, entries, totalDays, getDaysUsed }) {
  const thisYear = new Date().getFullYear();
  const rows = [...entries]
    .filter(e => new Date(e.date).getFullYear() === thisYear)
    .sort((a,b) => a.date.localeCompare(b.date));
  const now = new Date();

  const months = [...new Set(rows.map(e => new Date(e.date).getMonth()))].sort((a,b) => a-b);
  let periodLabel;
  if (months.length === 0) {
    periodLabel = `${MONTH_LONG[now.getMonth()]} ${thisYear}`;
  } else if (months.length === 1) {
    periodLabel = `${MONTH_LONG[months[0]]} ${thisYear}`;
  } else {
    periodLabel = `${MONTH_LONG[months[0]]}–${MONTH_LONG[months[months.length-1]]} ${thisYear}`;
  }

  return (
    <div className="print-view" aria-hidden="true">
      <div className="print-head">
        <div>
          <div className="print-kicker">Vab-loggen</div>
          <h1>Sammanställning VAB · {periodLabel}</h1>
        </div>
        <div className="print-meta">
          Utskriven {now.getDate()} {MONTH_SHORT[now.getMonth()]} {now.getFullYear()}<br/>
          Totalt: <strong>{formatDays(totalDays)} dagar</strong>
        </div>
      </div>

      <table className="print-children">
        <thead>
          <tr><th>Barn</th><th>Tillfällen</th><th style={{textAlign:'right'}}>Dagar</th></tr>
        </thead>
        <tbody>
          {children.map(c => {
            const n = rows.filter(r => r.child_id === c.id).length;
            return (
              <tr key={c.id}>
                <td>
                  {c.name} ({c.age} år)
                  {c.personal_id && <div style={{fontSize:11, opacity:0.7}}>{c.personal_id}</div>}
                </td>
                <td>{n}</td>
                <td style={{textAlign:'right'}}>{formatDays(getDaysUsed(c.id))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>Alla registreringar</h2>
      <table className="print-entries">
        <thead>
          <tr>
            <th>Datum</th><th>Veckodag</th><th>Barn</th>
            <th>Omfattning</th><th>Anledning</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(e => {
            const c = children.find(x => x.id === e.child_id);
            const r = getReasonObj(e.reason);
            const d = new Date(e.date);
            return (
              <tr key={e.id}>
                <td>{e.date}</td>
                <td>{DAY_NAMES[d.getDay()]}</td>
                <td>{c?.name ?? '—'}</td>
                <td>{extentLabel(e.extent)}</td>
                <td>{r.label}{e.reason_note ? ` — ${e.reason_note}` : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="print-foot">
        Underlag för ansökan hos Försäkringskassan. Kontrollera siffrorna innan inlämning.<br/>
        Kom ihåg: läkar-/sjuksköterskeintyg krävs från och med dag 8 av barnets sjukperiod.
        Ansökan ska skickas in inom 90 dagar från första VAB-dagen. Du behöver en registrerad SGI hos FK.
      </div>
    </div>
  );
}
