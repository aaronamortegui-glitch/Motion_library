"""Word timings for a continuous VO read (openai-whisper, word_timestamps). Usage: python tools/vo_words.py in.mp3 out.json"""
import json, sys, whisper
m = whisper.load_model("small")
r = m.transcribe(sys.argv[1], word_timestamps=True, language="en")
words = [{"w": w["word"].strip(), "s": round(w["start"], 3), "e": round(w["end"], 3)} for seg in r["segments"] for w in seg["words"]]
json.dump(words, open(sys.argv[2], "w"), indent=0)
print(r["text"])
