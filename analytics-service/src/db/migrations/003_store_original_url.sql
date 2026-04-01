ALTER TABLE analytics_clicks
  ADD COLUMN IF NOT EXISTS original_url TEXT;

ALTER TABLE analytics_url_counters
  ADD COLUMN IF NOT EXISTS original_url TEXT;
