-- Shorten bet descriptions for better UI display
-- Removes truncation without loss of meaning

UPDATE bets SET description = 'AI agents + revenue' WHERE name = 'Index (Startup)';
UPDATE bets SET description = 'Investments' WHERE name = 'High-Conviction Investments';
UPDATE bets SET description = 'Career' WHERE name = 'Salary / Career Hedge';
