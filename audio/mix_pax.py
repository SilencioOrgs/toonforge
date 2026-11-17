# Procedural music + SFX mix (no voiceover) for the 60.0 s Pax Silica + Aeta short.
# Synthesizes a warm marimba/pluck + bass pulse + atmospheric pad underscore that shifts mood across:
#   0-11 s  Tarlac valley calm | 11-30 s Tech boom & corridor momentum | 30-44 s Aeta pressure & tension
#   44-56 s PH safeguards & clean-tech recovery | 56-60 s Reflective balance finale
# Adds synced SFX (approval pulse, cleanroom rise, truck pass, boundary thud, warning chimes, shield lock, water flow),
# masters to -15.0 LUFS integrated and -1.2 dBTP true peak (48 kHz / 24-bit stereo).
import os
import subprocess
import numpy as np
from scipy import ndimage, signal
from dsp import SR, TAU, ns, tt, rng, lp, hp, bp, modal, pan, place, st, widen, make_ir, convolve_st, integrated, true_peak, write_wav, fades, dbg

HERE = os.path.dirname(os.path.abspath(__file__))
DUR = 60.0
N = ns(DUR)


def note_hz(midi):
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))


def marimba(midi, dur=0.45, amp=0.22):
    f0 = note_hz(midi)
    t = tt(dur)
    y = np.exp(-t / 0.14) * np.sin(TAU * f0 * t) + 0.35 * np.exp(-t / 0.045) * np.sin(TAU * 3.98 * f0 * t)
    y += 0.12 * np.exp(-t / 0.015) * np.sin(TAU * 9.2 * f0 * t)
    return fades(y * amp, 0.003, 0.04)


def bass_pluck(midi, dur=0.55, amp=0.28):
    f0 = note_hz(midi)
    t = tt(dur)
    y = np.sin(TAU * f0 * t) + 0.45 * np.sin(TAU * 2 * f0 * t) * np.exp(-t / 0.15)
    y *= np.exp(-t / 0.28)
    return fades(lp(y * amp, 900), 0.005, 0.06)


def pad_chord(midis, dur, amp=0.075):
    t = tt(dur)
    y = np.zeros_like(t)
    for m in midis:
        f = note_hz(m)
        y += np.sin(TAU * f * t) + 0.25 * np.sin(TAU * 2.002 * f * t)
    y = lp(y / len(midis), 1300)
    return fades(y * amp, 0.35, 0.5)


def build_music():
    buf = np.zeros((2, N))
    # Chords: Dmaj7 (calm) -> Gmaj7 -> Bm7/F#m (tech pulse) -> Em/C#dim (tension) -> A7sus4 -> Dmaj7 (balance)
    chords = [
        (0.0, 11.0, [50, 57, 62, 66, 69]),
        (11.0, 23.0, [55, 62, 66, 69, 74]),
        (23.0, 30.0, [57, 64, 69, 73, 76]),
        (30.0, 44.0, [52, 59, 64, 67, 71]),   # minor tension for Aeta/water pressure
        (44.0, 56.0, [55, 62, 67, 71, 74]),   # safeguards lift
        (56.0, 60.0, [50, 57, 62, 66, 69]),   # open balance ending
    ]
    for a, b, notes in chords:
        place(buf, widen(pad_chord(notes, b - a, 0.095), rng(int(a * 10 + 1)), 14.0, 0.7), a)

    # Pulse grid at 120 BPM (0.25 s eighth-notes)
    arp_major = [62, 66, 69, 74, 69, 66, 62, 69]
    arp_minor = [64, 67, 71, 74, 71, 67, 64, 71]
    t = 0.0
    step = 0
    while t < 58.8:
        tension = 30.0 <= t < 44.0
        calm = t < 11.0 or t >= 56.0
        arp = arp_minor if tension else arp_major
        m = arp[step % len(arp)]
        if not calm or step % 2 == 0:
            p_val = -0.35 if step % 2 == 0 else 0.35
            amp = 0.12 if calm else (0.15 if tension else 0.18)
            place(buf, pan(marimba(m, 0.38, amp), p_val), t)
        if step % 4 == 0:
            root = 40 if tension else (43 if 11.0 <= t < 23.0 else (45 if 23.0 <= t < 30.0 else 38))
            place(buf, pan(bass_pluck(root, 0.5, 0.24 if not calm else 0.16), 0.0), t)
        t += 0.25
        step += 1

    ir = make_ir(1.1, seed=77, hf=1.4, density_lp=4500)
    wet = convolve_st(buf, ir)
    return 0.82 * buf + 0.28 * wet


def build_sfx():
    buf = np.zeros((2, N))
    r = rng(99)

    # Gentle valley breeze bed (Shots 1-2, 6, 10)
    breeze = bp(r.standard_normal(N), 240, 1100, 1) * 0.014
    place(buf, widen(breeze, r, 18.0, 0.8), 0.0)

    # Approval flash pulse at f330 (11.00 s)
    stamp = modal(0.65, [(110, 0.6, 0.18), (220, 0.4, 0.15), (587, 0.35, 0.25), (880, 0.25, 0.3)], r)
    place(buf, pan(fades(stamp, 0.002, 0.08), 0.0), 11.0, 0.55)

    # Cleanroom rise whoosh & data ticks (15.0-28.0 s)
    whoosh_t = tt(1.4)
    whoosh = bp(r.standard_normal(len(whoosh_t)), 300, 2200, 2) * np.sin(np.pi * whoosh_t / 1.4) ** 2 * 0.18
    place(buf, widen(whoosh, r, 12.0, 0.6), 14.4)
    for k in range(6):
        tm = 22.8 + k * 0.85
        tick = modal(0.18, [(1046 + k * 110, 0.35, 0.045), (1568 + k * 140, 0.2, 0.03)], r)
        place(buf, pan(tick, -0.2 + 0.08 * k), tm, 0.45)

    # Fence boundary thud + tension warning chime at f900/f930 (30.0-31.0 s)
    thud = modal(0.45, [(72, 0.8, 0.14), (135, 0.45, 0.09)], r)
    place(buf, pan(thud, 0.25), 31.0, 0.6)
    warn = modal(0.7, [(494, 0.4, 0.22), (740, 0.25, 0.18)], r)
    place(buf, pan(warn, 0.15), 38.2, 0.45)

    # Official safeguard lock + chime at f1320 (44.0-45.5 s)
    lock = modal(0.8, [(293.66, 0.45, 0.28), (440.0, 0.4, 0.32), (587.33, 0.35, 0.36)], r)
    place(buf, pan(lock, 0.0), 44.0, 0.55)

    # Water loop recovery shimmer at f1530 (51.0 s)
    shimmer = modal(1.1, [(659.25, 0.3, 0.4), (880.0, 0.25, 0.45), (1318.5, 0.18, 0.5)], r)
    place(buf, widen(shimmer, r, 15.0, 0.7), 51.0, 0.45)

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
    m = build_music()
    s = build_sfx()
    mix = m * 0.75 + s * 0.85
    cur = integrated(mix)
    mix *= dbg(-15.0 - cur)
    mix = limit(mix, -1.2)
    out = os.path.join(HERE, "mix.wav")
    write_wav(out, mix, bits=24)
    print(f"wrote {out}: integrated={integrated(mix):.2f} LUFS, true_peak={true_peak(mix):.2f} dBTP")
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", out, "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    for line in r.stderr.splitlines():
        if line.strip().startswith(("I:", "LRA:", "Peak:")):
            print("ffmpeg", line.strip())


if __name__ == "__main__":
    main()
