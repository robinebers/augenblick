use crate::app_state::AppPaths;
use crate::types::{NoteMeta, NoteStorage};
use rusqlite::{params, Connection};
use std::path::{Path, PathBuf};

use super::files::move_file;
use super::meta::get_meta;
use super::time::now_ms;

pub(super) fn trash(conn: &Connection, paths: &AppPaths, id: &str) -> Result<NoteMeta, String> {
    let meta = get_meta(conn, id)?;
    if meta.is_trashed {
        return Ok(meta);
    }

    let trashed_at = now_ms();
    let mut new_file_path: Option<PathBuf> = None;
    if meta.storage == NoteStorage::Draft {
        let file_name = Path::new(&meta.file_path)
            .file_name()
            .ok_or_else(|| "Invalid file path".to_string())?;
        let target = paths.trash_dir.join(file_name);
        move_file(Path::new(&meta.file_path), &target)
            .map_err(|err| format!("Move to trash failed: {err}"))?;
        new_file_path = Some(target);
    }

    conn.execute(
        r#"
UPDATE notes
SET is_trashed = 1,
    trashed_at = ?1,
    is_pinned = 0,
    file_path = COALESCE(?2, file_path)
WHERE id = ?3
"#,
        params![
            trashed_at,
            new_file_path.as_ref().map(|p| p.to_string_lossy()),
            id
        ],
    )
    .map_err(|err| err.to_string())?;

    get_meta(conn, id)
}

pub(super) fn restore(conn: &Connection, paths: &AppPaths, id: &str) -> Result<NoteMeta, String> {
    let meta = get_meta(conn, id)?;
    if !meta.is_trashed {
        return Ok(meta);
    }

    let mut new_file_path: Option<PathBuf> = None;
    if meta.storage == NoteStorage::Draft {
        let file_name = Path::new(&meta.file_path)
            .file_name()
            .ok_or_else(|| "Invalid file path".to_string())?;
        let target = paths.drafts_dir.join(file_name);
        move_file(Path::new(&meta.file_path), &target)
            .map_err(|err| format!("Restore failed: {err}"))?;
        new_file_path = Some(target);
    }

    conn.execute(
        r#"
UPDATE notes
SET is_trashed = 0,
    trashed_at = NULL,
    file_path = COALESCE(?1, file_path)
WHERE id = ?2
"#,
        params![new_file_path.as_ref().map(|p| p.to_string_lossy()), id],
    )
    .map_err(|err| err.to_string())?;

    get_meta(conn, id)
}

pub(super) fn delete_forever(conn: &Connection, id: &str) -> Result<(), String> {
    let meta = get_meta(conn, id)?;

    if meta.storage == NoteStorage::Draft {
        let _ = std::fs::remove_file(&meta.file_path);
    }

    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])
        .map_err(|err| err.to_string())?;
    Ok(())
}
