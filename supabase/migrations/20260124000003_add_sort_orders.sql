-- Add sortable ordering for bets and bold takes

ALTER TABLE bets ADD COLUMN IF NOT EXISTS sort_order INTEGER;
ALTER TABLE bold_takes ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Backfill bet order by creation time (oldest first)
WITH ranked_bets AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
    FROM bets
)
UPDATE bets
SET sort_order = ranked_bets.rn
FROM ranked_bets
WHERE bets.id = ranked_bets.id
  AND bets.sort_order IS NULL;

-- Backfill action order within each belief/bet group
WITH ranked_takes AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY bet_id, belief_id
            ORDER BY date DESC NULLS LAST, created_at DESC
        ) AS rn
    FROM bold_takes
)
UPDATE bold_takes
SET sort_order = ranked_takes.rn
FROM ranked_takes
WHERE bold_takes.id = ranked_takes.id
  AND bold_takes.sort_order IS NULL;
