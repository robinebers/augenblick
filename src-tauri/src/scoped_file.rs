use std::path::{Path, PathBuf};

use crate::logs;

#[derive(Debug)]
pub struct ScopedOutcome<T> {
    pub value: T,
    pub refreshed_bookmark: Option<Vec<u8>>,
    pub resolved_path: Option<PathBuf>,
}

#[cfg(not(target_os = "macos"))]
pub fn with_scoped_file<T>(
    path: &Path,
    _bookmark: Option<&[u8]>,
    op: impl FnOnce(&Path) -> Result<T, String>,
) -> Result<ScopedOutcome<T>, String> {
    let value = op(path)?;
    Ok(ScopedOutcome {
        value,
        refreshed_bookmark: None,
        resolved_path: None,
    })
}

#[cfg(target_os = "macos")]
pub fn with_scoped_file<T>(
    path: &Path,
    bookmark: Option<&[u8]>,
    op: impl FnOnce(&Path) -> Result<T, String>,
) -> Result<ScopedOutcome<T>, String> {
    use objc2::rc::autoreleasepool;
    use objc2::runtime::Bool;
    use objc2_foundation::{
        NSData, NSString, NSURLBookmarkCreationOptions, NSURLBookmarkResolutionOptions, NSURL,
    };

    autoreleasepool(|_| {
        let path_str = match path.to_str() {
            Some(path_str) => path_str,
            None => {
                log_scoped_failure("path_non_utf8", path, "path is not valid UTF-8");
                return Err("Non-UTF8 paths are not supported.".to_string());
            }
        };

        let had_bookmark = bookmark.is_some();
        let mut is_stale = Bool::new(false);
        let (url, mut wants_bookmark_refresh) = match bookmark {
            Some(bookmark_bytes) => {
                let data = NSData::with_bytes(bookmark_bytes);
                let opts = NSURLBookmarkResolutionOptions::WithSecurityScope
                    | NSURLBookmarkResolutionOptions::WithoutUI
                    | NSURLBookmarkResolutionOptions::WithoutMounting;
                let url = unsafe {
                    NSURL::URLByResolvingBookmarkData_options_relativeToURL_bookmarkDataIsStale_error(
                        &data,
                        opts,
                        None,
                        &mut is_stale,
                    )
                }
                .map_err(|err| {
                    let desc = err.localizedDescription().to_string();
                    let debug = format!("{err:?}");
                    log_scoped_failure(
                        "resolve_bookmark",
                        path,
                        &format!("had_bookmark=true err=\"{desc}\" debug=\"{debug}\""),
                    );
                    ns_error(err)
                })?;

                (url, is_stale.as_bool())
            }
            None => {
                let ns_path = NSString::from_str(path_str);
                (NSURL::fileURLWithPath(&ns_path), true)
            }
        };

        let started = unsafe { url.startAccessingSecurityScopedResource() };
        if !started {
            log_scoped_failure(
                "start_access",
                path,
                "startAccessingSecurityScopedResource returned false",
            );
        }

        let resolved_path = url
            .path()
            .map(|p| PathBuf::from(p.to_string()))
            .filter(|p| p != path);
        if resolved_path.is_some() {
            wants_bookmark_refresh = true;
        }
        let op_path = resolved_path.as_deref().unwrap_or(path);

        let result = op(op_path);
        if let Err(err) = &result {
            log_scoped_failure(
                "op_failed",
                path,
                &format!("op_path=\"{}\" err=\"{err}\"", op_path.display()),
            );
        }

        if started {
            unsafe { url.stopAccessingSecurityScopedResource() };
        }

        let value = result?;

        let refreshed_bookmark = if wants_bookmark_refresh {
            match url.bookmarkDataWithOptions_includingResourceValuesForKeys_relativeToURL_error(
                NSURLBookmarkCreationOptions::WithSecurityScope,
                None,
                None,
            ) {
                Ok(bookmark_data) => Some(bookmark_data.to_vec()),
                Err(err) if !had_bookmark => {
                    let desc = err.localizedDescription().to_string();
                    let debug = format!("{err:?}");
                    log_scoped_failure(
                        "refresh_bookmark",
                        path,
                        &format!("had_bookmark=false err=\"{desc}\" debug=\"{debug}\""),
                    );
                    return Err(ns_error(err));
                }
                Err(err) if started => {
                    let desc = err.localizedDescription().to_string();
                    let debug = format!("{err:?}");
                    log_scoped_failure(
                        "refresh_bookmark",
                        path,
                        &format!("had_bookmark=true started=true err=\"{desc}\" debug=\"{debug}\""),
                    );
                    return Err(ns_error(err));
                }
                Err(_) => None,
            }
        } else {
            None
        };

        Ok(ScopedOutcome {
            value,
            refreshed_bookmark,
            resolved_path,
        })
    })
}

#[cfg(target_os = "macos")]
fn ns_error(err: objc2::rc::Retained<objc2_foundation::NSError>) -> String {
    let desc = err.localizedDescription().to_string();
    if desc.trim().is_empty() {
        format!("{err:?}")
    } else {
        desc
    }
}

#[cfg(target_os = "macos")]
fn log_scoped_failure(stage: &str, path: &Path, message: &str) {
    logs::error(
        "scoped_file",
        &format!("{stage}: path=\"{}\" {message}", path.display()),
    );
}
