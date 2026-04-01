ALTER TABLE analytics_url_counters
  ADD COLUMN IF NOT EXISTS last_clicked_at TIMESTAMPTZ;

ALTER TABLE analytics_daily_clicks
  ADD COLUMN IF NOT EXISTS url_code VARCHAR(32);

ALTER TABLE analytics_referrer_counters
  ADD COLUMN IF NOT EXISTS url_code VARCHAR(32);

UPDATE analytics_url_counters AS counters
SET last_clicked_at = latest.last_clicked_at
FROM (
  SELECT url_id, MAX(clicked_at) AS last_clicked_at
  FROM analytics_clicks
  GROUP BY url_id
) AS latest
WHERE counters.url_id = latest.url_id
  AND (
    counters.last_clicked_at IS NULL
    OR counters.last_clicked_at <> latest.last_clicked_at
  );

UPDATE analytics_daily_clicks AS daily
SET url_code = latest.url_code
FROM (
  SELECT DISTINCT ON (url_id) url_id, url_code
  FROM analytics_clicks
  ORDER BY url_id, clicked_at DESC
) AS latest
WHERE daily.url_id = latest.url_id
  AND daily.url_code IS NULL;

UPDATE analytics_referrer_counters AS referrers
SET url_code = latest.url_code
FROM (
  SELECT DISTINCT ON (url_id) url_id, url_code
  FROM analytics_clicks
  ORDER BY url_id, clicked_at DESC
) AS latest
WHERE referrers.url_id = latest.url_id
  AND referrers.url_code IS NULL;
