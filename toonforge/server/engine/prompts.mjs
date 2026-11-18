/** @typedef {import('./cardMachine.mjs').JobKind} JobKind */
/** @typedef {import('./cardMachine.mjs').Card} Card */
/** @typedef {{ category: string, name: string, [k: string]: any }} Folder */
/** @typedef {{ title: string, hook: string }} Topic */

const SKILL = 'Use the cartoon short skill at ~/.claude/skills/cartoon-3d-short/SKILL.md.';

/** @param {{ category: string, count: number, source: 'real'|'made_up', exclude: string[], canSearchWeb: boolean }} o */
export function topicsPrompt({ category, count, source, exclude, canSearchWeb }) {
  const real = source === 'real';
  const how = real && canSearchWeb
    ? 'search the web for true stories with a physical cause and effect'
    : real
      ? 'Web access is unavailable, so make the stories up (made up, but with a physical cause and effect and an everyday analogy)'
      : 'Make up the stories (made up, but with a physical cause and effect)';
  const ex = exclude.length ? `\nDo not repeat these titles:\n${exclude.map((t) => `- ${t}`).join('\n')}` : '';
  return `${SKILL}
Step 1 only (topic and facts). Category: ${category}. Propose ${count} surprising, visual story ideas: ${how}.${ex}
Do not write files. Reply with only a JSON array of ${count} objects: [{"title": "...", "hook": "one-line absurd fact"}].`;
}

/** @param {Card} card @param {Folder} folder */
export function scriptPrompt(card, folder) {
  const vo = card.audio === 'vo';
  return `${SKILL}
Step 2 (script) for "${card.title}". Hook: ${card.hook}
Write shorts/${folder.category}/${folder.name}/${card.slug}/SCRIPT.md: facts with sources at the top, then the beat script, 55-70 s at about 3.7 words/s.
Put each [SFX: ...] cue on its own line.${vo ? '\nEnd with a "## Narration" section containing only the clean spoken text (no cues, no headings).' : '\nThis is a visual-only short: no narration.'}`;
}

/** @param {Card} card */
export function scenePrompt(card) {
  return `${SKILL}
Steps 4-7 (shot plan, world, characters, post) for "${card.title}" (${card.slug}).
Copy templates/bridge/ to src/videos/${card.slug}/, write the shot plan in story.ts${card.files?.words ? ` timed to ${card.files.words}` : ''}, use the ${card.rig} rig for characters, and register composition ${card.compId} in src/Root.tsx.
Do not render.`;
}

/** @param {Card} card */
export function soundPrompt(card) {
  return `${SKILL}
Step 8 (sound) for "${card.title}" (${card.slug}).
Build SFX and music from src/videos/${card.slug}/story.ts. ${card.audio === 'vo' ? 'Mix under the voice with ducking.' : 'Music only, no voice.'}
Write out/${card.slug}/mix.wav and wire it into the composition per the skill. Do not render.`;
}

/** @param {Card} card @param {JobKind} step @param {string} errorText */
export function fixPrompt(card, step, errorText) {
  return `${SKILL}
Card "${card.title}" (${card.slug}).
The engine check after ${step} failed:
${String(errorText).slice(-4000)}
Fix the files so it passes. Do not render.`;
}

/** @param {Card} card @param {string} note @param {string[]} stillPaths */
export function revisePrompt(card, note, stillPaths) {
  return `${SKILL}
Revise card "${card.title}" (${card.slug}) per this note: ${note}
Update the scene (src/videos/${card.slug}/), and the sound too if the note needs it. Do not render.
Current stills:
${stillPaths.map((p) => `- ${p}`).join('\n')}`;
}

/** @param {string} text @param {number} count @param {string[]} exclude @returns {Topic[]} */
export function parseTopics(text, count, exclude) {
  let arr = null;
  const tryParse = (c) => {
    try { const v = JSON.parse(c.trim()); if (Array.isArray(v) && v.some((x) => typeof x?.title === "string")) arr = v; } catch { /* not JSON */ }
  };
  tryParse(text);
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)?.[1];
  if (!arr && fenced) tryParse(fenced);
  // shortcut: O(n^2) scan of '[' x ']' spans, fine for agent replies; first span that parses to an array wins
  for (let i = text.indexOf('['); !arr && i !== -1; i = text.indexOf('[', i + 1)) {
    for (let j = text.indexOf(']', i); !arr && j !== -1; j = text.indexOf(']', j + 1)) tryParse(text.slice(i, j + 1));
  }
  const seen = new Set(exclude.map((e) => e.trim().toLowerCase()));
  const out = [];
  for (const it of arr ?? []) {
    const title = typeof it?.title === 'string' ? it.title.trim() : '';
    if (!title || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    out.push({ title, hook: typeof it.hook === 'string' ? it.hook.trim() : '' });
    if (out.length >= count) break;
  }
  if (!out.length) throw new Error('Agent did not return a topic list');
  return out;
}
