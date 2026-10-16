-- Existing sessions retain their original procedural world for score validation.
ALTER TABLE sessions ADD COLUMN worldVersion INTEGER NOT NULL DEFAULT 1;
