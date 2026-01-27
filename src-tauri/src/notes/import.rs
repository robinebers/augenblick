use crate::app_state::AppPaths;
use crate::scoped_file;
use crate::types::{NoteStorage, NoteWithContent};
use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use uuid::Uuid;

use super::derive::derive_title_preview;
use super::files::read_file;
use super::meta::{get_meta, storage_to_db};
use super::ordering::next_sort_order;
use super::time::now_ms;
use super::write::set_active;

pub(super) fn import_file(
    conn: &Connection,
    paths: &AppPaths,
    path: &Path,
) -> Result<NoteWithContent, String> {
    let outcome = scoped_file::with_scoped_file(path, None, read_file)
        .map_err(|err| format!("Read failed: {err}"))?;
    let effective_path_buf = outcome.resolved_path.unwrap_or_else(|| path.to_path_buf());
    let effective_path = effective_path_buf.as_path();
    let content = outcome.value;
    let mut refreshed_bookmark = outcome.refreshed_bookmark;

    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM notes WHERE file_path = ?1 LIMIT 1",
            params![path.to_string_lossy()],
            |row| row.get(0),
        )
        .optional()
        .map_err(|err| err.to_string())?;

    let existing = if existing.is_some() || effective_path == path {
        existing
    } else {
        conn.query_row(
            "SELECT id FROM notes WHERE file_path = ?1 LIMIT 1",
            params![effective_path.to_string_lossy()],
            |row| row.get(0),
        )
        .optional()
        .map_err(|err| err.to_string())?
    };

    if let Some(id) = existing {
        let meta = get_meta(conn, &id)?;
        if meta.is_trashed {
            if meta.storage == NoteStorage::Draft {
                super::trash::restore(conn, paths, &id)?;
            } else {
                conn.execute(
                    "UPDATE notes SET is_trashed = 0, trashed_at = NULL WHERE id = ?1",
                    params![id],
                )
                .map_err(|err| err.to_string())?;
            }
        }

        if meta.storage == NoteStorage::Saved {
            if let Some(bookmark) = refreshed_bookmark.take() {
                conn.execute(
                    "UPDATE notes SET bookmark = ?1 WHERE id = ?2",
                    params![bookmark, id],
                )
                .map_err(|err| err.to_string())?;
            }
            conn.execute(
                "UPDATE notes SET file_path = ?1 WHERE id = ?2",
                params![effective_path.to_string_lossy(), id],
            )
            .map_err(|err| err.to_string())?;
        }

        let (title, preview) = derive_title_preview(&content);
        let now = now_ms();
        conn.execute(
            "UPDATE notes SET title = ?1, preview = ?2, last_interaction = ?3 WHERE id = ?4",
            params![title, preview, now, id],
        )
        .map_err(|err| err.to_string())?;

        set_active(conn, &id)?;
        let meta = get_meta(conn, &id)?;
        return Ok(NoteWithContent { meta, content });
    }

    let (title, preview) = derive_title_preview(&content);
    let now = now_ms();
    let sort_order = next_sort_order(conn)?;
    let id = Uuid::new_v4().to_string();

    conn.execute(
        r#"
INSERT INTO notes (
  id, title, preview, file_path, storage, bookmark, is_pinned, is_trashed,
  sort_order, created_at, last_interaction, trashed_at
) VALUES (
  ?1, ?2, ?3, ?4, ?5, ?6, 0, 0,
  ?7, ?8, ?9, NULL
)
"#,
        params![
            id,
            title,
            preview,
            effective_path.to_string_lossy(),
            storage_to_db(NoteStorage::Saved),
            refreshed_bookmark,
            sort_order,
            now,
            now
        ],
    )
    .map_err(|err| err.to_string())?;

    let meta = get_meta(conn, &id)?;
    Ok(NoteWithContent { meta, content })
}
