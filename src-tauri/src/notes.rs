mod derive;
mod files;
mod import;
mod list;
mod meta;
mod ordering;
mod scoped_updates;
mod time;
mod trash;
mod write;

use crate::app_state::AppPaths;
use crate::types::{NoteMeta, NoteWithContent, NotesList};
use rusqlite::Connection;
use std::path::Path;

pub fn now_ms() -> i64 {
    time::now_ms()
}

pub fn list(conn: &Connection) -> Result<NotesList, String> {
    list::list(conn)
}

pub fn create_draft(conn: &Connection, paths: &AppPaths) -> Result<NoteMeta, String> {
    write::create_draft(conn, paths)
}

pub fn get(conn: &Connection, id: &str) -> Result<NoteWithContent, String> {
    write::get(conn, id)
}

pub fn set_active(conn: &Connection, id: &str) -> Result<(), String> {
    write::set_active(conn, id)
}

pub fn write_draft(conn: &Connection, id: &str, content: &str) -> Result<NoteMeta, String> {
    write::write_draft(conn, id, content)
}

pub fn save(conn: &Connection, id: &str, content: &str) -> Result<NoteMeta, String> {
    write::save(conn, id, content)
}

pub fn save_as(
    conn: &Connection,
    paths: &AppPaths,
    id: &str,
    new_path: &Path,
    content: &str,
) -> Result<NoteMeta, String> {
    write::save_as(conn, paths, id, new_path, content)
}

pub fn import_file(
    conn: &Connection,
    paths: &AppPaths,
    path: &Path,
) -> Result<NoteWithContent, String> {
    import::import_file(conn, paths, path)
}

pub fn trash(conn: &Connection, paths: &AppPaths, id: &str) -> Result<NoteMeta, String> {
    trash::trash(conn, paths, id)
}

pub fn restore(conn: &Connection, paths: &AppPaths, id: &str) -> Result<NoteMeta, String> {
    trash::restore(conn, paths, id)
}

pub fn delete_forever(conn: &Connection, id: &str) -> Result<(), String> {
    trash::delete_forever(conn, id)
}

pub fn set_pinned(conn: &Connection, id: &str, pinned: bool) -> Result<NoteMeta, String> {
    ordering::set_pinned(conn, id, pinned)
}

pub fn reorder(conn: &mut Connection, ids: &[String]) -> Result<(), String> {
    ordering::reorder(conn, ids)
}
