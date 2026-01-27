use crate::types::{NoteMeta, NoteStorage};
use rusqlite::{params, Connection};

pub(super) fn get_meta(conn: &Connection, id: &str) -> Result<NoteMeta, String> {
    conn.query_row(
        r#"
SELECT
  id, title, preview, file_path, storage, is_pinned, is_trashed, sort_order,
  created_at, last_interaction, trashed_at
FROM notes
WHERE id = ?1
LIMIT 1
"#,
        params![id],
        row_to_meta,
    )
    .map_err(|err| err.to_string())
}

pub(super) fn row_to_meta(row: &rusqlite::Row<'_>) -> rusqlite::Result<NoteMeta> {
    let storage_raw: String = row.get(4)?;
    Ok(NoteMeta {
        id: row.get(0)?,
        title: row.get(1)?,
        preview: row.get(2)?,
        file_path: row.get(3)?,
        storage: storage_from_db(&storage_raw),
        is_pinned: row.get::<_, i64>(5)? != 0,
        is_trashed: row.get::<_, i64>(6)? != 0,
        sort_order: row.get(7)?,
        created_at: row.get(8)?,
        last_interaction: row.get(9)?,
        trashed_at: row.get(10)?,
    })
}

pub(super) fn storage_to_db(storage: NoteStorage) -> &'static str {
    match storage {
        NoteStorage::Draft => "draft",
        NoteStorage::Saved => "saved",
    }
}

fn storage_from_db(raw: &str) -> NoteStorage {
    match raw {
        "saved" => NoteStorage::Saved,
        _ => NoteStorage::Draft,
    }
}
