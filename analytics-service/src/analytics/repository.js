const { analyticsPool } = require("../db/pool");

/**
 * Persists an analytics click and updates the aggregate tables inside the same
 * transaction so the counters never drift from the raw events table.
 *
 * @param {{
 *   eventId: string,
 *   urlId: number,
 *   urlCode: string,
 *   originalUrl: string|null,
 *   occurredAt: string,
 *   referrer: string|null,
 *   userAgent: string|null,
 *   ipAddress: string|null
 * }} event
 * @param {object} logger
 * @returns {Promise<{inserted: boolean}>}
 */
async function recordClick(event, logger) {
  const client = await analyticsPool.connect();

  try {
    await client.query("BEGIN");

    const insertResult = await client.query(
      `
      INSERT INTO analytics_clicks (
        event_id,
        url_id,
        url_code,
        original_url,
        clicked_at,
        referrer,
        user_agent,
        ip_address
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (event_id) DO NOTHING
      RETURNING url_id
      `,
      [
        event.eventId,
        event.urlId,
        event.urlCode,
        event.originalUrl,
        event.occurredAt,
        event.referrer,
        event.userAgent,
        event.ipAddress,
      ],
    );

    if (insertResult.rowCount === 0) {
      await client.query("ROLLBACK");
      // Duplicate delivery is expected in at-least-once queue semantics, so treat it as a no-op.
      logger.warn("Skipping duplicate analytics event", {
        eventId: event.eventId,
        urlCode: event.urlCode,
      });
      return { inserted: false };
    }

    await client.query(
      `
      INSERT INTO analytics_url_counters (url_id, url_code, original_url, total_clicks, last_clicked_at)
      VALUES ($1, $2, $3, 1, $4)
      ON CONFLICT (url_id) DO UPDATE
      SET total_clicks = analytics_url_counters.total_clicks + 1,
          url_code = EXCLUDED.url_code,
          original_url = COALESCE(EXCLUDED.original_url, analytics_url_counters.original_url),
          last_clicked_at = GREATEST(
            COALESCE(analytics_url_counters.last_clicked_at, EXCLUDED.last_clicked_at),
            EXCLUDED.last_clicked_at
          ),
          updated_at = NOW()
      `,
      [event.urlId, event.urlCode, event.originalUrl, event.occurredAt],
    );

    await client.query(
      `
      INSERT INTO analytics_daily_clicks (url_id, url_code, click_date, clicks)
      VALUES ($1, $2, ($3::timestamptz AT TIME ZONE 'UTC')::date, 1)
      ON CONFLICT (url_id, click_date) DO UPDATE
      SET clicks = analytics_daily_clicks.clicks + 1,
          url_code = EXCLUDED.url_code,
          updated_at = NOW()
      `,
      [event.urlId, event.urlCode, event.occurredAt],
    );

    const normalizedReferrer = event.referrer || "direct";
    await client.query(
      `
      INSERT INTO analytics_referrer_counters (url_id, url_code, referrer, clicks)
      VALUES ($1, $2, $3, 1)
      ON CONFLICT (url_id, referrer) DO UPDATE
      SET clicks = analytics_referrer_counters.clicks + 1,
          url_code = EXCLUDED.url_code,
          updated_at = NOW()
      `,
      [event.urlId, event.urlCode, normalizedReferrer],
    );

    await client.query("COMMIT");
    logger.success("Persisted analytics click event", {
      eventId: event.eventId,
      referrer: normalizedReferrer,
      urlCode: event.urlCode,
    });
    return { inserted: true };
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Analytics DB transaction failed", {
      eventId: event.eventId,
      message: error.message,
      urlCode: event.urlCode,
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Returns the dashboard overview aggregates.
 *
 * @returns {Promise<{topUrls: object[], recentVolume: object[], topReferrers: object[]}>}
 */
async function getOverview() {
  const [topUrlsResult, recentVolumeResult, topReferrersResult] = await Promise.all([
    analyticsPool.query(
      `
      SELECT
        url_code AS code,
        original_url AS "originalUrl",
        total_clicks AS "totalClicks",
        last_clicked_at AS "lastClickedAt"
      FROM analytics_url_counters
      ORDER BY total_clicks DESC, url_code ASC
      LIMIT 10
      `,
    ),
    analyticsPool.query(
      `
      SELECT click_date AS date, SUM(clicks)::BIGINT AS clicks
      FROM analytics_daily_clicks
      GROUP BY click_date
      ORDER BY click_date DESC
      LIMIT 10
      `,
    ),
    analyticsPool.query(
      `
      SELECT referrer, SUM(clicks)::BIGINT AS clicks
      FROM analytics_referrer_counters
      GROUP BY referrer
      ORDER BY clicks DESC, referrer ASC
      LIMIT 10
      `,
    ),
  ]);

  return {
    topUrls: topUrlsResult.rows,
    recentVolume: recentVolumeResult.rows.reverse(),
    topReferrers: topReferrersResult.rows,
  };
}

/**
 * Returns per-code summary information plus the top referrers.
 *
 * @param {string} code
 * @returns {Promise<object|null>}
 */
async function getSummaryByCode(code) {
  const [summaryResult, topReferrersResult] = await Promise.all([
    analyticsPool.query(
      `
      SELECT
        url_code AS code,
        original_url AS "originalUrl",
        total_clicks AS "totalClicks",
        last_clicked_at AS "lastClickedAt"
      FROM analytics_url_counters
      WHERE url_code = $1
      `,
      [code],
    ),
    analyticsPool.query(
      `
      SELECT referrer, clicks
      FROM analytics_referrer_counters
      WHERE url_code = $1
      ORDER BY clicks DESC, referrer ASC
      LIMIT 5
      `,
      [code],
    ),
  ]);

  if (summaryResult.rows.length === 0) {
    return null;
  }

  return {
    ...summaryResult.rows[0],
    topReferrers: topReferrersResult.rows,
  };
}

/**
 * Returns recent daily click counts for one short code.
 *
 * @param {string} code
 * @returns {Promise<object[]>}
 */
async function getDailyByCode(code) {
  const result = await analyticsPool.query(
    `
    SELECT url_code AS code, click_date AS date, clicks
    FROM analytics_daily_clicks
    WHERE url_code = $1
    ORDER BY click_date DESC
    LIMIT 30
    `,
    [code],
  );

  return result.rows.reverse();
}

/**
 * Returns the top referrers for one short code.
 *
 * @param {string} code
 * @returns {Promise<object[]>}
 */
async function getReferrersByCode(code) {
  const result = await analyticsPool.query(
    `
    SELECT url_code AS code, referrer, clicks
    FROM analytics_referrer_counters
    WHERE url_code = $1
    ORDER BY clicks DESC, referrer ASC
    LIMIT 10
    `,
    [code],
  );

  return result.rows;
}

module.exports = {
  recordClick,
  getOverview,
  getSummaryByCode,
  getDailyByCode,
  getReferrersByCode,
};
