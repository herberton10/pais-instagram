import sys, json, re, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
d=sys.argv[1]; voice="pm_alex"; speed=1.25; SR=24000
k=Kokoro(d+"/tts/kokoro-v1.0.onnx", d+"/tts/voices-v1.0.bin")
segs=json.load(open(d+"/build/script.json"))
def trim(a,th=0.01):
    idx=np.where(np.abs(a)>th)[0]; return a[max(0,idx[0]-120):idx[-1]+600]
GAP=0.12; LEAD=0.15
scenes=[]; caps=[]; clips=[]; t=0.0
for i,sg in enumerate(segs):
    win=sg["t1"]-sg["t0"]
    tt=t+LEAD; sents=[]
    for s in sg["s"]:
        a,sr=k.create(s,voice=voice,speed=speed,lang="pt-br"); a=trim(a)
        dur=len(a)/sr; clips.append((tt,a)); sents.append((tt,dur,s)); tt+=dur+GAP
    narr_end=tt-GAP
    tail=1.6 if i==len(segs)-1 else 0.3
    D=max(win, narr_end-t+tail)
    scenes.append({"i":i,"start":round(t,3),"dur":round(D,3),"narr":[[round(a,3),round(b,3),c] for a,b,c in sents]})
    # captions
    for (st,dur,s) in sents:
        words=s.split()
        chunks=[];cur=[]
        for w in words:
            if cur and (len(" ".join(cur+[w]))>16 or len(cur)>=3):
                chunks.append(cur);cur=[]
            cur.append(w)
            if re.search(r"[.,:…]$",w) and len(" ".join(cur))>6: chunks.append(cur);cur=[]
        if cur: chunks.append(cur)
        L=[len(" ".join(c))+2 for c in chunks]; tot=sum(L); a=st
        for c,l in zip(chunks,L):
            b=a+dur*l/tot; caps.append({"t0":round(a,3),"t1":round(b,3),"text":" ".join(c)}); a=b
    t+=D
total=t
out=np.zeros(int((total+0.5)*SR),dtype=np.float32)
for st,a in clips:
    n=int(st*SR); out[n:n+len(a)]+=a
sf.write(d+"/build/narration.wav",out,SR)
json.dump({"total":round(total,3),"scenes":scenes,"captions":caps},open(d+"/build/timeline.json","w"),ensure_ascii=False,indent=1)
for s in scenes: print(s["i"],s["start"],s["dur"])
print("total",total, len(caps),"captions")
