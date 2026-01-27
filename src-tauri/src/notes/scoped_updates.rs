use rusqlite::{params, Connection};
use std::path::PathBuf;

pub(super) fn get_bookmark(conn: &Connection, id: &str) -> Result<Option<Vec<u8>>, String> {
    conn.query_row(
        "SELECT bookmark FROM notes WHERE id = ?1 LIMIT 1",
        params![id],
        |row| row.get::<_, Option<Vec<u8>>>(0),
    )
    .map_err(|err| err.to_string())
}

pub(super) fn apply_scoped_updates(
    conn: &Connection,
    id: &str,
    refreshed_bookmark: Option<Vec<u8>>,
    resolved_path: Option<PathBuf>,
) -> Result<(), String> {
    if let Some(bookmark) = refreshed_bookmark {
        conn.execute(
            "UPDATE notes SET bookmark = ?1 WHERE id = ?2",
            params![bookmark, id],
        )
        .map_err(|err| err.to_string())?;
    }

    if let Some(path) = resolved_path {
        conn.execute(
            "UPDATE notes SET file_path = ?1 WHERE id = ?2",
            params![path.to_string_lossy(), id],
        )
        .map_err(|err| err.to_string())?;
    }

    Ok(())
}
