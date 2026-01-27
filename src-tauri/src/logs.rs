use chrono::Local;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;

fn log_path() -> PathBuf {
    if let Ok(path) = std::env::var("AUGENBLICK_LOG_PATH") {
        if !path.trim().is_empty() {
            return PathBuf::from(path);
        }
    }
    std::env::temp_dir().join("augenblick-debug.log")
}

pub fn error(tag: &str, message: &str) {
    let path = log_path();
    let ts = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
    let line = format!("[{ts}] {tag} {message}\n");
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) {
        let _ = file.write_all(line.as_bytes());
    }
}
