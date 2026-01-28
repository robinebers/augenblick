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
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let app_handle = app.handle().clone();
            let state = AppState::init(&app_handle).map_err(std::io::Error::other)?;
            app.manage(state.clone());
            expiry::start_background_sweeper(state);
            let _ = window_state::restore_and_clamp(&app_handle);

            let quit_item = PredefinedMenuItem::quit(app, Some("Quit Augenblick"))
                .map_err(|err| std::io::Error::other(err.to_string()))?;
            let settings_item = MenuItemBuilder::with_id("app_settings", "Settings…")
                .accelerator("CmdOrCtrl+Comma")
                .build(app)
                .map_err(|err| std::io::Error::other(err.to_string()))?;
            let app_menu = SubmenuBuilder::new(app, "Augenblick")
                .about_with_text("About Augenblick", None)
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
            let new_note_item = MenuItemBuilder::with_id("file_new_note", "New Note")
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
                .accelerator("CmdOrCtrl+KeyW")
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
                match event.id().0.as_str() {
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
            commands::expiry_run_now
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
