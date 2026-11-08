import sys, json, numpy as np, soundfile as sf
from scipy import signal
B = sys.argv[1]
VOICE = (sys.argv[2] if len(sys.argv) > 2 else 'voice') == 'voice'
OUTF = sys.argv[3] if len(sys.argv) > 3 else B + '/mix.wav'
C = json.load(open(B + '/cues.json'))
SR = 48000
T = C['total'] + 0.3
N = int(T * SR)
rng = np.random.default_rng(7)

def sos(kind, f, order=2):
    return signal.butter(order, f, btype=kind, fs=SR, output='sos')
def filt(x, kind, f, order=2): return signal.sosfilt(sos(kind, f, order), x)
def noise(d): return rng.standard_normal(int(d * SR))
def tt(d): return np.arange(int(d * SR)) / SR
def env_ad(d, a, dec):
    t = tt(d); e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / dec); return e
def brown(d):
    w = noise(d); b = np.cumsum(w); b = filt(b, 'highpass', 20); return b / (np.abs(b).max() + 1e-9)
def norm(x, p=1.0): return x / (np.abs(x).max() + 1e-9) * p
def db(g): return 10 ** (g / 20)

class Track:
    def __init__(s): s.L = np.zeros(N); s.R = np.zeros(N)
    def add(s, t, x, g=1.0, pan=0.0):
        i = int(t * SR)
        if i >= N: return
        if i < 0: x = x[-i:]; i = 0
        x = x[:N - i]
        s.L[i:i + len(x)] += x * g * np.sqrt((1 - pan) / 2) * 1.414
        s.R[i:i + len(x)] += x * g * np.sqrt((1 + pan) / 2) * 1.414
    def addst(s, t, L, R, g=1.0):
        i = int(t * SR); L = L[:N - i]; R = R[:N - i]
        s.L[i:i + len(L)] += L * g; s.R[i:i + len(R)] += R * g

def reverb(x, dur=1.2, mix=.3, damp=3000):
    ir = noise(dur) * np.exp(-tt(dur) * 5.5 / dur); ir = filt(ir, 'lowpass', damp); ir /= np.sqrt((ir ** 2).sum())
    w = signal.fftconvolve(x, ir)[:len(x) + int(dur * SR)]
    y = np.zeros(len(w)); y[:len(x)] = x
    return y * (1 - mix) + w * mix * 0.6

# ------------------------------------------------------------ SFX
def swoosh(d=.5):
    n = noise(d); t = tt(d)
    lo = filt(n, 'bandpass', [300, 1500]); hi = filt(n, 'bandpass', [1500, 7000])
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    k = t / d
    return norm((lo * (1 - k) + hi * k) * e)
def impact():
    d = .6; t = tt(d); f = 70 * np.exp(-t * 3)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    c = filt(noise(d), 'lowpass', 2000) * np.exp(-t * 40) * .5
    return norm(s + c)
def water(d):
    n = noise(d); x = filt(n, 'bandpass', [350, 5000])
    mod = filt(rng.standard_normal(len(n)), 'lowpass', 25); mod = 0.6 + 0.4 * norm(mod)
    bub = np.zeros(len(n))
    for _ in range(int(d * 18)):
        st = rng.integers(0, max(1, len(n) - 3000)); L = int(SR * rng.uniform(.01, .03)); tb = np.arange(L) / SR
        f = rng.uniform(600, 1800) * (1 + tb * 20)
        bub[st:st + L] += np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tb * 120) * .5
    y = x * mod + bub * .25
    fade = np.minimum(1, np.minimum(tt(d) / .08, (d - tt(d)) / .15))
    return norm(y * fade)
def scrub(d):
    t = tt(d); n = noise(d)
    x = filt(n, 'bandpass', [1200, 6500]); sq = filt(n, 'bandpass', [150, 700])
    am = np.abs(np.cos(26 * t)) ** 3
    gur = 0.5 + 0.5 * np.sin(2 * np.pi * 37 * t)
    fade = np.minimum(1, np.minimum(t / .05, (d - t) / .08))
    return norm((x * .8 + sq * gur * .6) * (.15 + am) * fade)
def squirt(d):
    t = tt(d); x = filt(noise(d), 'bandpass', [500, 2500]) * (0.5 + 0.5 * np.sin(2 * np.pi * 18 * t) ** 2)
    e = np.minimum(1, np.minimum(t / .03, (d - t) / .1)) * (1 - .4 * t / d)
    return norm(x * e)
def bubble(f0=400, d=.06):
    t = tt(d); f = f0 * (1 + t * 25); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 60)
def underwater(d):
    x = filt(brown(d), 'lowpass', 260) * 1.0
    t = tt(d); x *= 0.75 + 0.25 * np.sin(2 * np.pi * .3 * t)
    for _ in range(int(d * 6)):
        st = rng.uniform(0, d - .1); i = int(st * SR); b = bubble(rng.uniform(250, 600), .08); x[i:i + len(b)] += b * .25
    fade = np.minimum(1, np.minimum(t / .3, (d - t) / .1))
    return norm(x * fade)
def tick(f):
    d = .04; t = tt(d); return (np.sin(2 * np.pi * f * t) + .4 * np.sin(2 * np.pi * f * 2.3 * t)) * np.exp(-t * 140)
def blip(f=520):
    d = .12; t = tt(d); fr = f * (1 + 1.2 * t / d)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 30) * np.minimum(1, t / .005)
def zap():
    d = .45; t = tt(d); sq = signal.square(2 * np.pi * 110 * t) * .3 + signal.sawtooth(2 * np.pi * 220 * t) * .2
    sw = np.sin(2 * np.pi * np.cumsum(1500 + 2500 * t / d) / SR) * .25
    e = np.exp(-t * 5) * np.minimum(1, t / .01)
    return norm(filt(sq, 'lowpass', 3000) * e + sw * e * (0.5 + 0.5 * signal.square(2 * np.pi * 30 * t)))
def squelch(d=.4):
    t = tt(d); n = filt(noise(d), 'lowpass', 1100)
    am = (0.5 + 0.5 * np.sin(2 * np.pi * (28 + 30 * t) * t)) ** 2
    e = np.minimum(1, t / .02) * np.exp(-t * 5)
    y = np.concatenate([n * am * e, np.zeros(int(.4 * SR))])
    for k in range(5): i = int((.05 + k * .06) * SR); b = bubble(rng.uniform(300, 700), .05); y[i:i + len(b)] += b * .4
    return norm(y)
def splash_echo():
    d = .5; t = tt(d)
    s = filt(noise(d), 'highpass', 700) * np.exp(-t * 12) + np.sin(2 * np.pi * 90 * t) * np.exp(-t * 15) * .8
    s = norm(s)
    out = np.zeros(int(2.4 * SR)); out[:len(s)] += s
    for k, g in enumerate([.55, .35, .22, .13]):
        i = int((k + 1) * .22 * SR); out[i:i + len(s)] += filt(s, 'lowpass', 2500 - k * 400) * g
    # scary stinger: detuned low saws
    d2 = 1.6; t2 = tt(d2)
    st = sum(signal.sawtooth(2 * np.pi * f * t2) for f in [55, 58.3, 82.4, 87.3]) * .25
    st = filt(st, 'lowpass', 600) * np.minimum(1, t2 / .05) * np.exp(-t2 * 2.2)
    out[:len(st)] += st * .45
    return norm(reverb(out, 1.5, .35))
def glitch():
    d = .3; y = np.zeros(int(d * SR))
    for k in range(6):
        i = int(k * .05 * SR); L = int(.03 * SR); tb = np.arange(L) / SR
        y[i:i + L] += signal.square(2 * np.pi * rng.uniform(300, 1800) * tb) * .3
    return filt(y, 'lowpass', 5000)
def sparkle():
    y = np.zeros(int(1.2 * SR))
    for k, f in enumerate([2093, 2637, 3136, 4186, 5274]):
        d = .6; t = tt(d); s = (np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * f * 2.01 * t)) * np.exp(-t * 7)
        i = int(k * .055 * SR); y[i:i + len(s)] += s * .35
    return norm(reverb(y, 1.0, .3))
def clink(base=2100, d=.35, n=1):
    y = np.zeros(int((d + .2) * SR))
    for k in range(n):
        t = tt(d); s = sum(np.sin(2 * np.pi * base * r * t + rng.uniform(0, 6)) * np.exp(-t * dd) * a for r, dd, a in [(1, 14, 1), (1.62, 18, .7), (2.47, 24, .5), (3.3, 30, .3)])
        s *= np.minimum(1, t / .001)
        i = int(k * .09 * SR); y[i:i + len(s)] += s * (1 if k == 0 else .5)
    return norm(y)
def thunk(f=110):
    d = .4; t = tt(d); s = np.sin(2 * np.pi * f * t) * np.exp(-t * 18) + filt(noise(d), 'lowpass', 1800) * np.exp(-t * 50) * .6
    return norm(s)
def buzzer():
    d = .22; y = np.zeros(int(.55 * SR))
    for k in range(2):
        t = tt(d); s = filt(signal.square(2 * np.pi * 140 * t) + signal.square(2 * np.pi * 147 * t), 'lowpass', 2200) * np.minimum(1, np.minimum(t / .01, (d - t) / .02))
        i = int(k * .27 * SR); y[i:i + len(s)] += s
    return norm(y) * .8 + np.pad(thunk(70), (0, len(y)))[:len(y)] * .5
def glug(d):
    t = tt(d); y = filt(noise(d), 'lowpass', 900) * .3
    k = 0.0
    while k < d - .12:
        b = bubble(rng.uniform(180, 330), .1) * 1.2; i = int(k * SR); y[i:i + len(b)] += b; k += rng.uniform(.09, .16)
    return norm(y * np.minimum(1, np.minimum(t / .05, (d - t) / .1)))
def hum(d):
    t = tt(d)
    base = filt(signal.sawtooth(2 * np.pi * 120 * t), 'lowpass', 700) * .5 + np.sin(2 * np.pi * 240 * t) * .15
    fan = filt(noise(d), 'bandpass', [200, 1500]) * .35
    e = np.minimum(1, np.minimum(t / .25, (d - t) / .05))
    return norm((base + fan) * e)
def pop():
    d = .08; t = tt(d); f = rng.uniform(.8, 1.4)
    s = filt(noise(d), 'bandpass', [900 * f, 3500 * f]) * np.exp(-t * 90) + np.sin(2 * np.pi * 320 * f * t) * np.exp(-t * 70) * .8
    return norm(s)
def beep():
    y = np.zeros(int(.8 * SR))
    for k in range(3):
        d = .14; t = tt(d); s = (signal.square(2 * np.pi * 2000 * t) * .3 + np.sin(2 * np.pi * 2000 * t)) * np.minimum(1, np.minimum(t / .005, (d - t) / .01))
        i = int(k * .25 * SR); y[i:i + len(s)] += filt(s, 'lowpass', 5000)
    return norm(y)
def latch():
    y = np.zeros(int(.7 * SR)); c = filt(noise(.03), 'highpass', 1500) * np.exp(-tt(.03) * 150); y[:len(c)] += c
    d = .4; t = tt(d); cr = filt(signal.sawtooth(2 * np.pi * (90 + 40 * np.sin(2 * np.pi * 3 * t)) * t), 'bandpass', [400, 2500]) * np.sin(np.pi * t / d) * .25
    y[int(.08 * SR):int(.08 * SR) + len(cr)] += cr
    return norm(y)
def plink():
    d = .25; t = tt(d); f = 1100 * (1 + 3 * t / .05).clip(0, 2.4)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 35)
    return norm(reverb(s, .8, .3))
def ping():
    d = 2.5; t = tt(d); f0 = 1046
    s = sum(np.sin(2 * np.pi * f0 * r * t) * np.exp(-t * dd) * a for r, dd, a in [(1, 1.8, 1), (2.76, 3, .5), (5.4, 5, .25), (1.007, 1.8, .6)])
    dr = sum(signal.sawtooth(2 * np.pi * f * t) for f in [65.4, 69.3, 98]) * .2
    dr = filt(dr, 'lowpass', 500) * np.minimum(1, t / .2) * np.exp(-t * 1.2)
    return norm(reverb(s * .8 + dr * .6, 1.8, .35))

# ------------------------------------------------------------ music (Karplus-Strong plucks)
def pluck(f, d=.6, bright=.5):
    Nn = int(SR / f); n = int(d * SR)
    x = np.zeros(n); x[:Nn] = filt(rng.uniform(-1, 1, Nn), 'lowpass', 2000 + 6000 * bright)
    a = np.zeros(Nn + 2); a[0] = 1; a[Nn] = -.497; a[Nn + 1] = -.497
    y = signal.lfilter([1], a, x)
    return y * np.minimum(1, (d - tt(d)) / .05)
def mnote(m): return 440 * 2 ** ((m - 69) / 12)
def music(start, end, dark=False):
    bpm = 116; beat = 60 / bpm; L = end - start; out = np.zeros(int((L + 1) * SR))
    prog = [(57, [69, 72, 76]), (53, [69, 72, 77]), (55, [67, 71, 74]), (52, [68, 71, 76])] if not dark else [(45, [57, 60, 64]), (46, [58, 62, 65]), (45, [57, 60, 64]), (44, [56, 59, 64])]
    nb = int(L / beat) + 1
    for b in range(nb):
        t0 = b * beat; bar = (b // 4) % 4; root, ch = prog[bar]
        i = int(t0 * SR)
        if b % 2 == 0 or dark:
            s = pluck(mnote(root - 12), .5, .2) * (.9 if not dark else .7); out[i:i + len(s)] += s
        # off-beat plucks
        for k, sub in enumerate([0, .5]):
            if dark and sub == .5: continue
            note = ch[(b * 2 + k) % 3] + (12 if (b % 4 == 3 and k == 1 and not dark) else 0)
            s = pluck(mnote(note), .35, .6) * .35; j = int((t0 + sub * beat) * SR); out[j:j + len(s)] += s
        # tick hat
        h = filt(noise(.03), 'highpass', 7000) * np.exp(-tt(.03) * 150) * (.12 if not dark else .18)
        j = int((t0 + .5 * beat) * SR); out[j:j + len(h)] += h
    out = out[:int(L * SR)]
    return out

# ------------------------------------------------------------ build
narr, nsr = sf.read(B + '/narration.wav')
narr = signal.resample_poly(narr, 2, 1) if nsr == 24000 else narr
narr = norm(narr, db(-3))
nar = np.zeros(N); nar[:min(N, len(narr))] = narr[:N]

fx = Track(); amb = Track(); mus = Track()
S = C['scenes']
# ambience: kitchen everywhere except showcase and inside
kit = filt(brown(T), 'lowpass', 400) * .5 + np.sin(2 * np.pi * 60 * tt(T)) * .04
kitmask = np.ones(N)
def mask_off(a, b, m, ramp=.08):
    ia, ib = int(a * SR), int(b * SR); m[ia:ib] = 0
mask_off(0, C['swoosh'][0] + .2, kitmask)
mask_off(C['underwater'][0][0], C['underwater'][0][1], kitmask)
kitmask = filt(kitmask, 'lowpass', 8)
amb.add(0, kit * kitmask, db(-34))
# showcase: airy pad shimmer
sh_d = C['swoosh'][0] + .1
shim = filt(noise(sh_d), 'bandpass', [3000, 9000]) * .05 + sum(np.sin(2 * np.pi * f * tt(sh_d)) for f in [1318, 1568, 1976]) * .03
amb.add(0, shim * np.minimum(1, (sh_d - tt(sh_d)) / .1), db(-14))
for t in [.6, 1.7, 2.9, 3.6]: fx.add(t, sparkle(), db(-24), pan=rng.uniform(-.5, .5))

fx.add(C['swoosh'][0] - .1, swoosh(.5), db(-6), pan=0)
fx.add(C['impact'][0] - .05, impact(), db(-10))
for a, b in C['water']: amb.add(a, water(b - a), db(-21))
for a, b in C['squirt']: fx.add(a, squirt(b - a), db(-16))
for a, b in C['scrub']: fx.add(a, scrub(b - a), db(-12))
fx.add(C['dive'][0], swoosh(.5), db(-12)); fx.add(C['dive'][0] + .4, bubble(300, .2) + bubble(500, .2), db(-12))
for a, b in C['underwater']: amb.add(a, underwater(b - a), db(-18))
# ticks accelerating
t = C['tickStart']; k = 0
while t < C['tickEnd']:
    u = (t - C['tickStart']) / (C['tickEnd'] - C['tickStart'])
    fx.add(t, tick(1900 if k % 2 == 0 else 1350), db(-16), pan=.15 if k % 2 else -.15)
    t += .48 * (1 - u) ** 1.6 + .07; k += 1
fx.add(C['bactAppear'], blip(420), db(-14))
for i, g in enumerate(C['gens']): fx.add(g, blip(520 + i * 40), db(-18 - i * .5), pan=rng.uniform(-.4, .4))
for x in C['xrayOn']: fx.add(x, sparkle(), db(-22))
fx.add(C['squeeze'], squelch(.45), db(-8))
fx.add(C['splash'] - .25, splash_echo(), db(-9))
fx.add(C['glitch'], glitch(), db(-20))
for g in C['glint']: fx.add(g, sparkle(), db(-16))
fx.add(C['plateClink'], clink(1900, .4, 2), db(-14))
fx.add(C['cupDoor'], thunk(130), db(-9))
fx.add(C['vinegar'][0], glug(C['vinegar'][1] - C['vinegar'][0]), db(-15))
fx.add(C['toss'], swoosh(.4), db(-15))
fx.add(C['slam'] - .02, thunk(95), db(-7)); fx.add(C['slam'], clink(3200, .1, 1), db(-22))
h0, h1 = C['hum']; amb.add(h0, hum(h1 - h0), db(-21))
for p in C['pops']: fx.add(p, pop(), db(-15 + rng.uniform(-3, 2)), pan=rng.uniform(-.5, .5))
fx.add(C['beep'], beep(), db(-15))
fx.add(C['doorOpen'], latch(), db(-14))
fx.add(C['place'], squelch(.25), db(-17))
fx.add(C['drop'], plink(), db(-11))
fx.add(C['ping'], ping(), db(-9))
for c in C['clinks']: fx.add(c, clink(3300, .22, 1), db(-17), pan=-.2)

# music
ms, me = 0.0, C['musicStop']
m1 = music(ms, me + .6)
# underwater lowpass during inside section
uw_a, uw_b = C['underwater'][0]
lp = filt(m1, 'lowpass', 450)
w = np.zeros(len(m1)); w[int(uw_a * SR):int(uw_b * SR)] = 1; w = filt(w, 'lowpass', 6)
m1 = m1 * (1 - w) + lp * w * 1.6
# tape stop at musicStop
i0 = int((me - .05) * SR); L = int(.55 * SR)
seg_ = m1[i0:i0 + L * 2]
ph = np.cumsum(np.linspace(1, 0, L)); ph = ph[ph < len(seg_) - 1]
ts = np.interp(ph, np.arange(len(seg_)), seg_) * np.linspace(1, 0, len(ph))
m1 = np.concatenate([m1[:i0], ts])
mus.add(0, m1, db(-14))
m2 = music(C['musicResume'], C['musicEnd'] + .3, dark=True)
d2 = len(m2) / SR; m2 *= np.minimum(1, np.minimum(tt(d2) / .4, (d2 - tt(d2)) / .3))
mus.add(C['musicResume'], m2, db(-15))

# ducking music by narration envelope
ne = filt(np.abs(nar), 'lowpass', 6); ne = ne / (ne.max() + 1e-9)
duck = 1 - .45 * np.clip(ne * 3, 0, 1)
if not VOICE:
    nar = nar * 0; duck = np.ones(N) * db(3)
L = nar * 1.0 + fx.L + amb.L + mus.L * duck
R = nar * 1.0 + fx.R + amb.R + mus.R * duck
mx = np.stack([L, R], 1)
mx = np.tanh(mx * 1.1) / np.tanh(1.1)
mx = norm(mx, db(-1))
sf.write(OUTF, mx.astype(np.float32), SR)
print('ok', mx.shape[0] / SR)
if len(sys.argv) > 4:
    def r(x): return 20*np.log10(np.sqrt(np.mean(x**2))+1e-9)
    for a in range(0, int(T), 3):
        sl = slice(a*SR, (a+3)*SR)
        print(f"{a:2d}s nar {r(nar[sl]):6.1f} fx {r(fx.L[sl]):6.1f} amb {r(amb.L[sl]):6.1f} mus {r((mus.L*duck)[sl]):6.1f}")
