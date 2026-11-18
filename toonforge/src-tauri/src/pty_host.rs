use portable_pty::{CommandBuilder, PtySize};
use serde::Serialize;
use std::collections::BTreeMap;
use std::io::Read;
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

/// Binary and the args that come before the prompt for each agent CLI; None means not an agent.
/// Mirrors AI_ENGINE_ARGS in server/services/jobRunner.mjs.
fn agent_command(engine: &str) -> Option<(&'static str, &'static [&'static str])> {
    match engine {
        "claude" => Some(("claude", &["-p"])),
        "codex" => Some(("codex", &["exec"])),
        "opencode" => Some(("opencode", &["run"])),
        "agy" => Some(("agy", &["--mode", "accept-edits", "-p"])),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::agent_command;

    #[test]
    fn each_engine_maps_only_to_its_own_cli() {
        assert_eq!(agent_command("agy"), Some(("agy", &["--mode", "accept-edits", "-p"][..])));
        assert_eq!(agent_command("claude"), Some(("claude", &["-p"][..])));
        assert_eq!(agent_command("shell"), None);
        assert_eq!(agent_command("[agy]"), None);
    }
}

fn run_with_pty(cmd_bin: &str, args: &[&str], root: &std::path::Path) -> Result<CliExecResult, String> {
    let pty_system = portable_pty::native_pty_system();
    let size = PtySize { rows: 24, cols: 100, pixel_width: 0, pixel_height: 0 };
    let pair = pty_system.openpty(size).map_err(|e| e.to_string())?;
    let mut cmd = CommandBuilder::new(cmd_bin);
    for a in args {
        cmd.arg(a);
    }
    cmd.cwd(root);
    let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let status = child.wait().map_err(|e| e.to_string())?;
    let mut buf = String::new();
    let _ = reader.read_to_string(&mut buf);
    Ok(CliExecResult {
        ok: status.success(),
        stdout: buf,
        stderr: String::new(),
    })
}

#[tauri::command]
pub fn exec_cli_command(
    state: State<'_, WorkspaceState>,
    engine: String,
    command: String,
) -> CliExecResult {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return CliExecResult { ok: false, stdout: String::new(), stderr: "Missing command".into() };
    }

    if let Ok(mut map) = state.pty.sessions.lock() {
        map.entry(engine.clone()).or_insert(PtySize { rows: 24, cols: 100, pixel_width: 0, pixel_height: 0 });
    }

    // The selected engine alone decides where the text goes: an agent gets it as a prompt
    // (never through a shell), and only engine "shell" runs it as a command.
    if let Some((bin, pre)) = agent_command(&engine) {
        let mut args: Vec<&str> = pre.to_vec();
        args.push(trimmed);
        return run_with_pty(bin, &args, &state.root).unwrap_or_else(|e| CliExecResult {
            ok: false,
            stdout: String::new(),
            stderr: format!("{bin} could not start (is it installed and on PATH?): {e}"),
        });
    }
    if engine != "shell" {
        return CliExecResult { ok: false, stdout: String::new(), stderr: format!("Unknown engine \"{engine}\"") };
    }

    let output = if cfg!(target_os = "windows") {
        Command::new("cmd").args(["/C", trimmed]).current_dir(&state.root).output()
    } else {
        Command::new("sh").args(["-c", trimmed]).current_dir(&state.root).output()
    };

    match output {
        Ok(out) => CliExecResult {
            ok: out.status.success(),
            stdout: String::from_utf8_lossy(&out.stdout).to_string(),
            stderr: String::from_utf8_lossy(&out.stderr).to_string(),
        },
        Err(err) => CliExecResult { ok: false, stdout: String::new(), stderr: err.to_string() },
    }
}
