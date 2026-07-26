'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bell,
  CreditCard,
  Download,
  Film,
  Gauge,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/src/lib/supabase/client';

type RevenueTotal = {
  amountMinor: number;
  currency: string;
};

type RecentUser = {
  account_status: string;
  available_credits: number | null;
  created_at: string;
  display_name: string | null;
  email: string;
  id: string;
  reserved_credits: number | null;
};

type RecentJob = {
  actual_duration_seconds: number | null;
  created_at: string;
  credit_cost: number;
  fps: number;
  frames: number;
  id: string;
  output_fps: number | null;
  output_frames: number | null;
  progress_percent: number;
  prompt: string;
  requested_duration_seconds: number;
  status: string;
};

type AdminOverview = {
  admin: {
    email: string;
    role: string;
  };
  generatedAt: string;
  metrics: {
    creditsConsumed: number;
    revenue: RevenueTotal[];
    totalUsers: number;
    videosGenerated: number;
  };
  recentJobs: RecentJob[];
  recentUsers: RecentUser[];
};

type AdminSection =
  | 'Overview'
  | 'Users'
  | 'Generations'
  | 'Billing'
  | 'Analytics'
  | 'System health'
  | 'Settings';

const ADMIN_SECTIONS: Array<{
  icon: typeof LayoutDashboard;
  label: AdminSection;
}> = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Users', icon: Users },
  { label: 'Generations', icon: Film },
  { label: 'Billing', icon: CreditCard },
  { label: 'Analytics', icon: BarChart3 },
  { label: 'System health', icon: Gauge },
  { label: 'Settings', icon: Settings },
];

function initials(value: string) {
  return value
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatSeconds(value: number) {
  return Number.isInteger(value)
    ? `${value}s`
    : `${value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}s`;
}

function formatRevenue(revenue: RevenueTotal[]) {
  if (!revenue.length) {
    return '₦0';
  }

  const primary = revenue[0];
  try {
    return new Intl.NumberFormat('en', {
      currency: primary.currency,
      maximumFractionDigits: 0,
      style: 'currency',
    }).format(primary.amountMinor / 100);
  } catch {
    return `${primary.currency} ${(primary.amountMinor / 100).toLocaleString()}`;
  }
}

function UsersTable({
  description = 'Newest verified profiles across Morphly',
  onAddCredits,
  title = 'Recent users',
  users,
}: {
  description?: string;
  onAddCredits: (user: RecentUser) => void;
  title?: string;
  users: RecentUser[];
}) {
  return (
    <div className="users-card">
      <div className="card-title">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="user-table">
        <div className="thead">
          <span>User</span>
          <span>Email</span>
          <span>Status</span>
          <span>Credits</span>
          <span>Action</span>
        </div>
        {users.length ? (
          users.map((user) => {
            const name = user.display_name || user.email.split('@')[0];
            return (
              <div className="trow" key={user.id}>
                <span>
                  <i>{initials(name)}</i>
                  <b>{name}</b>
                </span>
                <span>{user.email}</span>
                <span>
                  <em>{user.account_status}</em>
                </span>
                <span className="admin-credit-balance">
                  {user.available_credits === null ? (
                    'No wallet'
                  ) : (
                    <>
                      <b>{formatNumber(user.available_credits)}</b>
                      {Boolean(user.reserved_credits) && (
                        <small>{formatNumber(user.reserved_credits ?? 0)} reserved</small>
                      )}
                    </>
                  )}
                </span>
                <span>
                  <button
                    className="admin-add-credit-button"
                    disabled={user.available_credits === null}
                    onClick={() => onAddCredits(user)}
                    type="button"
                  >
                    <Plus />
                    Add credits
                  </button>
                </span>
              </div>
            );
          })
        ) : (
          <div className="admin-table-empty">No user profiles have been created yet.</div>
        )}
      </div>
    </div>
  );
}

function JobsTable({ jobs }: { jobs: RecentJob[] }) {
  return (
    <div className="users-card">
      <div className="card-title">
        <div>
          <h2>Recent generations</h2>
          <p>Latest protected generation requests</p>
        </div>
      </div>
      <div className="user-table admin-jobs-table">
        <div className="thead">
          <span>Prompt</span>
          <span>Status</span>
          <span>Duration</span>
          <span>Credits</span>
          <span>Created</span>
        </div>
        {jobs.length ? (
          jobs.map((job) => (
            <div className="trow" key={job.id}>
              <span>
                <i>
                  <Film />
                </i>
                <b title={job.prompt}>{job.prompt || 'Untitled generation'}</b>
              </span>
              <span>
                <em>{job.status}</em>
              </span>
              <span className="admin-generation-duration">
                <b>
                  {job.actual_duration_seconds !== null
                    ? `${formatSeconds(job.actual_duration_seconds)} actual`
                    : `${formatSeconds(job.requested_duration_seconds)} requested`}
                </b>
                <small>
                  {job.output_frames ?? job.frames} frames @ {job.output_fps ?? job.fps} fps
                </small>
              </span>
              <span>{formatNumber(job.credit_cost)}</span>
              <span>{formatDate(job.created_at)}</span>
            </div>
          ))
        ) : (
          <div className="admin-table-empty">No generation jobs have been submitted yet.</div>
        )}
      </div>
    </div>
  );
}

export function AdminDashboard({
  adminEmail,
  adminName,
  role,
}: {
  adminEmail: string;
  adminName: string;
  role: string;
}) {
  const [active, setActive] = useState<AdminSection>('Overview');
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<RecentUser[] | null>(null);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [userSearchError, setUserSearchError] = useState('');
  const [creditTarget, setCreditTarget] = useState<RecentUser | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [creditRequestId, setCreditRequestId] = useState('');
  const [creditError, setCreditError] = useState('');
  const [creditSuccess, setCreditSuccess] = useState('');
  const [grantingCredits, setGrantingCredits] = useState(false);

  const displayName = adminName || adminEmail.split('@')[0];
  const adminInitials = useMemo(() => initials(displayName), [displayName]);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch('/api/admin/overview', {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const result = (await response.json()) as AdminOverview & { error?: string };

        if (response.status === 401 || response.status === 403) {
          window.location.replace('/admin/login?reason=forbidden');
          return;
        }

        if (!response.ok) {
          throw new Error(result.error || 'Unable to load the admin overview.');
        }

        if (!cancelled) {
          setData(result);
        }
      } catch (overviewError) {
        if (!cancelled) {
          setError(
            overviewError instanceof Error
              ? overviewError.message
              : 'Unable to load the admin overview.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadOverview();
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.replace('/admin/login');
  }

  async function searchUsers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchingUsers(true);
    setUserSearchError('');
    setCreditSuccess('');

    try {
      const response = await fetch(
        `/api/admin/users?query=${encodeURIComponent(userQuery.trim())}`,
        {
          cache: 'no-store',
          credentials: 'same-origin',
        },
      );
      const result = (await response.json()) as {
        error?: string;
        users?: RecentUser[];
      };

      if (response.status === 401 || response.status === 403) {
        window.location.replace('/admin/login?reason=forbidden');
        return;
      }

      if (!response.ok) {
        throw new Error(result.error || 'Unable to search user accounts.');
      }

      setUserResults(result.users ?? []);
    } catch (searchError) {
      setUserSearchError(
        searchError instanceof Error
          ? searchError.message
          : 'Unable to search user accounts.',
      );
    } finally {
      setSearchingUsers(false);
    }
  }

  function clearUserSearch() {
    setUserQuery('');
    setUserResults(null);
    setUserSearchError('');
  }

  function openCreditGrant(user: RecentUser) {
    setCreditTarget(user);
    setCreditAmount('');
    setCreditReason('');
    setCreditRequestId(crypto.randomUUID());
    setCreditError('');
    setCreditSuccess('');
  }

  function closeCreditGrant() {
    if (grantingCredits) {
      return;
    }

    setCreditTarget(null);
    setCreditError('');
  }

  function replaceUserBalance(
    userId: string,
    availableCredits: number,
    reservedCredits: number,
  ) {
    const update = (user: RecentUser) =>
      user.id === userId
        ? {
            ...user,
            available_credits: availableCredits,
            reserved_credits: reservedCredits,
          }
        : user;

    setData((current) =>
      current
        ? {
            ...current,
            recentUsers: current.recentUsers.map(update),
          }
        : current,
    );
    setUserResults((current) => (current ? current.map(update) : current));
  }

  async function grantCredits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!creditTarget) {
      return;
    }

    const amount = Number(creditAmount);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000) {
      setCreditError('Enter a whole credit amount between 1 and 1,000,000.');
      return;
    }

    if (creditReason.trim().length < 3) {
      setCreditError('Enter a reason of at least 3 characters.');
      return;
    }

    setGrantingCredits(true);
    setCreditError('');

    try {
      const response = await fetch('/api/admin/credits', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: creditTarget.id,
          amount,
          reason: creditReason.trim(),
          requestId: creditRequestId,
        }),
      });
      const result = (await response.json()) as {
        code?: string;
        error?: string;
        grant?: {
          availableCredits: number;
          reservedCredits: number;
          transactionId: string;
          userId: string;
        };
      };

      if (response.status === 401 || response.status === 403) {
        window.location.replace('/admin/login?reason=forbidden');
        return;
      }

      if (!response.ok || !result.grant) {
        throw new Error(
          result.code === 'ADMIN_CREDIT_MIGRATION_REQUIRED'
            ? 'The Supabase admin credit function has not been installed. Run migration 0007_repair_admin_credit_grants.sql in the Supabase SQL Editor, then retry.'
            : result.error || 'Credits could not be added.',
        );
      }

      replaceUserBalance(
        result.grant.userId,
        result.grant.availableCredits,
        result.grant.reservedCredits,
      );
      setCreditSuccess(
        `${amount.toLocaleString()} credits added to ${creditTarget.email}.`,
      );
      setCreditTarget(null);
    } catch (grantError) {
      setCreditError(
        grantError instanceof Error ? grantError.message : 'Credits could not be added.',
      );
    } finally {
      setGrantingCredits(false);
    }
  }

  function exportReport() {
    if (!data) {
      return;
    }

    const rows = [
      ['Metric', 'Value'],
      ['Total users', String(data.metrics.totalUsers)],
      ['Videos generated', String(data.metrics.videosGenerated)],
      ['Credits consumed', String(data.metrics.creditsConsumed)],
      ['Revenue', formatRevenue(data.metrics.revenue)],
      ['Generated at', data.generatedAt],
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `morphly-admin-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const overviewContent = data ? (
    <>
      <div className="stat-grid four">
        {[
          ['Total users', formatNumber(data.metrics.totalUsers), Users],
          ['Videos generated', formatNumber(data.metrics.videosGenerated), Film],
          ['Revenue', formatRevenue(data.metrics.revenue), CreditCard],
          ['Credits consumed', formatNumber(data.metrics.creditsConsumed), Zap],
        ].map(([label, value, Icon], index) => (
          <article key={String(label)}>
            <div className={`stat-icon si${index}`}>
              <Icon />
            </div>
            <span>{String(label)}</span>
            <b>{String(value)}</b>
            <small className="up">Live production data</small>
          </article>
        ))}
      </div>

      <div className="admin-grid">
        <section className="chart-card admin-access-card">
          <div className="card-title">
            <div>
              <h2>Protected operations overview</h2>
              <p>Live data returned through an administrator-only API</p>
            </div>
            <ShieldCheck />
          </div>
          <div className="admin-protection-grid">
            <article>
              <ShieldCheck />
              <div>
                <b>Server authorization</b>
                <span>Every page and API request verifies your Supabase session and role.</span>
              </div>
            </article>
            <article>
              <Users />
              <div>
                <b>Account oversight</b>
                <span>Profile records are visible only through the protected console.</span>
              </div>
            </article>
            <article>
              <Film />
              <div>
                <b>Generation visibility</b>
                <span>Review the latest platform generation jobs and their status.</span>
              </div>
            </article>
          </div>
        </section>

        <section className="activity-card">
          <div className="card-title">
            <div>
              <h2>Latest generation activity</h2>
              <p>Most recent platform jobs</p>
            </div>
          </div>
          {data.recentJobs.length ? (
            data.recentJobs.slice(0, 5).map((job) => (
              <div className="activity" key={job.id}>
                <i>
                  <Film />
                </i>
                <div>
                  <b>{job.status}</b>
                  <span>{job.prompt || 'Untitled generation'}</span>
                </div>
                <small>{job.progress_percent}%</small>
              </div>
            ))
          ) : (
            <div className="admin-table-empty">No generation activity yet.</div>
          )}
        </section>
      </div>

      <UsersTable onAddCredits={openCreditGrant} users={data.recentUsers} />
    </>
  ) : null;

  const usersContent = data ? (
    <>
      <section className="admin-user-tools">
        <div>
          <h2>Find a user account</h2>
          <p>Search by email address or paste an exact user ID.</p>
        </div>
        <form onSubmit={searchUsers}>
          <label className="admin-user-search">
            <Search />
            <span className="sr-only">User email or account ID</span>
            <input
              autoComplete="off"
              onChange={(event) => setUserQuery(event.target.value)}
              placeholder="Email address or user ID"
              type="search"
              value={userQuery}
            />
          </label>
          <button className="lime-btn" disabled={searchingUsers} type="submit">
            {searchingUsers ? 'Searching…' : 'Search'}
          </button>
          {userResults !== null && (
            <button className="admin-clear-search" onClick={clearUserSearch} type="button">
              Clear
            </button>
          )}
        </form>
      </section>

      {userSearchError && (
        <div className="admin-inline-message error" role="alert">
          {userSearchError}
        </div>
      )}
      <UsersTable
        description={
          userResults === null
            ? 'Newest verified profiles across Morphly'
            : `${userResults.length} matching account${userResults.length === 1 ? '' : 's'}`
        }
        onAddCredits={openCreditGrant}
        title={userResults === null ? 'Recent users' : 'Search results'}
        users={userResults ?? data.recentUsers}
      />
    </>
  ) : null;

  function renderSection() {
    if (loading) {
      return (
        <div className="admin-loading">
          <span className="spinner" />
          <b>Loading protected platform data…</b>
        </div>
      );
    }

    if (error) {
      return (
        <div className="admin-error-card">
          <ShieldCheck />
          <h2>Admin data is unavailable</h2>
          <p>{error}</p>
          <button className="lime-btn" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      );
    }

    if (!data) {
      return null;
    }

    if (active === 'Overview') {
      return overviewContent;
    }
    if (active === 'Users') {
      return usersContent;
    }
    if (active === 'Generations') {
      return <JobsTable jobs={data.recentJobs} />;
    }
    if (active === 'Billing') {
      return (
        <div className="stat-grid">
          <article>
            <span>Verified revenue</span>
            <b>{formatRevenue(data.metrics.revenue)}</b>
            <small>Credited Flutterwave payments</small>
          </article>
          <article>
            <span>Credits consumed</span>
            <b>{formatNumber(data.metrics.creditsConsumed)}</b>
            <small>Lifetime credits recorded across wallets</small>
          </article>
          <article>
            <span>Billing access</span>
            <b>Protected</b>
            <small>Administrator role required</small>
          </article>
        </div>
      );
    }
    if (active === 'System health') {
      return (
        <div className="admin-protection-grid admin-health-grid">
          {[
            ['Authentication', 'Verified Supabase session active'],
            ['Authorization', `${role.replace('_', ' ')} role confirmed`],
            ['Admin data API', 'Protected overview responding'],
          ].map(([label, description]) => (
            <article key={label}>
              <ShieldCheck />
              <div>
                <b>{label}</b>
                <span>{description}</span>
              </div>
            </article>
          ))}
        </div>
      );
    }
    if (active === 'Settings') {
      return (
        <div className="wide-card profile-card">
          <span className="big-avatar">{adminInitials}</span>
          <div>
            <h2>{displayName}</h2>
            <p>{adminEmail}</p>
            <small>{role.replace('_', ' ')}</small>
          </div>
          <button onClick={signOut}>Sign out</button>
        </div>
      );
    }

    return (
      <div className="admin-section-placeholder">
        <BarChart3 />
        <h2>{active}</h2>
        <p>This protected section is ready for the next operational data view.</p>
      </div>
    );
  }

  return (
    <div className="app-shell admin-shell">
      <aside className="side">
        <Link className="logo" href="/" aria-label="Morphly home">
          <span className="logo-mark">
            <Sparkles size={17} />
          </span>
          <span>Morphly</span>
          <em>ADMIN</em>
        </Link>
        <div className="side-label">CONTROL CENTER</div>
        {ADMIN_SECTIONS.map(({ icon: Icon, label }) => (
          <button
            className={active === label ? 'active' : ''}
            key={label}
            onClick={() => setActive(label)}
            type="button"
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
        <div className="side-bottom">
          <div className="mini-user">
            <span>{adminInitials}</span>
            <div>
              <b>{displayName}</b>
              <small>{role.replace('_', ' ')}</small>
            </div>
          </div>
          <button onClick={signOut} type="button">
            <LogOut size={17} /> Sign out
          </button>
          <button onClick={() => window.location.assign('/')} type="button">
            <ArrowRight className="rotate" size={17} /> Back to site
          </button>
        </div>
      </aside>

      <main className="app-main">
        <header className="app-top">
          <button
            aria-label="Back to site"
            className="back-mobile"
            onClick={() => window.location.assign('/')}
            type="button"
          >
            <ArrowRight className="rotate" />
          </button>
          <div>
            <small>ADMIN CONSOLE</small>
            <h1>{active}</h1>
          </div>
          <div className="top-tools">
            <span className="health">
              <i /> Secure session
            </span>
            <button aria-label="Notifications" type="button">
              <Bell />
            </button>
            <button className="avatar" title={adminEmail} type="button">
              {adminInitials}
            </button>
          </div>
        </header>

        <div className="content-page">
          <div className="admin-hero">
            <div>
              <span>
                {new Intl.DateTimeFormat('en', {
                  dateStyle: 'full',
                }).format(new Date())}
              </span>
              <h2>Welcome back, {displayName.split(' ')[0]}.</h2>
              <p>Your protected Morphly operations overview is ready.</p>
            </div>
            <button className="lime-btn" disabled={!data} onClick={exportReport} type="button">
              <Download /> Export report
            </button>
          </div>

          {creditSuccess && (
            <div className="admin-inline-message success admin-global-notice" role="status">
              <ShieldCheck />
              {creditSuccess}
            </div>
          )}
          {renderSection()}
        </div>
      </main>

      {creditTarget && (
        <div className="admin-modal-backdrop" role="presentation">
          <section
            aria-labelledby="admin-credit-title"
            aria-modal="true"
            className="admin-credit-modal"
            role="dialog"
          >
            <div className="admin-credit-modal-head">
              <div>
                <span>WALLET CREDIT</span>
                <h2 id="admin-credit-title">Add credits to user</h2>
              </div>
              <button
                aria-label="Close credit grant"
                disabled={grantingCredits}
                onClick={closeCreditGrant}
                type="button"
              >
                <X />
              </button>
            </div>

            <div className="admin-credit-user">
              <i>{initials(creditTarget.display_name || creditTarget.email)}</i>
              <div>
                <b>{creditTarget.display_name || creditTarget.email.split('@')[0]}</b>
                <span>{creditTarget.email}</span>
              </div>
              <strong>
                {formatNumber(creditTarget.available_credits ?? 0)} current credits
              </strong>
            </div>

            <form onSubmit={grantCredits}>
              <label>
                Credit amount
                <input
                  autoFocus
                  inputMode="numeric"
                  max="1000000"
                  min="1"
                  onChange={(event) => {
                    setCreditAmount(event.target.value);
                    setCreditRequestId(crypto.randomUUID());
                  }}
                  placeholder="e.g. 500"
                  required
                  step="1"
                  type="number"
                  value={creditAmount}
                />
              </label>
              <label>
                Reason
                <textarea
                  maxLength={250}
                  minLength={3}
                  onChange={(event) => {
                    setCreditReason(event.target.value);
                    setCreditRequestId(crypto.randomUUID());
                  }}
                  placeholder="Why are these credits being added?"
                  required
                  value={creditReason}
                />
                <small>{creditReason.length}/250</small>
              </label>

              {creditError && (
                <div className="admin-inline-message error" role="alert">
                  {creditError}
                </div>
              )}

              <div className="admin-credit-confirmation">
                <ShieldCheck />
                <span>
                  This action updates the wallet and creates permanent ledger and audit
                  records.
                </span>
              </div>
              <div className="admin-credit-actions">
                <button
                  disabled={grantingCredits}
                  onClick={closeCreditGrant}
                  type="button"
                >
                  Cancel
                </button>
                <button className="lime-btn" disabled={grantingCredits} type="submit">
                  {grantingCredits ? 'Adding credits…' : 'Confirm credit grant'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
