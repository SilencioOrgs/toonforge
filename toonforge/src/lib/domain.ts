import type {
  AiProviderGuide,
  AudioMode,
  BoardState,
  CardItem,
  CliEngine,
  ContentNicheId,
  EnvProbe,
  EnvStatus,
  LaneId,
  LogoConcept,
  NichePreset,
  PipelineJobResult,
  RigMode,
  RigSummary,
  ScriptDoc,
  ScriptLanguage,
  StoryFlowStep,
  TopicIdea,
  VideoStep,
} from '../types/studio';

export type {
  AiProviderGuide,
  AudioMode,
  BoardState,
  CardItem,
  CliEngine,
  ContentNicheId,
  EnvProbe,
  EnvStatus,
  LaneId,
  LogoConcept,
  NichePreset,
  PipelineJobResult,
  RigMode,
  RigSummary,
  ScriptDoc,
  ScriptLanguage,
  StoryFlowStep,
  TopicIdea,
  VideoStep,
};

export const AI_PROVIDER_GUIDES: Record<CliEngine, AiProviderGuide> = {
  agy: {
    id: 'agy',
    title: 'Antigravity AI CLI (Built-In Default)',
    accountReq: 'Built-in with Antigravity IDE (no separate API billing needed)',
    summary: 'Runs directly inside your workspace to write SCRIPT_*.md, Remotion scenes, and Python audio mixes.',
    installCmd: 'Bundled with Antigravity IDE (agy on PATH)',
    loginCmd: 'agy',
  },
  claude: {
    id: 'claude',
    title: 'Claude Code CLI',
    accountReq: 'Requires Claude Pro / Max account or Anthropic API key',
    summary: 'Anthropic coding agent in terminal; ideal if you already subscribe to Claude Pro/Max.',
    installCmd: 'npm install -g @anthropic-ai/claude-code',
    loginCmd: 'claude (sign in via browser on first run)',
  },
  codex: {
    id: 'codex',
    title: 'OpenAI Codex CLI',
    accountReq: 'Requires ChatGPT Plus / Pro account or OPENAI_API_KEY',
    summary: 'OpenAI terminal coding agent for editing Three.js scenes, storybeats, and captions.',
    installCmd: 'npm install -g @openai/codex',
    loginCmd: 'codex --login',
  },
  opencode: {
    id: 'opencode',
    title: 'OpenCode CLI',
    accountReq: 'Open-source BYOK (works with API keys or local Ollama models)',
    summary: 'Provider-agnostic open-source coding agent supporting Anthropic, Gemini, OpenRouter, or local models.',
    installCmd: 'npm install -g opencode-ai',
    loginCmd: 'opencode auth login',
  },
};

const AUDIO_CYCLE: Record<AudioMode, AudioMode> = {
  needs_vo: 'vo_ready',
  vo_ready: 'no_vo',
  no_vo: 'needs_vo',
};

const DURATION_BY_MODE: Record<AudioMode, string> = {
  needs_vo: 'Script Ready',
  vo_ready: 'VO Ready',
  no_vo: 'Visual Only',
};

function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 18) || `short${Date.now()}`
  );
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Computes real card completion percentage purely from verified workspace artifacts. */
export function computeCardCompletionPct(card?: CardItem): number {
  if (!card) return 0;
  let score = 0;
  if (card.scriptFile) score += 25;
  if (card.voiceFile || card.audioMode === 'no_vo' || card.mixWavFile) score += 25;
  if (card.videoFile) score += 25;
  if (card.qaReport) score += 25;
  return score;
}

/** Moves a card cleanly to another Kanban lane and updates selection. */
export function moveCardToLane(board: BoardState, cardId: string, lane: LaneId): BoardState {
  return {
    ...board,
    activeLane: lane,
    selectedCardId: cardId,
    cards: board.cards.map((card) => (card.id === cardId ? { ...card, lane } : card)),
  };
}

/** Cycles a card's audio mode and auto-queues ready cards from backlog when enabled. */
export function toggleCardAudioMode(board: BoardState, cardId: string): BoardState {
  let transitionedToQueued = false;

  const cards = board.cards.map((card) => {
    if (card.id !== cardId) return card;
    const nextMode = AUDIO_CYCLE[card.audioMode];
    const shouldQueue =
      board.autoQueue && card.lane === 'backlog' && (nextMode === 'vo_ready' || nextMode === 'no_vo');
    if (shouldQueue) transitionedToQueued = true;

    return {
      ...card,
      audioMode: nextMode,
      lane: shouldQueue ? ('queued' as const) : card.lane,
      durationLabel:
        nextMode === 'vo_ready' && card.voiceFile
          ? card.durationLabel.includes('VO')
            ? card.durationLabel
            : 'VO Ready'
          : DURATION_BY_MODE[nextMode],
    };
  });

  return {
    ...board,
    activeLane: transitionedToQueued ? 'queued' : board.activeLane,
    selectedCardId: transitionedToQueued ? cardId : board.selectedCardId,
    cards,
  };
}

/** Updates backlog cards whose voiceover file matches `<slug>_voice.(wav|mp3)`. */
export function applyVoiceFilesToBoard(board: BoardState, voiceFiles: string[]): BoardState {
  const normalized = voiceFiles.map((f) => f.toLowerCase());
  const cards = board.cards.map((card) => {
    const match = normalized.find((file) => file.startsWith(`${card.slug.toLowerCase()}_voice.`));
    if (!match) return card;

    const shouldQueue = board.autoQueue && card.lane === 'backlog';
    const nextAudioMode: AudioMode = card.audioMode === 'no_vo' ? 'no_vo' : 'vo_ready';
    return {
      ...card,
      audioMode: nextAudioMode,
      voiceFile: match,
      lane: shouldQueue ? ('queued' as const) : card.lane,
      durationLabel: card.durationLabel.includes('MP4') ? card.durationLabel : 'VO Synced',
    };
  });

  return { ...board, cards };
}

/** Prepends a new script card into the Backlog lane and selects it. */
export function addCardToBoard(board: BoardState, title: string, rigMode: RigMode): BoardState {
  const cleanTitle = title.trim() || `Short ${board.cards.length + 1}`;
  const slug = slugifyTitle(cleanTitle);
  const id = `${slug}-${board.cards.length + 1}`;
  const card: CardItem = {
    id,
    slug,
    title: cleanTitle,
    lane: 'backlog',
    audioMode: 'needs_vo',
    rigMode,
    durationLabel: 'Script Draft',
    compositionId: `${slug[0].toUpperCase()}${slug.slice(1)}Short`,
  };
  return {
    ...board,
    activeLane: 'backlog',
    selectedCardId: id,
    cards: [card, ...board.cards],
  };
}

/** Assigns the selected character rig (`stickman` or `chibi`) on a card. */
export function setCardRig(board: BoardState, cardId: string, rigMode: RigMode): BoardState {
  return {
    ...board,
    cards: board.cards.map((card) => (card.id === cardId ? { ...card, rigMode } : card)),
  };
}

/** Generates an onboarding setup prompt specifically for the video creation stack. */
export function buildAiSetupPrompt(cliCmd: CliEngine, probes: EnvProbe[]): string {
  const missing = probes.filter(
    (p) => !p.installed && !['agy', 'claude', 'codex', 'opencode', 'cargo'].includes(p.id),
  );
  const missingList = missing.length > 0 ? missing.map((m) => m.id).join(', ') : 'none missing';
  return [
    `[${cliCmd} video-stack setup] Set up this repository to create 2D-in-3D vertical videos:`,
    `1. Verify required video tools: git, node (>=20 for Remotion 4), python (>=3.10 for audio DSP/QA), py_deps (numpy + pillow), ffmpeg/ffprobe, and Chromium. Missing: ${missingList}.`,
    `2. Install JS & Chromium deps: run \`npm ci\` and \`npx remotion browser ensure\`.`,
    `3. Install Python DSP & QA libs: run \`python -m pip install numpy pillow\` and confirm \`python scripts/short_qa.py --help\` works.`,
    `4. Verify \`src/Root.tsx\` typechecks (\`npm run typecheck\`) and summarize readiness to render.`,
  ].join('\n');
}

/** Generates copyable manual shell commands for setting up the video creation stack. */
export function buildManualSetupCommands(probes: EnvProbe[]): string {
  const missingFfmpeg = probes.some((p) => p.id === 'ffmpeg' && !p.installed);
  const missingPy = probes.some((p) => (p.id === 'python' || p.id === 'py_deps') && !p.installed);
  const lines = [
    '# 1. Clone your fork/repo & install Remotion + Three.js + React packages',
    'git clone <your-toonforge-repo-url> && cd <repo-dir>',
    'npm ci && npx remotion browser ensure && npm run typecheck',
    '# 2. Install Python libs for -15 LUFS audio mastering & frame QA',
    'python -m pip install numpy pillow',
  ];
  if (missingFfmpeg) lines.push('# Install FFmpeg (required by audio/dsp.py & short_qa.py): winget install Gyan.FFmpeg');
  if (missingPy) lines.push('# Install Python 3.10+ if missing: winget install Python.Python.3.12');
  lines.push('# 3. Verify video render prerequisites', 'ffmpeg -version && python scripts/short_qa.py --help');
  return lines.join('\n');
}

/** Builds a clear, step-by-step AI CLI prompt tied directly to a card's files in the repo. */
export function buildVideoStepPrompt(step: VideoStep, card: CardItem, cli: CliEngine): string {
  const s = card.slug;
  const upper = s.toUpperCase();
  if (step === 'script') {
    return `[${cli}] Draft or refine SCRIPT_${upper}.md for "${card.title}": include a 2-second hook, ${card.audioMode === 'no_vo' ? 'visual-only beat cues (No-VO)' : 'VO narration beats with [TAG] SFX cues'}, and CTA ending.`;
  }
  if (step === 'audio') {
    return card.audioMode === 'no_vo'
      ? `[${cli}] Build beat timing in audio/mix_${s}.py using audio/suno_3.wav (visual-only No-VO mode, target -15 LUFS via audio/dsp.py).`
      : `[${cli}] Scan pauses in voice/${s}_voice.wav and build audio/mix_${s}.py using audio/dsp.py (duck Suno BGM behind VO, normalize to -15 LUFS).`;
  }
  if (step === 'scene') {
    return `[${cli}] Implement 3D stage & character animation in src/videos/${s}/ using the ${card.rigMode === 'stickman' ? 'procedural Stickman rig' : 'src/videos/chibi/sprite sheet (sprites/ + faces/ + fx/)'}, register ${card.compositionId} in src/Root.tsx, and run npm run typecheck.`;
  }
  return `[${cli}] Render 2K video for ${card.compositionId} (--crf 16 --scale 1.3333333333333333) to out/${s}/${s}_2k.mp4 and verify loudness & frames with python scripts/short_qa.py.`;
}

export const SCRIPT_LANGUAGE_LABELS: Record<ScriptLanguage, string> = {
  taglish: 'Taglish',
  tagalog: 'Pure Tagalog',
  english: 'English',
};

export const NICHE_PRESETS: NichePreset[] = [
  {
    id: 'crime',
    title: 'Crime Scene & Mystery',
    tagline: 'Forensic breakdowns, cold cases, and locked-room twists with 3D evidence pins.',
    recommendedRig: 'chibi',
    top10Prompt: 'Generate Top 10 viral short crime mystery hooks with 2s suspense opener and forensic twist.',
    sampleAngle: 'Forensic timeline & twist reveal',
  },
  {
    id: 'horror',
    title: 'Night Shift & Horror',
    tagline: '3AM POV encounters, creepy CCTV logs, and folklore stories built for tense pacing.',
    recommendedRig: 'chibi',
    top10Prompt: 'Generate Top 10 terrifying 3AM urban legend and CCTV short topics with jumpscare SFX cues.',
    sampleAngle: '3AM slow-burn dread',
  },
  {
    id: 'tech',
    title: 'Tech & System Design',
    tagline: 'Backend bugs, security flaws, and scaling disasters explained with 3D props.',
    recommendedRig: 'stickman',
    top10Prompt: 'Generate Top 10 high-retention coding & architecture disaster stories for 45s 3D shorts.',
    sampleAngle: 'Production outage anatomy',
  },
  {
    id: 'custom',
    title: 'Custom Niche',
    tagline: 'Type any niche (finance, history, anime lore, health) to spin up a bespoke Top 10 bank.',
    recommendedRig: 'chibi',
    top10Prompt: 'Generate Top 10 high-retention custom topic ideas tailored to creator voice & target language.',
    sampleAngle: 'Creator-defined story arc',
  },
];

interface TopicSeed {
  title: string;
  sfxCues: [string, string, string];
  byLang: Record<ScriptLanguage, { hook: string; storyBeat: string; punchline: string }>;
}

const TOPIC_BANKS: Record<Exclude<ContentNicheId, 'custom'>, TopicSeed[]> = {
  crime: [
    {
      title: 'The Locked Apartment Keyhole Mystery',
      sfxCues: ['DOOR_LOCK_CLICK', 'CAMERA_FLASH', 'SUB_DROP'],
      byLang: {
        taglish: {
          hook: 'Locked mula sa loob ang pinto... pero nawawala ang susi sa buong crime scene.',
          storyBeat: 'Sinuspend ng forensics ang door latch — gumamit ng sinulid at magnet ang suspect bago umalis.',
          punchline: 'Isa lang ang mali niya: naiwan ang fingerprint sa tape.',
        },
        tagalog: {
          hook: 'Nakakandado mula sa loob ang silid, ngunit wala ni isang susing natagpuan.',
          storyBeat: 'Natuklasan ng imbestigador ang manipis na sinulid na ipinadaan sa ilalim ng pinto.',
          punchline: 'Ang perpektong krimen ay bumagsak dahil sa isang bakas ng daliri.',
        },
        english: {
          hook: 'The apartment was deadbolted from the inside, yet no key existed anywhere.',
          storyBeat: 'Forensics spotted micro-scratches on the latch from a looped nylon thread.',
          punchline: 'One fingerprint on the masking tape unraveled the entire alibi.',
        },
      },
    },
    {
      title: 'The 02:14 AM Elevator Glitch Alibi',
      sfxCues: ['ELEVATOR_DING', 'STATIC_GLITCH', 'GAVEL_HIT'],
      byLang: {
        taglish: {
          hook: 'Sabi ng suspect nasa 12th floor siya ng 2:14 AM — pero iba ang sinabi ng elevator log.',
          storyBeat: 'May 19-second weight spike sa basement bago nag-reboot ang CCTV.',
          punchline: 'Digital logs never lie kahit burahin mo ang video.',
        },
        tagalog: {
          hook: 'Iginiit ng suspek na nasa ikalabindalawang palapag siya nang mangyari ang krimen.',
          storyBeat: 'Ipinakita ng talaan ng elevator ang biglaang pagbagal at bigat sa silong.',
          punchline: 'Hindi maitatago ng pekeng kuha ang totoong oras sa makina.',
        },
        english: {
          hook: 'The suspect swore they never left the 12th floor, until the elevator weight sensor spoke.',
          storyBeat: 'A 19-second load spike hit the sub-basement right as CCTV looped.',
          punchline: 'Deleted footage cannot erase raw motor telemetry.',
        },
      },
    },
    {
      title: 'The Cold Coffee Cup Witness',
      sfxCues: ['GLASS_CLINK', 'THERMAL_BEEP', 'HEARTBEAT_SLOW'],
      byLang: {
        taglish: {
          hook: 'Isang basong iced coffee lang ang nagpatunay na nagsisinungaling ang witness.',
          storyBeat: 'Tunaw na lahat ng yelo pero malamig pa rin ang mesa dahil sa aircon vent.',
          punchline: 'Thermal physics ang nagturo kung anong oras talaga siya dumating.',
        },
        tagalog: {
          hook: 'Isang malamig na baso ng kape ang sumira sa buong salaysay ng saksi.',
          storyBeat: 'Sukat ng forensic team ang bilis ng pagkatunaw ng yelo laban sa temperatura ng silid.',
          punchline: 'Mas maaga nang dalawang oras ang pagdating niya kaysa sa inamin niya.',
        },
        english: {
          hook: 'A half-melted iced latte proved the sole witness arrived two hours earlier.',
          storyBeat: 'Room airflow curves exposed the exact time the cup touched the desk.',
          punchline: 'Thermal decay clocked the lie down to ten minutes.',
        },
      },
    },
    {
      title: 'The Missing Dashboard SD Card',
      sfxCues: ['CAR_CHIME', 'ZIP_PULL', 'SIREN_DISTANT'],
      byLang: {
        taglish: {
          hook: 'Tinanggal ang dashcam SD card, pero nakalimutan ang cloud buffer sa kotse.',
          storyBeat: 'Na-save ang last 30 seconds ng GPS speed at cabin mic bago pinatay ang makina.',
          punchline: 'Nahuli ang pangalan ng kasabwat sa background audio.',
        },
        tagalog: {
          hook: 'Kinuha ng salarin ang memory card ng sasakyan, ngunit nakaligtaan ang backup.',
          storyBeat: 'Naitala ng panloob na mikropono ang huling tatlumpung segundo bago tumigil ang makina.',
          punchline: 'Isang bulong sa rekording ang nagturo sa tunay na may pakana.',
        },
        english: {
          hook: 'They pulled the dashcam SD card, forgetting cars buffer the last thirty seconds in RAM.',
          storyBeat: 'Telemetry recovered hard braking plus an unmuted Bluetooth call.',
          punchline: 'The accomplice answered the phone just two seconds too soon.',
        },
      },
    },
    {
      title: 'The Inverted Clock Hand Clue',
      sfxCues: ['CLOCK_TICK', 'GLASS_SHATTER', 'DETECTIVE_CHORD'],
      byLang: {
        taglish: {
          hook: 'Bakit nakaturo sa 8:40 ang basag na wall clock kung 10:00 PM daw ang away?',
          storyBeat: 'Nahulog ang frame sa carpet pero baliktad ang baterya mula pa kanina.',
          punchline: 'Sinadya i-set ang oras para dayain ang time of death.',
        },
        tagalog: {
          hook: 'Tumigil ang basag na orasan sa alas-otso kuwarenta, malayo sa oras na iniulat.',
          storyBeat: 'Walang bakas ng pagkahulog mula sa mataas na pako sa dingding.',
          punchline: 'Inilagay lamang ang sirang orasan upang iligaw ang imbestigasyon.',
        },
        english: {
          hook: 'A shattered wall clock stopped at 8:40, yet neighbors heard silence until ten.',
          storyBeat: 'Dust patterns proved the battery was removed before the glass ever broke.',
          punchline: 'Staging the timeline was the suspect’s biggest tell.',
        },
      },
    },
    {
      title: 'The Silent Smartwatch Step Spike',
      sfxCues: ['WATCH_PING', 'HEART_PULSE', 'POLICE_RADIO'],
      byLang: {
        taglish: {
          hook: 'Sabi niya tulog na siya ng hatinggabi — pero umakyat ng 400 steps ang relo niya.',
          storyBeat: 'Nag-sync ang Bluetooth watch sa lobby router habang tumatakbo sa fire exit.',
          punchline: 'Every step counted sa korte.',
        },
        tagalog: {
          hook: 'Natutulog daw siya buong gabi, ngunit nagtala ng apat na raang hakbang ang relo niya.',
          storyBeat: 'Kumonekta ang relo sa router malapit sa hagdanang pang-emerhensya.',
          punchline: 'Ang sarili niyang pulso ang nagdiin sa kanya.',
        },
        english: {
          hook: 'He claimed he was fast asleep, yet his smartwatch logged 400 brisk steps at 1 AM.',
          storyBeat: 'The band briefly pinged the stairwell access point two floors below.',
          punchline: 'Biometrics turned an airtight alibi inside out.',
        },
      },
    },
    {
      title: 'The Reverse Footprint Trap',
      sfxCues: ['BOOT_THUD', 'DUST_SWEEP', 'DRAMATIC_HIT'],
      byLang: {
        taglish: {
          hook: 'May putik palabas ng bodega — pero wala ni isang bakas papasok.',
          storyBeat: 'Naglakad nang paatras ang suspect suot ang mas malaking sapatos.',
          punchline: 'Heel depth ang nagbuking: sobrang lalim ng sakong sa maling direksyon.',
        },
        tagalog: {
          hook: 'Puro bakas ng sapatos na palabas ang nakita sa maalikabok na sahig.',
          storyBeat: 'Sinubukang maglakad nang paurong ang magnanakaw upang linlangin ang guwardiya.',
          punchline: 'Ang lalim ng takong sa alikabok ang nagbunyag ng baliktad na paghakbang.',
        },
        english: {
          hook: 'Muddy boot prints led out of the vault with zero tracks coming in.',
          storyBeat: 'Someone walked backward in oversized boots to fake an exit trail.',
          punchline: 'Heel-strike weight distribution betrayed which way they actually faced.',
        },
      },
    },
    {
      title: 'The Borrowed Wifi Printer Leak',
      sfxCues: ['PRINTER_WHIRR', 'PAPER_SLIDE', 'BASS_IMPACT'],
      byLang: {
        taglish: {
          hook: 'Ransom note na naka-print sa plain paper — zero fingerprints, pero nahuli pa rin.',
          storyBeat: 'May microscopic yellow tracking dots ang bawat laser printer sa mundo.',
          punchline: 'Binigay ng micro-dots ang exact serial number at oras ng print.',
        },
        tagalog: {
          hook: 'Walang sulat-kamay o bakas ng daliri sa liham ng pananakot, ngunit natunton agad.',
          storyBeat: 'Nag-iiwan ng maliliit na dilaw na tuldok ang mga laser printer sa bawat papel.',
          punchline: 'Itinuro ng nakatagong koda ang eksaktong makinang ginamit sa opisina.',
        },
        english: {
          hook: 'The printed extortion letter held zero DNA, yet police traced the exact desk in hours.',
          storyBeat: 'Microscopic yellow machine identification dots encoded serial and timestamp.',
          punchline: 'You cannot wipe watermarks baked into laser drums.',
        },
      },
    },
    {
      title: 'The Dry Umbrella Rain Contradiction',
      sfxCues: ['RAIN_LOOP', 'THUNDER_RUMBLE', 'CASE_STAMP'],
      byLang: {
        taglish: {
          hook: 'Malakas ang ulan sa labas nang dumating daw siya — pero tuyo ang ilalim ng payong.',
          storyBeat: 'Nakatago siya sa loob ng building simula pa noong alas-singko.',
          punchline: 'Ang tuyong sahig sa hallway ang nagsabi ng totoo.',
        },
        tagalog: {
          hook: 'Bumubuhos daw ang ulan nang pumasok siya, ngunit tuyong-tuyo ang kanyang payong.',
          storyBeat: 'Hindi siya kailanman lumabas ng gusali mula pa noong hapon.',
          punchline: 'Isang maliit na detalye sa panahon ang bumutas sa kuwento.',
        },
        english: {
          hook: 'A storm raged outside all evening, yet her folded umbrella showed zero dampness.',
          storyBeat: 'Storm radar proved the downpour started twenty minutes before her arrival claim.',
          punchline: 'She had never left the building since five o’clock.',
        },
      },
    },
    {
      title: 'The Duplicate Garage Clicker Signal',
      sfxCues: ['RF_BEEP', 'GATE_CREAK', 'LOCK_SNAP'],
      byLang: {
        taglish: {
          hook: 'Walang forced entry sa mansion, pero nawala lahat ng vault files.',
          storyBeat: 'Ni-replay ng RF scanner ang rolling code ng garage remote mula sa kalsada.',
          punchline: 'Hindi sa loob ang salarin — nakatago lang sa van sa tapat.',
        },
        tagalog: {
          hook: 'Walang sirang kandado o bintana, ngunit nilimas ang mga dokumento sa loob.',
          storyBeat: 'Nasagap ng isang radio scanner ang huling senyas ng lumang susi ng garahe.',
          punchline: 'Isang lumang aparato sa labas ang nagbukas ng buong tahanan.',
        },
        english: {
          hook: 'Zero broken locks inside the estate, yet sensitive vault files vanished overnight.',
          storyBeat: 'Attackers captured two garage remote packets to clone a weak rolling code.',
          punchline: 'The break-in started from a parked hatchback across the street.',
        },
      },
    },
  ],
  horror: [
    {
      title: 'The 13th Floor Service Bell at 3:11 AM',
      sfxCues: ['BELL_CHIME', 'LOW_DRONE', 'BREATH_GASP'],
      byLang: {
        taglish: {
          hook: 'Alas-tres ng madaling araw nang tumunog ang service bell sa floor na matagal nang sarado.',
          storyBeat: 'Walang tao sa hallway sa CCTV — pero gumalaw ang shadow papunta sa guard desk.',
          punchline: 'Pagbukas ng logbook, pangalan ng night guard ang nakasulat sa dulo.',
        },
        tagalog: {
          hook: 'Tumunog ang lumang kampana sa ikalabintatlong palapag na sarado na nang dalawampung taon.',
          storyBeat: 'Walang makita sa kamera, ngunit bumaba ang elevator nang kusa.',
          punchline: 'May bumulong sa intercom ng eksaktong bilang ng hakbang niya.',
        },
        english: {
          hook: 'At 3:11 AM, the service bell rang from a floor sealed off twenty years ago.',
          storyBeat: 'CCTV stayed empty while the elevator car stalled inches shy of the lobby.',
          punchline: 'A cold handprint appeared inside the glass before the lights cut.',
        },
      },
    },
    {
      title: 'The Baby Monitor Second Voice',
      sfxCues: ['STATIC_HISS', 'WOOD_CREAK', 'VIOLIN_SCREECH'],
      byLang: {
        taglish: {
          hook: 'Akala niya lullaby galing sa kabilang kwarto — hanggang sa sumagot ang monitor.',
          storyBeat: 'May pangalawang boses na nagbibilang sa ilalim ng crib sa live feed.',
          punchline: 'Offline pala ang mic ng sarili nilang device.',
        },
        tagalog: {
          hook: 'Akala ng ina ay ingay lamang ng hangin ang naririnig sa baby monitor.',
          storyBeat: 'Isang malalim na tinig ang marahang bumulong ng pangalan ng bata.',
          punchline: 'Matagal nang nakapatay ang baterya ng monitor nang muli niya itong tingnan.',
        },
        english: {
          hook: 'She thought the static was wind until a second voice began humming inside the nursery.',
          storyBeat: 'Someone tapped the camera lens gently from behind the curtain.',
          punchline: 'The hallway door had been deadbolted from the inside all night.',
        },
      },
    },
    {
      title: 'The Mirror Reflection Half-Second Delay',
      sfxCues: ['GLASS_HUM', 'HEART_THUMP', 'METAL_SCRAPE'],
      byLang: {
        taglish: {
          hook: 'Kumukurap ka na... pero hindi pa kumukurap ang repleksyon mo sa salamin.',
          storyBeat: 'Half a second na huli gumalaw ang kanang kamay habang naghihilamos.',
          punchline: 'Biglang ngumiti ang repleksyon kahit nakasara ang bibig mo.',
        },
        tagalog: {
          hook: 'Napansin niyang nahuhuli nang kalahating segundo ang kanyang anino sa salamin.',
          storyBeat: 'Nang tumalikod siya upang lumabas, nanatiling nakatingin ang repleksyon.',
          punchline: 'Kumakatok na ito mula sa loob ng malamig na salamin.',
        },
        english: {
          hook: 'He blinked first, yet his reflection inside the bathroom mirror waited half a second.',
          storyBeat: 'When he stepped away from the sink, the reflection leaned closer instead.',
          punchline: 'Fingerprints fogged the glass from the inside.',
        },
      },
    },
    {
      title: 'The Last Jeepney Passenger Who Paid in Old Coins',
      sfxCues: ['COIN_DROP', 'ENGINE_STALL', 'WIND_HOWL'],
      byLang: {
        taglish: {
          hook: 'Nag-abot siya ng lumang 1978 coin sa jeep — sabay sabi: "Para po sa kanto ng sementeryo."',
          storyBeat: 'Paglingon ng driver sa rearview mirror, wala ni isang pasahero sa likod.',
          punchline: 'Pagbaba ng driver, malamig pa ang baryang hawak niya.',
        },
        tagalog: {
          hook: 'Iniabot ng huling pasahero ang lumang baryang kupas bago bumaba sa madilim na kanto.',
          storyBeat: 'Nang lingunin ng tsuper ang salamin, matagal na palang walang sakay sa likuran.',
          punchline: 'Nang tamaan ng ilaw ang barya, balot ito ng tuyong lupa.',
        },
        english: {
          hook: 'The final midnight rider paid with an oxidized coin dated forty years earlier.',
          storyBeat: 'Two blocks later the driver glanced up and found every bench empty.',
          punchline: 'Damp grave soil dusted the coin still resting in his palm.',
        },
      },
    },
    {
      title: 'The Attic Blueprint Extra Room',
      sfxCues: ['FLOOR_CREAK', 'PAPER_TEAR', 'DOOR_SLAM'],
      byLang: {
        taglish: {
          hook: 'Apat lang ang kwarto ng lumang bahay — pero lima ang naka-drawing sa 1954 blueprint.',
          storyBeat: 'Walang pinto sa gitnang pader, pero may malamig na hangin sa likod ng wallpaper.',
          punchline: 'Pagbakbak ng kahoy, may mesa at bagong tasang mainit pa.',
        },
        tagalog: {
          hook: 'Apat lamang ang silid ng bahay, ngunit lima ang nakaguhit sa lumang plano ng arkitekto.',
          storyBeat: 'Natagpuan nila ang nakatagong espasyo sa pagitan ng aparador at pader.',
          punchline: 'May sariwang bakas ng paa sa alikabok na kakadaan lamang kanina.',
        },
        english: {
          hook: 'Four bedrooms upstairs, yet the original blueprint clearly drafted a fifth locked room.',
          storyBeat: 'Prying open the drywall revealed an unvented narrow corridor.',
          punchline: 'A warm thermos sat beside a chair facing the bedroom wall.',
        },
      },
    },
    {
      title: 'The Highway GPS Reroute at Midnight',
      sfxCues: ['GPS_CHIME', 'GRAVEL_CRUNCH', 'RADIO_STATIC'],
      byLang: {
        taglish: {
          hook: 'Biglang sinabi ng GPS: "Turn left in 50 meters" — papunta sa gitna ng talahiban.',
          storyBeat: 'Namamatay ang signal ng phone pero tuloy pa rin ang boses na nag-uutos.',
          punchline: 'Pag-ilaw ng headlights, nakaharang ang lumang signage na "Dead End 1998."',
        },
        tagalog: {
          hook: 'Iniliko sila ng mapa sa isang makipot na daang wala na sa kasalukuyang kalsada.',
          storyBeat: 'Biglang namatay ang ilaw ng sasakyan habang papalapit sa lumang tulay.',
          punchline: 'May nakatayong anino sa dulo ng tulay na matagal nang gumuho.',
        },
        english: {
          hook: 'The navigation app insisted on an unpaved shortcut erased from county maps decades ago.',
          storyBeat: 'Signal dropped to zero while the synthesized voice kept whispering turn now.',
          punchline: 'Headlights caught rusted bridge pilings ending over black water.',
        },
      },
    },
    {
      title: 'The Hospital Ward Call Light #4',
      sfxCues: ['NURSE_BEEP', 'FLUORESCENT_HUM', 'FOOTSTEPS_RUN'],
      byLang: {
        taglish: {
          hook: 'Laging umiilaw ang Bed #4 tuwing 2:00 AM kahit bakante ang kwarto buong buwan.',
          storyBeat: 'Tinanggal na ng technician ang call button cord — pero umilaw ulit sa nurse station.',
          punchline: 'Nang silipin ang silid, nakatiklop ang kumot na parang may kakaupo lang.',
        },
        tagalog: {
          hook: 'Gabi-gabing umiilaw ang pindutan ng ikaapat na kama kahit walang pasyente roon.',
          storyBeat: 'Pinutol na ang kawad ng pindutan ngunit patuloy pa rin ang tunog sa istasyon.',
          punchline: 'May nakabakas na malamig na kamay sa bagong palit na kumot.',
        },
        english: {
          hook: 'Call button #4 buzzed at 2 AM nightly inside an empty wing under renovation.',
          storyBeat: 'Maintenance unplugged the wall jack entirely, yet the desk chime rang again.',
          punchline: 'Fresh indentation marks pressed deep into the stripped mattress.',
        },
      },
    },
    {
      title: 'The Cassette Tape Recorded Backwards',
      sfxCues: ['TAPE_CLICK', 'REWIND_SCREAM', 'THUD_FINAL'],
      byLang: {
        taglish: {
          hook: 'May lumang cassette sa ukay-ukay — puro static lang hanggang sa ni-reverse nila.',
          storyBeat: 'Nandoon ang boses ng nagbebenta na nagbibilang kung ilang minuto bago ka umuwi.',
          punchline: 'Naka-play pa ang tape... pero nasa labas na ng bintana ang ingay.',
        },
        tagalog: {
          hook: 'Isang lumang tape ang nabili sa bangketa na puro ugong lamang ang laman.',
          storyBeat: 'Nang baligtarin ang rekording, malinaw na binabanggit ang address ng kanyang bahay.',
          punchline: 'Tumigil ang tape kasabay ng marahang katok sa kanilang tarangkahan.',
        },
        english: {
          hook: 'A blank thrift-store cassette hissed softly until they played side B backward.',
          storyBeat: 'A calm voice described their living room furniture color by color.',
          punchline: 'The final sentence ended with their front porch motion light clicking on.',
        },
      },
    },
    {
      title: 'The Ring Doorbell Neighbor Knock',
      sfxCues: ['DOORBELL_CHIME', 'PHONE_VIBRATE', 'SHADOW_SWOOSH'],
      byLang: {
        taglish: {
          hook: 'Nag-alert ang doorbell cam ng 1:40 AM — kumatok ang kapitbahay na matagal nang lumipat.',
          storyBeat: 'Walang tunog sa pinto, pero kita sa infrared na nakatingala siya sa camera.',
          punchline: 'May hawak siyang susi na kapareho ng spare key mo.',
        },
        tagalog: {
          hook: 'Nagtala ang kamera sa pinto ng pagkatok mula sa kapitbahay na lumisan noong nakaraang taon.',
          storyBeat: 'Nakatingin lamang ito nang diretso sa lente nang hindi kumukurap.',
          punchline: 'Nakaturo siya sa nakabukas na bintana sa ikalawang palapag.',
        },
        english: {
          hook: 'Motion alerts fired at 1:40 AM showing a former tenant standing inches from the lens.',
          storyBeat: 'No footsteps sounded on the porch gravel before or after the frame.',
          punchline: 'He slowly held up an exact copy of their spare brass house key.',
        },
      },
    },
    {
      title: 'The Basement Dehumidifier Voice Loop',
      sfxCues: ['FAN_DRONE', 'WATER_DRIP', 'SUB_DROP'],
      byLang: {
        taglish: {
          hook: 'Akala nila umuugong lang ang lumang fan sa basement tuwing gabi.',
          storyBeat: 'Pagpatay ng breaker, tuloy pa rin ang rhythm ng ugong sa ilalim ng hagdan.',
          punchline: 'Hindi makina ang humihinga doon.',
        },
        tagalog: {
          hook: 'Matagal nilang inakala na ugong lamang ng makina ang naririnig sa ilalim ng bahay.',
          storyBeat: 'Nang patayin ang kuryente sa buong bahay, lalong lumakas ang mabigat na paghinga.',
          punchline: 'May sumisilip mula sa maliit na siwang ng sahig na kahoy.',
        },
        english: {
          hook: 'They blamed the nightly basement drone on an aging dehumidifier coil.',
          storyBeat: 'Cutting the main breaker plunged the house silent except beneath the stairs.',
          punchline: 'A rhythmic wheezing answered back from inside the crawlspace.',
        },
      },
    },
  ],
  tech: [
    {
      title: 'Race Condition That Sold 100 Tickets for 1 Seat',
      sfxCues: ['CASH_DING', 'ALARM_BEEP', 'KEYBOARD_SMASH'],
      byLang: {
        taglish: {
          hook: 'Dalawang users ang sabay nag-checkout — parehong nakakuha ng iisang VIP seat.',
          storyBeat: 'Nagsabay ang SELECT balance bago nakapag-UPDATE kaya parehong pumasa ang check.',
          punchline: 'One database transaction lock saves millions in chargebacks.',
        },
        tagalog: {
          hook: 'Dalawang mamimili ang sabay nagbayad para sa iisang upuan at parehong naaprubahan.',
          storyBeat: 'Sabay na binasa ng server ang natitirang bilang bago ito mabawasan sa sistema.',
          punchline: 'Isang atomic database lock ang pumipigil sa ganitong sakuna.',
        },
        english: {
          hook: 'Two shoppers clicked pay at the exact millisecond and both claimed seat 1A.',
          storyBeat: 'Both requests read available=1 before either transaction wrote back zero.',
          punchline: 'Atomic row locks turn race chaos into clean queues.',
        },
      },
    },
    {
      title: 'The Missing WHERE Clause That Wiped Prod',
      sfxCues: ['TYPING_FAST', 'ALERT_SIREN', 'FAN_SPINUP'],
      byLang: {
        taglish: {
          hook: 'Isang maling ENTER sa terminal at nawala ang lahat ng customer rows sa production.',
          storyBeat: 'Nakahiwalay ang DELETE line sa WHERE filter kaya buong table ang binura.',
          punchline: 'Always test in BEGIN TRANSACTION bago pindutin ang commit.',
        },
        tagalog: {
          hook: 'Isang kulang na salita sa utos ang bumura sa buong talaan ng mga gumagamit.',
          storyBeat: 'Naisama ang utos na magbura nang hindi nasama ang kondisyon sa dulo.',
          punchline: 'Laging gumamit ng backup at transaksyon bago magbago ng datos.',
        },
        english: {
          hook: 'One hurried SQL highlight skipped the WHERE clause and emptied every row in prod.',
          storyBeat: 'Running autocommit left zero undo button between confirm and disaster.',
          punchline: 'Read-only replicas plus point-in-time snapshots keep engineers employed.',
        },
      },
    },
    {
      title: 'How One Missing Database Index Crashed Black Friday',
      sfxCues: ['CLOCK_TICK', 'CPU_OVERLOAD', 'POWER_DOWN'],
      byLang: {
        taglish: {
          hook: 'Gumagana ang query sa laptop mo — pero nag-100% CPU pag-100k users.',
          storyBeat: 'Full table scan ang ginagawa kada search dahil walang B-Tree index.',
          punchline: 'Isang CREATE INDEX line at bumagsak ang latency mula 4s papuntang 2ms.',
        },
        tagalog: {
          hook: 'Mabilis ang sistema sa maliit na datos, ngunit bumagsak nang dumami ang gumagamit.',
          storyBeat: 'Binabasa ng database ang bawat linya isa-isa dahil walang nakakabit na index.',
          punchline: 'Isang linya ng index ang nagpababa ng paghihintay tungo sa dalawang millisecond.',
        },
        english: {
          hook: 'Your API flies locally on fifty rows, then melts at 100k shoppers on launch day.',
          storyBeat: 'Without a B-tree index every lookup scans the entire table from top to bottom.',
          punchline: 'One indexed column drops p99 latency from four seconds to two milliseconds.',
        },
      },
    },
    {
      title: 'IDOR Bug: Changing User ID in the URL',
      sfxCues: ['URL_TYPE', 'LOCK_BREAK', 'ACCESS_BEEP'],
      byLang: {
        taglish: {
          hook: 'Palitan mo lang ang `/invoice/102` ng `/103` at kita mo na ang resibo ng iba.',
          storyBeat: 'Chineck ang login token pero hindi chineck kung siya ba talaga ang owner.',
          punchline: 'Always enforce ownership check sa backend, hindi sa UI lang.',
        },
        tagalog: {
          hook: 'Sa pagpapalit lamang ng numero sa link, nabuksan niya ang pribadong datos ng iba.',
          storyBeat: 'Nakalimutan ng server suriin kung pag-aari nga ng humihingi ang rekord.',
          punchline: 'Ang tunay na seguridad ay laging may beripikasyon ng may-ari.',
        },
        english: {
          hook: 'Swap `/receipt/104` to `105` in the browser bar and someone else’s private PDF appears.',
          storyBeat: 'The endpoint verified login identity but skipped checking record ownership.',
          punchline: 'Authorization always belongs beside every database read.',
        },
      },
    },
    {
      title: 'Why Redis Responds in Sub-Millisecond Speed',
      sfxCues: ['RAM_SPARK', 'BOLT_ZAP', 'SUCCESS_CHIME'],
      byLang: {
        taglish: {
          hook: 'Bakit 50x mas mabilis ang Redis kaysa regular disk database?',
          storyBeat: 'Nasa RAM nakatira ang hot data imbes na magbasa ng mabagal na SSD blocks.',
          punchline: 'Single-threaded event loop kaya zero lock contention.',
        },
        tagalog: {
          hook: 'Bakit nakakasagot ang Redis nang mas mabilis sa isang kisapmata?',
          storyBeat: 'Direktang nakalagay sa RAM ang aktibong datos kaya walang bagal sa pagbasa ng disk.',
          punchline: 'Isang mabilis na daloy ang humahawak sa bawat hiling nang walang paghihintay.',
        },
        english: {
          hook: 'Why does Redis reply in under one millisecond while disk queries still warm up?',
          storyBeat: 'Hot structures sit straight in memory without waiting on storage seeks.',
          punchline: 'Pair Redis caching with TTLs for effortless read scaling.',
        },
      },
    },
    {
      title: 'Rate Limiter Mistake That Blocked Real Customers',
      sfxCues: ['GATE_BUZZ', 'TRAFFIC_SPIKE', 'RELIEF_CHIME'],
      byLang: {
        taglish: {
          hook: 'Nag-deploy ng anti-bot rate limiter — pero buong opisina ng client ang na-ban.',
          storyBeat: 'Naka-limit by IP lang kaya lahat ng nasa behind NAT router na-429.',
          punchline: 'Mix token bucket per API key plus user ID para safe ang legitimate traffic.',
        },
        tagalog: {
          hook: 'Naglagay sila ng proteksyon laban sa bot, ngunit pati totoong mamimili ay naharang.',
          storyBeat: 'Pinagsama-sama ang maraming tao sa iisang IP ng opisina kaya mabilis naubos ang limitasyon.',
          punchline: 'Mas mainam ang token bucket bawat account kaysa bulag na pagharang sa IP.',
        },
        english: {
          hook: 'One strict IP rate limit locked out an entire corporate customer behind office NAT.',
          storyBeat: 'Hundreds of legitimate browsers shared one gateway IP counter.',
          punchline: 'Key token buckets by session plus tenant instead of raw IP alone.',
        },
      },
    },
    {
      title: 'SQL Injection From One Unescaped Search Box',
      sfxCues: ['KEY_CLICK', 'VAULT_OPEN', 'ALERT_BEEP'],
      byLang: {
        taglish: {
          hook: 'Tinype niya lang ang `OR 1=1` sa search bar at lumabas buong user directory.',
          storyBeat: 'Direct string concatenation ang SQL query imbes na parameterized placeholders.',
          punchline: 'Never trust raw user strings inside SQL.',
        },
        tagalog: {
          hook: 'Isang kakaibang teksto sa search bar ang naglabas ng lahat ng nakatagong talaan.',
          storyBeat: 'Direktang idinikit ang input ng user sa loob ng mismong utos sa database.',
          punchline: 'Ang parameterized query ang pader laban sa panlilinlang ng code.',
        },
        english: {
          hook: 'Typing one single quote turned a harmless login search box into full table dump access.',
          storyBeat: 'Raw string concatenation let user text rewrite the query logic itself.',
          punchline: 'Parameterized statements keep user input strictly as data.',
        },
      },
    },
    {
      title: 'Binary Numbers Explained in 40 Seconds',
      sfxCues: ['SWITCH_FLIP', 'BIT_CHIME', 'DONE_SPARK'],
      byLang: {
        taglish: {
          hook: 'Paano nakakabasa ng 4K video at AI ang computer gamit lang ang 0 at 1?',
          storyBeat: 'Parang row ng light switches na naka-ON o OFF — bawat bit nagdo-double ng value.',
          punchline: 'Walong switches lang, may buong letra o kulay ka na.',
        },
        tagalog: {
          hook: 'Paano nakakagawa ng buong laro at video ang computer mula lamang sa zero at one?',
          storyBeat: 'Bawat bit ay parang maliit na ilaw na bukas o sarado sa loob ng chip.',
          punchline: 'Pinagsasama ang mga ilaw na ito upang bumuo ng bilang, kulay, at tunog.',
        },
        english: {
          hook: 'How do billions of microscopic light switches turn 0s and 1s into 3D animation?',
          storyBeat: 'Each bit doubles in weight just like switches labeled 1, 2, 4, and 8.',
          punchline: 'Stack eight bits together and any color or character clicks into focus.',
        },
      },
    },
    {
      title: 'The Memory Leak Hidden Inside an Infinite Listener',
      sfxCues: ['RAM_FILL', 'GLASS_CRACK', 'REBOOT_BEEP'],
      byLang: {
        taglish: {
          hook: 'Smooth pa ang app sa unang oras — pero nag-freeze after 20 clicks.',
          storyBeat: 'Nagdadagdag ng bagong event listener kada render nang walang cleanup return.',
          punchline: 'Always detach listeners sa unmount para hindi umapaw ang heap.',
        },
        tagalog: {
          hook: 'Mabilis ang app sa simula, ngunit unti-unting bumabagal habang ginagamit nang matagal.',
          storyBeat: 'Nag-iiwan ng hindi nabuburang nakikinig na code tuwing nagpapalit ng screen.',
          punchline: 'Siguraduhing malinis na natatanggal ang mga listener pagkatapos gamitin.',
        },
        english: {
          hook: 'The dashboard feels silky at 9 AM, then grinds to a halt before lunch.',
          storyBeat: 'Each modal open attached another window listener without cleaning up the last one.',
          punchline: 'Deterministic teardown keeps long-running apps fast.',
        },
      },
    },
    {
      title: 'Why Caching Bad Errors Ruins Recovery',
      sfxCues: ['CACHE_HIT', 'ERROR_BEEP', 'CLEAR_SWISH'],
      byLang: {
        taglish: {
          hook: 'Naayos na ang database bug — pero sira pa rin ang website para sa kalahati ng users.',
          storyBeat: 'Na-cache ng CDN ang `500 error` page nang limang minuto.',
          punchline: 'Never cache error responses sa edge proxy.',
        },
        tagalog: {
          hook: 'Naayos na ang serbisyo, ngunit sira pa rin ang lumalabas sa screen ng mga bumibisita.',
          storyBeat: 'Naitago ng cache ang maling sagot kaya paulit-ulit itong ipinapakita.',
          punchline: 'Tanging matagumpay na tugon lamang ang dapat itago sa mabilisang imbakan.',
        },
        english: {
          hook: 'You patched the outage in three minutes, yet customers still saw downtime for an hour.',
          storyBeat: 'Your edge CDN eagerly cached the 502 error response alongside normal pages.',
          punchline: 'Verify Cache-Control skips non-200 error codes everywhere.',
        },
      },
    },
  ],
};

function buildCustomTopicSeed(customSubject: string, index: number): TopicSeed {
  const clean = customSubject.trim() || 'Viral Hidden Truth';
  const angles = [
    `The #1 Myth About ${clean}`,
    `Why 90% Fail at ${clean}`,
    `Secret History Behind ${clean}`,
    `The 3-Second Mistake in ${clean}`,
    `Inside the Dark Side of ${clean}`,
    `What Experts Hide About ${clean}`,
    `How ${clean} Changed Overnight`,
    `Before vs After ${clean} Exposed`,
    `The Tiny Detail Everyone Misses in ${clean}`,
    `Future Shock: ${clean} in 2030`,
  ];
  const title = angles[index % angles.length];
  return {
    title,
    sfxCues: ['WHOOSH_IN', 'REVEAL_CHIME', 'OUTRO_THUD'],
    byLang: {
      taglish: {
        hook: `Akala mo alam mo na ang tungkol sa ${clean}? Ito ang hindi sinasabi sa'yo.`,
        storyBeat: `Sa mabilis na 3D breakdown, makikita ang ugat ng "${title}" step-by-step.`,
        punchline: `Save mo 'to at i-comment kung alin sa ${clean} ang next part!`,
      },
      tagalog: {
        hook: `Akala ng karamihan alam na nila ang buong kuwento ng ${clean}, ngunit may nakatago pa.`,
        storyBeat: `Suriin natin nang malapitan sa 3D ang totoong pangyayari sa "${title}".`,
        punchline: `Ibahagi ito upang malaman ng iba ang buong katotohanan.`,
      },
      english: {
        hook: `Think you know the real story behind ${clean}? Here is the detail almost everyone misses.`,
        storyBeat: `Break down "${title}" frame by frame on our 3D toon stage.`,
        punchline: `Follow and drop your pick for episode two in the comments.`,
      },
    },
  };
}

/**
 * Returns 10 localized short-video topic cards for the selected niche and target language.
 */
export function getTop10TopicsForNiche(
  niche: ContentNicheId,
  customTopic: string,
  language: ScriptLanguage,
): TopicIdea[] {
  const seeds =
    niche === 'custom'
      ? Array.from({ length: 10 }, (_, idx) => buildCustomTopicSeed(customTopic, idx))
      : TOPIC_BANKS[niche];

  return seeds.map((seed, idx) => {
    const localized = seed.byLang[language];
    return {
      rank: idx + 1,
      title: seed.title,
      hook: localized.hook,
      storyBeat: localized.storyBeat,
      punchline: localized.punchline,
      sfxCues: [...seed.sfxCues],
      niche,
    };
  });
}

/**
 * Generates ready-to-save markdown SCRIPT_*.md content with [SFX: ...] cues and character rig notes.
 */
export function generateScriptFromTopic(
  topic: TopicIdea,
  language: ScriptLanguage,
  rigMode: RigMode,
): string {
  const langLabel = SCRIPT_LANGUAGE_LABELS[language];
  const rigLabel = rigMode === 'stickman' ? 'Stickman 3D Procedural Rig' : 'Chibi Illustrated Sprite Rig';
  const [sfx1, sfx2, sfx3] = topic.sfxCues;

  return [
    `# ${topic.title}`,
    `Language: ${langLabel} | Character Rig: ${rigLabel} | Niche: ${topic.niche.toUpperCase()}`,
    '',
    `[SFX: ${sfx1 || 'WHOOSH_IN'}]`,
    `Hook (0-3s): ${topic.hook}`,
    '',
    `[SFX: ${sfx2 || 'REVEAL_CHIME'}]`,
    `Scene Breakdown (4-32s): ${topic.storyBeat}`,
    '',
    `[SFX: ${sfx3 || 'OUTRO_THUD'}]`,
    `Punchline & CTA (33-45s): ${topic.punchline}`,
    '',
  ].join('\n');
}

/**
 * Strips [SFX: ...] tags, markdown headers/markers, and metadata headers to produce
 * clean ElevenLabs-ready spoken narration text.
 */
export function stripSfxTagsForVoiceover(scriptMarkdown: string): string {
  return scriptMarkdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith('#') && !line.startsWith('Language:'))
    .filter((line) => !/^\[SFX:[^\]]*\]$/i.test(line))
    .map((line) =>
      line
        .replace(/\[SFX:[^\]]*\]/gi, '')
        .replace(/^(Hook|Scene Breakdown|Punchline\s*&\s*CTA)\s*\([^)]*\)\s*:\s*/i, '')
        .replace(/^[-*]\s+/, '')
        .replace(/[*_`]/g, '')
        .trim(),
    )
    .filter((line) => line.length > 0)
    .join('\n\n');
}
