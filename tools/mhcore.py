"""MakeHuman base mesh tools: load, morph with macro targets, joints, skeleton, weights."""
import numpy as np, json, os, functools
D = os.environ.get('MH_DATA', os.path.join(os.path.dirname(__file__), '..', 'mh', 'makehuman', 'data'))

def load_obj():
    vs, vts, faces = [], [], []  # faces: (group, [(v,vt),...])
    group = None
    for line in open(os.path.join(D, '3dobjs', 'base.obj')):
        if line.startswith('v '): vs.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '): vts.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('g '): group = line.split()[1]
        elif line.startswith('f '):
            idx = [tuple(int(p) - 1 for p in t.split('/')[:2]) for t in line.split()[1:]]
            faces.append((group, idx))
    return np.array(vs, np.float64), np.array(vts, np.float64), faces

@functools.lru_cache(None)
def target(rel):
    p = os.path.join(D, 'targets', rel)
    idx, d = [], []
    for line in open(p):
        if not line.strip() or line[0] == '#': continue
        t = line.split(); idx.append(int(t[0])); d.append([float(x) for x in t[1:4]])
    return np.array(idx, np.int64), np.array(d, np.float64).reshape(-1, 3)

def lerp_weights(v, lo, mid, hi):
    if v < 0.5: return {lo: (0.5 - v) * 2, mid: 1 - (0.5 - v) * 2}
    return {hi: (v - 0.5) * 2, mid: 1 - (v - 0.5) * 2}

def morph(base, gender, age, muscle, weight, race, extra=()):
    """gender 0 female..1 male, age 0.5 = 25 y, 1 = 90 y; race dict african/asian/caucasian summing to 1."""
    v = base.copy()
    gw = {'female': 1 - gender, 'male': gender}
    aw = {'young': 1 - (age - 0.5) * 2, 'old': (age - 0.5) * 2} if age >= 0.5 else {'young': 1.0}
    mw = lerp_weights(muscle, 'minmuscle', 'averagemuscle', 'maxmuscle')
    ww = lerp_weights(weight, 'minweight', 'averageweight', 'maxweight')
    def add(rel, w):
        if w <= 1e-4: return
        i, d = target(rel); v[i] += d * w
    for g, a in gw.items():
        for ag, b in aw.items():
            for m, c in mw.items():
                for wt, e in ww.items():
                    add(f'macrodetails/universal-{g}-{ag}-{m}-{wt}.target', a * b * c * e)
            for r, rw in race.items():
                add(f'macrodetails/{r}-{g}-{ag}.target', a * b * rw)
    for rel, w in extra: add(rel, w)
    return v

def skeleton():
    return json.load(open(os.path.join(D, 'rigs', 'default.mhskel')))
def weights():
    return json.load(open(os.path.join(D, 'rigs', 'default_weights.mhw')))['weights']
