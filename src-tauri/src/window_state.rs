use tauri::window::Monitor;
use tauri::{AppHandle, Manager};
use tauri::{PhysicalPosition, PhysicalSize, Position, Size};
use tauri_plugin_window_state::{AppHandleExt, StateFlags, WindowExt};

fn monitor_bounds(m: &Monitor) -> (i32, i32, i32, i32) {
    let pos = m.position();
    let size = m.size();
    let left = pos.x;
    let top = pos.y;
    let right = left.saturating_add(size.width as i32);
    let bottom = top.saturating_add(size.height as i32);
    (left, top, right, bottom)
}

fn pick_monitor(monitors: &[Monitor], x: i32, y: i32) -> Option<Monitor> {
    for m in monitors {
        let (left, top, right, bottom) = monitor_bounds(m);
        if x >= left && x < right && y >= top && y < bottom {
            return Some(m.clone());
        }
    }
    None
}

fn clamp_window_to_monitor(window: &tauri::WebviewWindow, monitor: &Monitor) -> tauri::Result<()> {
    let pos = window.outer_position()?;
    let size = window.outer_size()?;

    let (left, top, right, bottom) = monitor_bounds(monitor);
    let monitor_w = (right - left).max(1) as u32;
    let monitor_h = (bottom - top).max(1) as u32;

    let next_w = size.width.min(monitor_w);
    let next_h = size.height.min(monitor_h);

    let max_x = right.saturating_sub(next_w as i32);
    let max_y = bottom.saturating_sub(next_h as i32);
    let next_x = pos.x.clamp(left, max_x);
    let next_y = pos.y.clamp(top, max_y);

    if next_w != size.width || next_h != size.height {
        window.set_size(Size::Physical(PhysicalSize {
            width: next_w,
            height: next_h,
        }))?;
    }

    if next_x != pos.x || next_y != pos.y {
        window.set_position(Position::Physical(PhysicalPosition {
            x: next_x,
            y: next_y,
        }))?;
    }

    Ok(())
}

pub fn restore_and_clamp(app: &AppHandle) -> tauri::Result<()> {
    let Some(window) = app.get_webview_window("main") else {
        return Ok(());
    };

    // Ignore errors: state file may not exist on first launch.
    let _ = window.restore_state(StateFlags::all());

    let monitors = window.available_monitors().unwrap_or_default();

    let pos = window
        .outer_position()
        .unwrap_or(PhysicalPosition { x: 0, y: 0 });
    let size = window.outer_size().unwrap_or(PhysicalSize {
        width: 800,
        height: 600,
    });
    let center_x = pos.x.saturating_add((size.width as i32) / 2);
    let center_y = pos.y.saturating_add((size.height as i32) / 2);

    let monitor = pick_monitor(&monitors, center_x, center_y)
        .or_else(|| window.current_monitor().ok().flatten())
        .or_else(|| window.primary_monitor().ok().flatten());

    if let Some(m) = monitor {
        let _ = clamp_window_to_monitor(&window, &m);
    }

    // Persist sanitized state for next launch.
    let _ = app.save_window_state(StateFlags::all());

    Ok(())
}
