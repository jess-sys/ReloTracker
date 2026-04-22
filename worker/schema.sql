-- SuperMover D1 Schema (per-user box registry)

CREATE TABLE IF NOT EXISTS boxes (
  user_id TEXT NOT NULL,
  box_id INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  items TEXT NOT NULL DEFAULT '[]',
  is_fragile INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (date('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, box_id)
);

CREATE INDEX IF NOT EXISTS idx_boxes_user ON boxes(user_id);
