use crate::db;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::Manager;

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Mutex<Connection>>,
    pub paths: AppPaths,
}

#[derive(Clone)]
pub struct AppPaths {
    #[allow(dead_code)]
    pub app_data_dir: PathBuf,
    pub drafts_dir: PathBuf,
    pub trash_dir: PathBuf,
    #[allow(dead_code)]
    pub db_path: PathBuf,
}

impl AppState {
    pub fn init(app: &tauri::AppHandle) -> Result<Self, String> {
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|err| format!("Failed to resolve app data dir: {err}"))?;
        std::fs::create_dir_all(&app_data_dir)
            .map_err(|err| format!("Failed to create app data dir: {err}"))?;
        let log_path = app_data_dir.join("debug.log");
        std::env::set_var("AUGENBLICK_LOG_PATH", &log_path);

        let drafts_dir = app_data_dir.join("drafts");
        let trash_dir = app_data_dir.join("trash");
        std::fs::create_dir_all(&drafts_dir)
            .map_err(|err| format!("Failed to create drafts dir: {err}"))?;
        std::fs::create_dir_all(&trash_dir)
            .map_err(|err| format!("Failed to create trash dir: {err}"))?;

        let db_path = app_data_dir.join("augenblick.db");
        let conn = db::open(&db_path).map_err(|err| format!("Failed to open db: {err}"))?;

        Ok(Self {
            db: Arc::new(Mutex::new(conn)),
            paths: AppPaths {
                app_data_dir,
                drafts_dir,
                trash_dir,
                db_path,
            },
        })
    }
}
