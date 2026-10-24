CREATE TABLE rooms (id TEXT PRIMARY KEY, owner_token_hash TEXT NOT NULL UNIQUE, title TEXT, created_at INTEGER NOT NULL);
CREATE TABLE links (token_hash TEXT PRIMARY KEY, token_prefix TEXT NOT NULL, room_id TEXT NOT NULL REFERENCES rooms(id),
  role TEXT NOT NULL CHECK (role IN ('view','edit')), label TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
  expires_at INTEGER, revoked_at INTEGER);
CREATE INDEX links_room ON links(room_id);
