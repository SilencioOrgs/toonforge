# Audio mix for "Caching (Redis) Explained" using voice/redis_voice.wav + Suno Track 2 (audio/suno_2.wav):
# - Level-aligned into -15 LUFS master with -1.2 dBTP true peak ceiling
# - Envelope-keyed speech ducking (-5 dB) on the upbeat Suno BGM
# - Synced SFX: Shot 1 crash (6.87s), Shot 5 overload collapse (43.27s), Shot 6 Redis vault drop (47.83s),
#   Shot 7 Cache saved chime (55.50s), Shot 8 rapid 2ms cache hit ticks (60.3..66.5s), TTL refresh (75.3s), finale chord (81.2s)
import os
import subprocess
import numpy as np
from scipy import ndimage, signal
from dsp import SR, ns, tt, rng, bp, modal, pan, place, st, widen, read_wav, write_wav, integrated, true_peak, dbg

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DUR = 2497 / 30.0  # 83.2333 s exact frame match
N = ns(DUR)


def load_voice():
    x, sr = read_wav(os.path.join(ROOT, "voice", "redis_voice.wav"))
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
    r = rng(707)
    wt = tt(0.45)
    whoosh = widen(bp(r.standard_normal(len(wt)), 420, 2600, 2) * np.sin(np.pi * wt / 0.45) ** 2 * 0.22, r, 10, 0.6)
    crash_thud = modal(0.42, [(95, 0.75, 0.14), (185, 0.55, 0.10), (310, 0.3, 0.06)], r)
    chime = modal(0.55, [(587.33, 0.45, 0.22), (880.0, 0.38, 0.26), (1174.66, 0.3, 0.28)], r)

    # Shot 1 viral surge whoosh & DB crash (f=206 -> 6.87s)
    place(buf, whoosh, 1.5, 0.45)
    place(buf, pan(crash_thud, 0.25), 6.87, 0.72)

    # Shot 3 slow query hop up & back
    place(buf, whoosh, 19.6, 0.45)
    place(buf, pan(modal(0.16, [(520, 0.4, 0.06)], r), 0.35), 24.5, 0.4)
    place(buf, whoosh, 26.2, 0.42)

    # Shot 5 overload buzz & full system collapse (f=1298 -> 43.27s)
    place(buf, pan(crash_thud, 0.25), 43.27, 0.8)

    # Shot 6 Redis vault dramatic drop + sparkle land (f=1435 -> 47.83s)
    place(buf, whoosh, 46.9, 0.55)
    place(buf, pan(modal(0.32, [(140, 0.65, 0.12), (440, 0.4, 0.14), (880, 0.3, 0.15)], r), 0.0), 47.83, 0.7)

    # Shot 7 Cache saved chime (f=1665 -> 55.50s)
    place(buf, pan(chime, 0.0), 55.50, 0.6)

    # Shot 8 2ms fast hit zips!
    for k in range(8):
        place(buf, pan(modal(0.10, [(740 + (k % 4) * 110, 0.35, 0.045)], r), -0.3 + (k % 3) * 0.15), 60.4 + k * 0.72, 0.38)

    # Shot 9 TTL refresh & celebratory finale chord
    place(buf, pan(modal(0.28, [(659.25, 0.4, 0.12), (987.77, 0.32, 0.14)], r), 0.0), 74.8, 0.52)
    place(buf, pan(modal(0.65, [(523.25, 0.35, 0.25), (659.25, 0.32, 0.28), (783.99, 0.28, 0.30)], r), 0.0), 81.2, 0.55)
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
    m = load_suno("suno_2.wav")
    s = build_sfx()
    m *= dbg(lv - 11.5 - integrated(m)) * speech_duck(v, -5.0)[None, :]
    s *= dbg(lv - 9.0 - integrated(s))
    mix = v + m + s
    mix *= dbg(-15.0 - integrated(mix))
    mix = limit(mix, -1.2)
    out = os.path.join(HERE, "mix_redis.wav")
    write_wav(out, mix, bits=24)
    print(f"wrote {out}: integrated={integrated(mix):.2f} LUFS, true_peak={true_peak(mix):.2f} dBTP")
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", out, "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    for line in r.stderr.splitlines():
        if line.strip().startswith(("I:", "LRA:", "Peak:")):
            print("ffmpeg", line.strip())


if __name__ == "__main__":
    main()
