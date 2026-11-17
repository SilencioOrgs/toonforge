# Procedural music + SFX mix (no voiceover) for "No to Pax Silica" & Aeta Land Rights (60.0 s).
import os
import subprocess
import numpy as np
from scipy import ndimage, signal
from dsp import SR, TAU, ns, tt, rng, lp, bp, modal, pan, place, widen, make_ir, convolve_st, integrated, true_peak, write_wav, fades, dbg

HERE = os.path.dirname(os.path.abspath(__file__))
DUR = 60.0
N = ns(DUR)


def note_hz(midi):
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))


def plucked(midi, dur=0.45, amp=0.22):
    f0 = note_hz(midi)
    t = tt(dur)
    y = np.exp(-t / 0.16) * np.sin(TAU * f0 * t) + 0.28 * np.exp(-t / 0.05) * np.sin(TAU * 3.0 * f0 * t)
    return fades(y * amp, 0.003, 0.04)


def drum_hit(f0=75.0, dur=0.35, amp=0.36):
    t = tt(dur)
    f = f0 * (1 + 1.4 * np.exp(-t / 0.018))
    y = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / 0.11)
    return fades(lp(y * amp, 600), 0.002, 0.04)


def pad_chord(midis, dur, amp=0.08):
    t = tt(dur)
    y = np.zeros_like(t)
    for m in midis:
        f = note_hz(m)
        y += np.sin(TAU * f * t) + 0.22 * np.sin(TAU * 2.001 * f * t)
    return fades(lp(y / len(midis), 1100) * amp, 0.35, 0.5)


def build_music():
    buf = np.zeros((2, N))
    # D Dorian -> Bbmaj7 -> Gm7 -> Dm/A -> Csus4 -> Dm9 (grounded, determined, reflective)
    chords = [
        (0.0, 6.0, [50, 57, 62, 65, 69]),
        (6.0, 13.0, [50, 57, 62, 64, 69]),
        (13.0, 29.0, [46, 53, 58, 62, 65]),
        (29.0, 46.0, [43, 50, 55, 58, 62]),
        (46.0, 54.0, [48, 55, 60, 65, 69]),
        (54.0, 60.0, [50, 57, 62, 65, 69]),
    ]
    for a, b, notes in chords:
        place(buf, widen(pad_chord(notes, b - a, 0.09), rng(int(a * 7 + 3)), 15.0, 0.7), a)

    # Rhythm pulse (120 BPM) with rally drums in Shots 5-6 (29-46 s)
    arp_calm = [62, 65, 69, 72, 69, 65, 62, 69]
    arp_rally = [58, 62, 65, 70, 65, 62, 58, 65]
    t = 0.0
    step = 0
    while t < 58.8:
        rally = 29.0 <= t < 46.0
        arp = arp_rally if rally else arp_calm
        if step % 2 == 0 or rally:
            p_val = -0.3 if step % 2 == 0 else 0.3
            amp = 0.17 if rally else 0.13
            place(buf, pan(plucked(arp[step % len(arp)], 0.38, amp), p_val), t)
        if rally and step % 2 == 0:
            place(buf, pan(drum_hit(68 if step % 4 == 0 else 92, 0.28, 0.32 if step % 4 == 0 else 0.2), 0.0), t)
        elif step % 4 == 0:
            place(buf, pan(drum_hit(64, 0.3, 0.18), 0.0), t)
        t += 0.25
        step += 1

    ir = make_ir(1.15, seed=55, hf=1.3, density_lp=4200)
    return 0.82 * buf + 0.28 * convolve_st(buf, ir)


def build_sfx():
    buf = np.zeros((2, N))
    r = rng(107)
    breeze = bp(r.standard_normal(N), 220, 950, 1) * 0.015
    place(buf, widen(breeze, r, 18.0, 0.8), 0.0)

    # Zone outline cue (6.0 s) & Excavator + fence push impact (13.0 s, f390)
    place(buf, pan(modal(0.5, [(330, 0.3, 0.2), (660, 0.18, 0.22)], r), -0.2), 6.0, 0.45)
    thud = modal(0.6, [(68, 0.8, 0.18), (130, 0.45, 0.12)], r)
    place(buf, pan(thud, 0.1), 13.0, 0.6)

    # Water warning chime (21.0 s) & Rally pulse chime (29.0 s)
    place(buf, pan(modal(0.7, [(466, 0.4, 0.24), (698, 0.25, 0.2)], r), 0.2), 21.0, 0.45)
    place(buf, pan(modal(0.55, [(293.66, 0.45, 0.2), (440, 0.35, 0.24)], r), 0.0), 29.0, 0.5)

    # Petition stack thumps (38-44 s)
    for k in range(5):
        place(buf, pan(drum_hit(110 + k * 8, 0.14, 0.26), 0.2), 38.2 + k * 0.9, 0.5)

    # Official response / buffer chime (46.0 s, f1380)
    place(buf, widen(modal(0.9, [(349.23, 0.35, 0.3), (523.25, 0.3, 0.36), (698.46, 0.2, 0.4)], r), r, 14.0, 0.6), 46.0, 0.5)
    return buf


def limit(x, ceil_db=-1.2):
    c = dbg(ceil_db)
    n = x.shape[1]
    up = np.abs(signal.resample_poly(x, 4, 1, axis=-1)).max(0)
    pk = np.pad(up, (0, max(0, 4 * n - len(up))))[: 4 * n].reshape(n, 4).max(1)
    gr = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    la = max(1, ns(0.003))
    g1 = ndimage.minimum_filter1d(gr, 2 * la + 1, mode="nearest")
    g2 = ndimage.uniform_filter1d(g1, 2 * la + 1, mode="nearest")
    return x * np.minimum(g2, 1.0)[None, :]


def main():
    mix = build_music() * 0.75 + build_sfx() * 0.85
    mix *= dbg(-15.0 - integrated(mix))
    mix = limit(mix, -1.2)
    out = os.path.join(HERE, "mix_notopax.wav")
    write_wav(out, mix, bits=24)
    print(f"wrote {out}: integrated={integrated(mix):.2f} LUFS, true_peak={true_peak(mix):.2f} dBTP")
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", out, "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    for line in r.stderr.splitlines():
        if line.strip().startswith(("I:", "LRA:", "Peak:")):
            print("ffmpeg", line.strip())


if __name__ == "__main__":
    main()
