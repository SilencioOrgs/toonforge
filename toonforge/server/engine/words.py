"""Word timings: python words.py <voice-file> <out.json> -> [{"word", "start", "end"}] (seconds)."""
import json
import sys

try:
    from faster_whisper import WhisperModel
except ImportError:
    sys.exit("faster-whisper is not installed. Run: python -m pip install faster-whisper")

if len(sys.argv) != 3:
    sys.exit("usage: python words.py <voice-file> <out.json>")

segments, _ = WhisperModel("small").transcribe(sys.argv[1], word_timestamps=True)
words = [{"word": w.word.strip(), "start": w.start, "end": w.end} for s in segments for w in s.words]
with open(sys.argv[2], "w", encoding="utf8") as f:
    json.dump(words, f, indent=2)
print(f"{len(words)} words")
