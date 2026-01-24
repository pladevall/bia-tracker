-- Shorten bet descriptions for better UI display
-- Removes truncation without loss of meaning

UPDATE bets SET description = 'AI agents + systematic revenue' WHERE name = 'Index (Startup)';
UPDATE bets SET description = 'High-conviction investments' WHERE name = 'High-Conviction Investments';
UPDATE bets SET description = 'Career hedge' WHERE name = 'Salary / Career Hedge';
