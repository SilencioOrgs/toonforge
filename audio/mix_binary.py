# Audio mix for "Binary Search Explained" using user's voice/binary_voice.wav + Suno Track 1 (audio/suno_1.wav):
# - Preserves voice clarity (level-aligned into -15 LUFS master)
# - Envelope-keyed speech ducking (-5 dB) on the upbeat Suno BGM
# - Synced SFX (flash whoosh, sort snap ticks, parabolic leap pops, wing-drop whooshes, #73 BOOM chime, outro win chord)
import os
import subprocess
import numpy as np
from scipy import ndimage, signal
from dsp import SR, ns, tt, rng, bp, modal, pan, place, st, widen, read_wav, write_wav, integrated, true_peak, fades, dbg

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DUR = 2699 / 30.0  # 89.9667 s exact frame match
N = ns(DUR)


def load_voice():
    x, sr = read_wav(os.path.join(ROOT, "voice", "binary_voice.wav"))
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
    # Gentle intro fade-in & clean 1.4 s ending fade-out
    fi = ns(0.15)
    fo = ns(1.4)
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
    r = rng(606)
    hop = modal(0.22, [(440, 0.5, 0.08), (880, 0.35, 0.09)], r)
    wt = tt(0.5)
    whoosh = widen(bp(r.standard_normal(len(wt)), 400, 2600, 2) * np.sin(np.pi * wt / 0.5) ** 2 * 0.2, r, 10, 0.6)

    place(buf, whoosh, 6.65)
    for k in range(5):
        place(buf, pan(modal(0.14, [(520 + k * 90, 0.4, 0.06)], r), -0.4 + k * 0.2), 16.0 + k * 0.14, 0.45)

    place(buf, pan(hop, 0.0), 31.0, 0.55)
    place(buf, pan(modal(0.2, [(190, 0.6, 0.08)], r), 0.0), 32.5, 0.55)
    place(buf, whoosh, 38.8, 0.65)

    place(buf, pan(hop, 0.3), 49.8, 0.55)
    place(buf, pan(modal(0.2, [(210, 0.6, 0.08)], r), 0.3), 51.3, 0.55)
    place(buf, whoosh, 55.8, 0.65)

    place(buf, pan(hop, 0.15), 62.2, 0.5)
    place(buf, pan(modal(0.65, [(587.33, 0.45, 0.25), (880, 0.4, 0.28), (1174.66, 0.35, 0.3)], r), 0.2), 64.4, 0.65)
    place(buf, pan(modal(0.6, [(523.25, 0.35, 0.22), (659.25, 0.3, 0.26), (783.99, 0.25, 0.3)], r), 0.0), 88.0, 0.5)
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
    m = load_suno("suno_1.wav")
    s = build_sfx()
    # Keep rich Suno underscore ~11.5 LU below voice when quiet, ducked another -5 dB under speech
    m *= dbg(lv - 11.5 - integrated(m)) * speech_duck(v, -5.0)[None, :]
    s *= dbg(lv - 9.0 - integrated(s))
    mix = v + m + s
    mix *= dbg(-15.0 - integrated(mix))
    mix = limit(mix, -1.2)
    out = os.path.join(HERE, "mix_binary.wav")
    write_wav(out, mix, bits=24)
    print(f"wrote {out}: integrated={integrated(mix):.2f} LUFS, true_peak={true_peak(mix):.2f} dBTP")
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", out, "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    for line in r.stderr.splitlines():
        if line.strip().startswith(("I:", "LRA:", "Peak:")):
            print("ffmpeg", line.strip())


if __name__ == "__main__":
    main()
