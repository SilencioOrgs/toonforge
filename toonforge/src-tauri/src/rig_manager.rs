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
pub struct ChibiRigStatus {
    pub ready: bool,
    pub sprites: usize,
    pub faces: usize,
    pub fx: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct RigSummary {
    pub stickman: StickmanRigStatus,
    pub chibi: ChibiRigStatus,
}

fn count_pngs(dir: &Path) -> usize {
    fs::read_dir(dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    e.path()
                        .extension()
                        .and_then(|ext| ext.to_str())
                        .map(|ext| ext.eq_ignore_ascii_case("png"))
                        .unwrap_or(false)
                })
                .count()
        })
        .unwrap_or(0)
}

#[tauri::command]
pub fn inspect_rigs(state: State<'_, WorkspaceState>) -> RigSummary {
    let chibi_dir = state.root.join("src").join("videos").join("chibi");
    let sprites = count_pngs(&chibi_dir.join("sprites"));
    let faces = count_pngs(&chibi_dir.join("faces"));
    let fx = count_pngs(&chibi_dir.join("fx"));

    RigSummary {
        stickman: StickmanRigStatus {
            ready: true,
            label: "Built-in Procedural Stickman".to_string(),
        },
        chibi: ChibiRigStatus {
            ready: sprites > 0 && faces > 0,
            sprites,
            faces,
            fx,
        },
    }
}
