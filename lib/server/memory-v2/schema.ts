import type Database from "better-sqlite3";

const SCHEMA_VERSION = 1;

const SCHEMA_V1 = `
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  content_hash TEXT
);

CREATE TABLE conversation_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  stream_status TEXT,
  response_mode TEXT,
  timestamp TEXT NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE (conversation_id, ordinal)
);

CREATE TABLE conversation_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  media_type TEXT NOT NULL,
  url TEXT,
  extracted_text TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE memory_topics (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL CHECK (state IN ('active', 'archived')),
  parent_topic_id TEXT REFERENCES memory_topics(id) ON DELETE SET NULL,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE memory_facts (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES memory_topics(id) ON DELETE RESTRICT,
  fact_type TEXT NOT NULL,
  sensitivity TEXT NOT NULL CHECK (sensitivity IN ('standard', 'personal', 'sensitive')),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  state TEXT NOT NULL CHECK (state IN ('current', 'superseded', 'conflicted', 'archived', 'removed')),
  is_core INTEGER NOT NULL DEFAULT 0 CHECK (is_core IN (0, 1)),
  valid_from TEXT,
  valid_to TEXT,
  current_version_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE memory_fact_versions (
  id TEXT PRIMARY KEY,
  fact_id TEXT NOT NULL REFERENCES memory_facts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  normalized_content TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('current', 'superseded', 'conflicted', 'removed')),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  reason TEXT,
  author TEXT NOT NULL,
  valid_from TEXT,
  valid_to TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX memory_fact_one_current_version
  ON memory_fact_versions(fact_id)
  WHERE state = 'current';

CREATE TABLE memory_evidence (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES memory_fact_versions(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  message_id TEXT REFERENCES conversation_messages(id) ON DELETE SET NULL,
  evidence_type TEXT NOT NULL DEFAULT 'conversation',
  created_at TEXT NOT NULL
);

CREATE TABLE memory_conflicts (
  id TEXT PRIMARY KEY,
  fact_id TEXT NOT NULL REFERENCES memory_facts(id) ON DELETE CASCADE,
  competing_version_id TEXT NOT NULL REFERENCES memory_fact_versions(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolution_version_id TEXT REFERENCES memory_fact_versions(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE memory_operations (
  id TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'applied', 'review', 'rejected', 'rolled_back')),
  payload_json TEXT NOT NULL,
  source_conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  model TEXT,
  prompt_version TEXT,
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  created_at TEXT NOT NULL,
  applied_at TEXT
);

CREATE TABLE memory_audit_log (
  id TEXT PRIMARY KEY,
  operation_id TEXT REFERENCES memory_operations(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  rollback_of_id TEXT REFERENCES memory_audit_log(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE memory_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  available_at TEXT NOT NULL,
  lease_owner TEXT,
  lease_expires_at TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX conversations_lifecycle_updated
  ON conversations(lifecycle, updated_at DESC);
CREATE INDEX conversation_messages_conversation_ordinal
  ON conversation_messages(conversation_id, ordinal);
CREATE INDEX memory_topics_state_title
  ON memory_topics(state, title);
CREATE INDEX memory_facts_topic_state
  ON memory_facts(topic_id, state);
CREATE INDEX memory_evidence_conversation
  ON memory_evidence(conversation_id);
CREATE INDEX memory_jobs_status_available
  ON memory_jobs(status, available_at);
CREATE INDEX memory_audit_entity_created
  ON memory_audit_log(entity_type, entity_id, created_at DESC);
`;

export function migrateMemorySchema(raw: Database.Database): void {
  raw.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const currentVersion = raw
    .prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations")
    .get() as { version: number };

  if (currentVersion.version >= SCHEMA_VERSION) return;

  raw.transaction(() => {
    raw.exec(SCHEMA_V1);
    raw
      .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
      .run(SCHEMA_VERSION, new Date().toISOString());
  })();
}
