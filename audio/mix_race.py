# Audio mix for "Race Condition: Two People, Isang Seat" using user's voice/race_voice.wav:
# - Preserves voice clarity (only level-aligned into -15 LUFS master)
# - Envelope-keyed speech ducking (-4 dB) on playful tech marimba + bass music bed
# - Synced SFX (phone click, double dings, race packet whoosh, atomic lock clunk, DB shield slam, reject buzz, friendly chime)
import os
import subprocess
import numpy as np
from scipy import ndimage, signal
from dsp import SR, TAU, ns, tt, rng, lp, bp, modal, pan, place, st, widen, make_ir, convolve_st, read_wav, write_wav, integrated, true_peak, fades, dbg

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DUR = 1790 / 30.0  # 59.6667 s exact frame match
N = ns(DUR)


def note_hz(midi):
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))


def marimba(midi, dur=0.35, amp=0.18):
    f0 = note_hz(midi)
    t = tt(dur)
    y = np.exp(-t / 0.11) * np.sin(TAU * f0 * t) + 0.3 * np.exp(-t / 0.04) * np.sin(TAU * 4.0 * f0 * t)
    return fades(y * amp, 0.002, 0.03)


def bass(midi, dur=0.4, amp=0.22):
    f0 = note_hz(midi)
    t = tt(dur)
    y = np.sin(TAU * f0 * t) * np.exp(-t / 0.22)
    return fades(lp(y * amp, 750), 0.004, 0.04)


def load_voice():
    x, sr = read_wav(os.path.join(ROOT, "voice", "race_voice.wav"))
    assert sr == SR, sr
    v = x[0] if x.shape[0] == 1 else x.mean(0)
    out = np.zeros(N)
    out[: min(N, len(v))] = v[:N]
    return st(out)


def speech_duck(v_stereo, duck_db=-4.0):
    mono = np.abs(v_stereo[0])
    env = ndimage.maximum_filter1d(mono, ns(0.08))
    active = (env > 0.012).astype(float)
    smooth_env = ndimage.uniform_filter1d(active, ns(0.22), mode="nearest")
    return dbg(duck_db * smooth_env)


def build_music():
    buf = np.zeros((2, N))
    # Playful tech/explainer groove at 128 BPM (step = 0.234375 s)
    step_s = 60.0 / 128.0 / 2.0
    arp_main = [64, 67, 71, 74, 71, 67, 64, 71]
    arp_fix = [65, 69, 72, 76, 72, 69, 65, 72]
    t = 0.0
    i = 0
    while t < DUR - 0.5:
        fix = t >= 24.7
        arp = arp_fix if fix else arp_main
        p_val = -0.35 if i % 2 == 0 else 0.35
        place(buf, pan(marimba(arp[i % len(arp)], 0.3, 0.14), p_val), t)
        if i % 4 == 0:
            root = 41 if fix else (43 if 18.0 <= t < 24.7 else 40)
            place(buf, pan(bass(root, 0.35, 0.2), 0.0), t)
        t += step_s
        i += 1
    ir = make_ir(0.85, seed=31, hf=1.4, density_lp=4000)
    return 0.85 * buf + 0.22 * convolve_st(buf, ir)


def build_sfx():
    buf = np.zeros((2, N))
    r = rng(202)
    # 2.66 s: double confirmation dings!
    ding = modal(0.45, [(880, 0.5, 0.14), (1320, 0.3, 0.18)], r)
    place(buf, pan(ding, -0.45), 2.65, 0.5)
    place(buf, pan(ding, 0.45), 2.74, 0.5)
    # 7.0 s: flash transition whoosh
    wt = tt(0.5)
    place(buf, widen(bp(r.standard_normal(len(wt)), 400, 2600, 2) * np.sin(np.pi * wt / 0.5) ** 2 * 0.2, r, 10, 0.6), 6.9)
    # 18.3 s: simultaneous double-click + race whoosh
    click = modal(0.08, [(1800, 0.5, 0.015), (3200, 0.3, 0.01)], r)
    place(buf, pan(click, -0.4), 18.25, 0.6)
    place(buf, pan(click, 0.4), 18.26, 0.6)
    # 25.0 s: atomic lock merge clunk
    place(buf, pan(modal(0.45, [(140, 0.6, 0.12), (440, 0.4, 0.16), (660, 0.3, 0.2)], r), 0.0), 24.8, 0.55)
    # 34.0 s: Row=1 win chime | 36.0 s: Row=0 fail blip
    place(buf, pan(modal(0.45, [(587.33, 0.4, 0.16), (880, 0.35, 0.2)], r), -0.35), 34.0, 0.55)
    place(buf, pan(modal(0.35, [(220, 0.45, 0.12), (196, 0.4, 0.15)], r), 0.35), 36.0, 0.5)
    # 39.2 s: Heavy Unique Shield slam | 44.3 s: DB Reject buzz
    place(buf, pan(modal(0.55, [(78, 0.8, 0.16), (160, 0.45, 0.1)], r), 0.0), 39.2, 0.6)
    place(buf, pan(modal(0.4, [(185, 0.5, 0.14), (277, 0.3, 0.12)], r), 0.2), 44.2, 0.55)
    # 57.3 s: Friendly message chime
    place(buf, pan(modal(0.6, [(523.25, 0.35, 0.22), (659.25, 0.3, 0.26), (783.99, 0.25, 0.3)], r), 0.3), 57.2, 0.5)
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
    v = load_voice()
    lv = integrated(v)
    m = build_music()
    s = build_sfx()
    # Balance music (~-13 LU below voice after ducking) + SFX (~-10 LU below voice)
    m *= dbg(lv - 10.5 - integrated(m)) * speech_duck(v, -4.0)[None, :]
    s *= dbg(lv - 9.0 - integrated(s))
    mix = v + m + s
    mix *= dbg(-15.0 - integrated(mix))
    mix = limit(mix, -1.2)
    out = os.path.join(HERE, "mix_race.wav")
    write_wav(out, mix, bits=24)
    print(f"wrote {out}: integrated={integrated(mix):.2f} LUFS, true_peak={true_peak(mix):.2f} dBTP")
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", out, "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    for line in r.stderr.splitlines():
        if line.strip().startswith(("I:", "LRA:", "Peak:")):
            print("ffmpeg", line.strip())


if __name__ == "__main__":
    main()
