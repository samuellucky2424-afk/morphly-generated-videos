'use client';

import { useEffect, useMemo, useState } from 'react';
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
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { createClient } from '@/src/lib/supabase/client';

type RevenueTotal = {
  amountMinor: number;
  currency: string;
};

type RecentUser = {
  account_status: string;
  created_at: string;
  display_name: string | null;
  email: string;
  id: string;
};

type RecentJob = {
  created_at: string;
  credit_cost: number;
  id: string;
  progress_percent: number;
  prompt: string;
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

function UsersTable({ users }: { users: RecentUser[] }) {
  return (
    <div className="users-card">
      <div className="card-title">
        <div>
          <h2>Recent users</h2>
          <p>Newest verified profiles across Morphly</p>
        </div>
      </div>
      <div className="user-table">
        <div className="thead">
          <span>User</span>
          <span>Email</span>
          <span>Status</span>
          <span>Joined</span>
          <span>Account ID</span>
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
                <span>{formatDate(user.created_at)}</span>
                <span title={user.id}>{user.id.slice(0, 8)}…</span>
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
          <span>Progress</span>
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
              <span>{job.progress_percent}%</span>
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

      <UsersTable users={data.recentUsers} />
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
      return <UsersTable users={data.recentUsers} />;
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
        <a className="logo" href="/" aria-label="Morphly home">
          <span className="logo-mark">
            <Sparkles size={17} />
          </span>
          <span>Morphly</span>
          <em>ADMIN</em>
        </a>
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

          {renderSection()}
        </div>
      </main>
    </div>
  );
}
