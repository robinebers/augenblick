use std::path::Path;

use crate::logs;

pub(super) fn read_file(path: &Path) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|err| {
        log_read_failure(path, &err);
        err.to_string()
    })
}

pub(super) fn write_file(path: &Path, content: &str) -> Result<(), String> {
    std::fs::write(path, content).map_err(|err| err.to_string())
}

pub(super) fn move_file(from: &Path, to: &Path) -> Result<(), String> {
    if let Some(parent) = to.parent() {
        std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }

    match std::fs::rename(from, to) {
        Ok(_) => Ok(()),
        Err(_) => {
            std::fs::copy(from, to).map_err(|err| err.to_string())?;
            std::fs::remove_file(from).map_err(|err| err.to_string())?;
            Ok(())
        }
    }
}

fn log_read_failure(path: &Path, err: &std::io::Error) {
    let meta = std::fs::metadata(path);
    let symlink_meta = std::fs::symlink_metadata(path);
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("<non-utf8>");
    let ext = path.extension().and_then(|ext| ext.to_str()).unwrap_or("");
    let exists = meta.is_ok();
    let (is_file, is_dir, size) = match meta {
        Ok(meta) => (meta.is_file(), meta.is_dir(), Some(meta.len())),
        Err(_) => (false, false, None),
    };
    let is_symlink = symlink_meta
        .as_ref()
        .map(|meta| meta.file_type().is_symlink())
        .unwrap_or(false);

    let message = format!(
        "read_file failed: path=\"{}\" file=\"{}\" ext=\"{}\" exists={} file={} dir={} symlink={} size={:?} kind={:?} err=\"{}\"",
        path.display(),
        file_name,
        ext,
        exists,
        is_file,
        is_dir,
        is_symlink,
        size,
        err.kind(),
        err
    );
    eprintln!("{message}");
    logs::error("read_file", &message);
}
