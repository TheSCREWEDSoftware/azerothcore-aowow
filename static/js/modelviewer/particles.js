/*
 * aowow model viewer - M2 particle emitters (fire, smoke, sparkles, swamp gas, glowing weapons ..)
 * read from the model file and simulated on the cpu, drawn as textured point sprites
 * used by static/js/modelviewer/m2.js when present
 */
var AoParticles = (function () {
    'use strict';

    var MAX = 600;                                          // particles per emitter

    function rnd(a, b) { return a + Math.random() * (b - a); }

    // FBlock: timestamps (fixed16 share of the particle's life) and values, no interpolation type
    function fblock(r, o, type) {
        var t = r.arr(o), v = r.arr(o + 8), n = Math.min(t.n, v.n), times = [], vals = [];
        for (var i = 0; i < n; i++) {
            times.push(r.u16(t.o + i * 2) / 32767);
            if (type == 'vec3')       vals.push([r.f32(v.o + i * 12), r.f32(v.o + i * 12 + 4), r.f32(v.o + i * 12 + 8)]);
            else if (type == 'vec2')  vals.push([r.f32(v.o + i * 8), r.f32(v.o + i * 8 + 4)]);
            else if (type == 'fixed') vals.push(r.u16(v.o + i * 2) / 32767);
            else                      vals.push(r.u16(v.o + i * 2));
        }
        return { t: times, v: vals };
    }

    function fAt(fb, f, def) {                              // value at share f (0..1) of the life
        var t = fb.t, v = fb.v, n = t.length;
        if (!n) return def;
        if (n == 1 || f <= t[0]) return v[0];
        if (f >= t[n - 1]) return v[n - 1];
        for (var i = 1; i < n; i++)
            if (f < t[i]) {
                var k = (f - t[i - 1]) / ((t[i] - t[i - 1]) || 1), a = v[i - 1], b = v[i];
                if (typeof a == 'number') return a + (b - a) * k;
                var o = [];
                for (var j = 0; j < a.length; j++) o.push(a[j] + (b[j] - a[j]) * k);
                return o;
            }
        return v[n - 1];
    }

    // M2Particle (v264, 476 bytes - with the lifespan / rate variations) at header offset 0x128
    function read(r, model, Track) {
        var a = r.arr(0x128), out = [];
        for (var i = 0; i < a.n; i++) {
            var o = a.o + i * 476;
            var e = {
                flags: r.u32(o + 4),
                pos: [r.f32(o + 8), r.f32(o + 12), r.f32(o + 16)],
                bone: r.u16(o + 20),
                texture: r.u16(o + 22),
                blend: r.u8(o + 40),
                type: r.u8(o + 41),                         // 1 plane, 2 sphere, 3 spline
                rows: r.u16(o + 48) || 1,
                cols: r.u16(o + 50) || 1,
                speed:  new Track(r, o + 0x34, 'float'),
                speedVar: new Track(r, o + 0x48, 'float'),
                vRange: new Track(r, o + 0x5C, 'float'),
                hRange: new Track(r, o + 0x70, 'float'),
                gravity: new Track(r, o + 0x84, 'float'),
                life:   new Track(r, o + 0x98, 'float'),
                lifeVar: r.f32(o + 0xAC),
                rate:   new Track(r, o + 0xB0, 'float'),
                rateVar: r.f32(o + 0xC4),
                areaL:  new Track(r, o + 0xC8, 'float'),
                areaW:  new Track(r, o + 0xDC, 'float'),
                zSrc:   new Track(r, o + 0xF0, 'float'),
                color: fblock(r, o + 0x104, 'vec3'),
                alpha: fblock(r, o + 0x114, 'fixed'),
                scale: fblock(r, o + 0x124, 'vec2'),
                scaleVar: r.f32(o + 0x134),
                cell: fblock(r, o + 0x13C, 'u16'),
                drag: r.f32(o + 0x174),
                enabled: new Track(r, o + 0x1C8, 'u8')
            };
            if (e.flags & 0x10000000) e.texture &= 0x1f;    // several textures packed: use the first
            if (e.type < 1 || e.type > 3) continue;
            out.push(e);
        }
        return out;
    }

    var VS = [
        'attribute vec4 pcolor;',
        'attribute float psize;',
        'attribute float pcell;',
        'uniform float uScreen;',
        'varying vec4 vColor;',
        'varying float vCell;',
        'void main() {',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  gl_Position = projectionMatrix * mv;',
        '  gl_PointSize = max(1.0, psize * projectionMatrix[1][1] * uScreen / max(0.01, -mv.z));',
        '  vColor = pcolor; vCell = pcell;',
        '}'
    ].join('\n');

    var FS = [
        'uniform sampler2D map;',
        'uniform vec2 grid;',
        'uniform float alphaTest;',
        'uniform float additive;',
        'varying vec4 vColor;',
        'varying float vCell;',
        'void main() {',
        '  float col = mod(vCell, grid.x), row = floor(vCell / grid.x);',
        '  vec4 t = texture2D(map, vec2((col + gl_PointCoord.x) / grid.x, (row + gl_PointCoord.y) / grid.y));',
        '  vec4 c = t * vec4(pow(vColor.rgb, vec3(2.2)), vColor.a);',
        '  if (c.a <= alphaTest) discard;',
        '  gl_FragColor = c;',
        '  #include <encodings_fragment>',
        // see-through canvas: premultiplied colour, alpha from the brightest channel (as m2.js glow())
        '  if (additive > 0.5) gl_FragColor = vec4(gl_FragColor.rgb * gl_FragColor.a, max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b) * gl_FragColor.a);',
        '}'
    ].join('\n');

    function Emitter(def, model, tex) {
        this.def = def;
        this.model = model;
        this.pending = 0;
        this.list = [];
        var g = this.geo = new THREE.BufferGeometry();
        this.aPos = new THREE.BufferAttribute(new Float32Array(MAX * 3), 3);
        this.aCol = new THREE.BufferAttribute(new Float32Array(MAX * 4), 4);
        this.aSize = new THREE.BufferAttribute(new Float32Array(MAX), 1);
        this.aCell = new THREE.BufferAttribute(new Float32Array(MAX), 1);
        [this.aPos, this.aCol, this.aSize, this.aCell].forEach(function (x) { x.setUsage(THREE.DynamicDrawUsage); });
        g.setAttribute('position', this.aPos);
        g.setAttribute('pcolor', this.aCol);
        g.setAttribute('psize', this.aSize);
        g.setAttribute('pcell', this.aCell);
        g.setDrawRange(0, 0);

        var add = def.blend == 3 || def.blend == 4;
        this.mat = new THREE.ShaderMaterial({
            uniforms: {
                map: { value: tex || null },
                grid: { value: new THREE.Vector2(def.cols, def.rows) },
                alphaTest: { value: def.blend <= 1 ? 0.5 : 0.004 },
                additive: { value: add ? 1 : 0 },
                uScreen: { value: 300 }
            },
            vertexShader: VS,
            fragmentShader: FS,
            transparent: def.blend >= 2,
            depthWrite: def.blend <= 1,
            blending: add ? THREE.CustomBlending : THREE.NormalBlending,
            blendEquation: THREE.AddEquation,
            blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
            blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor
        });
        this.points = new THREE.Points(g, this.mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = 10;
        var self = this;
        this.points.onBeforeRender = function (renderer) {
            var s = new THREE.Vector2();
            renderer.getDrawingBufferSize(s);
            self.mat.uniforms.uScreen.value = s.y / 2;
        };
    }

    var _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _d = new THREE.Vector3(), _n3 = new THREE.Matrix3();

    Emitter.prototype.update = function (dt) {             // dt in ms
        var d = this.def, m = this.model, seq = m.seq, t = m.time, s = dt / 1000;
        if (s <= 0 && !this.list.length) return;
        var V = function (tr, def) { var x = tr.at(seq, t, m, def); return x == null ? def : x; };

        // spawn
        var on = d.enabled.empty() ? 1 : V(d.enabled, 1);
        if (on && !m.paused) {
            var life0 = V(d.life, 1) || 1;
            this.pending += V(d.rate, 0) * (1 + rnd(-d.rateVar, d.rateVar)) * s;
            var n = Math.min(Math.floor(this.pending), 40);
            this.pending -= Math.floor(this.pending);
            if (n > 0) {
                var bw = m.boneWorld && m.boneWorld[d.bone];
                _m.copy(bw || _m.identity());
                _n3.setFromMatrix4(_m);
                var speed = V(d.speed, 0), sv = V(d.speedVar, 0), vr = V(d.vRange, 0), hr = V(d.hRange, 0),
                    L = V(d.areaL, 0), W = V(d.areaW, 0), z = V(d.zSrc, 0);
                for (var i = 0; i < n && this.list.length < MAX; i++) {
                    var p = new THREE.Vector3(), dir = new THREE.Vector3();
                    var pol = rnd(-vr, vr), az = rnd(-hr, hr);
                    dir.set(Math.sin(pol) * Math.cos(az), Math.sin(pol) * Math.sin(az), Math.cos(pol));
                    if (d.type == 2) {                      // sphere: start somewhere inside, fly outwards
                        var rad = L + Math.random() * (W - L);
                        p.copy(dir).multiplyScalar(rad);
                    }
                    else                                    // plane (and splines, roughly)
                        p.set(rnd(-0.5, 0.5) * L, rnd(-0.5, 0.5) * W, 0);
                    if (z > 0) {
                        dir.copy(p).sub(_d.set(0, 0, z));
                        if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
                        dir.normalize();
                    }
                    p.add(_v.set(d.pos[0], d.pos[1], d.pos[2])).applyMatrix4(_m);
                    if (!(d.flags & 0x8)) dir.applyMatrix3(_n3).normalize();
                    var sp = speed * (1 + rnd(-sv, sv));
                    this.list.push({
                        p: p, v: dir.multiplyScalar(sp), age: 0, life: Math.max(0.05, life0 * (1 + rnd(-d.lifeVar, d.lifeVar))),
                        sc: 1 + rnd(-d.scaleVar, d.scaleVar)
                    });
                }
            }
        }

        // move, age, write the buffers
        var grav = V(d.gravity, 0), drag = d.drag, P = this.aPos.array, C = this.aCol.array, S = this.aSize.array, Ce = this.aCell.array;
        var keep = [], cells = d.rows * d.cols;
        for (var k = 0; k < this.list.length; k++) {
            var q = this.list[k];
            if (!m.paused) {
                q.age += s;
                q.v.z -= grav * s;
                if (drag) q.v.multiplyScalar(Math.max(0, 1 - drag * s));
                q.p.addScaledVector(q.v, s);
            }
            if (q.age >= q.life) continue;
            var f = q.age / q.life, j = keep.length;
            keep.push(q);
            var c = fAt(d.color, f, [255, 255, 255]), a = fAt(d.alpha, f, 1), sc = fAt(d.scale, f, [1, 1]);
            P[j * 3] = q.p.x; P[j * 3 + 1] = q.p.y; P[j * 3 + 2] = q.p.z;
            C[j * 4] = c[0] / 255; C[j * 4 + 1] = c[1] / 255; C[j * 4 + 2] = c[2] / 255; C[j * 4 + 3] = a;
            S[j] = 2 * sc[0] * q.sc;                        // scale is the half width of the quad
            Ce[j] = Math.floor(fAt(d.cell, f, 0)) % cells;
        }
        this.list = keep;
        this.geo.setDrawRange(0, keep.length);
        this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aCell.needsUpdate = true;
    };

    // emitters of a parsed model: added to its space, stepped from its update()
    function attach(model, defs) {
        return defs.map(function (def) {
            var tex = model.textureFor(def.texture);
            var e = new Emitter(def, model, tex);
            model.space.add(e.points);
            return e;
        });
    }

    return { read: read, attach: attach };
})();
