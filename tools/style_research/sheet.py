# sheet.py video out start_s end_s step_frames cols width
import cv2, numpy as np, sys
vid,out,a,b,step,cols,w = sys.argv[1],sys.argv[2],float(sys.argv[3]),float(sys.argv[4]),int(sys.argv[5]),int(sys.argv[6]),int(sys.argv[7])
cap=cv2.VideoCapture(vid); fps=cap.get(cv2.CAP_PROP_FPS)
f0,f1=int(a*fps),int(b*fps); cap.set(cv2.CAP_PROP_POS_FRAMES,f0)
tiles=[]; i=f0
while i<=f1:
    ok,f=cap.read()
    if not ok: break
    if (i-f0)%step==0:
        h=int(f.shape[0]*w/f.shape[1]); t=cv2.resize(f,(w,h),interpolation=cv2.INTER_AREA)
        lab=f"f{i} {i/fps:.2f}s"; cv2.rectangle(t,(0,0),(len(lab)*9+6,18),(0,0,0),-1)
        cv2.putText(t,lab,(3,13),cv2.FONT_HERSHEY_SIMPLEX,0.45,(0,255,255),1,cv2.LINE_AA); tiles.append(t)
    i+=1
h=tiles[0].shape[0]; rows=(len(tiles)+cols-1)//cols
img=np.full((rows*(h+4),cols*(w+4),3),40,np.uint8)
for k,t in enumerate(tiles):
    r,c=divmod(k,cols); img[r*(h+4):r*(h+4)+h,c*(w+4):c*(w+4)+w]=t
cv2.imwrite(out,img); print(out,len(tiles))
