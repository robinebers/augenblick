use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NoteStorage {
    Draft,
    Saved,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteMeta {
    pub id: String,
    pub title: String,
    pub preview: String,
    pub file_path: String,
    pub storage: NoteStorage,
    pub is_pinned: bool,
    pub is_trashed: bool,
    pub sort_order: i64,
    pub created_at: i64,
    pub last_interaction: i64,
    pub trashed_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotesList {
    pub active: Vec<NoteMeta>,
    pub trashed: Vec<NoteMeta>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteWithContent {
    pub meta: NoteMeta,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub expiry_days: i64,
    pub trash_retention_days: i64,
    pub theme: String,
}
