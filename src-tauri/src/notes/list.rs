use crate::types::NotesList;
use rusqlite::Connection;

use super::meta::row_to_meta;

pub(super) fn list(conn: &Connection) -> Result<NotesList, String> {
    let mut active_stmt = conn
        .prepare(
            r#"
SELECT
  id, title, preview, file_path, storage, is_pinned, is_trashed, sort_order,
  created_at, last_interaction, trashed_at
FROM notes
WHERE is_trashed = 0
ORDER BY is_pinned DESC, sort_order ASC
"#,
        )
        .map_err(|err| err.to_string())?;

    let active = active_stmt
        .query_map([], row_to_meta)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    let mut trashed_stmt = conn
        .prepare(
            r#"
SELECT
  id, title, preview, file_path, storage, is_pinned, is_trashed, sort_order,
  created_at, last_interaction, trashed_at
FROM notes
WHERE is_trashed = 1
ORDER BY trashed_at DESC, sort_order ASC
"#,
        )
        .map_err(|err| err.to_string())?;

    let trashed = trashed_stmt
        .query_map([], row_to_meta)
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    Ok(NotesList { active, trashed })
}
