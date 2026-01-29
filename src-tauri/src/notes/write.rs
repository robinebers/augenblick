use crate::app_state::AppPaths;
use crate::scoped_file;
use crate::types::{NoteMeta, NoteStorage, NoteWithContent};
use rusqlite::{params, Connection};
use std::path::Path;
use uuid::Uuid;

use super::derive::derive_title_preview;
use super::files::{read_file, write_file};
use super::meta::{get_meta, storage_to_db};
use super::ordering::next_sort_order;
use super::scoped_updates::{apply_scoped_updates, get_bookmark};
use super::time::now_ms;

pub(super) fn create_draft(conn: &Connection, paths: &AppPaths) -> Result<NoteMeta, String> {
    let id = Uuid::new_v4().to_string();
    let file_path = paths.drafts_dir.join(format!("{id}.md"));
    std::fs::write(&file_path, "").map_err(|err| err.to_string())?;

    let now = now_ms();
    let sort_order = next_sort_order(conn)?;

    conn.execute(
        r#"
INSERT INTO notes (
  id, title, preview, file_path, storage, bookmark, is_pinned, is_trashed,
  sort_order, created_at, last_interaction, trashed_at
) VALUES (
  ?1, ?2, ?3, ?4, ?5, NULL, 0, 0,
  ?6, ?7, ?8, NULL
)
"#,
        params![
            id,
            "New note",
            "",
            file_path.to_string_lossy(),
            storage_to_db(NoteStorage::Draft),
            sort_order,
            now,
            now
        ],
    )
    .map_err(|err| err.to_string())?;

    Ok(NoteMeta {
        id,
        title: "New note".to_string(),
        preview: "".to_string(),
        file_path: file_path.to_string_lossy().to_string(),
        storage: NoteStorage::Draft,
        is_pinned: false,
        is_trashed: false,
        sort_order,
        created_at: now,
        last_interaction: now,
        trashed_at: None,
    })
}

pub(super) fn get(conn: &Connection, id: &str) -> Result<NoteWithContent, String> {
    let meta = get_meta(conn, id)?;
    if meta.storage != NoteStorage::Saved {
        let content =
            read_file(Path::new(&meta.file_path)).map_err(|err| format!("Read failed: {err}"))?;
        return Ok(NoteWithContent { meta, content });
    }

    let bookmark = get_bookmark(conn, id)?;
    let outcome =
        scoped_file::with_scoped_file(Path::new(&meta.file_path), bookmark.as_deref(), read_file)
            .map_err(|err| format!("Read failed: {err}"))?;
    apply_scoped_updates(conn, id, outcome.refreshed_bookmark, outcome.resolved_path)?;

    let meta = get_meta(conn, id)?;
    Ok(NoteWithContent {
        meta,
        content: outcome.value,
    })
}

pub(super) fn set_active(conn: &Connection, id: &str) -> Result<(), String> {
    let now = now_ms();
    conn.execute(
        "UPDATE notes SET last_interaction = ?1 WHERE id = ?2",
        params![now, id],
    )
    .map_err(|err| err.to_string())?;
    Ok(())
}

pub(super) fn write_draft(conn: &Connection, id: &str, content: &str) -> Result<NoteMeta, String> {
    let meta = get_meta(conn, id)?;
    if meta.storage != NoteStorage::Draft {
        return Err("Only drafts can be auto-saved.".to_string());
    }

    write_file(Path::new(&meta.file_path), content)
        .map_err(|err| format!("Write failed: {err}"))?;

    let (title, preview) = derive_title_preview(content);
    let now = now_ms();
    conn.execute(
        r#"
UPDATE notes
SET title = ?1, preview = ?2, last_interaction = ?3
WHERE id = ?4
"#,
        params![title, preview, now, id],
    )
    .map_err(|err| err.to_string())?;

    get_meta(conn, id)
}

pub(super) fn save(conn: &Connection, id: &str, content: &str) -> Result<NoteMeta, String> {
    let meta = get_meta(conn, id)?;
    if meta.storage != NoteStorage::Saved {
        return Err("Only saved notes can be saved with Cmd+S.".to_string());
    }

    let bookmark = get_bookmark(conn, id)?;
    let outcome =
        scoped_file::with_scoped_file(Path::new(&meta.file_path), bookmark.as_deref(), |p| {
            write_file(p, content)
        })
        .map_err(|err| format!("Write failed: {err}"))?;
    apply_scoped_updates(conn, id, outcome.refreshed_bookmark, outcome.resolved_path)?;

    let (title, preview) = derive_title_preview(content);
    let now = now_ms();
    conn.execute(
        r#"
UPDATE notes
SET title = ?1, preview = ?2, last_interaction = ?3
WHERE id = ?4
"#,
        params![title, preview, now, id],
    )
    .map_err(|err| err.to_string())?;

    get_meta(conn, id)
}

pub(super) fn save_as(
    conn: &Connection,
    paths: &AppPaths,
    id: &str,
    new_path: &Path,
    content: &str,
) -> Result<NoteMeta, String> {
    let meta = get_meta(conn, id)?;

    let outcome = scoped_file::with_scoped_file(new_path, None, |p| write_file(p, content))
        .map_err(|err| format!("Write failed: {err}"))?;
    let effective_new_path = outcome.resolved_path.as_deref().unwrap_or(new_path);

    if meta.storage == NoteStorage::Draft {
        let _ = std::fs::remove_file(&meta.file_path);
    }

    let (title, preview) = derive_title_preview(content);
    let now = now_ms();
    conn.execute(
        r#"
UPDATE notes
SET title = ?1,
    preview = ?2,
    file_path = ?3,
    storage = ?4,
    bookmark = ?5,
    last_interaction = ?6
WHERE id = ?7
"#,
        params![
            title,
            preview,
            effective_new_path.to_string_lossy(),
            storage_to_db(NoteStorage::Saved),
            outcome.refreshed_bookmark,
            now,
            id
        ],
    )
    .map_err(|err| err.to_string())?;

    // Ensure the file lives outside the app data dir only via explicit Save As/import.
    let _ = paths; // reserved for future path validations

    get_meta(conn, id)
}
