use serde::Serialize;
use std::path::Path;
use std::process::Command;
use tauri::State;

use crate::WorkspaceState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvProbe {
    pub id: String,
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
    pub role: String,
    pub install_cmd: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvStatus {
    pub repo_root: String,
    pub branch: String,
    pub probes: Vec<EnvProbe>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SyncResult {
    pub ok: bool,
    pub lines: Vec<String>,
}

fn probe_binary(id: &str, name: &str, bin: &str, args: &[&str], role: &str, install_cmd: &str) -> EnvProbe {
    let out = Command::new(bin).args(args).output();
    match out {
        Ok(res) if res.status.success() => {
            let txt = format!(
                "{}\n{}",
                String::from_utf8_lossy(&res.stdout),
                String::from_utf8_lossy(&res.stderr)
            );
            let version = txt.lines().next().map(|l| l.trim().chars().take(48).collect());
            EnvProbe {
                id: id.to_string(),
                name: name.to_string(),
                installed: true,
                version,
                role: role.to_string(),
                install_cmd: install_cmd.to_string(),
            }
        }
        _ => EnvProbe {
            id: id.to_string(),
            name: name.to_string(),
            installed: false,
            version: None,
            role: role.to_string(),
            install_cmd: install_cmd.to_string(),
        },
    }
}

fn probe_chromium(root: &Path) -> EnvProbe {
    let candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ];
    let found = candidates.iter().find(|p| Path::new(p).exists()).copied();
    let remotion_cache = root.join("node_modules").join(".remotion").exists();
    EnvProbe {
        id: "chromium".to_string(),
        name: "Chromium / Chrome".to_string(),
        installed: found.is_some() || remotion_cache,
        version: found.map(|p| p.to_string()).or_else(|| if remotion_cache { Some("remotion cache".into()) } else { None }),
        role: "Headless WebGL browser engine used by Remotion to render MP4 frames".to_string(),
        install_cmd: "npx remotion browser ensure".to_string(),
    }
}

/// Looks for the claude-animated-shorts SKILL.md under ~/.claude/skills (README name, then repo name).
fn probe_skill() -> EnvProbe {
    let home = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME"));
    let found = home.and_then(|h| {
        ["cartoon-3d-short", "claude-animated-shorts"]
            .into_iter()
            .find(|d| Path::new(&h).join(".claude").join("skills").join(d).join("SKILL.md").exists())
    });
    EnvProbe {
        id: "skill".to_string(),
        name: "claude-animated-shorts skill".to_string(),
        installed: found.is_some(),
        version: found.map(|d| format!("~/.claude/skills/{d}")),
        role: "The pipeline, templates and references your agent follows (SKILL.md)".to_string(),
        install_cmd: "git clone https://github.com/mromidev/claude-animated-shorts ~/.claude/skills/cartoon-3d-short".to_string(),
    }
}

/// Fixed one-click install command per probe id. Mirrors INSTALLERS in server/services/jobRunner.mjs.
fn install_command(id: &str) -> Option<&'static str> {
    let win = cfg!(target_os = "windows");
    match id {
        "git" if win => Some("winget install -e --id Git.Git --silent --accept-source-agreements --accept-package-agreements"),
        "node" if win => Some("winget install -e --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements"),
        "python" if win => Some("winget install -e --id Python.Python.3.12 --silent --accept-source-agreements --accept-package-agreements"),
        "ffmpeg" if win => Some("winget install -e --id Gyan.FFmpeg --silent --accept-source-agreements --accept-package-agreements"),
        "py_deps" => Some("python -m pip install numpy pillow"),
        "chromium" => Some("npx remotion browser ensure"),
        "claude" => Some("npm install -g @anthropic-ai/claude-code"),
        "codex" => Some("npm install -g @openai/codex"),
        "opencode" => Some("npm install -g opencode-ai"),
        _ => None,
    }
}

fn last_lines(out: &[u8]) -> Vec<String> {
    let text = String::from_utf8_lossy(out);
    let lines: Vec<String> = text.lines().map(|l| l.trim().to_string()).filter(|l| !l.is_empty()).collect();
    lines[lines.len().saturating_sub(6)..].to_vec()
}

// async so a long install runs off the UI thread; async commands that borrow State must return Result.
#[tauri::command]
pub async fn install_tool(state: State<'_, WorkspaceState>, id: String) -> Result<SyncResult, String> {
    Ok(install_tool_blocking(&state.root, &id))
}

fn install_tool_blocking(root: &Path, id: &str) -> SyncResult {
    let output = if id == "skill" {
        let Some(home) = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")) else {
            return SyncResult { ok: false, lines: vec!["Could not find your home folder.".into()] };
        };
        let dest = Path::new(&home).join(".claude").join("skills").join("cartoon-3d-short");
        if dest.join("SKILL.md").exists() {
            return SyncResult { ok: true, lines: vec!["Skill is already installed.".into()] };
        }
        let _ = std::fs::create_dir_all(dest.parent().unwrap_or(&dest));
        Command::new("git")
            .args(["clone", "--depth", "1", "https://github.com/mromidev/claude-animated-shorts"])
            .arg(&dest)
            .output()
    } else {
        let Some(cmd) = install_command(id) else {
            return SyncResult { ok: false, lines: vec![format!("No automatic installer for \"{id}\" on this system.")] };
        };
        if cfg!(target_os = "windows") {
            Command::new("cmd").args(["/C", cmd]).current_dir(root).output()
        } else {
            Command::new("sh").args(["-c", cmd]).current_dir(root).output()
        }
    };
    match output {
        Ok(out) => {
            let mut lines = last_lines(&out.stdout);
            lines.extend(last_lines(&out.stderr));
            SyncResult { ok: out.status.success(), lines }
        }
        Err(err) => SyncResult { ok: false, lines: vec![err.to_string()] },
    }
}

#[tauri::command]
pub fn check_environment(state: State<'_, WorkspaceState>) -> EnvStatus {
    let probes = vec![
        probe_binary("git", "Git", "git", &["--version"], "Clones & syncs your ToonForge template repository", "winget install Git.Git"),
        probe_binary("node", "Node.js (>=20)", "node", &["-v"], "Bundles TypeScript & renders Three.js/Remotion scenes", "winget install OpenJS.NodeJS.LTS"),
        probe_binary("python", "Python (>=3.10)", "python", &["--version"], "Executes VO sync, -15 LUFS DSP audio mix & frame QA", "winget install Python.Python.3.12"),
        probe_binary("py_deps", "NumPy + Pillow", "python", &["-c", "import numpy, PIL; print('numpy+pillow OK')"], "Analyzes frame luma, black frames & contact sheets", "python -m pip install numpy pillow"),
        probe_binary("ffmpeg", "FFmpeg + FFprobe", "ffmpeg", &["-version"], "Normalizes -15 LUFS audio & encodes/analyzes MP4 streams", "winget install Gyan.FFmpeg"),
        probe_chromium(&state.root),
        probe_binary("agy", "Antigravity CLI", "agy", &["--version"], "Built-in IDE coding agent (no external API key needed)", "Bundled with Antigravity IDE"),
        probe_binary("claude", "Claude Code CLI", "claude", &["--version"], "Anthropic CLI agent (requires Claude Pro/Max or API key)", "npm install -g @anthropic-ai/claude-code"),
        probe_binary("codex", "Codex CLI", "codex", &["--version"], "OpenAI CLI agent (requires ChatGPT Plus/Pro or OPENAI_API_KEY)", "npm install -g @openai/codex"),
        probe_binary("opencode", "OpenCode CLI", "opencode", &["--version"], "Open-source BYOK CLI agent (Gemini / OpenRouter / Ollama)", "npm install -g opencode-ai"),
        probe_skill(),
    ];

    let branch = Command::new("git")
        .args(["branch", "--show-current"])
        .current_dir(&state.root)
        .output()
        .ok()
        .and_then(|o| {
            let b = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if b.is_empty() { None } else { Some(b) }
        })
        .unwrap_or_else(|| "main".to_string());

    EnvStatus {
        repo_root: state.root.to_string_lossy().to_string(),
        branch,
        probes,
    }
}

#[tauri::command]
pub fn sync_repo(state: State<'_, WorkspaceState>) -> SyncResult {
    let mut lines = Vec::new();
    let has_remote = Command::new("git")
        .args(["remote"])
        .current_dir(&state.root)
        .output()
        .map(|o| !String::from_utf8_lossy(&o.stdout).trim().is_empty())
        .unwrap_or(false);

    if has_remote {
        if let Ok(pull) = Command::new("git").args(["pull", "--ff-only"]).current_dir(&state.root).output() {
            let txt = String::from_utf8_lossy(&pull.stdout).trim().to_string();
            if !txt.is_empty() {
                lines.push(txt);
            }
        }
    } else {
        lines.push("local git repo clean (no upstream remote configured yet)".to_string());
    }

    let status = Command::new("git").args(["status", "--short"]).current_dir(&state.root).output();
    match status {
        Ok(out) => {
            let text = String::from_utf8_lossy(&out.stdout);
            if text.trim().is_empty() {
                lines.push("working tree clean".to_string());
            } else {
                lines.push(format!("modified entries: {}", text.lines().count()));
            }
            SyncResult { ok: out.status.success(), lines }
        }
        Err(err) => SyncResult { ok: false, lines: vec![err.to_string()] },
    }
}
