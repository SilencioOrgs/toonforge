import { randomBytes } from 'node:crypto';
import { ValidationError } from '../services/workspaceService.mjs';

/** @typedef {'topics'|'script'|'words'|'scene'|'sound'|'preview'|'render'} JobKind */
/** @typedef {{ id: string, state: string, audio: string, files: Record<string, any>, [k: string]: any }} Card */

const conflict = (msg) => new ValidationError(msg, 409);
const RUNNING = ['script', 'scene', 'sound', 'preview', 'render'];

/** @param {{ title: string, hook: string, audio: 'vo'|'visual', rig: 'chibi'|'stickman', slug: string, compId: string }} p @returns {Card} */
export function newCard({ title, hook, audio, rig, slug, compId }) {
  return {
    id: `c_${randomBytes(4).toString('hex')}`,
    slug, compId, title, hook, audio, rig,
    state: 'script',
    imported: false,
    warnings: [],
    failedStep: null,
    error: null,
    files: { script: null, voice: null, words: null, scene: null, mix: null, previews: [], stills: [], final: null, qa: null },
    notes: [],
    history: [],
  };
}

// The job the card's state calls for, ignoring the imported gate.
function jobFor(card) {
  if (RUNNING.includes(card.state)) return card.state;
  if (card.state === 'voice' && card.files.voice && !card.files.words) return 'words';
  return null;
}

/** @param {Card} card @returns {JobKind|null} */
export function nextJob(card) {
  return card.imported && !card.resumed ? null : jobFor(card);
}

/** @param {Card} card @param {JobKind} kind @param {{ files?: Record<string, any>, warnings?: string[], summary: string }} result @returns {Card} */
export function completeJob(card, kind, result) {
  if (jobFor(card) !== kind) throw conflict(`Cannot complete ${kind} while card is ${card.state}`);
  const { previews, stills, ...rest } = result.files ?? {};
  const files = { ...card.files, ...rest };
  if (previews) files.previews = [...card.files.previews, ...previews];
  if (stills) files.stills = stills;
  const next = {
    script: card.audio === 'vo' ? 'voice' : 'scene',
    words: 'scene', scene: 'sound', sound: 'preview', preview: 'review', render: 'done',
  }[kind];
  const out = { ...card, files, state: next };
  if (kind === 'render' && Array.isArray(result.warnings)) out.warnings = result.warnings;
  return out;
}

/** @param {Card} card @param {JobKind} kind @param {string} error @returns {Card} */
export function failJob(card, kind, error) {
  return { ...card, state: 'failed', failedStep: kind, error };
}

/** @param {Card} card @returns {Card} */
export function retry(card) {
  if (card.state !== 'failed' || !card.failedStep) throw conflict('Only a failed card can be retried');
  const state = card.failedStep === 'words' ? 'voice' : card.failedStep;
  return { ...card, state, failedStep: null, error: null };
}

/** @param {Card} card @param {string} text @param {string} at @returns {Card} */
export function submitNotes(card, text, at) {
  if (card.state !== 'review') throw conflict('Notes can only be submitted during review');
  const notes = [...card.notes, { at, text, previewVersion: card.files.previews.length }];
  return { ...card, notes, state: 'scene' };
}

/** @param {Card} card @returns {Card} */
export function requestRender(card) {
  if (card.state !== 'review') throw conflict('Render can only be requested during review');
  return { ...card, state: 'render' };
}

/** @param {Card} card @param {string} relPath @returns {Card} */
export function attachVoice(card, relPath) {
  if (card.audio !== 'vo' || card.state !== 'voice') throw conflict('Voice can only be attached to a voice-over card awaiting voice');
  return { ...card, files: { ...card.files, voice: relPath } };
}

/** @param {Card} card @returns {Card} */
export function markInterrupted(card) {
  if (card.imported && !card.resumed) return card; // waits for Resume
  return RUNNING.includes(card.state) ? failJob(card, card.state, 'Interrupted when ToonForge closed') : card;
}
