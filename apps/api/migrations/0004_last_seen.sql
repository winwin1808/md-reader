ALTER TABLE rooms ADD COLUMN last_seen INTEGER;
UPDATE rooms SET last_seen = created_at WHERE last_seen IS NULL;
CREATE INDEX rooms_last_seen_idx ON rooms(last_seen);
