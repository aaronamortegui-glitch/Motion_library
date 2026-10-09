# ref14: scene-change times (hist jumps, lower threshold) vs librosa beat grid
import cv2, numpy as np, sys, json, subprocess, librosa
vid=sys.argv[1]; cap=cv2.VideoCapture(vid); fps=cap.get(cv2.CAP_PROP_FPS)
prev=None; ch=[]; i=0
while True:
    ok,f=cap.read()
    if not ok: break
    h=cv2.calcHist([cv2.resize(f,(160,90))],[0,1,2],None,[8,8,8],[0,256]*3); h=cv2.normalize(h,h).flatten()
    if prev is not None:
        d=cv2.compareHist(prev,h,cv2.HISTCMP_BHATTACHARYYA)
        if d>0.25: ch.append(round(i/fps,3))
    prev=h; i+=1
# merge within 0.1 s
t=[]
for x in ch:
    if not t or x-t[-1]>0.1: t.append(x)
print("scene changes:",t); print("intervals:",np.round(np.diff(t),3).tolist())
y,sr=librosa.load(sys.argv[2] if len(sys.argv)>2 else vid,sr=22050,mono=True)
tempo,beats=librosa.beat.beat_track(y=y,sr=sr,units='time')
print("tempo",tempo,"beats",np.round(beats,2).tolist())
bp=np.median(np.diff(beats))
for x in t:
    k=np.argmin(np.abs(beats-x)); print(f"{x:6.2f}  nearest beat {beats[k]:.2f}  off {1000*(x-beats[k]):+.0f} ms  ({(x-beats[k])/bp:+.2f} beat)")
