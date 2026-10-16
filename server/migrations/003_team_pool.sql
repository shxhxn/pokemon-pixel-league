ALTER TABLE config ADD COLUMN attemptsPerTeam INTEGER NOT NULL DEFAULT 5;
ALTER TABLE teams ADD COLUMN allowance INTEGER NOT NULL DEFAULT 5;
ALTER TABLE teams ADD COLUMN used INTEGER NOT NULL DEFAULT 0;
UPDATE teams SET used=COALESCE((SELECT SUM(p.used) FROM players p WHERE p.teamId=teams.id),0);
UPDATE teams SET allowance=MAX(5,used);
CREATE UNIQUE INDEX one_active_team_v4 ON sessions(teamId) WHERE status='active' AND worldVersion>=4;
