# Audio mix for "Database Indexing (Full Table Scan vs B-Tree Index)" using voice/dbindex_voice.wav + Suno Track 3 (audio/suno_3.wav):
# - Level-aligned into -15 LUFS master with -1.2 dBTP true peak ceiling
# - Envelope-keyed speech ducking (-5 dB) on the upbeat Suno BGM
# - Synced SFX: Shot 1 slow tick (3.2s), Shot 3 drawer scan ticks (31.2s, 32.2s, 33.3s),
#   Shot 5 timeout crash thud (50.0s), Shot 6 B-Tree drop whoosh+thud (53.3s & 54.3s),
#   Shot 7 ascending B-Tree hops (69.5s, 70.5s, 71.5s) + 3ms target chime (72.5s), Follow-for-more finale chord (90.7s)
import os
import subprocess
import numpy as np
from scipy import ndimage, signal
from dsp import SR, ns, tt, rng, bp, modal, pan, place, st, widen, read_wav, write_wav, integrated, true_peak, dbg

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DUR = 2812 / 30.0  # 93.7333 s exact frame match
N = ns(DUR)


def load_voice():
    x, sr = read_wav(os.path.join(ROOT, "voice", "dbindex_voice.wav"))
    assert sr == SR, sr
    v = x[0] if x.shape[0] == 1 else x.mean(0)
    out = np.zeros(N)
    out[: min(N, len(v))] = v[:N]
    return st(out)


def load_suno(filename):
    x, sr = read_wav(os.path.join(HERE, filename))
    assert sr == SR, sr
    if x.shape[0] == 1:
        x = np.vstack([x[0], x[0]])
    if x.shape[1] >= N:
        out = x[:, :N].copy()
    else:
        reps = int(np.ceil(N / x.shape[1]))
        out = np.tile(x, (1, reps))[:, :N].copy()
    fi = ns(0.15)
    fo = ns(1.3)
    out[:, :fi] *= np.linspace(0, 1, fi)[None, :]
    out[:, -fo:] *= np.linspace(1, 0, fo)[None, :]
    return out


def speech_duck(v_stereo, duck_db=-5.0):
    mono = np.abs(v_stereo[0])
    env = ndimage.maximum_filter1d(mono, ns(0.08))
    active = (env > 0.012).astype(float)
    smooth_env = ndimage.uniform_filter1d(active, ns(0.24), mode="nearest")
    return dbg(duck_db * smooth_env)


def build_sfx():
    buf = np.zeros((2, N))
    r = rng(808)
    wt = tt(0.45)
    whoosh = widen(bp(r.standard_normal(len(wt)), 420, 2600, 2) * np.sin(np.pi * wt / 0.45) ** 2 * 0.22, r, 10, 0.6)
    crash_thud = modal(0.42, [(95, 0.75, 0.14), (185, 0.55, 0.10), (310, 0.3, 0.06)], r)
    chime = modal(0.55, [(587.33, 0.45, 0.22), (880.0, 0.38, 0.26), (1174.66, 0.3, 0.28)], r)

    # Shot 1 slow search warning tick (3.2s)
    place(buf, pan(modal(0.18, [(420, 0.45, 0.06), (340, 0.3, 0.05)], r), -0.2), 3.2, 0.48)

    # Shot 3 sequential Full Table Scan drawer ticks (row 1, row 2, row 3 at 31.2s, 32.2s, 33.3s)
    for k, ts in enumerate((31.2, 32.2, 33.3)):
        place(buf, pan(modal(0.14, [(480 + k * 45, 0.4, 0.06)], r), 0.25), ts, 0.46)

    # Shot 5 timeout & app crash thud (f=1500 -> 50.0s)
    place(buf, pan(crash_thud, 0.2), 50.0, 0.78)

    # Shot 6 B-Tree Index drop whoosh + landing chime (f=1600..1630 -> 53.3s & 54.3s)
    place(buf, whoosh, 53.3, 0.55)
    place(buf, pan(modal(0.32, [(145, 0.65, 0.12), (440, 0.4, 0.14), (880, 0.3, 0.15)], r), 0.0), 54.3, 0.70)

    # Shot 7 ascending B-Tree hop tones (69.5s, 70.5s, 71.5s) & 3ms target found chime (72.5s)
    for ts, freq in ((69.5, 520.0), (70.5, 660.0), (71.5, 880.0)):
        place(buf, pan(modal(0.16, [(freq, 0.42, 0.07)], r), 0.0), ts, 0.52)
    place(buf, pan(chime, 0.1), 72.5, 0.64)

    # Shot 9 "Follow for more!" finale chord (90.7s)
    place(buf, pan(modal(0.65, [(523.25, 0.35, 0.25), (659.25, 0.32, 0.28), (783.99, 0.28, 0.30)], r), 0.0), 90.7, 0.56)
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
    m = load_suno("suno_3.wav")
    s = build_sfx()
    m *= dbg(lv - 11.5 - integrated(m)) * speech_duck(v, -5.0)[None, :]
    s *= dbg(lv - 9.0 - integrated(s))
    mix = v + m + s
    mix *= dbg(-15.0 - integrated(mix))
    mix = limit(mix, -1.2)
    out = os.path.join(HERE, "mix_dbindex.wav")
    write_wav(out, mix, bits=24)
    print(f"wrote {out}: integrated={integrated(mix):.2f} LUFS, true_peak={true_peak(mix):.2f} dBTP")
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", out, "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    for line in r.stderr.splitlines():
        if line.strip().startswith(("I:", "LRA:", "Peak:")):
            print("ffmpeg", line.strip())


if __name__ == "__main__":
    main()
