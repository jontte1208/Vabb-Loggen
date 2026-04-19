import { useState } from 'react';
import { Mail, Lock, ArrowRight, Check } from 'lucide-react';
import { C, FONT_DISPLAY, FONT_SANS } from './lib/constants';
import { signUp, signIn, resetPassword, signInWithGoogle } from './lib/auth';

export default function Auth({ onAuthed }) {
  const [mode, setMode]         = useState('login'); // 'login' | 'signup'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [info, setInfo]         = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setInfo('');
    if (!email.trim()) { setError('Ange e-post.'); return; }
    if (password.length < 6) {
      setError('Lösenordet måste vara minst 6 tecken.'); return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password);
        setInfo('Konto skapat! Kolla din e-post för att bekräfta, sedan kan du logga in.');
        setMode('login');
      } else {
        await signIn(email, password);
        onAuthed?.();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(''); setInfo(''); setLoading(true);
    try { await signInWithGoogle(); }
    catch (err) { setError(err.message); setLoading(false); }
  }

  async function handleForgot() {
    if (!email.trim()) { setError('Ange din e-post först.'); return; }
    setError(''); setInfo(''); setLoading(true);
    try {
      await resetPassword(email);
      setInfo('Vi har skickat en länk för att återställa lösenordet.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const cta = mode === 'signup' ? 'Skapa konto' : 'Logga in';

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      padding: '40px 28px 28px', height: '100%',
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontSize: 56, lineHeight: 1, marginBottom: 16,
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.08))',
          }}>🤒</div>
          <h1 style={{
            fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 500,
            color: C.text, margin: '0 0 8px', letterSpacing: '-0.02em',
          }}>Vab-loggen</h1>
          <p style={{ fontSize: 14, color: C.textMuted, margin: 0 }}>
            {mode === 'signup' ? 'Skapa ett konto för att komma igång.' : 'Välkommen tillbaka.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          style={{
            width: '100%', padding: '14px', borderRadius: 14,
            background: '#fff', color: '#1F1F1F',
            border: `1px solid ${C.borderSoft}`,
            fontSize: 14, fontWeight: 600, fontFamily: FONT_SANS,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            marginBottom: 14, cursor: loading ? 'default' : 'pointer',
          }}
        >
          <GoogleIcon /> Fortsätt med Google
        </button>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          color: C.textMuted, fontSize: 12, marginBottom: 14,
        }}>
          <div style={{ flex: 1, height: 1, background: C.borderSoft }} />
          eller
          <div style={{ flex: 1, height: 1, background: C.borderSoft }} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field icon={<Mail size={16} />}>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              placeholder="din@epost.se"
              style={inputStyle}
            />
          </Field>

          <Field icon={<Lock size={16} />}>
            <input
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Lösenord (minst 6 tecken)"
              style={inputStyle}
            />
          </Field>

          {error && <Alert tone="error">{error}</Alert>}
          {info && <Alert tone="info">{info}</Alert>}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8, padding: '16px', borderRadius: 16, border: 'none',
              background: loading ? C.primarySoft : C.primary,
              color: loading ? C.primary : '#fff',
              fontSize: 15, fontWeight: 600, fontFamily: FONT_SANS,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: loading ? 'default' : 'pointer', transition: 'all 160ms',
            }}
          >
            {loading ? 'Laddar…' : <>{cta} <ArrowRight size={16} /></>}
          </button>

          {mode === 'login' && (
            <button type="button" onClick={handleForgot} style={linkBtnStyle}>
              Glömt lösenord?
            </button>
          )}
        </form>
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        borderTop: `1px solid ${C.borderSoft}`, paddingTop: 18,
      }}>
        {mode === 'login' ? (
          <div style={footerRow}>
            Har du inget konto?{' '}
            <button style={linkInline} onClick={() => { setMode('signup'); setError(''); setInfo(''); }}>
              Skapa konto
            </button>
          </div>
        ) : (
          <div style={footerRow}>
            Har du redan ett konto?{' '}
            <button style={linkInline} onClick={() => { setMode('login'); setError(''); setInfo(''); }}>
              Logga in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84a10.1 10.1 0 0 1-4.38 6.63v5.5h7.08c4.14-3.81 6.58-9.43 6.58-16.14z"/>
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.36l-7.08-5.5c-1.97 1.32-4.49 2.1-7.48 2.1-5.75 0-10.62-3.88-12.36-9.1H4.35v5.71A21.99 21.99 0 0 0 24 46z"/>
      <path fill="#FBBC05" d="M11.64 28.14A13.23 13.23 0 0 1 10.94 24c0-1.44.25-2.84.7-4.14v-5.71H4.35A22 22 0 0 0 2 24c0 3.55.85 6.91 2.35 9.85l7.29-5.71z"/>
      <path fill="#EA4335" d="M24 10.75c3.24 0 6.16 1.11 8.45 3.3l6.33-6.33C34.91 4.13 29.93 2 24 2A21.99 21.99 0 0 0 4.35 14.15l7.29 5.71C13.38 14.63 18.25 10.75 24 10.75z"/>
    </svg>
  );
}

function Field({ icon, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: C.surface, borderRadius: 14,
      border: `1px solid ${C.borderSoft}`,
      padding: '0 14px',
    }}>
      <div style={{ color: C.textMuted, display: 'flex' }}>{icon}</div>
      {children}
    </div>
  );
}

function Alert({ tone, children }) {
  const isErr = tone === 'error';
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 12,
      background: isErr ? '#FCE7DE' : C.primarySoft,
      color: isErr ? '#9A3F21' : C.primary,
      fontSize: 13, lineHeight: 1.45,
    }}>
      {isErr ? children : <><Check size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />{children}</>}
    </div>
  );
}

const inputStyle = {
  flex: 1, padding: '14px 0', background: 'transparent',
  border: 'none', outline: 'none',
  fontFamily: FONT_SANS, fontSize: 15, color: C.text,
};

const linkBtnStyle = {
  background: 'none', border: 'none',
  color: C.textMuted, fontSize: 12, cursor: 'pointer',
  alignSelf: 'center', padding: 4, fontFamily: FONT_SANS,
};

const footerRow = {
  textAlign: 'center', fontSize: 13, color: C.textMuted,
  fontFamily: FONT_SANS,
};

const linkInline = {
  background: 'none', border: 'none', padding: 0,
  color: C.primary, fontWeight: 600, fontSize: 13,
  cursor: 'pointer', fontFamily: FONT_SANS,
};
