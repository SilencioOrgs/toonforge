use portable_pty::PtySize;
use serde::Serialize;
use std::collections::BTreeMap;
use std::process::Command;
use std::sync::Mutex;
use tauri::State;

use crate::WorkspaceState;

#[derive(Default)]
pub struct PtyManager {
    pub sessions: Mutex<BTreeMap<String, PtySize>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CliExecResult {
    pub ok: bool,
    pub stdout: String,
    pub stderr: String,
}

#[tauri::command]
pub fn exec_cli_command(
    state: State<'_, WorkspaceState>,
    engine: String,
    command: String,
) -> CliExecResult {
    if let Ok(mut map) = state.pty.sessions.lock() {
        map.entry(engine).or_insert(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        });
    }

    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", &command])
            .current_dir(&state.root)
            .output()
    } else {
        Command::new("sh")
            .args(["-c", &command])
            .current_dir(&state.root)
            .output()
    };

    match output {
        Ok(out) => CliExecResult {
            ok: out.status.success(),
            stdout: String::from_utf8_lossy(&out.stdout).to_string(),
            stderr: String::from_utf8_lossy(&out.stderr).to_string(),
        },
        Err(err) => CliExecResult {
            ok: false,
            stdout: String::new(),
            stderr: err.to_string(),
        },
    }
}
