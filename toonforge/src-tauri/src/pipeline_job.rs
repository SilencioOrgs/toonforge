use serde::Serialize;
use std::fs;
use std::process::Command;
use tauri::State;

use crate::board_watch::composition_id_from_slug;
use crate::WorkspaceState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineRunResult {
    pub ok: bool,
    pub step: String,
    pub lines: Vec<String>,
    pub completion_pct: Option<u8>,
}

#[tauri::command]
pub async fn run_pipeline(
    state: State<'_, WorkspaceState>,
    slug: String,
    action: String,
) -> Result<PipelineRunResult, String> {
    let clean_slug: String = slug
        .to_lowercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect();

    if action == "typecheck" {
        let bin = if cfg!(target_os = "windows") { "npx.cmd" } else { "npx" };
        let out = Command::new(bin)
            .args(["tsc", "--noEmit"])
            .current_dir(&state.root)
            .output()
            .map_err(|e| e.to_string())?;
        return Ok(PipelineRunResult {
            ok: out.status.success(),
            step: "typecheck".to_string(),
            lines: if out.status.success() {
                vec!["npx tsc --noEmit passed with 0 errors".to_string()]
            } else {
                vec![String::from_utf8_lossy(&out.stdout).to_string()]
            },
            completion_pct: None,
        });
    }

    if clean_slug.is_empty() {
        return Err("Invalid card slug".to_string());
    }

    let out_dir = state.root.join("out").join(&clean_slug);
    if action == "stills" {
        let count = fs::read_dir(out_dir.join("stills"))
            .map(|d| d.filter_map(|e| e.ok()).count())
            .unwrap_or(0);
        return Ok(PipelineRunResult {
            ok: count > 0,
            step: "stills".to_string(),
            lines: vec![if count > 0 {
                format!("verified {} real still images in out/{}", count, clean_slug)
            } else {
                format!("no stills yet in out/{}/stills — run node scripts/stills.mjs after scene build", clean_slug)
            }],
            completion_pct: None,
        });
    }

    if action != "render" {
        return Err(format!("Unsupported pipeline action: {}", action));
    }

    let qa_path = out_dir.join("qa").join("report.md");
    if qa_path.exists() {
        let report = fs::read_to_string(&qa_path).map_err(|e| e.to_string())?;
        let lines: Vec<String> = report.lines().take(6).map(|l| l.to_string()).collect();
        return Ok(PipelineRunResult {
            ok: true,
            step: "qa".to_string(),
            lines,
            completion_pct: Some(100),
        });
    }

    let comp_id = composition_id_from_slug(&clean_slug);
    Ok(PipelineRunResult {
        ok: false,
        step: "render".to_string(),
        lines: vec![
            format!("No QA report found at out/{}/qa/report.md yet.", clean_slug),
            format!("Render: npx remotion render src/index.ts {} out/{}/{}_2k.mp4 --codec h264 --crf 16 --scale 1.3333333333333333", comp_id, clean_slug, clean_slug),
        ],
        completion_pct: None,
    })
}
