use serde::Serialize;
use std::fs;
use std::path::Path;
use tauri::State;

use crate::WorkspaceState;

#[derive(Debug, Clone, Serialize)]
pub struct StickmanRigStatus {
    pub ready: bool,
    pub label: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChibiRigStatus {
    pub ready: bool,
    pub sprites: usize,
    pub faces: usize,
    pub fx: usize,
    pub sprite_files: Vec<String>,
    pub face_files: Vec<String>,
    pub fx_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RigSummary {
    pub stickman: StickmanRigStatus,
    pub chibi: ChibiRigStatus,
}

fn list_pngs(dir: &Path) -> Vec<String> {
    let mut files: Vec<String> = fs::read_dir(dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter_map(|e| {
                    let path = e.path();
                    let is_png = path
                        .extension()
                        .and_then(|ext| ext.to_str())
                        .map(|ext| ext.eq_ignore_ascii_case("png"))
                        .unwrap_or(false);
                    if is_png {
                        e.file_name().into_string().ok()
                    } else {
                        None
                    }
                })
                .collect()
        })
        .unwrap_or_default();
    files.sort();
    files
}

#[tauri::command]
pub fn inspect_rigs(state: State<'_, WorkspaceState>) -> RigSummary {
    let chibi_dir = state.root.join("src").join("videos").join("chibi");
    let sprite_files = list_pngs(&chibi_dir.join("sprites"));
    let face_files = list_pngs(&chibi_dir.join("faces"));
    let fx_files = list_pngs(&chibi_dir.join("fx"));

    RigSummary {
        stickman: StickmanRigStatus {
            ready: true,
            label: "Built-in Procedural Stickman".to_string(),
        },
        chibi: ChibiRigStatus {
            ready: !sprite_files.is_empty() && !face_files.is_empty(),
            sprites: sprite_files.len(),
            faces: face_files.len(),
            fx: fx_files.len(),
            sprite_files,
            face_files,
            fx_files,
        },
    }
}
