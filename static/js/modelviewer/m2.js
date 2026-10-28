/*
 * aowow model viewer: WotLK (3.3.5, M2 version 264) model reader for three.js
 *
 *   var model = await AoM2.load(baseUrl, 'creature/ghoul/ghoul', {tex: {'11': 'creature/ghoul/ghoulskinblue'}});
 *   scene.add(model.root);  model.play(animIndex);  model.update(deltaMs);
 *
 * Files come from setup/tools/modelviewer/extract.py: m/<key>.m2, m/<key>00.skin, m/<key>NNNN-NN.anim, t/<key>.png
 * Model space is the client's (Z up); model.root turns it upright for three.js (Y up).
 */
var AoM2 = (function () {

    // ---------------------------------------------------------------- binary helpers

    function Reader(buf) {
        this.buf = buf;
        this.dv  = new DataView(buf);
    }
    Reader.prototype = {
        u8:  function (o) { return this.dv.getUint8(o); },
        i8:  function (o) { return this.dv.getInt8(o); },
        u16: function (o) { return this.dv.getUint16(o, true); },
        i16: function (o) { return this.dv.getInt16(o, true); },
        u32: function (o) { return this.dv.getUint32(o, true); },
        i32: function (o) { return this.dv.getInt32(o, true); },
        f32: function (o) { return this.dv.getFloat32(o, true); },
        arr: function (o) { return { n: this.u32(o), o: this.u32(o + 4) }; },
        str: function (o, n) {
            var s = '';
            for (var i = 0; i < n; i++) {
                var c = this.u8(o + i);
                if (!c) break;
                s += String.fromCharCode(c);
            }
            return s;
        }
    };

    function fetchBuf(url) {
        return fetch(url).then(function (r) {
            if (!r.ok) throw new Error(r.status + ' ' + url);
            return r.arrayBuffer();
        });
    }

    function keyOf(path) {                                  // client path -> extracted file key
        return path.replace(/\\/g, '/').toLowerCase().replace(/\.(mdx|mdl|m2|blp)$/, '');
    }

    // ---------------------------------------------------------------- animation tracks

    // M2Track: interpolation u16, globalSeq i16, timestamps M2Array<M2Array<u32>>, values M2Array<M2Array<T>>
    function Track(r, o, type) {
        this.interp = r.u16(o);
        this.gseq   = r.i16(o + 2);
        this.ts     = r.arr(o + 4);
        this.vs     = r.arr(o + 12);
        this.type   = type;                                 // vec3 | quat16 | quat | fixed16 | float
        this.r      = r;
        this.cache  = {};
    }
    var SIZE = { vec3: 12, quat16: 8, quat: 16, fixed16: 2, float: 4, u8: 1 };

    Track.prototype.empty = function () { return !this.ts.n; };

    // keyframes of one sequence: [times[], values[]] - the data may sit in that sequence's .anim file
    Track.prototype.keys = function (seq, model) {
        var idx = this.gseq >= 0 ? 0 : seq;
        if (idx >= this.ts.n)
            idx = 0;
        if (this.cache[idx])
            return this.cache[idx];

        var src = this.r;
        if (this.gseq < 0 && model && model.seqs[idx] && !(model.seqs[idx].flags & 0x20)) {
            src = model.animBuf[idx];                       // external animation data
            if (!src)
                return null;
        }
        var tA = { n: this.r.u32(this.ts.o + idx * 8), o: this.r.u32(this.ts.o + idx * 8 + 4) };
        var vA = { n: this.r.u32(this.vs.o + idx * 8), o: this.r.u32(this.vs.o + idx * 8 + 4) };
        var n = Math.min(tA.n, vA.n), times = new Array(n), vals = new Array(n), sz = SIZE[this.type];
        try {
            for (var i = 0; i < n; i++) {
                times[i] = src.u32(tA.o + i * 4);
                vals[i]  = readVal(src, vA.o + i * sz, this.type);
            }
        } catch (e) {
            n = 0; times = []; vals = [];
        }
        return (this.cache[idx] = [times, vals]);
    };

    function q16(v) { return (v < 0 ? v + 32768 : v - 32767) / 32767; }

    function readVal(r, o, type) {
        switch (type) {
            case 'vec3':    return [r.f32(o), r.f32(o + 4), r.f32(o + 8)];
            case 'quat16':  return [q16(r.i16(o)), q16(r.i16(o + 2)), q16(r.i16(o + 4)), q16(r.i16(o + 6))];
            case 'quat':    return [r.f32(o), r.f32(o + 4), r.f32(o + 8), r.f32(o + 12)];
            case 'fixed16': return r.i16(o) / 32767;
            case 'float':   return r.f32(o);
            case 'u8':      return r.u8(o);
        }
    }

    function lerp(a, b, f) {
        if (typeof a == 'number')
            return a + (b - a) * f;
        var o = [];
        for (var i = 0; i < a.length; i++)
            o.push(a[i] + (b[i] - a[i]) * f);
        return o;
    }

    function slerp(a, b, f) {
        var qa = new THREE.Quaternion(a[0], a[1], a[2], a[3]), qb = new THREE.Quaternion(b[0], b[1], b[2], b[3]);
        qa.slerp(qb, f);
        return [qa.x, qa.y, qa.z, qa.w];
    }

    // value of a track at time t (ms) in sequence seq, or def
    Track.prototype.at = function (seq, t, model, def) {
        if (this.empty())
            return def;
        var k = this.keys(seq, model);
        if (!k || !k[0].length)
            return def;
        var times = k[0], vals = k[1], n = times.length;
        if (this.gseq >= 0 && model.gloops[this.gseq])
            t = model.clock % model.gloops[this.gseq];
        if (n == 1 || t <= times[0])
            return vals[0];
        if (t >= times[n - 1])
            return vals[n - 1];
        var lo = 0, hi = n - 1;
        while (hi - lo > 1) {
            var mid = (lo + hi) >> 1;
            if (times[mid] <= t) lo = mid; else hi = mid;
        }
        if (this.interp == 0)
            return vals[lo];
        var f = (t - times[lo]) / ((times[hi] - times[lo]) || 1);
        return (this.type == 'quat16' || this.type == 'quat') ? slerp(vals[lo], vals[hi], f) : lerp(vals[lo], vals[hi], f);
    };

    // ---------------------------------------------------------------- materials

    var texCache = {};
    var TEX_VERSION = 2;                                    // bump when textures are re-extracted (browsers keep old copies)

    function loadTexture(base, key, flags) {
        var id = key + '|' + (flags & 3);
        if (texCache[id])
            return texCache[id];
        var t = new THREE.TextureLoader().load(base + 't/' + key + '.png?v=' + TEX_VERSION);
        t.encoding = THREE.sRGBEncoding;
        t.wrapS = (flags & 1) ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
        t.wrapT = (flags & 2) ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
        t.flipY = false;
        return (texCache[id] = t);
    }

    // blend modes: 0 opaque, 1 alpha key, 2 alpha, 3 no-alpha add, 4 add, 5 mod, 6 mod2x
    function makeMaterial(tex, renderFlags, blend) {
        var unlit = renderFlags & 0x01, p = {
            map: tex || null,
            color: tex ? 0xffffff : 0x808080,
            side: (renderFlags & 0x04) ? THREE.DoubleSide : THREE.FrontSide,
            depthTest: !(renderFlags & 0x10),
            depthWrite: !(renderFlags & 0x20)
        };
        if (blend == 1) {
            p.alphaTest = 0.5;
        }
        else if (blend >= 2) {
            p.transparent = true;
            p.depthWrite  = false;
            if (blend == 3 || blend == 4)
                p.blending = THREE.AdditiveBlending;
            else if (blend == 5 || blend == 6) {
                p.blending = THREE.CustomBlending;
                p.blendEquation = THREE.AddEquation;
                p.blendSrc = THREE.DstColorFactor;
                p.blendDst = blend == 6 ? THREE.SrcColorFactor : THREE.ZeroFactor;
            }
        }
        var m = unlit ? new THREE.MeshBasicMaterial(p) : new THREE.MeshLambertMaterial(p);
        m.userData.baseOpacity = 1;
        if (blend == 3 || blend == 4)
            glow(m);
        return m;
    }

    // shader tweaks stack: each adds to the fragment / vertex code and to the program key
    function patch(m, key, fn) {
        var prev = m.onBeforeCompile, keys = (m.userData.patches || []).concat(key);
        m.userData.patches = keys;
        m.onBeforeCompile = function (sh, r) {
            if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev.call(this, sh, r);
            fn(sh);
        };
        m.customProgramCacheKey = function () { return 'aom2-' + keys.join('-'); };
        return m;
    }

    // additive glow over a see-through canvas (the page background shows behind the model): the browser
    // treats the canvas as premultiplied, so light added with almost no alpha would vanish - write the
    // colour premultiplied and let alpha grow with the brightest channel
    function glow(m) {
        m.blending = THREE.CustomBlending;
        m.blendEquation = THREE.AddEquation;
        m.blendSrc = THREE.OneFactor;
        m.blendDst = THREE.OneFactor;
        m.blendSrcAlpha = THREE.OneFactor;
        m.blendDstAlpha = THREE.OneFactor;
        return patch(m, 'glow', function (sh) {
            sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>',
                '#include <dithering_fragment>\n\tgl_FragColor = vec4(gl_FragColor.rgb * gl_FragColor.a, max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b) * gl_FragColor.a);');
        });
    }

    // reflection layers (ArmorReflect, OrbReflectBright, ..): texture coords from the view space normal, like the client
    function sphereMap(m) {
        return patch(m, 'sphere', function (sh) {
            sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>',
                '#include <project_vertex>\n\tvUv = normalize( normalMatrix * normal ).xy * 0.5 + 0.5;');
        });
    }

    // ---------------------------------------------------------------- model

    function Model(base, key, opt) {
        this.base = base;
        this.key  = key;
        this.opt  = opt || {};
        this.clock = 0;                                     // ms since load (global sequences)
        this.time  = 0;                                     // ms into the current sequence
        this.seq   = -1;
        this.speed = 1;
        this.paused = false;
        this.animBuf = {};
    }

    Model.prototype.parse = function (m2buf, skinbuf) {
        var r = this.r = new Reader(m2buf), self = this;
        if (r.str(0, 4) != 'MD20')
            throw new Error('not a model: ' + this.key);

        // global loops, sequences
        var g = r.arr(0x14);
        this.gloops = [];
        for (var i = 0; i < g.n; i++)
            this.gloops.push(r.u32(g.o + i * 4));

        var s = r.arr(0x1C);
        this.seqs = [];
        for (i = 0; i < s.n; i++) {
            var o = s.o + i * 64;
            this.seqs.push({ id: r.u16(o), sub: r.u16(o + 2), duration: r.u32(o + 4), flags: r.u32(o + 12), alias: r.u16(o + 62) });
        }

        // bones
        var b = r.arr(0x2C);
        this.bones = [];
        for (i = 0; i < b.n; i++) {
            o = b.o + i * 88;
            this.bones.push({
                flags: r.u32(o + 4), parent: r.i16(o + 8),
                t: new Track(r, o + 16, 'vec3'), q: new Track(r, o + 36, 'quat16'), s: new Track(r, o + 56, 'vec3'),
                pivot: new THREE.Vector3(r.f32(o + 76), r.f32(o + 80), r.f32(o + 84))
            });
        }

        // vertices
        var v = r.arr(0x3C), nv = v.n;
        var pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2),
            uv2 = new Float32Array(nv * 2), bw = new Float32Array(nv * 4), bi = new Uint16Array(nv * 4);
        for (i = 0; i < nv; i++) {
            o = v.o + i * 48;
            pos[i * 3] = r.f32(o); pos[i * 3 + 1] = r.f32(o + 4); pos[i * 3 + 2] = r.f32(o + 8);
            var wsum = 0;
            for (var j = 0; j < 4; j++) {
                bw[i * 4 + j] = r.u8(o + 12 + j) / 255;
                bi[i * 4 + j] = r.u8(o + 16 + j);
                wsum += bw[i * 4 + j];
            }
            if (!wsum) bw[i * 4] = 1;
            nrm[i * 3] = r.f32(o + 20); nrm[i * 3 + 1] = r.f32(o + 24); nrm[i * 3 + 2] = r.f32(o + 28);
            uv[i * 2] = r.f32(o + 32); uv[i * 2 + 1] = r.f32(o + 36);
            uv2[i * 2] = r.f32(o + 40); uv2[i * 2 + 1] = r.f32(o + 44);
        }

        // colours / transparency / texture animations
        var c = r.arr(0x48);
        this.colors = [];
        for (i = 0; i < c.n; i++)
            this.colors.push({ rgb: new Track(r, c.o + i * 40, 'vec3'), a: new Track(r, c.o + i * 40 + 20, 'fixed16') });
        var tw = r.arr(0x58);
        this.weights = [];
        for (i = 0; i < tw.n; i++)
            this.weights.push(new Track(r, tw.o + i * 20, 'fixed16'));
        var tt = r.arr(0x60);
        this.texAnims = [];
        for (i = 0; i < tt.n; i++)
            this.texAnims.push({ t: new Track(r, tt.o + i * 60, 'vec3'), rot: new Track(r, tt.o + i * 60 + 20, 'quat'), s: new Track(r, tt.o + i * 60 + 40, 'vec3') });

        // textures
        var t = r.arr(0x50);
        this.textures = [];
        for (i = 0; i < t.n; i++) {
            o = t.o + i * 16;
            var nlen = r.u32(o + 8), noff = r.u32(o + 12);
            this.textures.push({ type: r.u32(o), flags: r.u32(o + 4), name: nlen ? r.str(noff, nlen) : '' });
        }

        var mats = r.arr(0x70);
        this.renderFlags = [];
        for (i = 0; i < mats.n; i++)
            this.renderFlags.push({ flags: r.u16(mats.o + i * 4), blend: r.u16(mats.o + i * 4 + 2) });

        function lookup(off) {
            var a = r.arr(off), out = [];
            for (var k = 0; k < a.n; k++) out.push(r.i16(a.o + k * 2));
            return out;
        }
        this.texLookup    = lookup(0x80);
        this.weightLookup = lookup(0x90);
        this.texAnimLookup = lookup(0x98);
        this.uvLookup     = lookup(0x88);                     // texture coord set per layer: 0 / 1, -1 = sphere (reflection) map

        // bounds from the header (models made only of particles have next to no mesh)
        this.headerBox = new THREE.Box3(new THREE.Vector3(r.f32(0xA0), r.f32(0xA4), r.f32(0xA8)), new THREE.Vector3(r.f32(0xAC), r.f32(0xB0), r.f32(0xB4)));

        // attachments (weapons, helms on characters)
        var at = r.arr(0xF0);
        this.attachments = [];
        for (i = 0; i < at.n; i++) {
            o = at.o + i * 40;
            this.attachments.push({ id: r.u32(o), bone: r.u16(o + 4), pos: new THREE.Vector3(r.f32(o + 8), r.f32(o + 12), r.f32(o + 16)) });
        }

        // particle emitters (static/js/modelviewer/particles.js)
        this.emitterDefs = [];
        if (typeof AoParticles != 'undefined')
            try { this.emitterDefs = AoParticles.read(r, this, Track); } catch (e) { this.emitterDefs = []; }

        // ---- skin: which vertices / triangles / batches make up the visible mesh
        var sr = new Reader(skinbuf);
        if (sr.str(0, 4) != 'SKIN')
            throw new Error('not a skin: ' + this.key);
        var sv = sr.arr(4), si = sr.arr(12), ss = sr.arr(28), sb = sr.arr(36);
        var remap = new Uint16Array(sv.n);
        for (i = 0; i < sv.n; i++)
            remap[i] = sr.u16(sv.o + i * 2);

        // geometry built from the skin's vertex list
        var n = sv.n, P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2),
            U2 = new Float32Array(n * 2), W = new Float32Array(n * 4), I = new Uint16Array(n * 4);
        for (i = 0; i < n; i++) {
            var gi = remap[i];
            P.set(pos.subarray(gi * 3, gi * 3 + 3), i * 3);
            N.set(nrm.subarray(gi * 3, gi * 3 + 3), i * 3);
            U.set(uv.subarray(gi * 2, gi * 2 + 2), i * 2);
            U2.set(uv2.subarray(gi * 2, gi * 2 + 2), i * 2);
            W.set(bw.subarray(gi * 4, gi * 4 + 4), i * 4);
            I.set(bi.subarray(gi * 4, gi * 4 + 4), i * 4);
        }
        var idx = new Uint16Array(si.n);
        for (i = 0; i < si.n; i++)
            idx[i] = sr.u16(si.o + i * 2);

        this.sections = [];
        for (i = 0; i < ss.n; i++) {
            o = ss.o + i * 48;
            this.sections.push({ id: sr.u16(o), level: sr.u16(o + 2), indexStart: sr.u16(o + 8) + (sr.u16(o + 2) << 16), indexCount: sr.u16(o + 10) });
        }

        this.batches = [];
        for (i = 0; i < sb.n; i++) {
            o = sb.o + i * 24;
            this.batches.push({
                flags: sr.u8(o), priority: sr.i8(o + 1), section: sr.u16(o + 4), color: sr.i16(o + 8),
                material: sr.u16(o + 10), layer: sr.u16(o + 12), texCount: sr.u16(o + 14), texCombo: sr.u16(o + 16),
                uvCombo: sr.u16(o + 18), weightCombo: sr.u16(o + 20), texAnimCombo: sr.u16(o + 22)
            });
        }
        // layers in order (the client draws batches by section, then material layer)
        this.batches.sort(function (a, c) { return (a.priority - c.priority) || (a.section - c.section) || (a.layer - c.layer); });

        var geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
        geo.setAttribute('normal',   new THREE.BufferAttribute(N, 3));
        geo.setAttribute('uv',       new THREE.BufferAttribute(U, 2));
        geo.setAttribute('uv2',      new THREE.BufferAttribute(U2, 2));
        geo.setAttribute('skinIndex',  new THREE.Uint16BufferAttribute(I, 4));
        geo.setAttribute('skinWeight', new THREE.BufferAttribute(W, 4));
        geo.setIndex(new THREE.BufferAttribute(idx, 1));
        this.geometry = geo;

        this.build();
    };

    // texture for a batch: fixed file (type 0) or replaced by the display (item: 2, creature skins: 11 - 13, ..)
    Model.prototype.textureFor = function (texIndex) {
        var tx = this.textures[texIndex];
        if (!tx)
            return null;
        var key = tx.type == 0 ? (tx.name ? keyOf(tx.name) : null) : ((this.opt.tex || {})[tx.type] || null);
        if (key && key.isTexture)                           // made in the browser (character skin, ..)
            return key;
        return key ? loadTexture(this.base, key, tx.flags) : null;
    };

    Model.prototype.build = function () {
        this.root = new THREE.Group();
        this.root.rotation.x = -Math.PI / 2;                // client Z up -> three Y up
        this.root.rotation.z = -Math.PI / 2;                // face the camera
        this.space = new THREE.Group();                     // model space: the mesh and anything attached to it
        this.root.add(this.space);
        this.attached = [];
        this.emitters = [];
        this.buildMesh();
        if (this.emitterDefs.length)
            this.emitters = AoParticles.attach(this, this.emitterDefs);
        this.geometry.computeBoundingBox();
        this.box = this.geometry.boundingBox.clone();
        this.play(this.findSeq(0));
    };

    // visible parts change (hair style, gloves, ..): rebuild the draw groups, keep geometry and animation
    Model.prototype.setGeosets = function (fn) {
        this.opt.geosets = fn;
        this.buildMesh();
    };

    Model.prototype.buildMesh = function () {
        var self = this, geo = this.geometry;
        if (this.mesh) {
            this.space.remove(this.mesh);
            this.batchMats.forEach(function (m) { m.dispose(); });
        }
        var materials = [];
        this.batchMats = [];
        geo.clearGroups();
        this.batches.forEach(function (bt, n) {
            var sec = self.sections[bt.section];
            if (!sec || !sec.indexCount)
                return;
            if (self.opt.geosets && !self.opt.geosets(sec.id))
                return;
            var rf  = self.renderFlags[bt.material] || { flags: 0, blend: 0 };
            var tex = self.textureFor(self.texLookup[bt.texCombo]);
            var anim = self.texAnimLookup[bt.texAnimCombo];
            if (tex && anim != null && anim >= 0 && self.texAnims[anim]) {
                tex = tex.clone();                          // own copy: its offset is animated
                tex.needsUpdate = true;
            }
            var env = self.uvLookup[bt.uvCombo] == -1;
            // reflection layers brighten the metal: drawn additive (as multiply they darkened everything behind them)
            var mat = makeMaterial(tex, env ? rf.flags | 0x01 : rf.flags, env && rf.blend >= 2 ? 4 : rf.blend);
            if (env) {
                sphereMap(mat);
                if (rf.blend >= 2) mat.userData.envScale = 0.6;
            }
            mat.userData = { batch: bt, texAnim: (anim != null && anim >= 0) ? anim : -1, weight: self.weightLookup[bt.weightCombo], envScale: mat.userData.envScale || 1 };
            mat.polygonOffset = bt.layer > 0;               // stacked layers on the same faces
            mat.polygonOffsetFactor = -bt.layer;
            materials.push(mat);
            self.batchMats.push(mat);
            geo.addGroup(sec.indexStart, sec.indexCount, materials.length - 1);

            // two textures in one batch: the second (usually a reflection) is added on top
            for (var t = 1; t < bt.texCount; t++) {
                var tex2 = self.textureFor(self.texLookup[bt.texCombo + t]);
                if (!tex2)
                    continue;
                var m2 = makeMaterial(tex2, rf.flags | 0x01, 4);   // unlit, additive
                if (self.uvLookup[bt.uvCombo + t] == -1)
                    sphereMap(m2);
                m2.userData = { batch: bt, texAnim: -1, weight: self.weightLookup[bt.weightCombo + t], envScale: 0.6 };
                m2.polygonOffset = true;
                m2.polygonOffsetFactor = -(bt.layer + t);
                m2.depthWrite = false;
                materials.push(m2);
                self.batchMats.push(m2);
                geo.addGroup(sec.indexStart, sec.indexCount, materials.length - 1);
            }
        });

        if (this.bones.length) {
            var bones = this.bones.map(function () { var b = new THREE.Bone(); b.matrixAutoUpdate = false; return b; });
            this.mesh = new THREE.SkinnedMesh(geo, materials);
            bones.forEach(function (b) { self.mesh.add(b); });
            this.mesh.bind(new THREE.Skeleton(bones, bones.map(function () { return new THREE.Matrix4(); })), new THREE.Matrix4());
            this.boneObjs = bones;
        }
        else
            this.mesh = new THREE.Mesh(geo, materials);
        this.mesh.frustumCulled = false;
        this.space.add(this.mesh);
        if (this.boneWorld)                                 // keep the pose until the next update
            this.update(0);
    };

    // attach another model (weapon, helm, shoulder) to one of the attachment points (M2Attachment ids)
    Model.prototype.attach = function (other, attachmentId) {
        var at = null;
        for (var i = 0; i < this.attachments.length; i++)
            if (this.attachments[i].id == attachmentId) { at = this.attachments[i]; break; }
        if (!at)
            return false;
        var holder = new THREE.Group();
        holder.matrixAutoUpdate = false;
        holder.add(other.space);                            // the other model's own space, without its upright turn
        this.space.add(holder);
        this.attached.push({ model: other, at: at, holder: holder });
        return true;
    };

    Model.prototype.detachAll = function () {
        var self = this;
        this.attached.forEach(function (a) { self.space.remove(a.holder); });
        this.attached = [];
    };

    // ---------------------------------------------------------------- animation

    Model.prototype.findSeq = function (animId) {
        for (var i = 0; i < this.seqs.length; i++)
            if (this.seqs[i].id == animId && !(this.seqs[i].flags & 0x40))
                return i;
        return this.seqs.length ? 0 : -1;
    };

    // start a sequence; loads its .anim file first when the data is kept outside the model
    Model.prototype.play = function (i) {
        var self = this, s = this.seqs[i];
        if (!s)
            return Promise.resolve();
        if (s.flags & 0x40 && this.seqs[s.alias])          // alias: play the referenced one
            return this.play(s.alias);
        this.want = i;                                      // what is playing as soon as its data is in (animation lists)
        var go = function () { self.seq = i; self.time = 0; };
        if (s.flags & 0x20 || this.animBuf[i]) {
            go();
            return Promise.resolve();
        }
        var url = this.base + 'm/' + this.key + ('000' + s.id).slice(-4) + '-' + ('0' + s.sub).slice(-2) + '.anim';
        return fetchBuf(url).then(function (buf) { self.animBuf[i] = new Reader(buf); go(); }, function () { go(); });
    };

    var _m = new THREE.Matrix4(), _p = new THREE.Matrix4(), _n = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

    Model.prototype.update = function (dt) {
        if (!this.paused) {
            this.clock += dt;
            var s = this.seqs[this.seq];
            if (s) {
                this.time += dt * this.speed;
                if (s.duration)
                    this.time %= s.duration;
            }
        }
        var seq = this.seq, t = this.time, self = this;

        // bones: world = parent * T(pivot) * T(trans) * R * S * T(-pivot)
        if (this.boneObjs) {
            var world = [];
            for (var i = 0; i < this.bones.length; i++) {
                var b = this.bones[i];
                var tr = b.t.at(seq, t, this, null), rq = b.q.at(seq, t, this, null), sc = b.s.at(seq, t, this, null);
                _m.makeTranslation(b.pivot.x, b.pivot.y, b.pivot.z);
                if (tr) _m.multiply(_p.makeTranslation(tr[0], tr[1], tr[2]));
                if (rq) _m.multiply(_p.makeRotationFromQuaternion(_q.set(rq[0], rq[1], rq[2], rq[3]).normalize()));
                if (sc) _m.multiply(_p.makeScale(sc[0], sc[1], sc[2]));
                _m.multiply(_n.makeTranslation(-b.pivot.x, -b.pivot.y, -b.pivot.z));
                var w = new THREE.Matrix4();
                if (b.parent >= 0 && world[b.parent])
                    w.multiplyMatrices(world[b.parent], _m);
                else
                    w.copy(_m);
                world.push(w);
                this.boneObjs[i].matrix.copy(w);
                this.boneObjs[i].matrixWorldNeedsUpdate = true;
            }
            this.boneWorld = world;
        }

        // attached models follow their attachment point
        for (var ai = 0; ai < this.attached.length; ai++) {
            var A = this.attached[ai], bw = this.boneWorld && this.boneWorld[A.at.bone];
            A.holder.matrix.copy(bw || _m.identity()).multiply(_p.makeTranslation(A.at.pos.x, A.at.pos.y, A.at.pos.z));
            A.holder.matrixWorldNeedsUpdate = true;
            A.model.update(dt);
        }

        // particles
        for (var ei = 0; this.emitters && ei < this.emitters.length; ei++)
            this.emitters[ei].update(dt);

        // transparency / colour alpha / scrolling textures
        this.batchMats.forEach(function (m) {
            var u = m.userData, a = 1;
            if (u.weight != null && u.weight >= 0 && self.weights[u.weight])
                a *= self.weights[u.weight].at(seq, t, self, 1);
            if (u.batch.color >= 0 && self.colors[u.batch.color]) {
                var col = self.colors[u.batch.color];
                a *= col.a.at(seq, t, self, 1);
                var rgb = col.rgb.at(seq, t, self, null);
                if (rgb && !m.map) m.color.setRGB(rgb[0], rgb[1], rgb[2]);
            }
            a *= u.envScale || 1;
            if (a < 0.999 && !m.transparent) { m.transparent = true; m.needsUpdate = true; }
            m.opacity = a;
            if (u.texAnim >= 0 && m.map) {
                var ta = self.texAnims[u.texAnim], off = ta.t.at(seq, t, self, null);
                if (off) m.map.offset.set(off[0], off[1]);
            }
        });
    };

    Model.prototype.animations = function (names) {           // [{index, id, name}] one per animation id
        var seen = {}, out = [];
        this.seqs.forEach(function (s, i) {
            if (seen[s.id] || (s.flags & 0x40)) return;
            seen[s.id] = 1;
            out.push({ index: i, id: s.id, name: (names && names[s.id]) || ('Animation ' + s.id) });
        });
        return out.sort(function (a, b) { return a.name.localeCompare(b.name); });
    };

    // ---------------------------------------------------------------- load

    function load(base, key, opt) {
        var m = new Model(base, key, opt);
        return Promise.all([fetchBuf(base + 'm/' + key + '.m2'), fetchBuf(base + 'm/' + key + '00.skin')]).then(function (b) {
            m.parse(b[0], b[1]);
            return m;
        });
    }

    return { load: load, keyOf: keyOf, TEX_VERSION: TEX_VERSION };
})();
