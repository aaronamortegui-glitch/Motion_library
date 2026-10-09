import cv2, numpy as np, sys, json
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
vid, out = sys.argv[1], sys.argv[2]
cap = cv2.VideoCapture(vid); fps = cap.get(cv2.CAP_PROP_FPS)
prev=None; prevh=None; E=[]; H=[]; F=[]
while True:
    ok, f = cap.read()
    if not ok: break
    g = cv2.cvtColor(cv2.resize(f,(480,270)), cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(cv2.resize(f,(480,270)), cv2.COLOR_BGR2HSV)
    h = cv2.calcHist([hsv],[0,1],None,[30,32],[0,180,0,256]); cv2.normalize(h,h)
    if prev is not None:
        E.append(float(np.mean(cv2.absdiff(g,prev))))
        H.append(float(1-cv2.compareHist(h,prevh,cv2.HISTCMP_CORREL)))
        fl = cv2.calcOpticalFlowFarneback(prev,g,None,0.5,3,15,3,5,1.2,0)
        mag = np.linalg.norm(fl,axis=2); F.append([float(np.mean(mag)), float(np.mean(fl[...,0])), float(np.mean(fl[...,1]))])
    else:
        E.append(0); H.append(0); F.append([0,0,0])
    prev=g; prevh=h
E=np.array(E); H=np.array(H); F=np.array(F)
json.dump({"fps":fps,"diff":E.tolist(),"hist":H.tolist(),"flow":F.tolist()}, open(out+".json","w"))
t=np.arange(len(E))/fps
fig,ax=plt.subplots(3,1,figsize=(16,8),sharex=True)
ax[0].plot(t,E); ax[0].set_ylabel("pixel diff")
ax[1].plot(t,H,color="r"); ax[1].set_ylabel("hist change (cuts)")
ax[2].plot(t,F[:,0],label="flow mag"); ax[2].plot(t,F[:,1],label="dx"); ax[2].plot(t,F[:,2],label="dy"); ax[2].legend(); ax[2].set_ylabel("optical flow px/f (480w)")
for a in ax: a.grid(alpha=.3); a.set_xticks(np.arange(0,t[-1]+1,1))
plt.tight_layout(); plt.savefig(out+".png",dpi=80)
cuts=[i for i in range(len(H)) if H[i]>0.3]
print("fps",fps,"frames",len(E)); print("candidate cuts (frame,t,hist,diff):")
for i in cuts: print(i, round(i/fps,2), round(H[i],2), round(E[i],1))
