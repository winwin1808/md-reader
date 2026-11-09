CREATE TABLE feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  reason TEXT,
  message TEXT NOT NULL,
  email TEXT,
  version TEXT,
  browser TEXT,
  locale TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX feedback_created_idx ON feedback(created_at);
