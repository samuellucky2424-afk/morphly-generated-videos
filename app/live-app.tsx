"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  CreditCard,
  Download,
  Film,
  Image as ImageIcon,
  Layers3,
  MessageSquareText,
  Play,
  Plus,
  Search,
  Settings,
  Sparkles,
  Upload,
  Video,
  WandSparkles,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/src/lib/supabase/client";

type View = "home" | "dashboard" | "auth";
type Mode = "Text to video" | "Image to video" | "Video to video";

interface Wallet {
  available_credits: number;
  reserved_credits: number;
  lifetime_purchased: number;
  lifetime_spent: number;
}

interface GenerationPreset {
  id: string;
  name: string;
  action: string;
  width: number;
  height: number;
  frames: number;
  fps: number;
  credit_cost: number;
}

interface GenerationJob {
  id: string;
  prompt: string;
  action: string;
  status: string;
  output_storage_path?: string | null;
  generation_presets?: { name?: string } | null;
}

interface CreditPackage {
  id: string;
  name: string;
  description?: string | null;
  price_minor: number;
  currency: string;
  base_credits: number;
  bonus_credits: number;
}

interface CreditTransaction {
  id: string;
  transaction_type: string;
  credit_delta: number;
  available_balance_after: number;
  description?: string | null;
  created_at: string;
}

const modeActions: Record<Mode, string> = {
  "Text to video": "text_to_video",
  "Image to video": "image_to_video",
  "Video to video": "video_to_video",
};

class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);
  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : typeof payload === "string"
          ? payload
          : "Request failed";
    throw new ApiRequestError(response.status, message);
  }

  return payload as T;
}

function LiveLogo() {
  return (
    <button
      onClick={() => {
        location.hash = "";
      }}
      className="logo"
      aria-label="Morphly home"
    >
      <span className="logo-mark">
        <Sparkles size={17} />
      </span>
      <span>Morphly</span>
      <em>LTX 2.3</em>
    </button>
  );
}

function LiveSide({
  active,
  setActive,
}: {
  active: string;
  setActive: (value: string) => void;
}) {
  const items: Array<[string, LucideIcon]> = [
    ["Create", WandSparkles],
    ["My videos", Film],
    ["Assets", Layers3],
    ["Billing", CreditCard],
    ["Settings", Settings],
  ];

  return (
    <aside className="side">
      <LiveLogo />
      <div className="side-label">STUDIO</div>
      {items.map(([label, Icon]) => (
        <button
          className={active === label ? "active" : ""}
          onClick={() => setActive(label)}
          key={label}
        >
          <Icon size={18} />
          {label}
        </button>
      ))}
      <div className="side-bottom">
        <div className="mini-user">
          <span>LS</span>
          <div>
            <b>Lucky Samuel</b>
            <small>Morphly creator</small>
          </div>
        </div>
        <button onClick={() => location.reload()}>
          <ArrowRight className="rotate" size={17} /> Back to site
        </button>
      </div>
    </aside>
  );
}

export function LiveDashboard({
  setView,
}: {
  setView: (value: View) => void;
}) {
  const [active, setActive] = useState("Create");
  const [mode, setMode] = useState<Mode>("Text to video");
  const [generating, setGenerating] = useState(false);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [presets, setPresets] = useState<GenerationPreset[]>([]);
  const [activePreset, setActivePreset] =
    useState<GenerationPreset | null>(null);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [studioError, setStudioError] = useState("");
  const [prompt, setPrompt] = useState(
    "A cinematic close-up of a futuristic electric sports car gliding through a rain-soaked neon city at blue hour. Volumetric light, shallow depth of field, slow dolly shot.",
  );

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      requestJson<Wallet>("/api/wallet"),
      requestJson<GenerationPreset[]>("/api/generation/presets"),
      requestJson<GenerationJob[]>("/api/generation/jobs"),
    ])
      .then(([walletData, presetData, jobData]) => {
        if (cancelled) return;
        setWallet(walletData);
        setPresets(presetData);
        setJobs(jobData);
        setStudioError("");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiRequestError && error.status === 401) {
          setView("auth");
          return;
        }
        setStudioError(
          error instanceof Error
            ? error.message
            : "Unable to load your studio.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [active, setView]);

  useEffect(() => {
    const available = presets.filter(
      (preset) => preset.action === modeActions[mode],
    );
    setActivePreset(
      (previous) =>
        available.find((preset) => preset.id === previous?.id) ??
        available[0] ??
        null,
    );
  }, [mode, presets]);

  async function handleGenerate() {
    if (!activePreset || !prompt.trim()) return;
    setGenerating(true);
    setStudioError("");

    try {
      await requestJson<{ job_id: string; runpod_job_id: string }>(
        "/api/generation/jobs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetId: activePreset.id,
            prompt: prompt.trim(),
          }),
        },
      );

      const [walletData, jobData] = await Promise.all([
        requestJson<Wallet>("/api/wallet"),
        requestJson<GenerationJob[]>("/api/generation/jobs"),
      ]);
      setWallet(walletData);
      setJobs(jobData);
    } catch (error: unknown) {
      if (error instanceof ApiRequestError && error.status === 401) {
        setView("auth");
        return;
      }
      setStudioError(
        error instanceof Error ? error.message : "Generation request failed.",
      );
    } finally {
      setGenerating(false);
    }
  }

  const modePresets = presets.filter(
    (preset) => preset.action === modeActions[mode],
  );

  return (
    <div className="app-shell">
      <LiveSide active={active} setActive={setActive} />
      <div className="app-main">
        <div className="app-top">
          <button className="back-mobile" onClick={() => setView("home")}>
            <X />
          </button>
          <div>
            <small>MORPHLY STUDIO</small>
            <h1>{active}</h1>
          </div>
          <div className="top-tools">
            <button aria-label="Search">
              <Search />
            </button>
            <button aria-label="Notifications">
              <Bell />
              <i />
            </button>
            <div className="credit-pill">
              <Zap size={14} fill="currentColor" />
              <b>{wallet ? wallet.available_credits.toLocaleString() : "…"}</b>{" "}
              credits
            </div>
            <button className="avatar" aria-label="Account">
              LS
            </button>
          </div>
        </div>

        {active === "Create" ? (
          <div className="workspace">
            <div className="mode-tabs">
              {(
                [
                  "Text to video",
                  "Image to video",
                  "Video to video",
                ] as Mode[]
              ).map((item) => (
                <button
                  key={item}
                  onClick={() => setMode(item)}
                  className={mode === item ? "active" : ""}
                >
                  {item === "Text to video" ? (
                    <MessageSquareText />
                  ) : item === "Image to video" ? (
                    <ImageIcon />
                  ) : (
                    <Video />
                  )}
                  {item}
                </button>
              ))}
            </div>

            {studioError && (
              <p className="form-error" role="alert">
                {studioError}
              </p>
            )}

            <div className="creator-grid">
              <section className="prompt-panel">
                <div className="panel-head">
                  <h2>{mode}</h2>
                  <span>
                    {activePreset
                      ? `${activePreset.credit_cost} credits`
                      : "Unavailable"}
                  </span>
                </div>

                {mode !== "Text to video" && (
                  <label className="dropzone">
                    <Upload />
                    <b>
                      Drop your {mode === "Image to video" ? "image" : "video"}{" "}
                      here
                    </b>
                    <span>or browse files · max 200MB</span>
                    <input type="file" />
                  </label>
                )}

                <label className="prompt-label">
                  <span>
                    Describe your scene{" "}
                    <small>{prompt.length} / 1200</small>
                  </span>
                  <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    maxLength={1200}
                    placeholder="Describe motion, camera, lighting and atmosphere..."
                  />
                </label>

                <div className="control-grid">
                  <label>
                    Preset
                    <select
                      value={activePreset?.id ?? ""}
                      onChange={(event) =>
                        setActivePreset(
                          modePresets.find(
                            (preset) => preset.id === event.target.value,
                          ) ?? null,
                        )
                      }
                      disabled={!modePresets.length}
                    >
                      {modePresets.length ? (
                        modePresets.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.name}
                          </option>
                        ))
                      ) : (
                        <option>No active preset</option>
                      )}
                    </select>
                  </label>
                  <label>
                    Resolution
                    <select disabled>
                      <option>
                        {activePreset
                          ? `${activePreset.width} × ${activePreset.height}`
                          : "—"}
                      </option>
                    </select>
                  </label>
                  <label>
                    Duration
                    <select disabled>
                      <option>
                        {activePreset
                          ? `${Math.max(
                              1,
                              Math.round(
                                activePreset.frames / activePreset.fps,
                              ),
                            )} seconds`
                          : "—"}
                      </option>
                    </select>
                  </label>
                  <label>
                    Frame rate
                    <select disabled>
                      <option>
                        {activePreset ? `${activePreset.fps} fps` : "—"}
                      </option>
                    </select>
                  </label>
                </div>

                <div className="estimate">
                  <span>
                    <Sparkles /> Estimated cost
                  </span>
                  <b>
                    {activePreset
                      ? `${activePreset.credit_cost} credits`
                      : "Not available"}
                  </b>
                </div>
                <button
                  className="generate-btn"
                  onClick={handleGenerate}
                  disabled={generating || !activePreset || !prompt.trim()}
                >
                  {generating ? (
                    <>
                      <span className="spinner" /> Submitting to RunPod…
                    </>
                  ) : (
                    <>
                      <WandSparkles /> Generate video <span>⌘↵</span>
                    </>
                  )}
                </button>
              </section>

              <section className="preview-panel">
                <div className="panel-head">
                  <h2>Preview</h2>
                  <span>
                    {activePreset
                      ? `${activePreset.width}:${activePreset.height}`
                      : "—"}
                  </span>
                </div>
                <div className="preview-screen">
                  <AnimatePresence mode="wait">
                    {generating ? (
                      <motion.div
                        key="generating"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="generating"
                      >
                        <div className="gen-orbit">
                          <Sparkles />
                        </div>
                        <b>Sending your scene to RunPod</b>
                        <span>Credits are reserved while the render runs</span>
                        <div>
                          <i />
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="preview"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="empty-preview"
                      >
                        <div className="scene-mini" />
                        <button aria-label="Play latest preview">
                          <Play fill="currentColor" />
                        </button>
                        <span>Your latest preview</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="preview-actions">
                  <button>
                    <Download /> Export
                  </button>
                  <button>
                    <Plus /> New variation
                  </button>
                </div>
              </section>
            </div>

            <div className="recent-head">
              <div>
                <h2>Recent generations</h2>
                <p>Your latest projects and renders.</p>
              </div>
              <button>
                View all <ChevronRight />
              </button>
            </div>
            <div className="job-grid">
              {jobs.map((job, index) => (
                <article key={job.id}>
                  <div className={`job-thumb jt${index % 3}`}>
                    {job.output_storage_path ? (
                      <video
                        src={job.output_storage_path}
                        autoPlay
                        loop
                        muted
                        playsInline
                      />
                    ) : (
                      <Play fill="currentColor" />
                    )}
                  </div>
                  <div>
                    <h3>
                      {job.prompt.length > 28
                        ? `${job.prompt.slice(0, 28)}…`
                        : job.prompt}
                    </h3>
                    <p>
                      {job.generation_presets?.name ??
                        job.action.replaceAll("_", " ")}{" "}
                      · {job.status}
                    </p>
                    <span
                      className={
                        job.status === "completed"
                          ? "green"
                          : job.status === "failed"
                            ? "purple"
                            : "yellow"
                      }
                    >
                      {job.status}
                    </span>
                  </div>
                  <button aria-label="Generation actions">•••</button>
                </article>
              ))}
              {jobs.length === 0 && (
                <p className="empty-copy">
                  No generations yet. Your first render will appear here.
                </p>
              )}
            </div>
          </div>
        ) : (
          <LiveAccountPage active={active} />
        )}
      </div>
    </div>
  );
}

function LiveAccountPage({ active }: { active: string }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [billingError, setBillingError] = useState("");

  useEffect(() => {
    if (active !== "Billing") return;
    let cancelled = false;

    Promise.all([
      requestJson<Wallet>("/api/wallet"),
      requestJson<CreditTransaction[]>("/api/wallet/transactions"),
    ])
      .then(([walletData, transactionData]) => {
        if (cancelled) return;
        setWallet(walletData);
        setTransactions(transactionData);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setBillingError(
            error instanceof Error ? error.message : "Unable to load billing.",
          );
        }
      });

    const supabase = createClient();
    void supabase
      .from("credit_packages")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setBillingError(error.message);
        else setPackages((data ?? []) as CreditPackage[]);
      });

    return () => {
      cancelled = true;
    };
  }, [active]);

  async function handleCheckout(packageId: string) {
    setLoading(true);
    setBillingError("");
    try {
      const data = await requestJson<{ checkoutUrl: string }>(
        "/api/billing/checkout",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packageId }),
        },
      );
      window.location.assign(data.checkoutUrl);
    } catch (error: unknown) {
      setBillingError(
        error instanceof Error ? error.message : "Checkout failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (active === "Billing") {
    return (
      <div className="content-page">
        {billingError && (
          <p className="form-error" role="alert">
            {billingError}
          </p>
        )}
        <div className="stat-grid">
          <article>
            <span>Available credits</span>
            <b>{wallet ? wallet.available_credits.toLocaleString() : "…"}</b>
            <small>
              {wallet
                ? `${wallet.reserved_credits.toLocaleString()} reserved`
                : "Loading balance"}
            </small>
          </article>
          <article>
            <span>Lifetime purchased</span>
            <b>{wallet ? wallet.lifetime_purchased.toLocaleString() : "…"}</b>
            <small>credits added</small>
          </article>
          <article>
            <span>Lifetime spent</span>
            <b>{wallet ? wallet.lifetime_spent.toLocaleString() : "…"}</b>
            <small>credits used</small>
          </article>
        </div>

        <h2>Buy credits</h2>
        <div className="billing-packages">
          {packages.map((creditPackage) => (
            <article className="package-card" key={creditPackage.id}>
              <div>
                <h2>{creditPackage.name}</h2>
                <p>{creditPackage.description}</p>
                <strong>
                  {creditPackage.base_credits.toLocaleString()} credits
                  {creditPackage.bonus_credits > 0
                    ? ` + ${creditPackage.bonus_credits.toLocaleString()} bonus`
                    : ""}
                </strong>
                <span>
                  {(creditPackage.price_minor / 100).toLocaleString(undefined, {
                    style: "currency",
                    currency: creditPackage.currency,
                  })}
                </span>
              </div>
              <button
                className="lime-btn"
                onClick={() => handleCheckout(creditPackage.id)}
                disabled={loading}
              >
                {loading ? "Opening checkout…" : "Buy credits"}
              </button>
            </article>
          ))}
        </div>

        <h2>Credit history</h2>
        <div className="table">
          {transactions.map((transaction) => (
            <div key={transaction.id}>
              <span>{new Date(transaction.created_at).toLocaleDateString()}</span>
              <span>{transaction.transaction_type.replaceAll("_", " ")}</span>
              <span
                className={transaction.credit_delta > 0 ? "positive" : "negative"}
              >
                {transaction.credit_delta > 0 ? "+" : ""}
                {transaction.credit_delta.toLocaleString()}
              </span>
              <span>{transaction.description ?? "Credit activity"}</span>
              <span>{transaction.available_balance_after.toLocaleString()}</span>
            </div>
          ))}
          {transactions.length === 0 && (
            <p className="empty-copy">No credit transactions yet.</p>
          )}
        </div>
      </div>
    );
  }

  if (active === "Settings") {
    return (
      <div className="content-page settings-page">
        <div className="wide-card profile-card">
          <span className="big-avatar">LS</span>
          <div>
            <h2>Lucky Samuel</h2>
            <p>lucky@morphly.studio</p>
          </div>
          <button>Change photo</button>
        </div>
        <div className="form-card">
          <h2>Profile information</h2>
          <div className="control-grid">
            <label>
              Full name
              <input defaultValue="Lucky Samuel" />
            </label>
            <label>
              Display name
              <input defaultValue="Lucky" />
            </label>
            <label>
              Email address
              <input defaultValue="lucky@morphly.studio" />
            </label>
            <label>
              Company
              <input defaultValue="Morphly Labs" />
            </label>
          </div>
          <button className="lime-btn">Save changes</button>
        </div>
      </div>
    );
  }

  return (
    <div className="content-page">
      <div className="empty-state">
        <div>
          <Film />
        </div>
        <h2>{active}</h2>
        <p>
          {active === "My videos"
            ? "Every render, version and export—organized in one place."
            : "Upload and manage reusable images, clips and brand assets."}
        </p>
        <button className="lime-btn">
          <Plus /> Add new
        </button>
      </div>
    </div>
  );
}

export function LiveAuth({ setView }: { setView: (value: View) => void }) {
  const [signup, setSignup] = useState(true);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
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

    if (signup) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            referral_code_used: referralCode || null,
          },
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
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
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) setErrorMessage(error.message);
  }

  return (
    <div className="auth-page">
      <button className="auth-back" onClick={() => setView("home")}>
        <ArrowRight /> Back to home
      </button>
      <div className="auth-brand">
        <LiveLogo />
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
          <p>
            Bring yours to life with LTX 2.3—faster than the thought that
            started it.
          </p>
        </div>
      </div>

      <div className="auth-form-wrap">
        <div className="auth-form">
          <div className="mobile-logo">
            <LiveLogo />
          </div>
          {done ? (
            <div className="success">
              <div>
                <Check />
              </div>
              <h2>Check your email.</h2>
              <p>
                We sent a verification link to your email. Open it to activate
                your Morphly account and credits.
              </p>
              <button
                className="lime-btn"
                onClick={() => {
                  setDone(false);
                  setSignup(false);
                }}
              >
                Back to sign in <ArrowRight />
              </button>
            </div>
          ) : (
            <>
              <span className="auth-tag">
                {signup ? "START CREATING" : "WELCOME BACK"}
              </span>
              <h2>{signup ? "Create your account" : "Sign in to Morphly"}</h2>
              <p>
                {signup
                  ? "50 free credits. No credit card required."
                  : "Continue creating where you left off."}
              </p>
              <button
                type="button"
                className="google-btn"
                onClick={handleGoogle}
              >
                <span>G</span> Continue with Google
              </button>
              <div className="or">
                <span>or continue with email</span>
              </div>
              <form autoComplete="on" onSubmit={handleSubmit}>
                {signup && (
                  <label>
                    Full name
                    <input
                      autoComplete="name"
                      name="fullname"
                      required
                      placeholder="Lucky Samuel"
                    />
                  </label>
                )}
                <label>
                  Email address
                  <input
                    autoComplete="username"
                    name="email"
                    type="email"
                    required
                    placeholder="you@company.com"
                  />
                </label>
                <label>
                  Password
                  <input
                    autoComplete={signup ? "new-password" : "current-password"}
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                  />
                </label>
                {signup && (
                  <label>
                    Referral code <small>Optional</small>
                    <input
                      autoComplete="off"
                      name="refcode"
                      placeholder="MORPHLY-2026"
                    />
                  </label>
                )}
                {errorMessage && (
                  <p className="form-error" role="alert">
                    {errorMessage}
                  </p>
                )}
                <button className="lime-btn" type="submit" disabled={loading}>
                  {loading
                    ? "Please wait…"
                    : signup
                      ? "Create free account"
                      : "Sign in"}{" "}
                  <ArrowRight />
                </button>
              </form>
              <p className="switch">
                {signup ? "Already have an account?" : "New to Morphly?"}{" "}
                <button
                  onClick={() => {
                    setSignup(!signup);
                    setErrorMessage("");
                  }}
                >
                  {signup ? "Sign in" : "Create account"}
                </button>
              </p>
              <small className="legal">
                By continuing, you agree to Morphly’s Terms of Service and
                Privacy Policy.
              </small>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
