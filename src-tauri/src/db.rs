use rusqlite::{Connection, Result};

pub const DB_SCHEMA_VERSION: i32 = 1;

pub fn open(path: &std::path::Path) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    migrate(&conn)?;
    Ok(conn)
}

fn migrate(conn: &Connection) -> Result<()> {
    let current_version: i32 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;

    if current_version < 1 {
        conn.execute_batch(
            r#"
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  preview TEXT NOT NULL,
  file_path TEXT NOT NULL,
  storage TEXT NOT NULL,
  bookmark BLOB,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_trashed INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_interaction INTEGER NOT NULL,
  trashed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_notes_last_interaction ON notes(last_interaction);
CREATE INDEX IF NOT EXISTS idx_notes_trashed_at ON notes(trashed_at);

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"#,
        )?;
        conn.pragma_update(None, "user_version", DB_SCHEMA_VERSION)?;
    }

    Ok(())
}
