use crate::app_state::AppState;
use crate::notes;
use crate::types::NoteStorage;
use rusqlite::{params, Connection, OptionalExtension};
use std::time::Duration;

pub fn start_background_sweeper(state: AppState) {
    std::thread::spawn(move || loop {
        if let Err(err) = sweep(&state) {
            eprintln!("expiry sweep error: {err}");
        }
        std::thread::sleep(Duration::from_secs(60));
    });
}

pub fn sweep(state: &AppState) -> Result<(), String> {
    let now = notes::now_ms();
    let (expiry_minutes, trash_days) = {
        let conn = state
            .db
            .lock()
            .map_err(|_| "DB lock poisoned".to_string())?;
        let expiry_minutes = get_int_setting(&conn, "expiry_minutes", 10_080)?;
        let trash_days = get_int_setting(&conn, "trash_retention_days", 30)?;
        (expiry_minutes, trash_days)
    };

    let expiry_ms = expiry_minutes * 60_000;
    let trash_ms = trash_days * 86_400_000;

    {
        let conn = state
            .db
            .lock()
            .map_err(|_| "DB lock poisoned".to_string())?;
        trash_expired(&conn, state, now - expiry_ms)?;
        drop_expired_trash(&conn, state, now - trash_ms)?;
    }

    Ok(())
}

fn trash_expired(
    conn: &Connection,
    state: &AppState,
    cutoff_last_interaction: i64,
) -> Result<(), String> {
    let mut stmt = conn
        .prepare(
            r#"
	SELECT id FROM notes
	WHERE is_trashed = 0
	  AND is_pinned = 0
	  AND last_interaction <= ?1
"#,
        )
        .map_err(|err| err.to_string())?;

    let ids = stmt
        .query_map(params![cutoff_last_interaction], |row| {
            row.get::<_, String>(0)
        })
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    for id in ids {
        if let Err(err) = crate::notes::trash(conn, &state.paths, &id) {
            eprintln!("auto-trash failed for {id}: {err}");
        }
    }

    Ok(())
}

fn drop_expired_trash(
    conn: &Connection,
    _state: &AppState,
    cutoff_trashed_at: i64,
) -> Result<(), String> {
    let mut stmt = conn
        .prepare(
            r#"
SELECT id, storage, file_path FROM notes
WHERE is_trashed = 1
  AND trashed_at IS NOT NULL
  AND trashed_at <= ?1
"#,
        )
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map(params![cutoff_trashed_at], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    for (id, storage_raw, file_path) in rows {
        let storage = if storage_raw == "saved" {
            NoteStorage::Saved
        } else {
            NoteStorage::Draft
        };

        if storage == NoteStorage::Draft {
            let _ = std::fs::remove_file(&file_path);
        }

        conn.execute("DELETE FROM notes WHERE id = ?1", params![id])
            .map_err(|err| err.to_string())?;
    }

    Ok(())
}

fn get_int_setting(conn: &Connection, key: &str, default: i64) -> Result<i64, String> {
    let existing: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1 LIMIT 1",
            params![key],
            |row| row.get(0),
        )
        .optional()
        .map_err(|err| err.to_string())?;

    if let Some(value) = existing {
        return Ok(value.parse::<i64>().unwrap_or(default));
    }

    conn.execute(
        "INSERT INTO settings(key, value) VALUES (?1, ?2)",
        params![key, default.to_string()],
    )
    .map_err(|err| err.to_string())?;

    Ok(default)
}
