# Audio mix for "SQL Injection (SQLi)" using user's voice/sqli_voice.wav:
# - Preserves voice clarity (level-aligned into -15 LUFS master)
# - Envelope-keyed speech ducking (-4 dB) on investigative synth marimba + bass pulse
# - Synced SFX (typing taps, injection slide, Admin Vault swing open, flash whoosh, concatenation weld, guard gate open, Prepared Statement slam, blocked bounce, closing chime)
import os
import subprocess
import numpy as np
from scipy import ndimage, signal
from dsp import SR, TAU, ns, tt, rng, lp, bp, modal, pan, place, st, widen, make_ir, convolve_st, read_wav, write_wav, integrated, true_peak, fades, dbg

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DUR = 2219 / 30.0  # 73.9667 s exact frame match
N = ns(DUR)


def note_hz(midi):
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))


def marimba(midi, dur=0.32, amp=0.18):
    f0 = note_hz(midi)
    t = tt(dur)
    y = np.exp(-t / 0.11) * np.sin(TAU * f0 * t) + 0.3 * np.exp(-t / 0.04) * np.sin(TAU * 4.0 * f0 * t)
    return fades(y * amp, 0.002, 0.03)


def bass(midi, dur=0.36, amp=0.22):
    f0 = note_hz(midi)
    t = tt(dur)
    y = np.sin(TAU * f0 * t) * np.exp(-t / 0.22)
    return fades(lp(y * amp, 750), 0.004, 0.04)


def load_voice():
    x, sr = read_wav(os.path.join(ROOT, "voice", "sqli_voice.wav"))
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
    step_s = 60.0 / 124.0 / 2.0
    arp_main = [57, 60, 64, 67, 64, 60, 57, 64]
    arp_fix = [59, 64, 67, 71, 67, 64, 59, 67]
    t = 0.0
    i = 0
    while t < DUR - 0.5:
        fix = t >= 44.0
        arp = arp_fix if fix else arp_main
        p_val = -0.35 if i % 2 == 0 else 0.35
        place(buf, pan(marimba(arp[i % len(arp)], 0.3, 0.14), p_val), t)
        if i % 4 == 0:
            root = 40 if fix else (43 if 24.0 <= t < 44.0 else 38)
            place(buf, pan(bass(root, 0.35, 0.2), 0.0), t)
        t += step_s
        i += 1
    ir = make_ir(0.85, seed=66, hf=1.4, density_lp=4000)
    return 0.85 * buf + 0.22 * convolve_st(buf, ir)


def build_sfx():
    buf = np.zeros((2, N))
    r = rng(505)
    tap = modal(0.06, [(1750, 0.5, 0.013), (3100, 0.3, 0.009)], r)
    swing = modal(0.45, [(230, 0.45, 0.14), (470, 0.3, 0.1)], r)

    # 1.8 s: typing ' OR 1=1 & 5.4 s: Admin Vault swings open!
    for dt in [1.6, 1.85, 2.1, 2.4]:
        place(buf, pan(tap, 0.35), dt, 0.5)
    place(buf, pan(swing, 0.0), 5.4, 0.55)

    # 9.0 s: flash transition whoosh (f270)
    wt = tt(0.5)
    place(buf, widen(bp(r.standard_normal(len(wt)), 400, 2600, 2) * np.sin(np.pi * wt / 0.5) ** 2 * 0.2, r, 10, 0.6), 8.95)

    # 16.0 s: string concat weld clunk
    place(buf, pan(modal(0.35, [(180, 0.55, 0.1), (360, 0.4, 0.12)], r), 0.0), 16.0, 0.5)

    # 31.8 s: OR 1=1 = TRUE unlock ding & open
    place(buf, pan(modal(0.4, [(587.33, 0.4, 0.16), (880, 0.35, 0.2)], r), 0.0), 31.8, 0.55)

    # 37.5 s: guard gate swings open in analogy
    place(buf, pan(swing, 0.0), 37.5, 0.5)

    # 46.0 s: Heavy Prepared Statement Shield slam
    place(buf, pan(modal(0.55, [(78, 0.85, 0.16), (160, 0.45, 0.1)], r), 0.0), 46.0, 0.65)

    # 58.8 s: Plain text bounce reject
    place(buf, pan(modal(0.38, [(190, 0.5, 0.13), (285, 0.3, 0.1)], r), 0.25), 58.8, 0.55)

    # 72.0 s: Closing lock confirmation chime
    place(buf, pan(modal(0.6, [(523.25, 0.35, 0.22), (659.25, 0.3, 0.26), (783.99, 0.25, 0.3)], r), 0.0), 72.0, 0.5)
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
    m *= dbg(lv - 10.5 - integrated(m)) * speech_duck(v, -4.0)[None, :]
    s *= dbg(lv - 9.0 - integrated(s))
    mix = v + m + s
    mix *= dbg(-15.0 - integrated(mix))
    mix = limit(mix, -1.2)
    out = os.path.join(HERE, "mix_sqli.wav")
    write_wav(out, mix, bits=24)
    print(f"wrote {out}: integrated={integrated(mix):.2f} LUFS, true_peak={true_peak(mix):.2f} dBTP")
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", out, "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    for line in r.stderr.splitlines():
        if line.strip().startswith(("I:", "LRA:", "Peak:")):
            print("ffmpeg", line.strip())


if __name__ == "__main__":
    main()
