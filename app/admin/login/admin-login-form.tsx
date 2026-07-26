'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, KeyRound, ShieldCheck, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/src/lib/supabase/client';

const PRIMARY_ADMIN_EMAIL = 'samuellucky2424@gmail.com';

export function AdminLoginForm({
  initialEmail,
  initialMessage,
}: {
  initialEmail?: string;
  initialMessage?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail || PRIMARY_ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialMessage || '');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        throw new Error(signInError.message);
      }

      const verification = await fetch('/api/admin/session', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const result = (await verification.json()) as {
        authorized?: boolean;
        error?: string;
      };

      if (!verification.ok || !result.authorized) {
        await supabase.auth.signOut();
        throw new Error(
          result.error || 'This account is not authorized to access the admin console.',
        );
      }

      router.replace('/admin');
      router.refresh();
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'Unable to sign in to the admin console.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function sendPasswordReset() {
    if (!email.trim()) {
      setError('Enter the administrator email address first.');
      return;
    }

    setError('');
    setNotice('');
    setSendingReset(true);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/api/auth/callback?next=/admin/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo },
      );

      if (resetError) {
        throw new Error(resetError.message);
      }

      setNotice('If this administrator account exists, a secure reset link is on its way.');
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : 'Unable to send the password reset email.',
      );
    } finally {
      setSendingReset(false);
    }
  }

  return (
    <div className="auth-page admin-login-page">
      <a className="auth-back" href="/">
        <ArrowRight /> Back to Morphly
      </a>

      <section className="auth-brand" aria-label="Morphly administrator portal">
        <a className="logo" href="/" aria-label="Morphly home">
          <span className="logo-mark">
            <Sparkles size={17} />
          </span>
          <span>Morphly</span>
          <em>LTX 2.3</em>
        </a>
        <div className="auth-visual">
          <div className="ring r1" />
          <div className="ring r2" />
          <div className="auth-spark">
            <ShieldCheck />
          </div>
        </div>
        <div>
          <span>RESTRICTED ACCESS</span>
          <h1>
            Morphly
            <br />
            control center.
          </h1>
          <p>
            Platform operations, account oversight, generation activity, and billing
            visibility—protected by verified administrator access.
          </p>
        </div>
      </section>

      <main className="auth-form-wrap">
        <div className="auth-form">
          <div className="mobile-logo">
            <a className="logo" href="/">
              <span className="logo-mark">
                <Sparkles size={17} />
              </span>
              <span>Morphly</span>
              <em>ADMIN</em>
            </a>
          </div>

          <span className="auth-tag">SECURE ADMIN PORTAL</span>
          <h2>Administrator sign in</h2>
          <p>Use your verified Morphly administrator account to continue.</p>

          <div className="admin-security-note">
            <ShieldCheck />
            <span>
              Authorization is verified on the server for every admin page and request.
            </span>
          </div>

          <form onSubmit={handleSubmit}>
            <label>
              Administrator email
              <input
                autoComplete="username"
                inputMode="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label>
              Password
              <input
                autoComplete="current-password"
                minLength={8}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
                type="password"
                value={password}
              />
            </label>

            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="form-notice" role="status">
                {notice}
              </p>
            ) : null}

            <button className="lime-btn admin-login-submit" disabled={submitting} type="submit">
              {submitting ? (
                <>
                  <span className="spinner" /> Verifying access…
                </>
              ) : (
                <>
                  <KeyRound /> Open admin console <ArrowRight />
                </>
              )}
            </button>
          </form>

          <button
            className="admin-reset-link"
            disabled={sendingReset}
            onClick={sendPasswordReset}
            type="button"
          >
            {sendingReset ? 'Sending reset link…' : 'Forgot your password?'}
          </button>

          <small className="legal">
            First time here?{' '}
            <a href="/?auth=signup">Create and verify a Morphly account</a> using the
            administrator email first. Access attempts remain restricted to verified accounts
            with an administrator role.
          </small>
        </div>
      </main>
    </div>
  );
}
