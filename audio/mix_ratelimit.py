# Audio mix for "Missing Rate Limiting (OTP / Login Brute Force)" using user's voice/ratelimit_voice.wav:
# - Preserves voice clarity (only level-aligned into -15 LUFS master)
# - Envelope-keyed speech ducking (-4 dB) on energetic minor-to-major tech pulse + bass bed
# - Synced SFX (machine-gun packet bursts, padlock snap, human slow tap, shield slam, 429 reject buzzes, expire lock, closing chime)
import os
import subprocess
import numpy as np
from scipy import ndimage, signal
from dsp import SR, TAU, ns, tt, rng, lp, bp, modal, pan, place, st, widen, make_ir, convolve_st, read_wav, write_wav, integrated, true_peak, fades, dbg

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DUR = 2356 / 30.0  # 78.5333 s exact frame match
N = ns(DUR)


def note_hz(midi):
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))


def marimba(midi, dur=0.3, amp=0.18):
    f0 = note_hz(midi)
    t = tt(dur)
    y = np.exp(-t / 0.1) * np.sin(TAU * f0 * t) + 0.3 * np.exp(-t / 0.04) * np.sin(TAU * 4.0 * f0 * t)
    return fades(y * amp, 0.002, 0.03)


def bass(midi, dur=0.35, amp=0.22):
    f0 = note_hz(midi)
    t = tt(dur)
    y = np.sin(TAU * f0 * t) * np.exp(-t / 0.2)
    return fades(lp(y * amp, 750), 0.004, 0.04)


def load_voice():
    x, sr = read_wav(os.path.join(ROOT, "voice", "ratelimit_voice.wav"))
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
    step_s = 60.0 / 132.0 / 2.0
    arp_atk = [60, 63, 67, 70, 67, 63, 60, 67]
    arp_fix = [62, 66, 69, 74, 69, 66, 62, 69]
    t = 0.0
    i = 0
    while t < DUR - 0.5:
        fix = t >= 47.0
        arp = arp_fix if fix else arp_atk
        p_val = -0.35 if i % 2 == 0 else 0.35
        place(buf, pan(marimba(arp[i % len(arp)], 0.28, 0.14), p_val), t)
        if i % 4 == 0:
            root = 38 if fix else (41 if 24.5 <= t < 47.0 else 36)
            place(buf, pan(bass(root, 0.34, 0.2), 0.0), t)
        t += step_s
        i += 1
    ir = make_ir(0.85, seed=55, hf=1.4, density_lp=4000)
    return 0.85 * buf + 0.22 * convolve_st(buf, ir)


def build_sfx():
    buf = np.zeros((2, N))
    r = rng(404)
    tick = modal(0.05, [(1650, 0.5, 0.012), (2950, 0.3, 0.009)], r)
    snap = modal(0.45, [(420, 0.6, 0.12), (980, 0.45, 0.14), (1760, 0.3, 0.1)], r)

    # 3.1 - 6.6 s: machine-gun bot packet fire + 6.8 s padlock snap!
    for k in range(28):
        place(buf, pan(tick, 0.25 - k * 0.012), 3.1 + k * 0.12, 0.42)
    place(buf, pan(snap, 0.0), 6.8, 0.6)

    # 8.0 s: flash transition whoosh (f240)
    wt = tt(0.5)
    place(buf, widen(bp(r.standard_normal(len(wt)), 400, 2600, 2) * np.sin(np.pi * wt / 0.5) ** 2 * 0.2, r, 10, 0.6), 7.95)

    # 25.2 s & 26.8 s: slow manual human clicks
    place(buf, pan(tick, -0.4), 25.2, 0.5)
    place(buf, pan(tick, -0.4), 26.8, 0.5)

    # 28.8 - 34.0 s: second dense bot barrage + 34.3 s breach snap!
    for k in range(36):
        place(buf, pan(tick, 0.3 - (k % 8) * 0.04), 28.8 + k * 0.13, 0.42)
    place(buf, pan(snap, 0.0), 34.3, 0.6)

    # 48.2 s: Heavy RATE LIMIT shield slam
    place(buf, pan(modal(0.55, [(76, 0.85, 0.16), (155, 0.45, 0.1)], r), 0.0), 48.2, 0.65)

    # 51.8 - 56.0 s: 429 reject buzzes bouncing packets off the shield
    buzz = modal(0.32, [(185, 0.5, 0.12), (277, 0.3, 0.1)], r)
    for dt in [51.8, 53.5, 55.4]:
        place(buf, pan(buzz, 0.25), dt, 0.5)

    # 61.5 s: OTP expire lock clicks
    for k in range(3):
        place(buf, pan(modal(0.18, [(880 + k * 150, 0.4, 0.08)], r), 0.0), 61.5 + k * 0.18, 0.45)

    # 76.5 s: Closing security chime
    place(buf, pan(modal(0.6, [(523.25, 0.35, 0.22), (659.25, 0.3, 0.26), (783.99, 0.25, 0.3)], r), 0.0), 76.5, 0.5)
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
    out = os.path.join(HERE, "mix_ratelimit.wav")
    write_wav(out, mix, bits=24)
    print(f"wrote {out}: integrated={integrated(mix):.2f} LUFS, true_peak={true_peak(mix):.2f} dBTP")
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", out, "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    for line in r.stderr.splitlines():
        if line.strip().startswith(("I:", "LRA:", "Peak:")):
            print("ffmpeg", line.strip())


if __name__ == "__main__":
    main()
