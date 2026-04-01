import React, { useState } from "react";

const featureItems = [
  {
    eyebrow: "Fast",
    title: "Short links in one request",
    description:
      "Create clean redirect links from the same API you already built with Express, PostgreSQL, and Redis.",
  },
  {
    eyebrow: "Safe",
    title: "Input validation stays server-side",
    description:
      "The UI stays thin while the backend keeps protocol validation, conflict handling, and redirect resolution centralized.",
  },
  {
    eyebrow: "Simple",
    title: "Pure React and CSS",
    description:
      "No component libraries, no styling frameworks, just a focused interface around the shortener flow.",
  },
];

const stats = [
  { label: "Backend", value: "Express API" },
  { label: "Frontend", value: "React UI" },
  { label: "Cache", value: "Redis Ready" },
];

export default function App() {
  const [originalUrl, setOriginalUrl] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy link");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    setCopyLabel("Copy link");
    setIsSubmitting(true);

    try {
      const response = await fetch("/shorten", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ originalUrl }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not shorten that URL");
      }

      setResult(payload);
      setOriginalUrl("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopy() {
    if (!result?.shortUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(result.shortUrl);
      setCopyLabel("Copied");
    } catch (_error) {
      setCopyLabel("Copy failed");
    }
  }

  return (
    <div className="page-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <main className="layout">
        <section className="hero-card">
          <div className="hero-copy">
            <p className="kicker">URL Shortener</p>
            <h1>Short links with a sharper front-end.</h1>
            <p className="lede">
              A focused React interface for generating short URLs, checking
              results, and keeping the backend workflow clear.
            </p>

            <div className="stat-row">
              {stats.map((stat) => (
                <article className="stat-card" key={stat.label}>
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </article>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <p className="panel-label">Create short URL</p>
              <span className="panel-pill">Live API</span>
            </div>

            <form className="shortener-form" onSubmit={handleSubmit}>
              <label className="field">
                <span>Destination URL</span>
                <input
                  type="url"
                  placeholder="https://example.com/article"
                  value={originalUrl}
                  onChange={(event) => setOriginalUrl(event.target.value)}
                  required
                />
              </label>

              <button
                className="submit-button"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Generating..." : "Shorten URL"}
              </button>
            </form>

            {error ? <p className="message error">{error}</p> : null}

            {result ? (
              <section className="result-card">
                <div>
                  <span className="result-label">Short link</span>
                  <br />
                  <a href={result.shortUrl} target="_blank" rel="noreferrer">
                    {result.shortUrl}
                  </a>
                </div>

                <div>
                  <span className="result-label">Original link</span>
                  <p>{result.originalUrl}</p>
                </div>

                <button
                  className="ghost-button"
                  type="button"
                  onClick={handleCopy}
                >
                  {copyLabel}
                </button>
              </section>
            ) : (
              <p className="message hint">
                Paste a full URL and the backend will return the short code and
                redirect link.
              </p>
            )}
          </div>
        </section>

        <section className="feature-grid">
          {featureItems.map((item) => (
            <article className="feature-card" key={item.title}>
              <p className="feature-eyebrow">{item.eyebrow}</p>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
