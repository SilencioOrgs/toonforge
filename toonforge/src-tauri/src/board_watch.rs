use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
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
    pub voice_path: Option<String>,
    pub script_file: Option<String>,
    pub mix_script: Option<String>,
    pub mix_wav_file: Option<String>,
    pub video_file: Option<String>,
    pub qa_report: Option<String>,
    pub stills: Option<Vec<String>>,
    pub loudness: Option<String>,
    pub specs: Option<String>,
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptDoc {
    pub slug: String,
    pub file: String,
    pub content: String,
    pub exists: bool,
}

fn sanitize_slug(raw: &str) -> String {
    raw.to_lowercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(24)
        .collect()
}

pub fn composition_id_from_slug(slug: &str) -> String {
    match slug.to_lowercase().as_str() {
        "dbindex" => "DbIndexShort".to_string(),
        "redis" => "RedisShort".to_string(),
        "binary" => "BinaryShort".to_string(),
        "idor" => "IdorShort".to_string(),
        "ratelimit" => "RateLimitShort".to_string(),
        "racecondition" => "RaceConditionShort".to_string(),
        "sqli" => "SqliShort".to_string(),
        "notopax" => "NoToPaxSilicaShort".to_string(),
        "paxsilica" => "PaxSilicaShort".to_string(),
        other => {
            let mut chars = other.chars();
            match chars.next() {
                None => "Short".to_string(),
                Some(first) => format!("{}{}Short", first.to_uppercase(), chars.as_str()),
            }
        }
    }
}

pub fn apply_voice_auto_queue(board: &mut BoardState, voice_files: &[String]) {
    let lower: Vec<String> = voice_files.iter().map(|f| f.to_lowercase()).collect();
    for card in &mut board.cards {
        let slug_low = card.slug.to_lowercase();
        let short_prefix = slug_low.strip_suffix("condition").unwrap_or(&slug_low);
        let p1 = format!("{}_voice.", slug_low);
        let p2 = format!("{}_voice.", short_prefix);
        if let Some(found) = lower.iter().find(|f| f.starts_with(&p1) || f.starts_with(&p2)) {
            card.voice_file = Some(found.clone());
            card.voice_path = Some(format!("voice/{}", found));
            if card.audio_mode != "no_vo" {
                card.audio_mode = "vo_ready".to_string();
            }
            if board.auto_queue && card.lane == "backlog" {
                card.lane = "queued".to_string();
            }
        }
    }
}

fn board_file(root: &Path) -> PathBuf {
    root.join(".toonforge").join("board.json")
}

fn seed_board_from_workspace(root: &Path) -> BoardState {
    let mut cards = Vec::new();
    if let Ok(entries) = fs::read_dir(root.join("src").join("videos")) {
        for entry in entries.filter_map(|e| e.ok()) {
            let slug = entry.file_name().to_string_lossy().to_string();
            if slug == "chibi" || !entry.path().is_dir() {
                continue;
            }
            let has_mp4 = fs::read_dir(root.join("out").join(&slug))
                .map(|r| r.filter_map(|e| e.ok()).any(|e| e.file_name().to_string_lossy().ends_with(".mp4")))
                .unwrap_or(false);
            let lane = if has_mp4 { "done" } else { "backlog" };
            cards.push(CardItem {
                id: slug.clone(),
                slug: slug.clone(),
                title: slug.clone(),
                lane: lane.to_string(),
                audio_mode: "needs_vo".to_string(),
                rig_mode: "chibi".to_string(),
                duration_label: if has_mp4 { "2K MP4".into() } else { "Script Ready".into() },
                composition_id: composition_id_from_slug(&slug),
                voice_file: None,
                voice_path: None,
                script_file: None,
                mix_script: None,
                mix_wav_file: None,
                video_file: None,
                qa_report: None,
                stills: None,
                loudness: None,
                specs: None,
            });
        }
    }
    let active_lane = cards.first().map(|c| c.lane.clone()).unwrap_or_else(|| "backlog".to_string());
    let selected_card_id = cards.first().map(|c| c.id.clone()).unwrap_or_default();
    BoardState {
        version: 1,
        auto_queue: true,
        active_lane,
        selected_card_id,
        cards,
    }
}

#[tauri::command]
pub fn load_board(state: State<'_, WorkspaceState>) -> Result<BoardState, String> {
    let path = board_file(&state.root);
    let mut board = if path.exists() {
        let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&raw).map_err(|e| e.to_string())?
    } else {
        let seeded = seed_board_from_workspace(&state.root);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let json = serde_json::to_string_pretty(&seeded).map_err(|e| e.to_string())?;
        fs::write(&path, json).map_err(|e| e.to_string())?;
        seeded
    };

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

#[tauri::command]
pub fn create_card(
    state: State<'_, WorkspaceState>,
    title: String,
    rig_mode: String,
    script_content: Option<String>,
) -> Result<BoardState, String> {
    let clean_title = title.trim().to_string();
    if clean_title.is_empty() {
        return Err("Card title is required".to_string());
    }
    let slug = {
        let s: String = sanitize_slug(&clean_title).chars().take(18).collect();
        if s.is_empty() { "short".to_string() } else { s }
    };
    let script_file = format!("SCRIPT_{}.md", slug.to_uppercase());
    let script_path = state.root.join(&script_file);
    let custom = script_content.unwrap_or_default().trim().to_string();
    if !custom.is_empty() {
        fs::write(&script_path, format!("{}\n", custom)).map_err(|e| e.to_string())?;
    } else if !script_path.exists() {
        let starter = format!("# {}\n\n- **Hook (0-3s):** ...\n- **Visual Story:** ...\n- **Punchline + CTA:** Follow for more!\n", clean_title);
        fs::write(&script_path, starter).map_err(|e| e.to_string())?;
    }

    let mut board = load_board(state.clone())?;
    let new_card = CardItem {
        id: slug.clone(),
        slug: slug.clone(),
        title: clean_title,
        lane: "backlog".to_string(),
        audio_mode: "needs_vo".to_string(),
        rig_mode: if rig_mode == "stickman" { "stickman".into() } else { "chibi".into() },
        duration_label: "Script Ready".to_string(),
        composition_id: composition_id_from_slug(&slug),
        voice_file: None,
        voice_path: None,
        script_file: Some(script_file),
        mix_script: None,
        mix_wav_file: None,
        video_file: None,
        qa_report: None,
        stills: None,
        loudness: None,
        specs: None,
    };
    board.cards.retain(|c| c.slug != slug);
    board.cards.insert(0, new_card);
    board.active_lane = "backlog".to_string();
    board.selected_card_id = slug;
    save_board(state, board)
}

fn find_script_filename(root: &Path, slug: &str) -> String {
    let clean = sanitize_slug(slug);
    let short_prefix = clean.strip_suffix("condition").unwrap_or(&clean);
    let exact = format!("script_{}.md", clean);
    let alt = format!("script_{}.md", short_prefix);
    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.filter_map(|e| e.ok()) {
            let name = entry.file_name().to_string_lossy().to_string();
            let low = name.to_lowercase();
            if low == exact || low == alt {
                return name;
            }
        }
    }
    format!("SCRIPT_{}.md", clean.to_uppercase())
}

#[tauri::command]
pub fn read_script(state: State<'_, WorkspaceState>, slug: String) -> Result<ScriptDoc, String> {
    let clean = sanitize_slug(&slug);
    if clean.is_empty() {
        return Err("Invalid slug".to_string());
    }
    let file = find_script_filename(&state.root, &clean);
    let target = state.root.join(&file);
    let exists = target.exists();
    let content = if exists { fs::read_to_string(&target).map_err(|e| e.to_string())? } else { String::new() };
    Ok(ScriptDoc { slug: clean, file, content, exists })
}

#[tauri::command]
pub fn write_script(
    state: State<'_, WorkspaceState>,
    slug: String,
    content: String,
) -> Result<ScriptDoc, String> {
    let clean = sanitize_slug(&slug);
    if clean.is_empty() {
        return Err("Invalid slug".to_string());
    }
    let file = find_script_filename(&state.root, &clean);
    let target = state.root.join(&file);
    fs::write(&target, &content).map_err(|e| e.to_string())?;
    Ok(ScriptDoc { slug: clean, file, content, exists: true })
}

fn decode_base64_payload(input: &str) -> Result<Vec<u8>, String> {
    let stripped = input
        .split_once(";base64,")
        .map(|(_, rest)| rest)
        .unwrap_or(input)
        .trim();
    if stripped.is_empty() {
        return Err("Audio payload cannot be empty".to_string());
    }
    let mut out = Vec::with_capacity((stripped.len() * 3) / 4);
    let mut val: u32 = 0;
    let mut valb: i32 = -8;
    for byte in stripped.bytes() {
        if byte == b'=' || byte.is_ascii_whitespace() {
            continue;
        }
        let digit = match byte {
            b'A'..=b'Z' => byte - b'A',
            b'a'..=b'z' => byte - b'a' + 26,
            b'0'..=b'9' => byte - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => return Err("Invalid base64 character in audio payload".to_string()),
        };
        val = (val << 6) | u32::from(digit);
        valb += 6;
        if valb >= 0 {
            out.push(((val >> valb) & 0xFF) as u8);
            valb -= 8;
        }
    }
    if out.is_empty() {
        return Err("Decoded audio payload is empty".to_string());
    }
    Ok(out)
}

#[tauri::command]
pub fn upload_voiceover(
    state: State<'_, WorkspaceState>,
    slug: String,
    file_name: String,
    base64_data: String,
) -> Result<BoardState, String> {
    let clean = sanitize_slug(&slug);
    if clean.is_empty() {
        return Err("Valid card slug is required".to_string());
    }
    let ext = Path::new(&file_name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();
    if ext != "wav" && ext != "mp3" {
        return Err("Voiceover file must be .wav or .mp3".to_string());
    }
    let bytes = decode_base64_payload(&base64_data)?;
    if bytes.len() > 12 * 1024 * 1024 {
        return Err("Voiceover file exceeds 12MB limit".to_string());
    }
    let voice_file = format!("{}_voice.{}", clean, ext);
    let voice_dir = state.root.join("voice");
    fs::create_dir_all(&voice_dir).map_err(|e| e.to_string())?;
    fs::write(voice_dir.join(&voice_file), bytes).map_err(|e| e.to_string())?;

    let mut board = load_board(state.clone())?;
    for card in &mut board.cards {
        if card.slug == clean {
            card.audio_mode = "vo_ready".to_string();
            card.voice_file = Some(voice_file.clone());
            card.voice_path = Some(format!("voice/{}", voice_file));
            if board.auto_queue && card.lane == "backlog" {
                card.lane = "queued".to_string();
            }
        }
    }
    if board.auto_queue {
        board.active_lane = "queued".to_string();
    }
    board.selected_card_id = clean;
    save_board(state, board)
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
            selected_card_id: "racecondition".into(),
            cards: vec![CardItem {
                id: "racecondition".into(),
                slug: "racecondition".into(),
                title: "Race Conditions".into(),
                lane: "backlog".into(),
                audio_mode: "needs_vo".into(),
                rig_mode: "chibi".into(),
                duration_label: "Script Ready".into(),
                composition_id: composition_id_from_slug("racecondition"),
                voice_file: None,
                voice_path: None,
                script_file: None,
                mix_script: None,
                mix_wav_file: None,
                video_file: None,
                qa_report: None,
                stills: None,
                loudness: None,
                specs: None,
            }],
        };
        apply_voice_auto_queue(&mut board, &["race_voice.wav".into()]);
        assert_eq!(board.cards[0].audio_mode, "vo_ready");
        assert_eq!(board.cards[0].lane, "queued");
        assert_eq!(board.cards[0].composition_id, "RaceConditionShort");
    }
}
