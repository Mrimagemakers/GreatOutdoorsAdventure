"""Build one rigged, textured character GLB from the MakeHuman base mesh (CC0).
usage: python3 build.py <id> <out.glb>"""
import sys, os, json, struct, math
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from mhcore import load_obj, morph, skeleton, weights
from chars import CHARS

TEX = 2048
rng = np.random.default_rng(7)

def hexrgb(h):
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])

# ------------------------------------------------------------------ skeleton (merged to a game rig)
SIDE_KEEP = ['clavicle', 'shoulder01', 'upperarm01', 'upperarm02', 'lowerarm01', 'lowerarm02', 'wrist',
             'metacarpal1', 'metacarpal2', 'metacarpal3', 'metacarpal4'] + [f'finger{a}-{b}' for a in range(1, 6) for b in range(1, 4)] + \
            ['pelvis', 'upperleg01', 'upperleg02', 'lowerleg01', 'lowerleg02', 'foot']
KEEP = ['root', 'spine05', 'spine04', 'spine03', 'spine02', 'spine01', 'neck01', 'neck02', 'neck03', 'head'] + \
       [f'{b}.{s}' for s in 'LR' for b in SIDE_KEEP]

def build(cid, out):
    C = CHARS[cid]
    V, VT, F = load_obj()
    SK = skeleton(); J = SK['joints']; BONES = SK['bones']
    m = morph(V, C['gender'], C['age'], C['muscle'], C['weight'], C['race'], tuple(C.get('extra', ())))
    groups = {}
    for g, f in F: groups.setdefault(g, []).append(f)
    body_idx = np.array(sorted({i for f in groups['body'] for i, _ in f}))
    ymin, ymax = m[body_idx, 1].min(), m[body_idx, 1].max()
    s = C['height'] / (ymax - ymin)  # metres per base unit
    P = (m - [0, ymin, 0]) * s       # feet on y = 0, metres, facing +z
    jp = lambda name: P[J[name]].mean(0)
    # bones
    keep = [b for b in KEEP if b in BONES]
    def kept_ancestor(b):
        while b not in keep: b = BONES[b]['parent']
        return b
    bpos = {b: jp(BONES[b]['head']) for b in keep}
    bparent = {b: (kept_ancestor(BONES[b]['parent']) if BONES[b]['parent'] else None) for b in keep}
    bi = {b: i for i, b in enumerate(keep)}
    # weights merged onto kept bones, top 4 per vertex
    W = weights(); nv = len(P)
    acc = [dict() for _ in range(nv)]
    for b, lst in W.items():
        kb = bi[kept_ancestor(b)]
        for v, w in lst: acc[v][kb] = acc[v].get(kb, 0) + w
    head_i = bi['head']
    JI = np.zeros((nv, 4), np.uint8); JW = np.zeros((nv, 4), np.float32); dom = np.full(nv, head_i)
    for v in range(nv):
        it = sorted(acc[v].items(), key=lambda t: -t[1])[:4]
        if not it: it = [(head_i, 1.0)]
        tot = sum(w for _, w in it)
        for k, (b, w) in enumerate(it): JI[v, k] = b; JW[v, k] = w / tot
        dom[v] = it[0][0]
    dname = np.array([keep[d] for d in dom])
    # landmarks
    def gcen(g):
        ids = sorted({v for f in groups[g] for v, _ in f}); return P[ids].mean(0)
    eyeL, eyeR = gcen('helper-l-eye'), gcen('helper-r-eye')
    eyeC = (eyeL + eyeR) / 2; eyeHalf = abs(eyeL[0])
    mouth = (jp(BONES['oris05']['head']) + jp(BONES['oris01']['head'])) / 2; mouth[1] = jp(BONES['oris06']['tail'])[1] * 0.5 + jp(BONES['oris01']['tail'])[1] * 0.5
    corner = abs(jp(BONES['oris03.L']['tail'])[0])
    # the mouth slit: base-mesh vertex 493 sits at the centre of the inner lip line (hm08 topology)
    mouth = P[493].copy(); mouth[0] = 0; mouth[2] = P[body_idx[(np.abs(P[body_idx, 0]) < 0.003) & (np.abs(P[body_idx, 1] - mouth[1]) < 0.008)], 2].max()
    corner = max(corner, 0.021 * C['height'] / 1.75)
    chinY = jp(BONES['special04']['head'])[1]; headTop = jp(BONES['head']['tail'])[1]
    headJ = bpos['head']; neckBase = bpos['neck01']
    hipY = bpos['root'][1]; kneeY = bpos['lowerleg01.L'][1]; ankleY = bpos['foot.L'][1]
    U = s * 10  # 1 dm in these units (landmark distances below were tuned in base decimetres)

    # ------------------------------------------------------------------ per-vertex regions
    def has(prefixes): return np.array([any(n.startswith(p) for p in prefixes) for n in dname])
    torsoB = has(['spine', 'clavicle', 'shoulder', 'breast'])
    armB = has(['upperarm', 'lowerarm'])
    handB = has(['wrist', 'metacarpal', 'finger'])
    legB = has(['pelvis', 'upperleg', 'lowerleg']) | (dname == 'root')
    footB = has(['foot'])
    neckB = has(['neck'])
    y = P[:, 1]
    belt = hipY + 0.07 * C['height'] / 1.75
    bootTop = ankleY + C.get('bootH', 0.17) * C['height'] / 1.75
    limb = armB | handB
    vneck = (P[:, 2] > neckBase[2]) & (y > neckBase[1] - C.get('vneck', 0.035)) & (np.abs(P[:, 0]) < (y - (neckBase[1] - C.get('vneck', 0.035))) * 0.9 + 0.012)
    shirt = ((armB | ((torsoB | legB | neckB) & ~limb & (y > belt))) & ~(neckB & (y > neckBase[1] - 0.004)) & ~vneck).astype(float)
    pants = ((~limb) & (y <= belt) & (y > bootTop)).astype(float)
    boots = ((~limb) & (y <= bootTop)).astype(float)
    shirt[handB] = 0
    torsoR = ((torsoB | neckB | legB) & ~limb & (y > belt)).astype(float)
    if C.get('shortSleeves'):
        elbowY = None
    skin = np.clip(1 - shirt - pants - boots, 0, 1)

    # ------------------------------------------------------------------ geometry: triangles of body + helpers
    def tris(group_names):
        out = []
        for g in group_names:
            for f in groups.get(g, []):
                for k in range(1, len(f) - 1): out.append((f[0], f[k], f[k + 1]))
        return out
    body_t = tris(['body'])
    # vertex normals of the body (position-index based, so seams stay smooth)
    def vnormals(tl):
        n = np.zeros_like(P)
        for a, b, c in tl:
            A, B, Cc = P[a[0]], P[b[0]], P[c[0]]; fn = np.cross(B - A, Cc - A)
            n[a[0]] += fn; n[b[0]] += fn; n[c[0]] += fn
        l = np.linalg.norm(n, axis=1, keepdims=True); l[l == 0] = 1; return n / l
    N = vnormals(body_t + tris(['helper-l-eye', 'helper-r-eye']))
    # clothing thickness, smoothed over the mesh so hems taper
    thick = shirt * C.get('topT', 0.013) + pants * 0.010 + boots * 0.014
    if C.get('vest'): thick += torsoB * (y > belt) * 0.006
    adj = [[] for _ in range(nv)]
    for a, b, c in body_t:
        for p, q in ((a[0], b[0]), (b[0], c[0]), (c[0], a[0])): adj[p].append(q); adj[q].append(p)
    for _ in range(6):
        thick = np.array([0.5 * thick[i] + 0.5 * (thick[adj[i]].mean() if adj[i] else thick[i]) for i in range(nv)])
    # fabric drapes over the body: smooth away skin detail under clothes (nipples, navel, muscle lines)
    cloth = np.clip(shirt + pants + boots, 0, 1)
    for _ in range(3): cloth = np.array([0.5 * cloth[i] + 0.5 * (cloth[adj[i]].mean() if adj[i] else cloth[i]) for i in range(nv)])
    Ps = P.copy()
    nb = [np.array(a) for a in adj]
    for _ in range(8):
        avg = np.array([Ps[a].mean(0) if len(a) else Ps[i] for i, a in enumerate(nb)])
        c = (0.55 * cloth)[:, None]; Ps = Ps * (1 - c) + avg * c
    Pc = Ps + N * thick[:, None]

    # ------------------------------------------------------------------ texture: paint in UV space from 3D position
    tex = np.zeros((TEX, TEX, 3), np.float32); cover = np.zeros((TEX, TEX), bool)
    posmap = np.zeros((TEX, TEX, 3), np.float32); nmap = np.zeros((TEX, TEX, 3), np.float32); reg = np.zeros((TEX, TEX, 5), np.float32)
    vreg = np.stack([skin, shirt, pants, boots, torsoR], 1)
    for a, b, c in body_t:
        uv = np.array([VT[a[1]], VT[b[1]], VT[c[1]]]) * [TEX, TEX]; uv[:, 1] = TEX - uv[:, 1]
        x0, y0 = np.floor(uv.min(0)).astype(int) - 1; x1, y1 = np.ceil(uv.max(0)).astype(int) + 1
        x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, TEX - 1), min(y1, TEX - 1)
        if x1 < x0 or y1 < y0: continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        d = (uv[1, 1] - uv[2, 1]) * (uv[0, 0] - uv[2, 0]) + (uv[2, 0] - uv[1, 0]) * (uv[0, 1] - uv[2, 1])
        if abs(d) < 1e-9: continue
        l0 = ((uv[1, 1] - uv[2, 1]) * (xs - uv[2, 0]) + (uv[2, 0] - uv[1, 0]) * (ys - uv[2, 1])) / d
        l1 = ((uv[2, 1] - uv[0, 1]) * (xs - uv[2, 0]) + (uv[0, 0] - uv[2, 0]) * (ys - uv[2, 1])) / d
        l2 = 1 - l0 - l1
        e = -0.02
        inside = (l0 >= e) & (l1 >= e) & (l2 >= e)
        if not inside.any(): continue
        Y, X = (ys[inside] - 0.5).astype(int), (xs[inside] - 0.5).astype(int)
        L = np.stack([l0[inside], l1[inside], l2[inside]], 1)
        ids = [a[0], b[0], c[0]]
        posmap[Y, X] = L @ P[ids]; nmap[Y, X] = L @ N[ids]; reg[Y, X] = L @ vreg[ids]; cover[Y, X] = True
    pix = np.nonzero(cover)
    p = posmap[pix]; n = nmap[pix]; r = reg[pix]
    colr = paint(C, p, n, r, dict(eyeL=eyeL, eyeR=eyeR, eyeC=eyeC, eyeHalf=eyeHalf, mouth=mouth, corner=corner, chinY=chinY, headTop=headTop,
                                  headJ=headJ, U=U, belt=belt, neckBase=neckBase, shoulderY=bpos['upperarm01.L'][1], bootTop=bootTop, kneeY=kneeY, hipY=hipY, height=C['height']))
    tex[pix] = colr
    img = Image.fromarray((np.clip(tex, 0, 1) * 255).astype(np.uint8))
    # bleed colour past UV seams so filtering never shows black
    mask = Image.fromarray((cover * 255).astype(np.uint8))
    for _ in range(6):
        grown = img.filter(ImageFilter.MaxFilter(3)); m2 = mask.filter(ImageFilter.MaxFilter(3))
        img = Image.composite(img, grown, mask); mask = m2

    # ------------------------------------------------------------------ hair shell: copies of scalp faces pushed out
    hair_t = []
    scalp = scalp_mask(C, P, N, dname, eyeC, mouth, headTop, U)
    for t in body_t:
        if all(scalp[v] > 0 for v, _ in t): hair_t.append(t)
    hair_off = np.array([scalp[v] for v in range(nv)])
    border = np.array([scalp[v] > 0 and any(scalp[q] == 0 for q in adj[v]) for v in range(nv)])
    near = np.array([scalp[v] > 0 and any(border[q] for q in adj[v]) for v in range(nv)])
    hair_off = np.where(border, 0.0007, np.where(near, hair_off * 0.45 + 0.0007, hair_off))

    # ------------------------------------------------------------------ assemble primitives (split by v/vt)
    prims = []
    def prim(tl, posfn, name, uvfn=None):
        key = {}; pos = []; nor = []; uvs = []; ji = []; jw = []; idx = []
        for t in tl:
            for v, vt in t:
                k = (v, vt)
                if k not in key:
                    key[k] = len(pos); pos.append(posfn(v)); nor.append(N[v]); uvs.append(uvfn(v, vt) if uvfn else (VT[vt][0], 1 - VT[vt][1]))
                    ji.append(JI[v]); jw.append(JW[v])
                idx.append(key[k])
        prims.append(dict(name=name, pos=np.array(pos, np.float32), nor=np.array(nor, np.float32), uv=np.array(uvs, np.float32),
                          ji=np.array(ji, np.uint8), jw=np.array(jw, np.float32), idx=np.array(idx, np.uint32)))
    prim(body_t, lambda v: Pc[v], 'body')
    if hair_t: prim(hair_t, lambda v: P[v] + N[v] * hair_off[v], 'hair')
    # eyes: helper spheres with a planar UV facing forward
    for side, g in (('L', 'helper-l-eye'), ('R', 'helper-r-eye')):
        tl = tris([g]); vs = sorted({v for t in tl for v, _ in t}); cen = P[vs].mean(0); rad = np.abs(P[vs] - cen).max()
        prim(tl, lambda v: P[v], 'eye', lambda v, vt, cen=cen, rad=rad: (0.5 + (P[v][0] - cen[0]) / (2 * rad), 0.5 - (P[v][1] - cen[1]) / (2 * rad)))
    lash = [g for g in groups if 'eyelashes' in g]
    lt = tris(lash)
    eye_img = paint_eye(C)
    extras = dict(headTop=float(headTop), headJ=headJ.tolist(), eyeC=eyeC.tolist(), chinY=float(chinY),
                  headR=float(abs(P[[v for v in range(nv) if dname[v] == 'head' and abs(P[v][1] - eyeC[1]) < 0.02]][:, 0]).max()) if True else 0.09,
                  height=C['height'], hair=C['hair'])
    write_glb(out, keep, bpos, bparent, prims, img, eye_img, C, extras)

def hair_amount(style, rel, k):
    """How far above the hairline a point is (metres, >0 = hair). rel is relative to the eye centre; the head centre sits ~7 cm behind it."""
    x, yy, z = rel[:, 0], rel[:, 1], rel[:, 2] + 0.072 * k
    th = np.arctan2(np.abs(x), z)              # 0 front .. pi back
    front = np.clip(np.cos(th), 0, 1); back = np.clip(-np.cos(th), 0, 1)
    side = 1 - front - back
    line = 0.058 * k * front ** 2 + 0.024 * k * (1 - front ** 2) * (1 - back) - 0.055 * k * back ** 1.5
    if style == 'bob': line = np.minimum(line, np.where(z < 0.085 * k, -0.075 * k + 0.02 * k * front, line))
    if style in ('bun', 'braid'): line = line + 0.004 * k * side
    return yy - line

def scalp_mask(C, P, N, dname, eyeC, mouth, headTop, U):
    """Hair-shell thickness per vertex (0 = no hair)."""
    k = C['height'] / 1.75
    isHead = np.isin(dname, ['head', 'neck03', 'neck02'])
    amt = hair_amount(C['hair'], P - eyeC, k)
    base = {'crop': 0.0025, 'short': 0.0045, 'bun': 0.007, 'braid': 0.007, 'bob': 0.010}[C['hair']]
    t = np.where(isHead & (amt > 0.002), base, 0.0)
    if C['hair'] == 'bob': t = np.where(t > 0, base + np.clip(-(P[:, 1] - eyeC[1]), 0, 0.08) * 0.22, 0)
    return t

def noise3(p, f, seed=0):
    x, y, z = p[:, 0] * f, p[:, 1] * f, p[:, 2] * f
    return (np.sin(x * 1.7 + y * 2.3 + seed) * np.cos(y * 1.3 - z * 2.1 + seed * 2) + np.sin(z * 2.9 + x * 0.7 + seed * 3) * 0.5 +
            np.sin((x + y + z) * 3.7 + seed) * 0.25) / 1.75

def paint(C, p, n, r, L):
    skin = hexrgb(C['skin']); out = np.zeros((len(p), 3))
    k = L['height'] / 1.75
    # ---- skin
    sk = np.tile(skin, (len(p), 1))
    v = noise3(p, 60) * 0.035 + noise3(p, 220, 3) * 0.02 + rng.normal(0, 0.012, len(p))
    sk *= (1 + v)[:, None]
    rel = p - L['eyeC']
    head = (p[:, 1] > L['chinY'] - 0.06 * k)
    warm = np.array([0.82, 0.32, 0.28]) if skin.mean() > 0.45 else np.array([0.5, 0.18, 0.14])
    def blob(cx, cy, cz, rx, ry, amt, col, rz=0.06):
        d = ((rel[:, 0] - cx) / rx) ** 2 + ((rel[:, 1] - cy) / ry) ** 2 + ((rel[:, 2] - cz) / rz) ** 2
        w = np.exp(-d) * amt * head
        return w[:, None] * (col - sk)
    for sx in (1, -1):
        sk += blob(sx * 0.042 * k, -0.035 * k, 0.03, 0.022 * k, 0.018 * k, 0.13, warm)         # cheeks
        sk += blob(sx * L['eyeHalf'], -0.004, 0.02, 0.018 * k, 0.010 * k, 0.22, sk.mean(0) * 0.62)  # under-eye shade
        sk += blob(sx * L['eyeHalf'], 0.006, 0.02, 0.019 * k, 0.010 * k, 0.15, sk.mean(0) * 0.7)   # lid crease
    sk += blob(0, -0.03 * k, 0.07, 0.010 * k, 0.02 * k, 0.18, warm)                                # nose tip warmth
    # ears and knuckles warmer
    out = sk
    # ---- lips
    mrel = p - L['mouth']
    lipW = L['corner'] * 1.08
    up = (mrel[:, 1] >= 0) & (mrel[:, 1] < 0.0075 * k * (1 - (mrel[:, 0] / lipW) ** 2) * 1.0 + 0.0012)
    lo = (mrel[:, 1] < 0) & (mrel[:, 1] > -0.0105 * k * (1 - (mrel[:, 0] / lipW) ** 2) - 0.0005)
    lips = (up | lo) & (np.abs(mrel[:, 0]) < lipW) & (mrel[:, 2] > -0.02) & head
    lipcol = skin * np.array([0.92, 0.66, 0.66]) if skin.mean() > 0.45 else skin * np.array([0.82, 0.62, 0.62])
    if C['gender'] < 0.5: lipcol = lipcol * 0.92 + np.array([0.6, 0.3, 0.3]) * 0.08
    out[lips] = out[lips] * 0.45 + lipcol * 0.55
    line = (np.abs(mrel[:, 1]) < 0.0011) & (np.abs(mrel[:, 0]) < lipW * 1.02) & (mrel[:, 2] > -0.02) & head
    out[line] *= 0.55
    # ---- brows: strands above each eye
    hair = hexrgb(C['hairCol']); browcol = hexrgb(C.get('browCol', C['hairCol']))
    for sx in (1, -1):
        bx = (rel[:, 0] * sx - 0.004 * k) / (0.026 * k)  # 0 at inner end .. 1 outer
        arch = 0.0205 * k + 0.0025 * k * np.sin(np.clip(bx, 0, 1) * math.pi * 0.8) - 0.004 * k * np.clip(bx - 0.65, 0, 1)
        thick = (0.0058 * k if C['gender'] > 0.5 else 0.0042 * k) * (1 - 0.45 * np.clip(bx, 0, 1))
        inb = (bx > 0) & (bx < 1.05) & (np.abs(rel[:, 1] - arch) < thick) & (rel[:, 2] > 0.0) & head
        grain = rng.random(len(p))
        a = inb * np.clip(1 - np.abs(rel[:, 1] - arch) / thick, 0, 1) ** 0.5 * (0.55 + 0.4 * (grain > 0.35))
        out = out * (1 - a[:, None]) + browcol * a[:, None]
    # ---- beard or stubble
    ax = np.abs(mrel[:, 0])
    topb = 0.011 * k + 0.034 * k * np.clip((ax - 0.047 * k) / (0.02 * k), 0, 1)        # rises from the moustache to the sideburns
    under = (p[:, 1] > L['chinY'] - 0.018 * k) & (rel[:, 2] > -0.06 * k) & head
    edge = np.clip((topb - mrel[:, 1]) / (0.008 * k), 0, 1) * np.clip((p[:, 1] - (L['chinY'] - 0.018 * k)) / (0.01 * k), 0, 1)
    edge *= np.clip((rel[:, 2] + 0.06 * k) / (0.015 * k), 0, 1)
    edge *= ~lips
    if C.get('beard'):
        bc = hexrgb(C['beardCol']); grain = rng.random(len(p))
        a = under * edge * C.get('beardAmt', 0.92) * (0.45 + 0.5 * (grain > 0.45)) * (0.75 + 0.25 * noise3(p, 400, 21))
        out = out * (1 - a[:, None]) + bc[None, :] * (0.85 + 0.3 * grain[:, None]) * a[:, None]
    elif C['gender'] > 0.5:
        a = under * edge * 0.16
        out = out * (1 - a[:, None]) + hexrgb(C['hairCol']) * a[:, None]
    # upper lash line: a soft dark band hugging the top of each eye opening
    for sx in (1, -1):
        er = p - (L['eyeL'] if sx > 0 else L['eyeR'])
        d = np.abs(np.hypot(er[:, 0] / 1.3, er[:, 1] * 1.15) - 0.0098 * k)
        lid = head & (d < 0.0016 * k) & (er[:, 2] > 0.006) & (er[:, 1] > 0.001) & (np.abs(er[:, 0]) < 0.0155 * k)
        out[lid] = out[lid] * 0.6
    # ---- painted hair on the scalp (under the hair shell)
    ha = hair_amount(C['hair'], rel, k)
    sc = head & (ha > 0)
    hn = (rng.random(len(p)) - 0.5) * 0.22 + noise3(p, 160, 9) * 0.08 + np.sin(p[:, 1] * 2200 + noise3(p, 40, 3) * 6) * 0.05
    fa = np.clip(ha[sc] / (0.004 * k), 0, 1)[:, None]
    out[sc] = out[sc] * (1 - fa) + hair * (1 + hn[sc])[:, None] * fa
    # ---- age lines
    if C['age'] > 0.7:
        fore = (rel[:, 1] > 0.03 * k) & (rel[:, 1] < 0.06 * k) & (rel[:, 2] > 0.04) & head & ~sc
        lines = fore & (np.abs(np.sin(rel[:, 1] * 900)) < 0.12)
        out[lines] *= 0.9
        for sx in (1, -1):
            crow = (np.abs(rel[:, 0] * sx - L['eyeHalf'] - 0.022 * k) < 0.008 * k) & (np.abs(rel[:, 1]) < 0.01 * k) & head
            out[crow & (np.abs(np.sin(rel[:, 1] * 1600 + rel[:, 0] * 300)) < 0.2)] *= 0.88
    # ---- clothes
    def fabric(col, kind, pp, scale=1.0):
        c = np.tile(hexrgb(col), (len(pp), 1))
        fold = noise3(pp, 35, 5) * 0.07 + noise3(pp, 90, 6) * 0.03
        weave = (np.sin(pp[:, 0] * 2400) * np.sin(pp[:, 1] * 2400)) * 0.025
        c *= (1 + fold + weave)[:, None]
        if kind == 'camo':
            nn = noise3(pp, 18, 11) + noise3(pp, 41, 12) * 0.6
            c[nn > 0.45] = c[nn > 0.45] * 0.62
            c[nn < -0.5] = c[nn < -0.5] * 0.4 + hexrgb('#8a7d55') * 0.6
            m2 = (nn > -0.1) & (nn < 0.12); c[m2] = c[m2] * 0.5 + hexrgb('#3b4428') * 0.5
        elif kind == 'plaid':
            a = np.sin(pp[:, 1] * 95) > 0.35; b = np.sin((pp[:, 0] + pp[:, 2] * 0.3) * 95) > 0.35
            c[a & b] *= 0.42; c[a ^ b] *= 0.68
            thin = (np.abs(np.sin(pp[:, 1] * 95 + 1.4)) < 0.06) | (np.abs(np.sin(pp[:, 0] * 95 + 1.4)) < 0.06)
            c[thin] = c[thin] * 0.5 + np.array([0.9, 0.85, 0.6]) * 0.5
        elif kind == 'denim':
            c *= (1 + (np.sin(pp[:, 0] * 3000 + pp[:, 1] * 3000) * 0.04))[:, None]
        return c
    top = C.get('jacket') or C['shirt']
    kind = 'camo' if C.get('camo') else 'plaid' if C.get('plaid') else 'plain'
    shirtc = fabric(top, kind, p)
    if C.get('jacket') and C.get('openFront'):
        strip = (np.abs(p[:, 0]) < 0.045 * k) & (n[:, 2] > 0.3) & (p[:, 1] > L['belt'])
        inner = fabric(C['shirt'], 'plain', p); shirtc[strip] = inner[strip]
        edge = (np.abs(np.abs(p[:, 0]) - 0.045 * k) < 0.003) & (n[:, 2] > 0.3) & (p[:, 1] > L['belt']); shirtc[edge] *= 0.7
    if C.get('vest'):
        torso = r[:, 4] > 0.5
        arm = (np.abs(p[:, 0]) > 0.115 * k) & (p[:, 1] > L['shoulderY'] - 0.14 * k)
        vneck = (n[:, 2] > 0.2) & (np.abs(p[:, 0]) < (p[:, 1] - (L['neckBase'][1] - 0.17 * k)) * 0.45) & (p[:, 1] > L['neckBase'][1] - 0.17 * k)
        vest = torso & ~arm & ~vneck & (p[:, 1] < L['shoulderY'] + 0.02 * k)
        vc = fabric(C['vest'], 'plain', p); shirtc[vest] = vc[vest]
        trim = vest & ((np.abs(np.abs(p[:, 0]) - 0.115 * k) < 0.004) | (np.abs(p[:, 1] - L['belt'] - 0.03 * k) < 0.003)); shirtc[trim] *= 0.75
    pantsc = fabric(C['pants'], 'denim' if C.get('denim') else 'plain', p)
    seam = (np.abs(p[:, 0]) > 0.01) & (np.abs(n[:, 0]) > 0.85); pantsc[seam] *= 0.9
    beltz = np.abs(p[:, 1] - L['belt'] - 0.012 * k) < 0.012 * k
    bootc = fabric(C['boots'], 'plain', p) * (1 + noise3(p, 300, 14) * 0.05)[:, None]
    sole = p[:, 1] < 0.022 * k; bootc[sole] = bootc[sole] * 0.35
    lace = (np.abs(p[:, 0] - np.sign(p[:, 0]) * 0.1 * k) < 0.012) & (n[:, 2] > 0.6) & (np.abs(np.sin(p[:, 1] * 600)) < 0.3); bootc[lace] *= 0.6
    r4 = r[:, :4]; w = r4 / np.maximum(r4.sum(1, keepdims=True), 1e-6)
    # crisp seams: sharpen region weights
    w = w ** 3; w = w / np.maximum(w.sum(1, keepdims=True), 1e-6)
    nb_ = L['neckBase']; vn = C.get('vneck', 0.035)
    collar = (r[:, 4] > 0.2) & ((p[:, 1] > nb_[1] - 0.006) | ((n[:, 2] > 0.1) & (p[:, 2] > nb_[2] - 0.01) & (p[:, 1] > nb_[1] - vn) & (np.abs(p[:, 0]) < (p[:, 1] - (nb_[1] - vn)) * 0.9 + 0.012)))
    w[collar] = [1, 0, 0, 0]
    hem = (r[:, 4] > 0.2) & ~collar & ((p[:, 1] > nb_[1] - 0.012) | ((n[:, 2] > 0.1) & (np.abs(p[:, 0]) < (p[:, 1] - (nb_[1] - vn)) * 0.9 + 0.018) & (p[:, 1] > nb_[1] - vn - 0.006)))
    res = out * w[:, :1] + shirtc * w[:, 1:2] + pantsc * w[:, 2:3] + bootc * w[:, 3:4]
    bz = beltz & (w[:, 1] + w[:, 2] > 0.5)
    res[bz] = hexrgb(C.get('belt', '#3a2618')) * (1 + noise3(p[bz], 200, 3) * 0.08)[:, None]
    res[hem] *= 0.93
    return res

def paint_eye(C):
    S = 256; yy, xx = np.mgrid[0:S, 0:S] / S - 0.5
    rr = np.hypot(xx, yy)
    img = np.ones((S, S, 3)) * np.array([0.93, 0.91, 0.88])
    img *= (1 - np.clip(rr - 0.3, 0, 1) * 0.6)[:, :, None]
    iris = hexrgb(C['eye']); ir = 0.215
    ring = (rr < ir)
    ang = np.arctan2(yy, xx)
    fib = 1 + 0.18 * np.sin(ang * 40) * np.clip(rr / ir, 0, 1)
    ic = iris[None, None, :] * fib[:, :, None] * (0.75 + 0.5 * (1 - rr / ir))[:, :, None]
    img[ring] = ic[ring]
    img[(rr < ir) & (rr > ir * 0.88)] *= 0.55
    img[rr < 0.085] = [0.03, 0.025, 0.02]
    spec = np.hypot(xx + 0.06, yy + 0.07) < 0.03; img[spec] = [1, 1, 1]
    return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))

# ------------------------------------------------------------------ GLB writer
def write_glb(out, keep, bpos, bparent, prims, img, eye_img, C, extras):
    import io, pygltflib as G
    blob = bytearray(); views = []; accs = []
    def add_view(data, target=None):
        while len(blob) % 4: blob.append(0)
        off = len(blob); blob.extend(data); views.append(G.BufferView(buffer=0, byteOffset=off, byteLength=len(data), target=target)); return len(views) - 1
    def add_acc(arr, ctype, typ, target=None, norm=False, minmax=False):
        v = add_view(arr.tobytes(), target)
        a = G.Accessor(bufferView=v, componentType=ctype, count=len(arr), type=typ, normalized=norm or None)
        if minmax: a.min = arr.min(0).tolist(); a.max = arr.max(0).tolist()
        accs.append(a); return len(accs) - 1
    def add_img(im, fmt='JPEG', q=84):
        b = io.BytesIO(); im.save(b, fmt, quality=q) if fmt == 'JPEG' else im.save(b, fmt); return add_view(b.getvalue())
    nodes = []
    # bones as nodes
    bone_node = {}
    for b in keep:
        par = bparent[b]; t = bpos[b] - (bpos[par] if par else 0)
        nodes.append(G.Node(name=b.replace('.', '_'), translation=[float(x) for x in t])); bone_node[b] = len(nodes) - 1
    for b in keep:
        if bparent[b]: nodes[bone_node[bparent[b]]].children = (nodes[bone_node[bparent[b]]].children or []) + [bone_node[b]]
    ibm = np.array([np.array([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [-bpos[b][0], -bpos[b][1], -bpos[b][2], 1]], np.float32) for b in keep], np.float32)
    ibm_acc = add_acc(ibm.reshape(-1, 16), G.FLOAT, 'MAT4')
    skin = G.Skin(joints=[bone_node[b] for b in keep], inverseBindMatrices=ibm_acc, skeleton=bone_node['root'])
    images = [G.Image(bufferView=add_img(img, 'JPEG', 84), mimeType='image/jpeg'), G.Image(bufferView=add_img(eye_img, 'PNG'), mimeType='image/png')]
    textures = [G.Texture(source=0, sampler=0), G.Texture(source=1, sampler=0)]
    mats = [G.Material(name='skin', pbrMetallicRoughness=G.PbrMetallicRoughness(baseColorTexture=G.TextureInfo(index=0), metallicFactor=0, roughnessFactor=0.78)),
            G.Material(name='eye', pbrMetallicRoughness=G.PbrMetallicRoughness(baseColorTexture=G.TextureInfo(index=1), metallicFactor=0, roughnessFactor=0.15)),
            G.Material(name='lashes', doubleSided=True, pbrMetallicRoughness=G.PbrMetallicRoughness(baseColorFactor=[0.04, 0.03, 0.025, 1], metallicFactor=0, roughnessFactor=0.9)),
            G.Material(name='hair', pbrMetallicRoughness=G.PbrMetallicRoughness(baseColorTexture=G.TextureInfo(index=0), metallicFactor=0, roughnessFactor=0.62))]
    matidx = {'body': 0, 'eye': 1, 'lashes': 2, 'hair': 3}
    gprims = []
    for pr in prims:
        attrs = G.Attributes(POSITION=add_acc(pr['pos'], G.FLOAT, 'VEC3', G.ARRAY_BUFFER, minmax=True), NORMAL=add_acc(pr['nor'], G.FLOAT, 'VEC3', G.ARRAY_BUFFER),
                             TEXCOORD_0=add_acc(pr['uv'], G.FLOAT, 'VEC2', G.ARRAY_BUFFER), JOINTS_0=add_acc(pr['ji'], G.UNSIGNED_BYTE, 'VEC4', G.ARRAY_BUFFER),
                             WEIGHTS_0=add_acc(pr['jw'], G.FLOAT, 'VEC4', G.ARRAY_BUFFER))
        idx = pr['idx'].astype(np.uint16) if pr['idx'].max() < 65535 else pr['idx']
        gprims.append(G.Primitive(attributes=attrs, indices=add_acc(idx, G.UNSIGNED_SHORT if idx.dtype == np.uint16 else G.UNSIGNED_INT, 'SCALAR', G.ELEMENT_ARRAY_BUFFER), material=matidx[pr['name']]))
    mesh = G.Mesh(name='person', primitives=gprims)
    nodes.append(G.Node(name='person', mesh=0, skin=0)); mnode = len(nodes) - 1
    nodes.append(G.Node(name='character', children=[bone_node['root'], mnode], extras=extras)); rnode = len(nodes) - 1
    g = G.GLTF2(asset=G.Asset(version='2.0', generator='Great Outdoors Adventure MakeHuman builder'), scene=0, scenes=[G.Scene(nodes=[rnode])], nodes=nodes,
                meshes=[mesh], skins=[skin], materials=mats, textures=textures, images=images, samplers=[G.Sampler(magFilter=9729, minFilter=9987)],
                accessors=accs, bufferViews=views, buffers=[G.Buffer(byteLength=len(blob))])
    g.set_binary_blob(bytes(blob)); g.save_binary(out)

if __name__ == '__main__':
    build(sys.argv[1], sys.argv[2]); print(sys.argv[2], os.path.getsize(sys.argv[2]))
