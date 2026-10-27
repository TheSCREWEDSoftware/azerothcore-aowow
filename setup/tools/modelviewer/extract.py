#!/usr/bin/env python3
"""
aowow model viewer - extract models and textures from the WoW 3.3.5 client

Reads the client archives (MPQ) and writes what static/js/modelviewer needs:

    static/modelviewer/data/m/<path>.m2           model (as in the client)
    static/modelviewer/data/m/<path>00.skin       mesh (LOD 0)
    static/modelviewer/data/m/<path>NNNN-NN.anim  animations kept outside the model
    static/modelviewer/data/t/<path>.png          textures (BLP -> PNG)
    static/modelviewer/data/meta/item/<displayId>.json
    static/modelviewer/data/meta/npc/<displayId>.json
    static/modelviewer/data/meta/object/<displayId>.json

<path> is the client path, lower case, '/' separated, without extension.
Which models belong to a display comes from the DBC files aowow already uses
(setup/mpqdata/<locale>/DBFilesClient).

Usage (from the aowow folder):
    python setup/tools/modelviewer/extract.py --data "C:/Games/WoW/Data"
    python setup/tools/modelviewer/extract.py --data ... --only item --ids 41428,41429
Options:
    --data   the client's Data folder (with common.MPQ, lichking.MPQ, ..)
    --dbc    DBFilesClient folder (default: setup/mpqdata/enGB/DBFilesClient, any case)
    --out    output folder (default: static/modelviewer/data)
    --only   item | npc | object (default: all)
    --ids    limit to these display ids
    --force  rewrite files that already exist
    --limit  stop after N seconds (run again to continue - finished displays are skipped)
    --part   k/n: split the work over n processes (run k = 0 .. n-1 side by side)

Needs: Python 3.8+, pip install mpyq pillow
"""

import argparse, glob, io, json, os, struct, sys, time

try:
    import mpyq
    from PIL import Image
except ImportError:
    sys.exit('needs: pip install mpyq pillow')


# ---------------------------------------------------------------------- archives

_hashes = {}


class FastMPQ(mpyq.MPQArchive):
    """mpyq compares a name against every hash table entry; index the table once and hash each name once"""
    def __init__(self, *a, **k):
        mpyq.MPQArchive.__init__(self, *a, **k)
        self.index = {(e.hash_a, e.hash_b): e for e in self.hash_table if e.block_table_index != 0xFFFFFFFF}

    def get_hash_table_entry(self, filename):
        key = filename.upper()
        h = _hashes.get(key)
        if h is None:
            h = _hashes[key] = (self._hash(filename, 'HASH_A'), self._hash(filename, 'HASH_B'))
        return self.index.get(h)

# highest priority first: custom patches (patch-[A-Z]), numbered patches, base archives
BASE_ORDER = ['patch-3.mpq', 'patch-2.mpq', 'patch.mpq', 'lichking.mpq', 'expansion.mpq', 'common-2.mpq', 'common.mpq']


class Archives:
    def __init__(self, data_dir):
        files = {os.path.basename(f).lower(): f for f in glob.glob(os.path.join(data_dir, '*')) if f.lower().endswith('.mpq')}
        custom = sorted([n for n in files if n.startswith('patch-') and n[6:7].isalpha() and n not in BASE_ORDER], reverse=True)
        self.order = [files[n] for n in custom + BASE_ORDER if n in files]
        if not self.order:
            sys.exit('no MPQ archives found in ' + data_dir)
        self.open = {}
        self.missing = set()

    def read(self, path):
        key = path.replace('/', '\\')
        if key.lower() in self.missing:
            return None
        for f in self.order:
            if f not in self.open:
                try:
                    self.open[f] = FastMPQ(f, listfile=False)
                except Exception as e:
                    print('  cannot open', f, e)
                    self.open[f] = None
            a = self.open[f]
            if not a:
                continue
            try:
                data = a.read_file(key)
            except Exception:
                data = None
            if data:
                return data
        self.missing.add(key.lower())
        return None


# ---------------------------------------------------------------------- dbc

def read_dbc(path):
    d = open(path, 'rb').read()
    magic, n, f, rs, ss = struct.unpack('<4s4I', d[:20])
    body, strs = d[20:20 + n * rs], d[20 + n * rs:]
    rows = [struct.unpack_from('<%dI' % f, body, i * rs) for i in range(n)]

    def s(o):
        return strs[o:strs.index(b'\0', o)].decode('utf8', 'replace') if 0 < o < len(strs) else ''
    return rows, s


def find_dbc_dir(arg):
    if arg:
        return arg
    for d in glob.glob('setup/mpqdata/*/DBFilesClient') + glob.glob('setup/mpqdata/*/dbfilesclient'):
        if os.path.basename(os.path.dirname(d)).lower() in ('engb', 'enus'):
            return d
    return (glob.glob('setup/mpqdata/*/DBFilesClient') or [None])[0]


def f32(u):
    return struct.unpack('<f', struct.pack('<I', u))[0]


# ---------------------------------------------------------------------- output

def key_of(path):                       # client path -> output key
    p = path.replace('\\', '/').lower()
    for ext in ('.mdx', '.mdl', '.m2', '.blp'):
        if p.endswith(ext):
            p = p[:-len(ext)]
    return p


class Writer:
    def __init__(self, arc, out, force):
        self.arc, self.out, self.force = arc, out, force
        self.done_models, self.done_tex = {}, {}
        self.stats = {'models': 0, 'textures': 0, 'missing': 0, 'bytes': 0}
        self.listing = {}                               # folder -> names in it (one listing instead of a stat per file:
                                                        # on shared / network folders each stat is slow)

    def _names(self, folder):
        if folder not in self.listing:
            try:
                self.listing[folder] = set(os.listdir(os.path.join(self.out, folder)))
            except OSError:
                self.listing[folder] = set()
        return self.listing[folder]

    def _write(self, rel, data):
        p = os.path.join(self.out, rel)
        folder, name = os.path.split(rel)
        if not self._names(folder):
            os.makedirs(os.path.dirname(p), exist_ok=True)
        tmp = '%s.%d.tmp' % (p, os.getpid())            # write + rename: a run stopped mid-write leaves no cut-off file
        with open(tmp, 'wb') as fh:                     # (own name per process: --part runs may write a shared model at once)
            fh.write(data)
        try:
            os.replace(tmp, p)
        except OSError:
            if not os.path.exists(p):
                raise
            os.remove(tmp)
        self.listing[folder].add(name)
        self.stats['bytes'] += len(data)

    def _exists(self, rel):
        folder, name = os.path.split(rel)
        return not self.force and name in self._names(folder)

    def texture(self, path):
        """BLP -> PNG; returns the key or None"""
        if not path:
            return None
        k = key_of(path)
        if k in self.done_tex:
            return self.done_tex[k]
        rel = 't/' + k + '.png'
        if self._exists(rel):
            self.done_tex[k] = k
            return k
        data = self.arc.read(k + '.blp')
        if not data:
            self.stats['missing'] += 1
            self.done_tex[k] = None
            return None
        try:
            img = Image.open(io.BytesIO(data))
            img = img.convert('RGBA')
            buf = io.BytesIO()
            img.save(buf, 'PNG', optimize=False)
            self._write(rel, buf.getvalue())
            self.stats['textures'] += 1
            self.done_tex[k] = k
        except Exception as e:
            print('  texture failed', k, e)
            self.done_tex[k] = None
        return self.done_tex[k]

    def model(self, path):
        """copies .m2, 00.skin, external .anim files and the model's own textures; returns (key, info) or (None, None)"""
        k = key_of(path)
        if k in self.done_models:
            return k if self.done_models[k] else None, self.done_models[k]
        m2 = self.arc.read(k + '.m2')
        if not m2 or m2[:4] != b'MD20':
            self.stats['missing'] += 1
            self.done_models[k] = None
            return None, None
        if not self._exists('m/' + k + '.m2'):
            self._write('m/' + k + '.m2', m2)
            self.stats['models'] += 1
        if not self._exists('m/' + k + '00.skin'):
            skin = self.arc.read(k + '00.skin')
            if skin:
                self._write('m/' + k + '00.skin', skin)

        info = {'tex': {}}
        try:
            info = parse_m2_info(m2)
        except Exception as e:
            print('  model header failed', k, e)

        # animations stored outside the model (sequence flag 0x20 not set)
        for sid, sub, flags in info.get('seq', []):
            if flags & 0x20:
                continue
            rel = 'm/%s%04d-%02d.anim' % (k, sid, sub)
            if self._exists(rel):
                continue
            anim = self.arc.read('%s%04d-%02d.anim' % (k, sid, sub))
            if anim:
                self._write(rel, anim)

        # textures named in the model (type 0)
        for i, (ttype, name) in enumerate(info.get('textures', [])):
            if ttype == 0 and name:
                self.texture(name)
        self.done_models[k] = info
        return k, info

    def has_meta(self, kind, did):
        return self._exists('meta/%s/%d.json' % (kind, did))

    def meta(self, kind, did, obj):
        self._write('meta/%s/%d.json' % (kind, did), json.dumps(obj, separators=(',', ':')).encode())


def parse_m2_info(d):
    """just what the extractor needs: sequences (for .anim files) and texture names"""
    def arr(off):
        return struct.unpack_from('<II', d, off)
    nseq, oseq = arr(0x1C)
    seq = []
    for i in range(nseq):
        o = oseq + i * 64
        sid, sub = struct.unpack_from('<HH', d, o)
        flags = struct.unpack_from('<I', d, o + 12)[0]
        seq.append((sid, sub, flags))
    ntex, otex = arr(0x50)
    textures = []
    for i in range(ntex):
        o = otex + i * 16
        ttype, tflags, nlen, noff = struct.unpack_from('<IIII', d, o)
        name = d[noff:noff + nlen].split(b'\0')[0].decode('latin1') if nlen else ''
        textures.append((ttype, name))
    return {'seq': seq, 'textures': textures}


# ---------------------------------------------------------------------- displays

RACE_SUFFIX = ['HuM', 'HuF', 'OrM', 'OrF', 'DwM', 'DwF', 'NiM', 'NiF', 'ScM', 'ScF', 'TaM', 'TaF',
               'GnM', 'GnF', 'TrM', 'TrF', 'BeM', 'BeF', 'DrM', 'DrF']
ITEM_DIRS = ['Weapon', 'Shield', 'Head', 'Shoulder', 'Quiver', 'Ammo']


def mine(i, part):                                      # --part k/n: this process takes every n-th row
    return not part or i % part[1] == part[0]


def items(w, dbc_dir, ids, deadline, part=None):
    rows, s = read_dbc(os.path.join(dbc_dir, 'ItemDisplayInfo.dbc'))
    n = 0
    for i, r in enumerate(rows):
        did = r[0]
        if (ids and did not in ids) or not mine(i, part) or w.has_meta('item', did):
            continue
        if deadline and time.time() > deadline:
            return False
        names, texs = [s(r[1]), s(r[2])], [s(r[3]), s(r[4])]
        meta = {'models': [], 'geosets': [r[7], r[8], r[9]], 'flags': r[10],
                'helmVis': [r[13], r[14]], 'body': [s(r[15 + i]) for i in range(8)], 'visual': r[23]}

        for side, (name, tex) in enumerate(zip(names, texs)):
            if not name:
                continue
            base = name.rsplit('.', 1)[0]
            for folder in ITEM_DIRS:
                prefix = 'Item\\ObjectComponents\\%s\\' % folder
                if folder == 'Head':                    # helms: one model per race / gender
                    found = {}
                    for sfx in RACE_SUFFIX:
                        k, _ = w.model(prefix + base + '_' + sfx)
                        if k:
                            found[sfx] = k
                    if found:
                        t = w.texture(prefix + tex) if tex else None
                        meta['models'].append({'slot': 'head', 'race': found, 'tex': {'2': t} if t else {}})
                        break
                    continue
                k, _ = w.model(prefix + base)
                if k:
                    t = w.texture(prefix + tex) if tex else None
                    entry = {'slot': folder.lower(), 'f': k, 'tex': {'2': t} if t else {}}
                    if folder == 'Shoulder':
                        entry['side'] = 'left' if side == 0 else 'right'
                    meta['models'].append(entry)
                    break

        # capes: texture only (drawn on the character's cape geoset)
        if not meta['models'] and texs[0]:
            t = w.texture('Item\\ObjectComponents\\Cape\\' + texs[0])
            if t:
                meta['cape'] = t

        # armour region textures (TextureComponents) are for the character model (phase 2), only kept as names here
        w.meta('item', did, meta)
        n += 1
        if n % 2000 == 0:
            print('  items %d / %d  %s' % (n, len(rows), w.stats))
    return True


def npcs(w, dbc_dir, ids, deadline, part=None):
    models, ms = read_dbc(os.path.join(dbc_dir, 'CreatureModelData.dbc'))
    mpath = {r[0]: ms(r[2]) for r in models}
    rows, s = read_dbc(os.path.join(dbc_dir, 'CreatureDisplayInfo.dbc'))
    n = 0
    for i, r in enumerate(rows):
        did = r[0]
        if (ids and did not in ids) or not mine(i, part) or w.has_meta('npc', did):
            continue
        if deadline and time.time() > deadline:
            return False
        path = mpath.get(r[1])
        if not path:
            continue
        k, info = w.model(path)
        if not k:
            continue
        folder = path.replace('/', '\\').rsplit('\\', 1)[0] + '\\'
        tex = {}
        for i in range(3):                              # TextureVariation[3] -> replaceable texture types 11 / 12 / 13
            name = s(r[6 + i])
            if name:
                t = w.texture(folder + name)
                if t:
                    tex[str(11 + i)] = t
        w.meta('npc', did, {'f': k, 'tex': tex, 'scale': round(f32(r[4]), 4) or 1, 'alpha': r[5], 'extra': r[3]})
        n += 1
        if n % 2000 == 0:
            print('  npcs %d / %d  %s' % (n, len(rows), w.stats))
    return True


def objects(w, dbc_dir, ids, deadline, part=None):
    rows, s = read_dbc(os.path.join(dbc_dir, 'GameObjectDisplayInfo.dbc'))
    for i, r in enumerate(rows):
        did = r[0]
        if (ids and did not in ids) or not mine(i, part) or w.has_meta('object', did):
            continue
        if deadline and time.time() > deadline:
            return False
        path = s(r[1])
        if not path or not path.lower().endswith(('.mdx', '.m2', '.mdl')):
            continue                                    # .wmo buildings are not supported
        k, _ = w.model(path)
        if k:
            w.meta('object', did, {'f': k, 'tex': {}})
    return True


# ---------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--dbc')
    ap.add_argument('--out', default='static/modelviewer/data')
    ap.add_argument('--only', choices=['item', 'npc', 'object'])
    ap.add_argument('--ids', default='')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--part', default='', help='k/n: run n processes, this one takes every n-th display (k = 0 .. n-1)')
    a = ap.parse_args()

    dbc_dir = find_dbc_dir(a.dbc)
    if not dbc_dir or not os.path.isdir(dbc_dir):
        sys.exit('DBFilesClient not found - pass --dbc')
    ids = set(int(x) for x in a.ids.split(',') if x.strip())
    part = tuple(int(x) for x in a.part.split('/')) if a.part else None
    deadline = time.time() + a.limit if a.limit else 0

    arc = Archives(a.data)
    print('archives:', ', '.join(os.path.basename(f) for f in arc.order))
    w = Writer(arc, a.out, a.force)

    # animation names for the viewer's list (AnimationData.dbc: ID, Name, ..)
    try:
        rows, s = read_dbc(os.path.join(dbc_dir, 'AnimationData.dbc'))
        w._write('anims.json', json.dumps({r[0]: s(r[1]) for r in rows}, separators=(',', ':')).encode())
    except Exception as e:
        print('  AnimationData.dbc:', e)

    done = True
    for kind, fn in (('item', items), ('npc', npcs), ('object', objects)):
        if a.only and a.only != kind:
            continue
        print('[%s]' % kind)
        if not fn(w, dbc_dir, ids, deadline, part):
            done = False
            print('  time limit reached - run again to continue')
            break
    print('done' if done else 'paused', w.stats)


if __name__ == '__main__':
    main()
