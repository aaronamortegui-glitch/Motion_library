# Fits sub-phases of the pill-stack move measured in measure_ref06.py (values copied from its output)
import sys, numpy as np; sys.path.insert(0, sys.argv[1]); from fit_samples import fit, nearest_token
raw=[437,437,437,437,437,436,436,434,431,427,420,411,397,374,330,254,211,189,176,167,160,156,153,151,151,151,150,149,146,143,139,134,126,117,105,90,70,41,0,0,0,39,135,107,86,71,59,50,43,38,33,30,28,27,26]
for name,a,b in [("step1 f1365-1385",5,25),("step3 f1402-1414",42,54)]:
    s=np.array(raw[a:b+1],float); p=(s-s[0])/(s[-1]-s[0]); bz,r=fit(p); print(name,len(s)-1,"f",bz,round(r,3),nearest_token(bz),np.round(p,2).tolist())
