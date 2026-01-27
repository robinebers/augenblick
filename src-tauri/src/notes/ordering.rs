use crate::types::NoteMeta;
use rusqlite::{params, Connection};

use super::meta::get_meta;

pub(super) fn next_sort_order(conn: &Connection) -> Result<i64, String> {
    let max_sort: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), 0) FROM notes WHERE is_trashed = 0 AND is_pinned = 0",
            [],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;
    Ok(max_sort + 1)
}

pub(super) fn set_pinned(conn: &Connection, id: &str, pinned: bool) -> Result<NoteMeta, String> {
    let meta = get_meta(conn, id)?;
    if meta.is_pinned == pinned {
        return Ok(meta);
    }

    if pinned {
        let pinned_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM notes WHERE is_pinned = 1 AND is_trashed = 0",
                [],
                |row| row.get(0),
            )
            .map_err(|err| err.to_string())?;
        if pinned_count >= 5 {
            return Err("You can only pin up to 5 notes.".to_string());
        }

        let max_pinned_sort: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(sort_order), 0) FROM notes WHERE is_pinned = 1 AND is_trashed = 0",
                [],
                |row| row.get(0),
            )
            .map_err(|err| err.to_string())?;

        conn.execute(
            "UPDATE notes SET is_pinned = 1, sort_order = ?1 WHERE id = ?2",
            params![max_pinned_sort + 1, id],
        )
        .map_err(|err| err.to_string())?;
    } else {
        let max_sort: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(sort_order), 0) FROM notes WHERE is_pinned = 0 AND is_trashed = 0",
                [],
                |row| row.get(0),
            )
            .map_err(|err| err.to_string())?;

        // Reset timer when unpinning so note gets full expiry period
        let now = super::time::now_ms();
        conn.execute(
            "UPDATE notes SET is_pinned = 0, sort_order = ?1, last_interaction = ?2 WHERE id = ?3",
            params![max_sort + 1, now, id],
        )
        .map_err(|err| err.to_string())?;
    }

    get_meta(conn, id)
}

pub(super) fn reorder(conn: &mut Connection, ids: &[String]) -> Result<(), String> {
    let tx = conn.transaction().map_err(|err| err.to_string())?;
    for (idx, id) in ids.iter().enumerate() {
        tx.execute(
            "UPDATE notes SET sort_order = ?1 WHERE id = ?2 AND is_trashed = 0",
            params![idx as i64, id],
        )
        .map_err(|err| err.to_string())?;
    }
    tx.commit().map_err(|err| err.to_string())?;
    Ok(())
}
