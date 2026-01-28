use crate::app_state::AppState;
use crate::types::{AppSettings, NoteMeta, NoteWithContent, NotesList};
use crate::{expiry, notes};
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
pub fn notes_list(state: State<'_, AppState>) -> Result<NotesList, String> {
    let conn = state
        .db
        .lock()
        .map_err(|_| "DB lock poisoned".to_string())?;
    notes::list(&conn)
}

#[tauri::command]
pub fn note_create(state: State<'_, AppState>) -> Result<NoteMeta, String> {
    let conn = state
        .db
        .lock()
        .map_err(|_| "DB lock poisoned".to_string())?;
    notes::create_draft(&conn, &state.paths)
}

#[tauri::command]
pub fn note_get(state: State<'_, AppState>, id: String) -> Result<NoteWithContent, String> {
    let conn = state
        .db
        .lock()
        .map_err(|_| "DB lock poisoned".to_string())?;
    notes::get(&conn, &id)
}

#[tauri::command]
pub fn note_set_active(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state
        .db
        .lock()
        .map_err(|_| "DB lock poisoned".to_string())?;
    notes::set_active(&conn, &id)
}

#[tauri::command]
pub fn note_write_draft(
    state: State<'_, AppState>,
    id: String,
    content: String,
) -> Result<NoteMeta, String> {
    let conn = state
        .db
        .lock()
        .map_err(|_| "DB lock poisoned".to_string())?;
    notes::write_draft(&conn, &id, &content)
}

#[tauri::command]
pub fn note_save(
    state: State<'_, AppState>,
    id: String,
    content: String,
) -> Result<NoteMeta, String> {
    let conn = state
        .db
        .lock()
        .map_err(|_| "DB lock poisoned".to_string())?;
    notes::save(&conn, &id, &content)
}

#[tauri::command]
pub fn note_save_as(
    state: State<'_, AppState>,
    id: String,
    path: String,
    content: String,
) -> Result<NoteMeta, String> {
    let conn = state
        .db
        .lock()
        .map_err(|_| "DB lock poisoned".to_string())?;
    let new_path = PathBuf::from(path);
    notes::save_as(&conn, &state.paths, &id, &new_path, &content)
}

#[tauri::command]
pub fn note_import_file(
    state: State<'_, AppState>,
    path: String,
) -> Result<NoteWithContent, String> {
    let conn = state
        .db
        .lock()
        .map_err(|_| "DB lock poisoned".to_string())?;
    notes::import_file(&conn, &state.paths, PathBuf::from(path).as_path())
}

#[tauri::command]
pub fn note_trash(state: State<'_, AppState>, id: String) -> Result<NoteMeta, String> {
    let conn = state
        .db
        .lock()
        .map_err(|_| "DB lock poisoned".to_string())?;
    notes::trash(&conn, &state.paths, &id)
}

#[tauri::command]
pub fn note_restore(state: State<'_, AppState>, id: String) -> Result<NoteMeta, String> {
    let conn = state
        .db
        .lock()
        .map_err(|_| "DB lock poisoned".to_string())?;
    notes::restore(&conn, &state.paths, &id)
}

#[tauri::command]
pub fn note_delete_forever(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state
        .db
        .lock()
        .map_err(|_| "DB lock poisoned".to_string())?;
    notes::delete_forever(&conn, &id)
}

#[tauri::command]
pub fn note_pin(state: State<'_, AppState>, id: String, pinned: bool) -> Result<NoteMeta, String> {
    let conn = state
        .db
        .lock()
        .map_err(|_| "DB lock poisoned".to_string())?;
    notes::set_pinned(&conn, &id, pinned)
}

#[tauri::command]
pub fn notes_reorder(state: State<'_, AppState>, ids: Vec<String>) -> Result<(), String> {
    let mut conn = state
        .db
        .lock()
        .map_err(|_| "DB lock poisoned".to_string())?;
    notes::reorder(&mut conn, &ids)
}

#[tauri::command]
pub fn settings_get_all(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let conn = state
        .db
        .lock()
        .map_err(|_| "DB lock poisoned".to_string())?;
    Ok(AppSettings {
        expiry_minutes: get_setting_int(&conn, "expiry_minutes", 10_080)?,
        trash_retention_days: get_setting_int(&conn, "trash_retention_days", 30)?,
        theme: get_setting_string(&conn, "theme", "dark")?,
    })
}

#[tauri::command]
pub fn settings_set(state: State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    let conn = state
        .db
        .lock()
        .map_err(|_| "DB lock poisoned".to_string())?;
    set_setting(&conn, &key, &value)?;
    Ok(())
}

#[tauri::command]
pub fn app_state_get_all(state: State<'_, AppState>) -> Result<HashMap<String, String>, String> {
    let conn = state
        .db
        .lock()
        .map_err(|_| "DB lock poisoned".to_string())?;
    let mut stmt = conn
        .prepare("SELECT key, value FROM app_state")
        .map_err(|err| err.to_string())?;
    let items = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;
    Ok(items.into_iter().collect())
}

#[tauri::command]
pub fn app_state_set(state: State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    let conn = state
        .db
        .lock()
        .map_err(|_| "DB lock poisoned".to_string())?;
    conn.execute(
        "INSERT INTO app_state(key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn expiry_run_now(state: State<'_, AppState>) -> Result<(), String> {
    expiry::sweep(&state)
}

#[tauri::command]
pub fn app_exit(app: tauri::AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

fn get_setting_int(conn: &Connection, key: &str, default: i64) -> Result<i64, String> {
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

    set_setting(conn, key, &default.to_string())?;
    Ok(default)
}

fn get_setting_string(conn: &Connection, key: &str, default: &str) -> Result<String, String> {
    let existing: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1 LIMIT 1",
            params![key],
            |row| row.get(0),
        )
        .optional()
        .map_err(|err| err.to_string())?;

    if let Some(value) = existing {
        return Ok(value);
    }

    set_setting(conn, key, default)?;
    Ok(default.to_string())
}

fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO settings(key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|err| err.to_string())?;
    Ok(())
}
