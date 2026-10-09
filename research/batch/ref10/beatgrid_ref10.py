# ref10: cut times vs beat grid (librosa), in beats
import librosa, numpy as np, sys
y,sr=librosa.load(sys.argv[1],sr=22050)
tempo,beats=librosa.beat.beat_track(y=y,sr=sr,units='time'); print("tempo",tempo,"n beats",len(beats))
cuts=[]; 
for line in open(sys.argv[2]).read().splitlines()[2:]:
    f,t,h,d=line.split(); f=int(f); h=float(h)
    if h>=0.3 and (not cuts or f-cuts[-1]>3): cuts.append(f)
bp=np.median(np.diff(beats))
for f in cuts:
    t=f/30; k=np.argmin(np.abs(beats-t)); ph=(t-beats[k])/bp
    print(f"f{f} {t:.2f}s  nearest beat {beats[k]:.2f}  offset {ph:+.2f} beat")
print("intervals (beats):",np.round(np.diff(np.array(cuts)/30)/bp,2).tolist())
