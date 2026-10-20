CREATE TABLE IF NOT EXISTS gifts (
  id TEXT PRIMARY KEY NOT NULL,
  recipient TEXT NOT NULL CHECK (length(recipient) BETWEEN 1 AND 70),
  sender TEXT NOT NULL CHECK (length(sender) BETWEEN 1 AND 70),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 1400),
  youtube_video_id TEXT CHECK (youtube_video_id IS NULL OR length(youtube_video_id) = 11),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gifts_created_at ON gifts(created_at);
