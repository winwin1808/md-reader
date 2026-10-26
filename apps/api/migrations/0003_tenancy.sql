CREATE TABLE usage_daily (scope TEXT NOT NULL, subject TEXT NOT NULL, day INTEGER NOT NULL, kind TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (scope, subject, day, kind));
CREATE TABLE room_installs (room_id TEXT PRIMARY KEY, install_hash TEXT NOT NULL, bytes INTEGER NOT NULL DEFAULT 0);
CREATE INDEX room_installs_install ON room_installs (install_hash);
CREATE TABLE reports (id INTEGER PRIMARY KEY AUTOINCREMENT, room_id TEXT NOT NULL, reason TEXT NOT NULL,
  ip_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE takedowns (room_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
