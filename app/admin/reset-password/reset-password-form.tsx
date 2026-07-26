'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, Check, KeyRound, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/src/lib/supabase/client';

export function ResetPasswordForm({ email }: { email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        throw new Error(updateError.message);
      }

      router.replace('/admin');
      router.refresh();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Unable to update the administrator password.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page admin-login-page">
      <Link className="auth-back" href="/admin/login">
        <ArrowRight /> Back to admin sign in
      </Link>

      <section className="auth-brand" aria-label="Morphly password setup">
        <Link className="logo" href="/">
          <span className="logo-mark">
            <Sparkles size={17} />
          </span>
          <span>Morphly</span>
          <em>LTX 2.3</em>
        </Link>
        <div className="auth-visual">
          <div className="ring r1" />
          <div className="ring r2" />
          <div className="auth-spark">
            <KeyRound />
          </div>
        </div>
        <div>
          <span>SECURE ACCOUNT RECOVERY</span>
          <h1>
            Set a new
            <br />
            admin password.
          </h1>
          <p>Your recovery session is verified before any password can be changed.</p>
        </div>
      </section>

      <main className="auth-form-wrap">
        <div className="auth-form">
          <div className="mobile-logo">
            <Link className="logo" href="/">
              <span className="logo-mark">
                <Sparkles size={17} />
              </span>
              <span>Morphly</span>
              <em>ADMIN</em>
            </Link>
          </div>

          <span className="auth-tag">PASSWORD SETUP</span>
          <h2>Choose a new password</h2>
          <p>
            Updating credentials for <strong>{email}</strong>
          </p>

          <form onSubmit={handleSubmit}>
            <label>
              New password
              <input
                autoComplete="new-password"
                minLength={12}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 12 characters"
                required
                type="password"
                value={password}
              />
            </label>
            <label>
              Confirm new password
              <input
                autoComplete="new-password"
                minLength={12}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="Repeat your new password"
                required
                type="password"
                value={confirmation}
              />
            </label>

            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}

            <button className="lime-btn admin-login-submit" disabled={submitting} type="submit">
              {submitting ? (
                <>
                  <span className="spinner" /> Updating password…
                </>
              ) : (
                <>
                  <Check /> Save password and continue <ArrowRight />
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
