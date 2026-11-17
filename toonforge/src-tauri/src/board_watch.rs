use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::State;

use crate::WorkspaceState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardItem {
    pub id: String,
    pub slug: String,
    pub title: String,
    pub lane: String,
    pub audio_mode: String,
    pub rig_mode: String,
    pub duration_label: String,
    pub composition_id: String,
    pub voice_file: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardState {
    pub version: u32,
    pub auto_queue: bool,
    pub active_lane: String,
    pub selected_card_id: String,
    pub cards: Vec<CardItem>,
}

pub fn apply_voice_auto_queue(board: &mut BoardState, voice_files: &[String]) {
    if !board.auto_queue {
        return;
    }
    let lower: Vec<String> = voice_files.iter().map(|f| f.to_lowercase()).collect();
    for card in &mut board.cards {
        let prefix = format!("{}_voice.", card.slug.to_lowercase());
        if let Some(found) = lower.iter().find(|f| f.starts_with(&prefix)) {
            card.voice_file = Some(found.clone());
            if card.audio_mode != "no_vo" {
                card.audio_mode = "vo_ready".to_string();
            }
            if card.lane == "backlog" {
                card.lane = "queued".to_string();
            }
        }
    }
}

fn board_file(root: &PathBuf) -> PathBuf {
    root.join(".toonforge").join("board.json")
}

#[tauri::command]
pub fn load_board(state: State<'_, WorkspaceState>) -> Result<BoardState, String> {
    let path = board_file(&state.root);
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut board: BoardState = serde_json::from_str(&raw).map_err(|e| e.to_string())?;

    if let Ok(entries) = fs::read_dir(state.root.join("voice")) {
        let voice_files: Vec<String> = entries
            .filter_map(|e| e.ok())
            .filter_map(|e| e.file_name().into_string().ok())
            .collect();
        apply_voice_auto_queue(&mut board, &voice_files);
    }

    Ok(board)
}

#[tauri::command]
pub fn save_board(state: State<'_, WorkspaceState>, board: BoardState) -> Result<BoardState, String> {
    let path = board_file(&state.root);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&board).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(board)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auto_queues_backlog_card_when_voice_file_arrives() {
        let mut board = BoardState {
            version: 1,
            auto_queue: true,
            active_lane: "backlog".into(),
            selected_card_id: "dbindex".into(),
            cards: vec![CardItem {
                id: "dbindex".into(),
                slug: "dbindex".into(),
                title: "DbIndex".into(),
                lane: "backlog".into(),
                audio_mode: "needs_vo".into(),
                rig_mode: "chibi".into(),
                duration_label: "Script Ready".into(),
                composition_id: "DbIndexShort".into(),
                voice_file: None,
            }],
        };
        apply_voice_auto_queue(&mut board, &["dbindex_voice.wav".into()]);
        assert_eq!(board.cards[0].audio_mode, "vo_ready");
        assert_eq!(board.cards[0].lane, "queued");
    }
}
