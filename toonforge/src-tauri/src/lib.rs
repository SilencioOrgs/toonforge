pub mod board_watch;
pub mod git_sync;
pub mod pipeline_job;
pub mod pty_host;
pub mod rig_manager;

use std::path::PathBuf;

pub struct WorkspaceState {
    pub root: PathBuf,
    pub pty: pty_host::PtyManager,
}

impl Default for WorkspaceState {
    fn default() -> Self {
        let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let root = if cwd.file_name().and_then(|n| n.to_str()) == Some("toonforge") {
            cwd.parent().map(|p| p.to_path_buf()).unwrap_or(cwd)
        } else {
            cwd
        };
        Self {
            root,
            pty: pty_host::PtyManager::default(),
        }
    }
}

#[tauri::command]
pub fn get_workspace_root(state: tauri::State<'_, WorkspaceState>) -> String {
    state.root.to_string_lossy().to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = WorkspaceState::default();
    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            get_workspace_root,
            git_sync::check_environment,
            git_sync::sync_repo,
            board_watch::load_board,
            board_watch::save_board,
            board_watch::create_card,
            board_watch::read_script,
            board_watch::write_script,
            board_watch::upload_voiceover,
            rig_manager::inspect_rigs,
            pipeline_job::run_pipeline,
            pty_host::exec_cli_command,
        ])
        .run(tauri::generate_context!())
        .expect("failed to start ToonForge Tauri shell");
}
