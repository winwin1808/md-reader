CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX assets_room_idx ON assets (room_id);
CREATE TABLE asset_chunks (
  asset_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  bytes BLOB NOT NULL,
  PRIMARY KEY (asset_id, idx)
);
