import React, { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from "recharts";

const AUTH_KEY = "analytics-ui-auth";
const credentials = {
  username: "admin",
  password: "admin",
};

const pieColors = ["#ff8a5b", "#ffbd73", "#4d9de0", "#6dd3ce", "#5a189a"];

function StatCard({ label, value, helper }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{helper}</p>
    </article>
  );
}

function EmptyState({ message }) {
  return <div className="empty-state">{message}</div>;
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (username === credentials.username && password === credentials.password) {
      localStorage.setItem(AUTH_KEY, "true");
      onLogin(true);
      return;
    }

    setError('Use "admin" for both username and password.');
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div>
          <p className="eyebrow">Analytics UI</p>
          <h1>Operations snapshot for your short links.</h1>
          <p className="lede">
            Sign in with the temporary local admin account to inspect traffic,
            daily volume, and referrer trends.
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Username</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <button type="submit">Enter dashboard</button>
        </form>

        {error ? <p className="login-error">{error}</p> : null}
      </section>
    </main>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem(AUTH_KEY) === "true",
  );
  const [overview, setOverview] = useState({
    topReferrers: [],
    topUrls: [],
    recentVolume: [],
  });
  const [selectedCode, setSelectedCode] = useState("");
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState([]);
  const [referrers, setReferrers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let isActive = true;

    async function loadOverview() {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch("/api/analytics/overview");
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Could not load analytics overview");
        }

        if (!isActive) {
          return;
        }

        setOverview(payload);
        if (payload.topUrls.length > 0) {
          setSelectedCode((currentCode) => currentCode || payload.topUrls[0].code);
        }
      } catch (requestError) {
        if (isActive) {
          setError(requestError.message);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadOverview();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !selectedCode) {
      return;
    }

    let isActive = true;

    async function loadDetails() {
      setIsDetailLoading(true);
      setError("");

      try {
        const [summaryResponse, dailyResponse, referrersResponse] = await Promise.all([
          fetch(`/api/analytics/${selectedCode}/summary`),
          fetch(`/api/analytics/${selectedCode}/daily`),
          fetch(`/api/analytics/${selectedCode}/referrers`),
        ]);

        const [summaryPayload, dailyPayload, referrersPayload] = await Promise.all([
          summaryResponse.json(),
          dailyResponse.json(),
          referrersResponse.json(),
        ]);

        if (!summaryResponse.ok) {
          throw new Error(summaryPayload.error || "Could not load summary");
        }

        if (!dailyResponse.ok) {
          throw new Error(dailyPayload.error || "Could not load daily analytics");
        }

        if (!referrersResponse.ok) {
          throw new Error(referrersPayload.error || "Could not load referrers");
        }

        if (!isActive) {
          return;
        }

        setSummary(summaryPayload);
        setDaily(dailyPayload.daily);
        setReferrers(referrersPayload.referrers);
      } catch (requestError) {
        if (isActive) {
          setError(requestError.message);
        }
      } finally {
        if (isActive) {
          setIsDetailLoading(false);
        }
      }
    }

    loadDetails();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated, selectedCode]);

  function handleLogout() {
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={setIsAuthenticated} />;
  }

  const totalTopClicks = overview.topUrls.reduce(
    (sum, item) => sum + Number(item.totalClicks || 0),
    0,
  );

  return (
    <div className="dashboard-shell">
      <div className="backdrop glow-left" />
      <div className="backdrop glow-right" />

      <main className="dashboard-layout">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Analytics Service</p>
            <h1>Traffic dashboard for the busiest short codes.</h1>
            <p className="lede">
              Separate service, separate database, and a compact dashboard over
              the RabbitMQ-fed reporting pipeline.
            </p>
          </div>

          <div className="hero-actions">
            <div className="status-pill">admin session</div>
            <button className="ghost-button" type="button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </section>

        {error ? <div className="error-banner">{error}</div> : null}

        <section className="stats-grid">
          <StatCard
            label="Tracked URLs"
            value={overview.topUrls.length}
            helper="Top 10 URLs by total clicks"
          />
          <StatCard
            label="Visible clicks"
            value={totalTopClicks}
            helper="Summed from the current top URL leaderboard"
          />
          <StatCard
            label="Top referrers"
            value={overview.topReferrers.length}
            helper="Distinct sources in the current top 10"
          />
        </section>

        <section className="content-grid">
          <article className="panel panel-tall">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Overview</p>
                <h2>Top URLs</h2>
              </div>
              {isLoading ? <span className="subtle">Loading...</span> : null}
            </div>

            {overview.topUrls.length === 0 ? (
              <EmptyState message="No click activity yet." />
            ) : (
              <div className="table-list">
                {overview.topUrls.map((item, index) => (
                  <button
                    className={`table-row ${selectedCode === item.code ? "is-active" : ""}`}
                    key={item.code}
                    type="button"
                    onClick={() => setSelectedCode(item.code)}
                  >
                    <span className="rank-badge">{index + 1}</span>
                    <div>
                      <strong>{item.code}</strong>
                      <p>Last click: {item.lastClickedAt ? new Date(item.lastClickedAt).toLocaleString() : "n/a"}</p>
                    </div>
                    <span>{item.totalClicks} clicks</span>
                  </button>
                ))}
              </div>
            )}
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Volume</p>
                <h2>Recent daily clicks</h2>
              </div>
            </div>

            {overview.recentVolume.length === 0 ? (
              <EmptyState message="Daily volume will appear after clicks are recorded." />
            ) : (
              <div className="chart-frame">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={overview.recentVolume}>
                    <defs>
                      <linearGradient id="overviewGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff8a5b" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#ff8a5b" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="date" stroke="#9fb0c7" />
                    <YAxis stroke="#9fb0c7" />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="clicks"
                      stroke="#ff8a5b"
                      fillOpacity={1}
                      fill="url(#overviewGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Sources</p>
                <h2>Top referrers</h2>
              </div>
            </div>

            {overview.topReferrers.length === 0 ? (
              <EmptyState message="Referrer rankings appear after inbound traffic arrives." />
            ) : (
              <div className="chart-frame">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={overview.topReferrers}
                      dataKey="clicks"
                      nameKey="referrer"
                      innerRadius={58}
                      outerRadius={92}
                      paddingAngle={3}
                    >
                      {overview.topReferrers.map((entry, index) => (
                        <Cell key={entry.referrer} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="mini-list">
              {overview.topReferrers.map((item) => (
                <div className="mini-row" key={item.referrer}>
                  <span>{item.referrer}</span>
                  <strong>{item.clicks}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="panel panel-wide">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Selected URL</p>
                <h2>{selectedCode || "Choose a code"}</h2>
              </div>
              {isDetailLoading ? <span className="subtle">Refreshing details...</span> : null}
            </div>

            {!summary ? (
              <EmptyState message="Select a URL code from the leaderboard to inspect its detailed metrics." />
            ) : (
              <div className="detail-grid">
                <div className="detail-cards">
                  <StatCard
                    label="Total clicks"
                    value={summary.totalClicks}
                    helper="All processed click events for this code"
                  />
                  <StatCard
                    label="Last click"
                    value={summary.lastClickedAt ? new Date(summary.lastClickedAt).toLocaleDateString() : "n/a"}
                    helper="Most recent click timestamp"
                  />
                </div>

                <div className="detail-chart">
                  {daily.length === 0 ? (
                    <EmptyState message="No daily history available for this code yet." />
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={daily}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="date" stroke="#9fb0c7" />
                        <YAxis stroke="#9fb0c7" />
                        <Tooltip />
                        <Bar dataKey="clicks" fill="#4d9de0" radius={[10, 10, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="referrer-table">
                  <h3>Top referrers for {selectedCode}</h3>
                  {referrers.length === 0 ? (
                    <EmptyState message="No referrer data for this code yet." />
                  ) : (
                    referrers.map((item) => (
                      <div className="mini-row" key={`${selectedCode}-${item.referrer}`}>
                        <span>{item.referrer}</span>
                        <strong>{item.clicks}</strong>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </article>
        </section>
      </main>
    </div>
  );
}
