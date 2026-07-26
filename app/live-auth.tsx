"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { requestJson } from "@/src/lib/client-api";
import { createClient } from "@/src/lib/supabase/client";

type View = "home" | "dashboard" | "auth";

function AuthLogo() {
  return (
    <button
      aria-label="Morphly home"
      className="logo"
      onClick={() => {
        window.location.assign("/");
      }}
      type="button"
    >
      <span className="logo-mark">
        <Sparkles size={17} />
      </span>
      <span>Morphly</span>
      <em>LTX 2.3</em>
    </button>
  );
}

export function LiveAuth({ setView }: { setView: (value: View) => void }) {
  const resetRequested =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("reset") === "1";
  const [signup, setSignup] = useState(!resetRequested);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(resetRequested);
  const [resetSent, setResetSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("fullname") ?? "");
    const referralCode = String(form.get("refcode") ?? "");
    const supabase = createClient();

    if (resetMode) {
      const confirmation = String(form.get("confirmation") ?? "");
      if (password !== confirmation) {
        setErrorMessage("The new passwords do not match.");
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }
      setResetMode(false);
      setSignup(false);
      setDone(true);
      setLoading(false);
      return;
    }

    if (signup) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            referral_code_used: referralCode || null,
          },
          emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent("/?view=dashboard")}`,
        },
      });
      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      if (data.session) {
        try {
          await requestJson<{ initialized: boolean }>("/api/auth/bootstrap", {
            method: "POST",
          });
          setView("dashboard");
        } catch (bootstrapError) {
          setErrorMessage(
            bootstrapError instanceof Error
              ? bootstrapError.message
              : "Your account could not be initialized.",
          );
        }
        setLoading(false);
        return;
      }

      setDone(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      try {
        await requestJson<{ initialized: boolean }>("/api/auth/bootstrap", {
          method: "POST",
        });
      } catch (bootstrapError) {
        setErrorMessage(
          bootstrapError instanceof Error
            ? bootstrapError.message
            : "Your account could not be initialized.",
        );
        setLoading(false);
        return;
      }

      setView("dashboard");
    }

    setLoading(false);
  }

  async function handleGoogle() {
    setErrorMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent("/?view=dashboard")}`,
      },
    });
    if (error) setErrorMessage(error.message);
  }

  async function requestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("resetEmail") ?? "");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent("/?view=auth&reset=1")}`,
    });
    setLoading(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setResetSent(true);
  }

  return (
    <div className="auth-page">
      <button className="auth-back" onClick={() => setView("home")} type="button">
        <ArrowRight /> Back to home
      </button>
      <div className="auth-brand">
        <AuthLogo />
        <div className="auth-visual">
          <div className="ring r1" />
          <div className="ring r2" />
          <div className="auth-spark">
            <Sparkles />
          </div>
        </div>
        <div>
          <span>MAKE THE IMPOSSIBLE VISIBLE</span>
          <h1>
            Every frame begins
            <br />
            with an idea.
          </h1>
          <p>Bring yours to life with LTX 2.3—faster than the thought that started it.</p>
        </div>
      </div>

      <div className="auth-form-wrap">
        <div className="auth-form">
          <div className="mobile-logo">
            <AuthLogo />
          </div>
          {done ? (
            <div className="success">
              <div><Check /></div>
              <h2>{resetMode ? "Password updated." : signup ? "Check your email." : "All set."}</h2>
              <p>
                {signup
                  ? "Open the verification link we sent to activate your Morphly account."
                  : "You can now sign in and continue creating."}
              </p>
              <button
                className="lime-btn"
                onClick={() => {
                  setDone(false);
                  setSignup(false);
                }}
                type="button"
              >
                Back to sign in <ArrowRight />
              </button>
            </div>
          ) : resetSent ? (
            <div className="success">
              <div><Check /></div>
              <h2>Check your email.</h2>
              <p>Use the secure password recovery link to choose a new password.</p>
              <button
                className="lime-btn"
                onClick={() => {
                  setResetSent(false);
                  setSignup(false);
                }}
                type="button"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <span className="auth-tag">
                {resetMode ? "SECURE YOUR ACCOUNT" : signup ? "START CREATING" : "WELCOME BACK"}
              </span>
              <h2>
                {resetMode
                  ? "Choose a new password"
                  : signup
                    ? "Create your account"
                    : "Sign in to Morphly"}
              </h2>
              <p>
                {resetMode
                  ? "Use at least 8 characters."
                  : signup
                    ? "Free starter credits. No card required."
                    : "Continue creating where you left off."}
              </p>
              {!resetMode && (
                <>
                  <button className="google-btn" onClick={handleGoogle} type="button">
                    <span>G</span> Continue with Google
                  </button>
                  <div className="or"><span>or continue with email</span></div>
                </>
              )}
              <form autoComplete="on" onSubmit={handleSubmit}>
                {signup && !resetMode && (
                  <label>
                    Full name
                    <input autoComplete="name" name="fullname" required placeholder="Lucky Samuel" />
                  </label>
                )}
                {!resetMode && (
                  <label>
                    Email address
                    <input
                      autoComplete="username"
                      name="email"
                      placeholder="you@company.com"
                      required
                      type="email"
                    />
                  </label>
                )}
                <label>
                  {resetMode ? "New password" : "Password"}
                  <input
                    autoComplete={signup || resetMode ? "new-password" : "current-password"}
                    minLength={8}
                    name="password"
                    placeholder="At least 8 characters"
                    required
                    type="password"
                  />
                </label>
                {resetMode && (
                  <label>
                    Confirm new password
                    <input
                      autoComplete="new-password"
                      minLength={8}
                      name="confirmation"
                      required
                      type="password"
                    />
                  </label>
                )}
                {signup && !resetMode && (
                  <label>
                    Referral code <small>Optional</small>
                    <input autoComplete="off" name="refcode" placeholder="MORPHLY-2026" />
                  </label>
                )}
                {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
                <button className="lime-btn" disabled={loading} type="submit">
                  {loading
                    ? "Please wait…"
                    : resetMode
                      ? "Update password"
                      : signup
                        ? "Create free account"
                        : "Sign in"}{" "}
                  <ArrowRight />
                </button>
              </form>
              {!signup && !resetMode && (
                <details className="forgot-password">
                  <summary>Forgot your password?</summary>
                  <form onSubmit={requestPasswordReset}>
                    <input
                      autoComplete="email"
                      name="resetEmail"
                      placeholder="Your account email"
                      required
                      type="email"
                    />
                    <button disabled={loading} type="submit">Send reset link</button>
                  </form>
                </details>
              )}
              {!resetMode && (
                <p className="switch">
                  {signup ? "Already have an account?" : "New to Morphly?"}{" "}
                  <button
                    onClick={() => {
                      setSignup(!signup);
                      setErrorMessage("");
                    }}
                    type="button"
                  >
                    {signup ? "Sign in" : "Create account"}
                  </button>
                </p>
              )}
              <small className="legal">
                By continuing, you agree to Morphly’s Terms of Service and Privacy Policy.
              </small>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
