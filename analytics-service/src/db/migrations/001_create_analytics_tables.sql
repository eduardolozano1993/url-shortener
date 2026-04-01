CREATE TABLE IF NOT EXISTS analytics_clicks (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID NOT NULL UNIQUE,
  url_id INTEGER NOT NULL,
  url_code VARCHAR(32) NOT NULL,
  clicked_at TIMESTAMPTZ NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_url_counters (
  url_id INTEGER PRIMARY KEY,
  url_code VARCHAR(32) NOT NULL,
  total_clicks BIGINT NOT NULL DEFAULT 0,
  last_clicked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_daily_clicks (
  url_id INTEGER NOT NULL,
  url_code VARCHAR(32) NOT NULL,
  click_date DATE NOT NULL,
  clicks BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (url_id, click_date)
);

CREATE TABLE IF NOT EXISTS analytics_referrer_counters (
  url_id INTEGER NOT NULL,
  url_code VARCHAR(32) NOT NULL,
  referrer TEXT NOT NULL,
  clicks BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (url_id, referrer)
);

CREATE INDEX IF NOT EXISTS analytics_clicks_url_id_clicked_at_idx
  ON analytics_clicks (url_id, clicked_at DESC);

CREATE INDEX IF NOT EXISTS analytics_clicks_url_code_clicked_at_idx
  ON analytics_clicks (url_code, clicked_at DESC);

CREATE INDEX IF NOT EXISTS analytics_daily_clicks_url_code_idx
  ON analytics_daily_clicks (url_code, click_date DESC);

CREATE INDEX IF NOT EXISTS analytics_referrer_counters_url_code_clicks_idx
  ON analytics_referrer_counters (url_code, clicks DESC);
