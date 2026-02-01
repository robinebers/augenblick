mod app_state;
mod commands;
mod db;
mod expiry;
mod logs;
mod notes;
mod scoped_file;
mod types;
mod window_state;

use app_state::AppState;
use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};
use window_state::show_main_window;
#[cfg(target_os = "macos")]
use tauri::ActivationPolicy;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(ActivationPolicy::Accessory);

            let app_handle = app.handle().clone();
            let state = AppState::init(&app_handle).map_err(std::io::Error::other)?;
            app.manage(state.clone());
            expiry::start_background_sweeper(state);
            let _ = window_state::restore_and_clamp(&app_handle);
            show_main_window(&app_handle);

            let quit_item = MenuItemBuilder::with_id("app_quit", "Quit Augenblick")
                .accelerator("CmdOrCtrl+KeyQ")
                .build(app)
                .map_err(|err| std::io::Error::other(err.to_string()))?;
            let settings_item = MenuItemBuilder::with_id("app_settings", "Settings…")
                .accelerator("CmdOrCtrl+Comma")
                .build(app)
                .map_err(|err| std::io::Error::other(err.to_string()))?;
            let about_metadata = AboutMetadata {
                credits: Some("Built by Robin Ebers (@robinebers)".into()),
                ..Default::default()
            };
            let app_menu = SubmenuBuilder::new(app, "Augenblick")
                .about_with_text("About Augenblick", Some(about_metadata))
                .separator()
                .item(&settings_item)
                .separator()
                .services()
                .separator()
                .hide_with_text("Hide Augenblick")
                .hide_others()
                .show_all()
                .separator()
                .item(&quit_item)
                .build()
                .map_err(|err| std::io::Error::other(err.to_string()))?;

            let open_item = MenuItemBuilder::with_id("file_open_markdown", "Open…")
                .accelerator("CmdOrCtrl+KeyO")
                .build(app)
                .map_err(|err| std::io::Error::other(err.to_string()))?;
            let new_note_item = MenuItemBuilder::with_id("file_new_note", "New note")
                .accelerator("CmdOrCtrl+KeyN")
                .build(app)
                .map_err(|err| std::io::Error::other(err.to_string()))?;
            let save_note_item = MenuItemBuilder::with_id("file_save_note", "Save")
                .accelerator("CmdOrCtrl+KeyS")
                .build(app)
                .map_err(|err| std::io::Error::other(err.to_string()))?;
            let save_as_note_item = MenuItemBuilder::with_id("file_save_as_note", "Save As…")
                .accelerator("CmdOrCtrl+Shift+KeyS")
                .build(app)
                .map_err(|err| std::io::Error::other(err.to_string()))?;
            let trash_note_item = MenuItemBuilder::with_id("file_trash_note", "Move to Trash")
                .accelerator("Delete")
                .build(app)
                .map_err(|err| std::io::Error::other(err.to_string()))?;
            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&new_note_item)
                .separator()
                .item(&open_item)
                .separator()
                .item(&save_note_item)
                .item(&save_as_note_item)
                .separator()
                .item(&trash_note_item)
                .build()
                .map_err(|err| std::io::Error::other(err.to_string()))?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()
                .map_err(|err| std::io::Error::other(err.to_string()))?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .item(
                    &MenuItemBuilder::with_id("view_toggle_devtools", "Toggle Developer Tools")
                        .accelerator("CmdOrCtrl+Alt+KeyI")
                        .build(app)
                        .map_err(|err| std::io::Error::other(err.to_string()))?,
                )
                .separator()
                .fullscreen_with_text("Enter Full Screen")
                .build()
                .map_err(|err| std::io::Error::other(err.to_string()))?;

            let window_menu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .maximize_with_text("Zoom")
                .separator()
                .close_window()
                .build()
                .map_err(|err| std::io::Error::other(err.to_string()))?;

            let menu = MenuBuilder::new(app)
                .items(&[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu])
                .build()
                .map_err(|err| std::io::Error::other(err.to_string()))?;

            app.set_menu(menu)
                .map_err(|err| std::io::Error::other(err.to_string()))?;

            app.on_menu_event(|app_handle, event| {
                let id = event.id().0.as_str();
                if id == "tray_new_note" {
                    show_main_window(app_handle);
                    let _ = app_handle.emit("tray-new-note", ());
                    return;
                }

                if id == "tray_quit" {
                    let _ = app_handle.emit("tray-quit", ());
                    return;
                }

                if id == "app_quit" {
                    // If window exists, JS is likely alive - emit event for dirty notes check
                    // Only fallback to direct exit if no window exists at all
                    if app_handle.get_webview_window("main").is_some() {
                        let _ = app_handle.emit("menu-quit", ());
                    } else {
                        app_handle.exit(0);
                    }
                    return;
                }

                if id == "tray_show_all" {
                    show_main_window(app_handle);
                    let _ = app_handle.emit("tray-show-all", ());
                    return;
                }

                if let Some(note_id) = id.strip_prefix(TRAY_NOTE_PREFIX) {
                    show_main_window(app_handle);
                    let _ = app_handle.emit("tray-select-note", note_id.to_string());
                    return;
                }

                match id {
                    "app_settings" => {
                        let _ = app_handle.emit("menu-settings", ());
                    }
                    "file_open_markdown" => {
                        let _ = app_handle.emit("menu-open-markdown", ());
                    }
                    "file_new_note" => {
                        let _ = app_handle.emit("menu-new-note", ());
                    }
                    "file_save_note" => {
                        let _ = app_handle.emit("menu-save", ());
                    }
                    "file_save_as_note" => {
                        let _ = app_handle.emit("menu-save-as", ());
                    }
                    "file_trash_note" => {
                        let _ = app_handle.emit("menu-trash", ());
                    }
                    "view_toggle_devtools" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            if window.is_devtools_open() {
                                window.close_devtools();
                            } else {
                                window.open_devtools();
                            }
                        }
                    }
                    _ => {}
                };
            });

            let tray_menu = build_tray_menu(&app_handle)
                .or_else(|err: String| {
                    logs::error("tray-menu", &err);
                    build_basic_tray_menu(&app_handle)
                })
                .map_err(std::io::Error::other)?;

            let tray_icon_path = app_handle
                .path()
                .resolve("icons/tray-icon.png", tauri::path::BaseDirectory::Resource)
                .map_err(|err| std::io::Error::other(err.to_string()))?;
            let tray_icon = tauri::image::Image::from_path(tray_icon_path)
                .map_err(|err| std::io::Error::other(err.to_string()))?;

            TrayIconBuilder::new()
                .icon(tray_icon)
                .icon_as_template(true)
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if matches!(event, TrayIconEvent::Enter { .. }) {
                        if let Ok(menu) = build_tray_menu(tray.app_handle()) {
                            let _ = tray.set_menu(Some(menu));
                        }
                    }
                    if let TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        ..
                    } = event
                    {
                        // Show window directly in Rust to avoid race conditions with async JS
                        show_main_window(tray.app_handle());
                        let _ = tray.app_handle().emit("tray-show-all", ());
                    }
                })
                .build(&app_handle)
                .map_err(|err| std::io::Error::other(err.to_string()))?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::notes_list,
            commands::note_create,
            commands::note_get,
            commands::note_set_active,
            commands::note_write_draft,
            commands::note_save,
            commands::note_save_as,
            commands::note_import_file,
            commands::note_trash,
            commands::note_restore,
            commands::note_delete_forever,
            commands::note_pin,
            commands::notes_reorder,
            commands::settings_get_all,
            commands::settings_set,
            commands::app_state_get_all,
            commands::app_state_set,
            commands::expiry_run_now,
            commands::app_set_activation_policy,
            commands::app_show_main_window,
            commands::app_exit
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn build_tray_menu<R: tauri::Runtime>(
    app_handle: &AppHandle<R>,
) -> Result<tauri::menu::Menu<R>, String> {
    let state = app_handle.state::<AppState>();
    let conn = state
        .db
        .lock()
        .map_err(|_| "DB lock poisoned".to_string())?;
    let notes_list = notes::list(&conn)?;

    let pinned: Vec<_> = notes_list.active.iter().filter(|note| note.is_pinned).collect();
    let mut recent: Vec<_> = notes_list
        .active
        .iter()
        .filter(|note| !note.is_pinned)
        .collect();
    recent.sort_by(|a, b| b.last_interaction.cmp(&a.last_interaction));
    recent.truncate(5);

    let mut menu = MenuBuilder::new(app_handle).text("tray_new_note", "New note");

    if !pinned.is_empty() {
        let pinned_header = MenuItemBuilder::new("Pinned")
            .enabled(false)
            .build(app_handle)
            .map_err(|err| err.to_string())?;
        menu = menu.separator().item(&pinned_header);
        for note in pinned {
            menu = menu.text(tray_note_id(&note.id), tray_note_label(note.title.as_str()));
        }
    }

    if !recent.is_empty() {
        let recent_header = MenuItemBuilder::new("Recent")
            .enabled(false)
            .build(app_handle)
            .map_err(|err| err.to_string())?;
        menu = menu.separator().item(&recent_header);
        for note in recent {
            menu = menu.text(tray_note_id(&note.id), tray_note_label(note.title.as_str()));
        }
    }

    menu = menu
        .separator()
        .text("tray_show_all", "Show all notes")
        .text("tray_quit", "Quit Augenblick");

    menu.build().map_err(|err| err.to_string())
}

fn build_basic_tray_menu<R: tauri::Runtime>(
    app_handle: &AppHandle<R>,
) -> Result<tauri::menu::Menu<R>, String> {
    MenuBuilder::new(app_handle)
        .text("tray_new_note", "New note")
        .separator()
        .text("tray_show_all", "Show all notes")
        .text("tray_quit", "Quit Augenblick")
        .build()
        .map_err(|err| err.to_string())
}

const TRAY_NOTE_PREFIX: &str = "tray_note:";

fn tray_note_id(id: &str) -> String {
    format!("{TRAY_NOTE_PREFIX}{id}")
}

fn tray_note_label(title: &str) -> String {
    title.trim().to_string()
}
