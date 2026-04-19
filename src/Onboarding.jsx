import { useState } from 'react';
import { ArrowRight, Check, Bell, BellOff } from 'lucide-react';
import {
  C, FONT_DISPLAY, FONT_SANS, CHILD_PALETTE, initialsFromName,
} from './lib/constants';
import { requestNotificationPermission } from './lib/notifications';

const STEPS = ['welcome', 'child', 'notify'];

export default function Onboarding({ onComplete }) {
  const [step,       setStep]       = useState(0);
  const [leaving,    setLeaving]    = useState(false);
  const [firstChild, setFirstChild] = useState(null);

  function advance() {
    setLeaving(true);
    setTimeout(() => {
      setLeaving(false);
      if (step < STEPS.length - 1) setStep(s => s + 1);
      else onComplete(firstChild);
    }, 220);
  }

  const style = {
    opacity:    leaving ? 0 : 1,
    transform:  leaving ? 'translateY(12px)' : 'translateY(0)',
    transition: 'opacity 220ms ease, transform 220ms ease',
    height: '100%', display: 'flex', flexDirection: 'column',
  };

  return (
    <div style={style}>
      <StepDots total={STEPS.length} current={step} />
      {step === 0 && <WelcomeStep onNext={advance} />}
      {step === 1 && <ChildStep   onSetChild={setFirstChild} onNext={advance} />}
      {step === 2 && <NotifyStep  onNext={advance} />}
    </div>
  );
}

function StepDots({ total, current }) {
  return (
    <div style={{
      display: 'flex', gap: 6, justifyContent: 'center',
      padding: '18px 0 0',
    }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 20 : 6, height: 6, borderRadius: 3,
          background: i === current ? C.primary : C.borderSoft,
          transition: 'all 300ms cubic-bezier(0.16,1,0.3,1)',
        }} />
      ))}
    </div>
  );
}

/* ---- Step 1: Welcome ---- */

function WelcomeStep({ onNext }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 28px 36px', textAlign: 'center',
    }}>
      <div style={{
        fontSize: 72, lineHeight: 1, marginBottom: 24,
        filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.08))',
      }}>🤒</div>

      <div style={{
        display: 'inline-block',
        background: C.primarySoft, color: C.primary,
        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', padding: '4px 12px',
        borderRadius: 999, marginBottom: 14,
      }}>
        Välkommen
      </div>

      <h1 style={{
        fontFamily: FONT_DISPLAY, fontSize: 36, fontWeight: 500,
        color: C.text, margin: '0 0 12px', letterSpacing: '-0.02em',
        lineHeight: 1.15,
      }}>
        Vab-loggen
      </h1>

      <p style={{
        fontSize: 15, color: C.textMuted, lineHeight: 1.6,
        margin: '0 0 32px', maxWidth: 280,
      }}>
        Logga VAB-dagar på två sekunder. Få påminnelse innan 30-dagarsgränsen
        för ansökan går ut. Dela med din partner.
      </p>

      <div style={{
        width: '100%', display: 'flex', flexDirection: 'column', gap: 10,
        marginBottom: 20,
      }}>
        {[
          { emoji: '⏱️', text: 'Registrera VAB på 10 sekunder' },
          { emoji: '🔔', text: 'Påminnelse innan ansökan går ut' },
          { emoji: '👫', text: 'Dela med din partner' },
        ].map(({ emoji, text }) => (
          <div key={text} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: C.surface, borderRadius: 14,
            padding: '12px 14px', textAlign: 'left',
            border: `1px solid ${C.borderSoft}`,
          }}>
            <span style={{ fontSize: 20 }}>{emoji}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{text}</span>
          </div>
        ))}
      </div>

      <BigButton onClick={onNext}>
        Kom igång <ArrowRight size={18} />
      </BigButton>
    </div>
  );
}

/* ---- Step 2: Add first child ---- */

function ChildStep({ onSetChild, onNext }) {
  const [name,    setName]    = useState('');
  const [age,     setAge]     = useState(1);
  const [colorIx, setColorIx] = useState(0);

  const trimmed  = name.trim();
  const preview  = {
    initials:    initialsFromName(trimmed || '?'),
    accent:      CHILD_PALETTE[colorIx].accent,
    accent_soft: CHILD_PALETTE[colorIx].accent_soft,
  };

  function handleNext() {
    if (trimmed) {
      onSetChild({
        id:          Date.now(),
        name:        trimmed,
        initials:    initialsFromName(trimmed),
        age,
        accent:      CHILD_PALETTE[colorIx].accent,
        accent_soft: CHILD_PALETTE[colorIx].accent_soft,
      });
    } else {
      onSetChild(null);
    }
    onNext();
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      padding: '8px 28px 36px',
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: preview.accent, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 600, margin: '0 auto 16px',
            transition: 'background 200ms',
          }}>
            {preview.initials}
          </div>
          <h2 style={{
            fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 500,
            color: C.text, margin: '0 0 6px',
          }}>Lägg till ditt barn</h2>
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
            Du kan lägga till fler barn i inställningar.
          </p>
        </div>

        <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted,
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'block' }}>
          Namn
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="t.ex. Elsa"
          autoFocus
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 14,
            background: C.surface, border: `1px solid ${C.borderSoft}`,
            fontFamily: FONT_SANS, fontSize: 16, color: C.text,
            outline: 'none', marginBottom: 20,
          }}
        />

        <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted,
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'block' }}>
          Ålder
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <AgeBtn onClick={() => setAge(a => Math.max(0, a - 1))}>−</AgeBtn>
          <div style={{
            flex: 1, textAlign: 'center', padding: '12px',
            borderRadius: 14, background: C.surface,
            border: `1px solid ${C.borderSoft}`,
            fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 500,
          }}>
            {age} år
          </div>
          <AgeBtn onClick={() => setAge(a => Math.min(18, a + 1))}>+</AgeBtn>
        </div>

        <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted,
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'block' }}>
          Färg
        </label>
        <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
          {CHILD_PALETTE.map((p, i) => (
            <button key={i} onClick={() => setColorIx(i)} style={{
              width: 38, height: 38, borderRadius: '50%',
              background: p.accent, border: 'none',
              boxShadow: colorIx === i
                ? `0 0 0 3px ${C.bg}, 0 0 0 5px ${p.accent}`
                : 'none',
              transition: 'box-shadow 150ms', cursor: 'pointer',
            }} />
          ))}
        </div>
      </div>

      <BigButton onClick={handleNext} disabled={!trimmed}>
        {trimmed ? `Lägg till ${trimmed}` : 'Hoppa över'} <ArrowRight size={18} />
      </BigButton>
    </div>
  );
}

/* ---- Step 3: Notifications ---- */

function NotifyStep({ onNext }) {
  const [status, setStatus] = useState('idle');

  async function handleEnable() {
    setStatus('loading');
    const result = await requestNotificationPermission();
    setStatus(result === 'granted' ? 'granted' : 'denied');
    setTimeout(onNext, 1000);
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 28px 36px', textAlign: 'center',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: 24,
        background: status === 'granted' ? C.primarySoft : C.accentSoft,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 24, transition: 'background 300ms',
      }}>
        {status === 'granted'
          ? <Check size={36} color={C.primary} strokeWidth={2.4} />
          : <Bell size={36} color={C.accent} strokeWidth={1.8} />}
      </div>

      <h2 style={{
        fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 500,
        color: C.text, margin: '0 0 12px',
      }}>Missa aldrig en deadline</h2>

      <p style={{
        fontSize: 14, color: C.textMuted, lineHeight: 1.6,
        margin: '0 0 12px', maxWidth: 280,
      }}>
        Från 1 april 2026 måste VAB-ansökan lämnas in inom <strong>30 dagar</strong>.
        Vi påminner dig i god tid.
      </p>

      <div style={{
        background: C.surface, borderRadius: 14, padding: '12px 16px',
        border: `1px solid ${C.borderSoft}`, marginBottom: 32,
        fontSize: 13, color: C.textMuted, lineHeight: 1.5,
      }}>
        🔔 &nbsp;"Elsa – 5 dagar kvar att ansöka om VAB"
      </div>

      {status === 'granted' ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          color: C.primary, fontWeight: 600, fontSize: 15,
        }}>
          <Check size={20} /> Påminnelser aktiverade
        </div>
      ) : (
        <>
          <BigButton onClick={handleEnable} loading={status === 'loading'}>
            <Bell size={18} /> Aktivera påminnelser
          </BigButton>
          <button
            onClick={onNext}
            style={{
              marginTop: 14, background: 'none', border: 'none',
              color: C.textMuted, fontSize: 13, cursor: 'pointer',
              fontFamily: FONT_SANS,
            }}
          >
            Hoppa över
          </button>
        </>
      )}
    </div>
  );
}

/* ---- Shared primitives ---- */

function BigButton({ onClick, children, disabled, loading }) {
  const [down, setDown] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      onMouseDown={() => setDown(true)}
      onMouseUp={() => setDown(false)}
      onMouseLeave={() => setDown(false)}
      onTouchStart={() => setDown(true)}
      onTouchEnd={() => setDown(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 10,
        padding: '18px 20px', borderRadius: 20,
        background: disabled ? C.borderSoft : C.primary,
        color: disabled ? C.textMuted : '#fff',
        fontSize: 16, fontWeight: 600,
        transform: down ? 'scale(0.98)' : 'scale(1)',
        transition: 'transform 80ms, background 160ms',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: FONT_SANS,
      }}
    >
      {children}
    </button>
  );
}

function AgeBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      width: 48, height: 48, borderRadius: 14, flexShrink: 0,
      background: C.surface, border: `1px solid ${C.borderSoft}`,
      fontSize: 22, color: C.text, cursor: 'pointer',
      fontFamily: FONT_SANS,
    }}>
      {children}
    </button>
  );
}
