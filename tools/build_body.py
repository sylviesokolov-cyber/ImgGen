#!/usr/bin/env python3
"""Bake the dress-up body from MakeHuman's CC0 assets.

Reads the MakeHuman base mesh, morph targets, game-engine skeleton and skin
weights (all CC0, from github.com/makehumancommunity/mpfb2, src/mpfb/data)
and writes:

  assets/body.bin   packed geometry, skin weights and slider morphs
  assets/body.json  layout of body.bin, skeleton, slider definitions

Usage:  python3 tools/build_body.py /path/to/mpfb2/src/mpfb/data

You only need to run this to change the baked shape or the sliders; the
output is committed, so the app itself never needs MakeHuman.
"""
import gzip
import json
import os
import sys
from collections import defaultdict

import numpy as np

DATA = sys.argv[1] if len(sys.argv) > 1 else 'mpfb2/src/mpfb/data'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')
SCALE = 0.1  # MakeHuman units are decimeters

# --- The baked character -------------------------------------------------
# Female, 25 ("young" in MakeHuman), average build, then nudged toward an
# anime face: bigger eyes, smaller nose and mouth, softer narrower jaw.
RACES = ['caucasian', 'asian', 'african']
BASE = [
    ('macrodetails/universal-female-young-averagemuscle-averageweight', 1.0),
    *[(f'macrodetails/{r}-female-young', w) for r, w in zip(RACES, (0.45, 0.45, 0.10))],
    ('macrodetails/proportions/female-young-averagemuscle-averageweight-idealproportions', 1.0),
    ('macrodetails/universal-female-young-averagemuscle-minweight', 0.15),
    # face
    *[(f'eyes/{s}-eye-{t}', w) for s in 'lr' for t, w in [
        ('scale-incr', 1.0), ('height1-incr', 0.8), ('height2-incr', 1.0), ('height3-incr', 0.6),
        ('trans-down', 0.3), ('push1-in', 0.3), ('bag-decr', 0.6)]],
    ('head/head-scale-horiz-incr', 0.3), ('head/head-scale-vert-incr', 0.3), ('head/head-scale-depth-incr', 0.2),
    ('nose/nose-scale-horiz-decr', 0.5), ('nose/nose-scale-vert-decr', 0.45),
    ('nose/nose-scale-depth-decr', 0.35), ('nose/nose-volume-decr', 0.4),
    ('nose/nose-point-up', 0.3),
    ('mouth/mouth-scale-horiz-decr', 0.35), ('mouth/mouth-upperlip-volume-decr', 0.2),
    ('mouth/mouth-angles-up', 0.8), ('mouth/mouth-lowerlip-volume-incr', 0.2),
    ('chin/chin-width-decr', 0.55), ('chin/chin-height-decr', 0.15), ('chin/chin-prominent-decr', 0.2),
    ('head/head-oval', 0.6), ('head/head-fat-decr', 0.3),
    ('neck/neck-scale-horiz-decr', 0.25),
    ('torso/torso-vshape-decr', 0.25),
    ('macrodetails/height/female-young-averagemuscle-averageweight-maxheight', 0.04),
]

# Sliders: value in -1..1; positive uses `plus`, negative uses `minus`.
SLIDERS = [
    ('height', 'Height', {
        '+': [('macrodetails/height/female-young-averagemuscle-averageweight-maxheight', 0.27)],
        '-': [('macrodetails/height/female-young-averagemuscle-averageweight-minheight', 0.3)],
    }),
    ('legs', 'Leg length', {
        '+': [('legs/upperlegs-height-incr', 0.45), ('legs/lowerlegs-height-incr', 0.45)],
        '-': [('legs/upperlegs-height-decr', 0.5), ('legs/lowerlegs-height-decr', 0.5)],
    }),
    ('bust', 'Bust', {
        '+': [('breast/female-young-averagemuscle-averageweight-maxcup-averagefirmness', 0.75)],
        '-': [('breast/female-young-averagemuscle-averageweight-mincup-averagefirmness', 1.0)],
    }),
    ('waist', 'Waist', {
        '+': [('torso/measure-waist-circ-incr', 1.0), ('stomach/stomach-pregnant-incr', 0.15)],
        '-': [('torso/measure-waist-circ-decr', 1.0), ('hip/hip-waist-down', 0.2)],
    }),
    ('hips', 'Hips', {
        '+': [('torso/measure-hips-circ-incr', 0.7), ('hip/hip-scale-horiz-incr', 0.4), ('buttocks/buttocks-volume-incr', 0.6)],
        '-': [('torso/measure-hips-circ-decr', 0.7), ('hip/hip-scale-horiz-decr', 0.4), ('buttocks/buttocks-volume-decr', 0.6)],
    }),
]

MESHES = {
    'body': ['body'],
    'tights': ['helper-tights'],
    'skirt': ['helper-skirt'],
    'hair': ['helper-hair'],
    'lashes': ['helper-l-eyelashes-1', 'helper-l-eyelashes-2', 'helper-r-eyelashes-1', 'helper-r-eyelashes-2'],
}


def load_obj(path):
    verts, uvs, faces = [], [], defaultdict(list)
    group = None
    with open(path) as f:
        for line in f:
            if line.startswith('v '):
                verts.append([float(x) for x in line.split()[1:4]])
            elif line.startswith('vt '):
                uvs.append([float(x) for x in line.split()[1:3]])
            elif line.startswith('g '):
                group = line.split()[1]
            elif line.startswith('f '):
                face = []
                for tok in line.split()[1:]:
                    p = tok.split('/')
                    face.append((int(p[0]) - 1, int(p[1]) - 1 if len(p) > 1 and p[1] else -1))
                faces[group].append(face)
    return np.array(verts, np.float64), np.array(uvs, np.float64), faces


def load_target(name, n):
    d = np.zeros((n, 3))
    with gzip.open(os.path.join(DATA, 'targets', name + '.target.gz'), 'rt') as f:
        for line in f:
            if not line.strip() or line.startswith('#'):
                continue
            i, x, y, z = line.split()
            d[int(i)] = (float(x), float(y), float(z))
    return d


def mix(spec, n):
    out = np.zeros((n, 3))
    for name, w in spec:
        out += load_target(name, n) * w
    return out


def main():
    verts, uvs, faces = load_obj(os.path.join(DATA, '3dobjs', 'base.obj'))
    n = len(verts)
    groups = json.load(open(os.path.join(DATA, 'mesh_metadata', 'basemesh_vertex_groups.json')))

    def group_verts(g):
        return [i for a, b in groups[g] for i in range(a, b + 1)]

    base = verts + mix(BASE, n)
    deltas = {}
    for sid, _, parts in SLIDERS:
        for sign in '+-':
            deltas[sid + sign] = mix(parts[sign], n)

    # Ground at y = 0, meters. Sliders keep the feet on the ground too.
    gv = group_verts('joint-ground')
    base = (base - base[gv].mean(0)) * SCALE
    for k in deltas:
        deltas[k] = (deltas[k] - deltas[k][gv].mean(0)) * SCALE

    # --- Skeleton: joints are means of MakeHuman's joint cubes / vertex sets.
    rig = json.load(open(os.path.join(DATA, 'rigs', 'standard', 'rig.game_engine.json')))
    names = list(rig.keys())
    order, seen = [], set()

    def visit(b):
        if b in seen:
            return
        p = rig[b]['parent']
        if p:
            visit(p)
        seen.add(b)
        order.append(b)
    for b in names:
        visit(b)

    def joint_sets(spec):
        if spec['strategy'] == 'CUBE':
            return group_verts(spec['cube_name'])
        return spec['vertex_indices']

    head_sets = {b: joint_sets(rig[b]['head']) for b in order}
    tail_sets = {b: joint_sets(rig[b]['tail']) for b in order}

    def joints(pos):
        return ({b: pos[s].mean(0) for b, s in head_sets.items()},
                {b: pos[s].mean(0) for b, s in tail_sets.items()})

    heads, tails = joints(base)
    bones = []
    for b in order:
        bones.append({
            'name': b,
            'parent': order.index(rig[b]['parent']) if rig[b]['parent'] else -1,
            'head': np.round(heads[b], 5).tolist(),
            'tail': np.round(tails[b], 5).tolist(),
        })
    bone_deltas = {}
    for k, d in deltas.items():
        h, _ = joints(base + d)
        bone_deltas[k] = [np.round(h[b] - heads[b], 5).tolist() for b in order]

    # --- Skin weights: top 4 per vertex, normalized.
    wjson = json.load(open(os.path.join(DATA, 'rigs', 'standard', 'weights.game_engine.json')))['weights']
    per = defaultdict(list)
    for b, lst in wjson.items():
        bi = order.index(b)
        for v, w in lst:
            per[v].append((w, bi))
    skin_i = np.zeros((n, 4), np.uint8)
    skin_w = np.zeros((n, 4), np.uint8)
    for v in range(n):
        top = sorted(per[v], reverse=True)[:4] or [(1.0, 0)]
        s = sum(w for w, _ in top)
        ws = [round(w / s * 255) for w, _ in top]
        ws[0] += 255 - sum(ws)
        for j, ((_, bi), w) in enumerate(zip(top, ws)):
            skin_i[v, j] = bi
            skin_w[v, j] = w

    # --- Meshes: split vertices on UV seams, triangulate quads.
    blobs, layout = [], {}

    def add(name, arr):
        arr = np.ascontiguousarray(arr)
        pad = (-sum(len(b) for b in blobs)) % 4
        if pad:
            blobs.append(b'\0' * pad)
        offset = sum(len(b) for b in blobs)
        blobs.append(arr.tobytes())
        layout[name] = {'offset': offset, 'count': int(arr.size), 'type': str(arr.dtype)}

    add('positions', base.astype(np.float32))
    add('skinIndex', skin_i)
    add('skinWeight', skin_w)

    meshes = {}
    for mname, gnames in MESHES.items():
        key, mverts, muv, tris = {}, [], [], []
        for g in gnames:
            for face in faces[g]:
                ids = []
                for v, t in face:
                    k = (v, t)
                    if k not in key:
                        key[k] = len(mverts)
                        mverts.append(v)
                        muv.append(uvs[t] if t >= 0 else (0, 0))
                    ids.append(key[k])
                for j in range(1, len(ids) - 1):
                    tris.append((ids[0], ids[j], ids[j + 1]))
        add(mname + '.vert', np.array(mverts, np.uint16))
        add(mname + '.uv', np.array(muv, np.float32))
        add(mname + '.index', np.array(tris, np.uint16))
        meshes[mname] = {'vertices': len(mverts), 'triangles': len(tris)}

    # Sparse slider deltas, quantized to 0.05 mm.
    for k, d in deltas.items():
        idx = np.nonzero(np.abs(d).sum(1) > 1e-6)[0]
        add('morph.' + k + '.index', idx.astype(np.uint16))
        add('morph.' + k + '.delta', np.round(d[idx] / 0.00005).astype(np.int16))

    # Eye spheres: center and radius from the eye helper geometry.
    eyes = {}
    for side in 'lr':
        p = base[group_verts(f'helper-{side}-eye')]
        c = p.mean(0)
        eyes[side] = {'center': np.round(c, 5).tolist(), 'radius': round(float(np.linalg.norm(p - c, axis=1).mean()), 5)}
        eyes[side]['deltas'] = {k: np.round(d[group_verts(f'helper-{side}-eye')].mean(0), 5).tolist() for k, d in deltas.items()}

    # Face landmarks (joint cube centers) for painting the anime face.
    landmarks = {}
    for g in ['joint-mouth', 'joint-l-upperlid', 'joint-l-lowerlid', 'joint-r-upperlid', 'joint-r-lowerlid', 'joint-l-eye', 'joint-r-eye', 'joint-head-2']:
        landmarks[g[6:]] = np.round(base[group_verts(g)].mean(0), 5).tolist()

    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'body.bin'), 'wb') as f:
        for b in blobs:
            f.write(b)
    meta = {
        'source': 'MakeHuman (CC0) base mesh hm08, targets, game_engine rig and weights',
        'vertexCount': n,
        'deltaScale': 0.00005,
        'layout': layout,
        'meshes': meshes,
        'bones': bones,
        'boneDeltas': bone_deltas,
        'eyes': eyes,
        'landmarks': landmarks,
        'sliders': [{'id': sid, 'name': label} for sid, label, _ in SLIDERS],
    }
    with open(os.path.join(OUT, 'body.json'), 'w') as f:
        json.dump(meta, f, separators=(',', ':'))
    size = sum(len(b) for b in blobs)
    print(f'wrote body.bin ({size / 1e6:.2f} MB), {len(bones)} bones, meshes {meshes}')
    bv = group_verts('body')
    ys = base[bv][:, 1]
    print(f'height {ys.max() - ys.min():.3f} m (feet at {ys.min():.3f})')
    for k, d in deltas.items():
        y = (base + d)[bv][:, 1]
        print(f'  {k:8s} height {y.max() - y.min():.3f} m, max move {np.abs(d).max():.3f} m')


if __name__ == '__main__':
    main()
