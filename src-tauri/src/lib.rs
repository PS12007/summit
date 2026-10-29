use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const DATA_FILE: &str = "summit-data.json";
const BACKUP_DIR: &str = "backups";
const MAX_BACKUPS: usize = 14;

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Returns the saved JSON, or None on first launch.
#[tauri::command]
fn load_data(app: AppHandle) -> Result<Option<String>, String> {
    let path = data_dir(&app)?.join(DATA_FILE);
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(path).map(Some).map_err(|e| e.to_string())
}

/// Writes to a temp file first, then swaps it in, so a crash mid-save can't corrupt data.
/// Also keeps one backup per day (the last 14 days).
#[tauri::command]
fn save_data(app: AppHandle, json: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&json).map_err(|e| format!("invalid JSON: {e}"))?;
    let dir = data_dir(&app)?;
    let path = dir.join(DATA_FILE);
    let tmp = dir.join(format!("{DATA_FILE}.tmp"));
    fs::write(&tmp, &json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    daily_backup(&dir, &json);
    Ok(())
}

fn daily_backup(dir: &PathBuf, json: &str) {
    let backups = dir.join(BACKUP_DIR);
    if fs::create_dir_all(&backups).is_err() {
        return;
    }
    let days = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() / 86_400)
        .unwrap_or(0);
    let file = backups.join(format!("day-{days}.json"));
    if !file.exists() {
        let _ = fs::write(&file, json);
    }
    // Prune oldest backups.
    if let Ok(entries) = fs::read_dir(&backups) {
        let mut names: Vec<PathBuf> = entries.flatten().map(|e| e.path()).collect();
        names.sort();
        while names.len() > MAX_BACKUPS {
            let _ = fs::remove_file(names.remove(0));
        }
    }
}

#[tauri::command]
fn data_folder(app: AppHandle) -> Result<String, String> {
    Ok(data_dir(&app)?.to_string_lossy().into_owned())
}

/// Used for export (JSON / .ics) after the user picks a path in the save dialog.
#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    fs::write(path, contents).map_err(|e| e.to_string())
}

/// Used for import after the user picks a file in the open dialog.
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_data,
            save_data,
            data_folder,
            write_text_file,
            read_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Summit");
}
