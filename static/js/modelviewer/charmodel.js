/*
 * aowow model viewer: player characters - race / body / looks and worn items
 *
 *   AoChar.load(base, {race: 11, sex: 1, skin: 0, face: 0, hairStyle: 0, hairColor: 0, facial: 0, npc: false},
 *               {head: {display: 46358}, chest: {display: 1234}, mainhand: {display: 41428}, ..})
 *       -> Promise<model>   (an AoM2 model with extra methods: setLook, setItems, options)
 *
 * Data (setup/tools/modelviewer/extract.py): meta/char/<race*10+sex>.json, meta/item/<display>.json,
 * meta/body/<display>.json (armour textures), helmvis.json
 */
var AoChar = (function () {

    // body texture regions, in 256 x 256 units (scaled to the skin texture's real size)
    var REGION = {
        armUpper: [0, 0, 128, 64], armLower: [0, 64, 128, 64], hand: [0, 128, 128, 32],
        faceUpper: [0, 160, 128, 32], faceLower: [0, 192, 128, 64],
        torsoUpper: [128, 0, 128, 64], torsoLower: [128, 64, 128, 32],
        legUpper: [128, 96, 128, 64], legLower: [128, 160, 128, 64], foot: [128, 224, 128, 32]
    };
    // ItemDisplayInfo Texture[8] order
    var ITEM_REGION = ['armUpper', 'armLower', 'hand', 'torsoUpper', 'torsoLower', 'legUpper', 'legLower', 'foot'];
    // the regions each slot may paint; display records often carry leftovers for other parts of the body
    var SLOT_REGIONS = {
        shirt: [0, 1, 3, 4], chest: [0, 1, 3, 4, 5, 6], waist: [4, 5], legs: [5, 6], feet: [6, 7],
        wrist: [1], hands: [1, 2], tabard: [3, 4]
    };

    // slots, in the order their textures are painted (later covers earlier)
    var SLOTS = ['shirt', 'legs', 'feet', 'chest', 'wrist', 'hands', 'waist', 'tabard', 'back', 'head', 'shoulder', 'mainhand', 'offhand', 'ranged'];

    // inventory type -> slot
    var INV = { 1: 'head', 3: 'shoulder', 4: 'shirt', 5: 'chest', 20: 'chest', 6: 'waist', 7: 'legs', 8: 'feet', 9: 'wrist',
                10: 'hands', 16: 'back', 19: 'tabard', 13: 'mainhand', 17: 'mainhand', 21: 'mainhand', 22: 'offhand',
                14: 'offhand', 23: 'offhand', 15: 'ranged', 25: 'ranged', 26: 'ranged' };

    // geoset groups (id / 100) a naked character shows, and which value
    // like the client, every group shows its X01 part unless something picks another (1501 = the neck / upper back
    // without a cloak, 401 bare hands, 1301 no robe ...); ears use 702
    var DEFAULT_GEO = { 4: 1, 5: 1, 6: 1, 7: 2, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1 };

    var cache = {}, imgCache = {};

    function json(url) {
        if (!cache[url])
            cache[url] = fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status + ' ' + url); return r.json(); });
        return cache[url];
    }

    function img(url) {
        if (!url || /\/(none|undefined|null)\.png$/.test(url))
            return Promise.resolve(null);
        if (!imgCache[url])
            imgCache[url] = new Promise(function (ok) {
                var i = new Image();
                i.onload = function () { ok(i); };
                i.onerror = function () { ok(null); };
                i.src = url + '?v=' + AoM2.TEX_VERSION;
            });
        return imgCache[url];
    }

    // a CharSections row: exact match first, then the same variation in any colour, then anything
    function pick(list, v, c, npc) {
        var ok = list.filter(function (x) { return npc || !x.npc; });
        return ok.filter(function (x) { return x.v == v && x.c == c; })[0]
            || ok.filter(function (x) { return x.v == v; })[0]
            || ok.filter(function (x) { return x.c == c; })[0]
            || ok[0] || null;
    }

    function distinct(list, key, npc, filter) {
        var seen = {}, out = [];
        list.forEach(function (x) {
            if ((!npc && x.npc) || (filter && !filter(x)) || seen[x[key]] != null) return;
            seen[x[key]] = 1;
            out.push(x[key]);
        });
        return out.sort(function (a, b) { return a - b; });
    }

    function Char(base, meta, look) {
        this.base = base;
        this.meta = meta;
        this.look = {};
        this.items = {};
        this.itemData = {};
        for (var k in look) this.look[k] = look[k];
    }

    // ------------------------------------------------------------ what can be chosen (for the Body tab)
    Char.prototype.options = function () {
        var s = this.meta.sections, L = this.look, npc = !!L.npc;
        return {
            skin:      distinct(s.skin, 'c', npc),
            face:      distinct(s.face, 'v', npc, function (x) { return x.c == L.skin; }),
            hairStyle: Object.keys(this.meta.hair).map(Number).filter(function (v) { return npc || s.hair.some(function (x) { return x.v == v && !x.npc; }); }).sort(function (a, b) { return a - b; }),
            hairColor: distinct(s.hair, 'c', npc, function (x) { return x.v == L.hairStyle; }),
            facial:    Object.keys(this.meta.facial).map(Number).concat([0]).filter(function (v, i, a) { return a.indexOf(v) == i; }).sort(function (a, b) { return a - b; })
        };
    };

    // ------------------------------------------------------------ visible mesh parts
    Char.prototype.geosetFn = function () {
        var m = this.meta, L = this.look, groups = {}, k;
        for (k in DEFAULT_GEO) groups[k] = DEFAULT_GEO[k];

        var fh = m.facial[L.facial] || [1, 1, 1];
        groups[1] = fh[0] || 1;
        groups[3] = fh[1] || 1;
        groups[2] = fh[2] || 1;

        var hair = (m.hair[L.hairStyle] || [1, 0])[0];
        var hide = {};                                      // helm hides hair / facial hair / ears

        var self = this;
        SLOTS.forEach(function (slot) {
            var it = self.itemData[slot];
            if (!it || !it.item) return;
            var g = it.item.geosets || [0, 0, 0];
            switch (slot) {
                case 'hands':  if (g[0]) groups[4] = 1 + g[0]; break;
                case 'feet':   if (g[0]) groups[5] = 1 + g[0]; break;
                case 'shirt':
                case 'chest':
                    if (g[0]) groups[8]  = 1 + g[0];
                    if (g[1]) groups[10] = 1 + g[1];
                    if (g[2]) groups[13] = 1 + g[2];
                    break;
                case 'legs':
                    if (g[0]) groups[11] = 1 + g[0];
                    if (g[1]) groups[9]  = 1 + g[1];
                    if (g[2]) groups[13] = 1 + g[2];
                    break;
                case 'tabard': groups[12] = 1 + (g[0] || 1); break;
                case 'back':                                // a cape without its texture would be drawn black: leave it off
                    groups[15] = it.item.cape && !self.capeMissing ? 1 + (g[0] || 0) : 0;
                    break;
                case 'waist':  if (g[0]) groups[18] = 1 + g[0]; break;
                case 'head':
                    var vis = (it.item.helmVis || [0, 0])[m.sex], row = self.helmvis && self.helmvis[vis];
                    if (row) {
                        var bit = 1 << (m.race - 1);
                        ['hair', 'f1', 'f2', 'f3', 'ears'].forEach(function (name, i) { if (row[i] & bit) hide[name] = 1; });
                    }
                    break;
            }
        });
        // a helm hiding facial hair: the bare variant (X01), which is also the jaw / cheeks of the face itself
        if (hide.f1) groups[1] = 1;
        if (hide.f2) groups[2] = 1;
        if (hide.f3) groups[3] = 1;
        if (hide.ears) groups[7] = 1;
        var hairId = hide.hair || !hair ? 1 : hair;          // bald, or hair hidden by a helm: the bare scalp (geoset 1)

        return function (id) {
            if (id == 0) return true;
            if (id < 100) return id == hairId;
            var grp = Math.floor(id / 100), val = id % 100;
            return groups[grp] != null && groups[grp] > 0 && val == groups[grp];
        };
    };

    // ------------------------------------------------------------ textures
    Char.prototype.makeTextures = function () {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.canvas.height = 256;
        this.skinTex = new THREE.CanvasTexture(this.canvas);
        this.hairTex = new THREE.CanvasTexture(document.createElement('canvas'));
        this.furTex  = new THREE.CanvasTexture(document.createElement('canvas'));
        this.capeTex = new THREE.CanvasTexture(document.createElement('canvas'));
        [this.skinTex, this.hairTex, this.furTex, this.capeTex].forEach(function (t) {
            t.encoding = THREE.sRGBEncoding;
            t.flipY = false;
        });
        return { 1: this.skinTex, 6: this.hairTex, 8: this.furTex, 2: this.capeTex };
    };

    function copyTo(tex, image) {                           // plain texture from one image
        if (!image) return;
        var c = tex.image;
        c.width = image.width;
        c.height = image.height;
        c.getContext('2d').drawImage(image, 0, 0);
        tex.needsUpdate = true;
    }

    Char.prototype.compose = function () {
        var self = this, m = this.meta, L = this.look, s = m.sections, npc = !!L.npc, base = this.base + 't/';
        var skin  = pick(s.skin, 0, L.skin, npc),
            face  = pick(s.face.filter(function (x) { return x.c == L.skin || true; }), L.face, L.skin, npc),
            hair  = pick(s.hair, L.hairStyle, L.hairColor, npc),
            facial = pick(s.facial, L.facial, L.hairColor, npc),
            under = pick(s.under, 0, L.skin, npc),
            showScalp = (m.hair[L.hairStyle] || [0, 1])[1],
            hairTex = hair && hair.t[0] ? hair : pick(s.hair.filter(function (x) { return x.t[0]; }), -1, L.hairColor, npc);
        var layers = [];                                    // [key, region | null (whole)]
        function add(key, region) { if (key) layers.push([key, region]); }

        if (L.bake) add(L.bake, null);                      // humanoid npc: pre-baked skin + clothes
        else {
            add(skin && skin.t[0], null);
            add(face && face.t[0], 'faceLower');
            add(face && face.t[1], 'faceUpper');
            add(facial && facial.t[0], 'faceLower');
            add(facial && facial.t[1], 'faceUpper');
            if (showScalp || true) {
                add(hair && hair.t[1], 'faceLower');
                add(hair && hair.t[2], 'faceUpper');
            }
            add(under && under.t[0], 'legUpper');
            add(under && under.t[1], 'torsoUpper');
        }

        // armour, in paint order
        var g = m.sex ? 'F' : 'M';
        if (!L.bake)
            SLOTS.forEach(function (slot) {
                var it = self.itemData[slot];
                if (!it || !it.body) return;
                // a tabard covers the chest, a robe the legs (handled by order); gloves under long sleeves are not modelled
                for (var j in it.body.regions) {
                    if ((SLOT_REGIONS[slot] || []).indexOf(+j) < 0) continue;
                    var t = it.body.regions[j];
                    add(t[g] || t.U || t.M || t.F, ITEM_REGION[j]);
                }
            });

        var job = this.job = {};
        return Promise.all(layers.map(function (l) { return img(base + l[0] + '.png'); })).then(function (imgs) {
            if (job !== self.job) return;                   // a newer compose started
            var first = imgs[0], W = first ? first.width : 256, H = first ? first.height : 256, sc = W / 256;
            var c = self.canvas;
            c.width = W; c.height = H;
            var g2 = c.getContext('2d');
            g2.clearRect(0, 0, W, H);
            imgs.forEach(function (im, i) {
                if (!im) return;
                var r = layers[i][1] && REGION[layers[i][1]];
                if (r) g2.drawImage(im, r[0] * sc, r[1] * sc * (H / W), r[2] * sc, r[3] * sc * (H / W));
                else   g2.drawImage(im, 0, 0, W, H);
            });
            self.skinTex.needsUpdate = true;
        }).then(function () {
            return Promise.all([
                // bald styles have no hair texture, but brows / beards still use the hair colour
                img(base + (hairTex && hairTex.t[0] ? hairTex.t[0] : 'none') + '.png'),
                img(base + (skin && skin.t[1] ? skin.t[1] : 'none') + '.png'),
                self.itemData.back && self.itemData.back.item && self.itemData.back.item.cape ? img(base + self.itemData.back.item.cape + '.png') : null
            ]).then(function (r) {
                if (job !== self.job) return;
                copyTo(self.hairTex, r[0]);
                copyTo(self.furTex, r[1] || r[0]);
                if (r[2]) copyTo(self.capeTex, r[2]);
                var missing = !!(self.itemData.back && self.itemData.back.item && self.itemData.back.item.cape && !r[2]);
                if (missing != !!self.capeMissing) {        // cape texture did not load: take the cape off again
                    self.capeMissing = missing;
                    self.model.setGeosets(self.geosetFn());
                }
            });
        });
    };

    // ------------------------------------------------------------ worn items
    Char.prototype.loadItems = function (items) {
        var self = this, base = this.base;
        this.items = items || {};
        var jobs = Object.keys(this.items).map(function (slot) {
            var d = self.items[slot] && self.items[slot].display;
            if (!d) return null;
            return Promise.all([
                json(base + 'meta/item/' + d + '.json').catch(function () { return null; }),
                json(base + 'meta/body/' + d + '.json').catch(function () { return null; })
            ]).then(function (r) { self.itemData[slot] = { item: r[0], body: r[1] }; });
        });
        this.itemData = {};
        return Promise.all(jobs);
    };

    // helms, shoulders, weapons, shields: separate models on attachment points
    Char.prototype.attachItems = function () {
        var self = this, mdl = this.model, prefix = this.meta.prefix, jobs = [];
        mdl.detachAll();
        function put(entry, attachment, flip) {
            if (!entry) return;
            var key = entry.race ? (entry.race[prefix] || entry.race[Object.keys(entry.race)[0]]) : entry.f;
            if (!key) return;
            jobs.push(AoM2.load(self.base, key, { tex: entry.tex }).then(function (m) {
                if (flip) m.space.scale.y = -1;             // left side mirrors the right one if only one model exists
                mdl.attach(m, attachment);
            }).catch(function () {}));
        }
        var d = this.itemData;
        if (d.head && d.head.item)
            put((d.head.item.models || [])[0], 11);
        if (d.shoulder && d.shoulder.item) {
            var sh = d.shoulder.item.models || [];
            put(sh.filter(function (x) { return x.side == 'left'; })[0], 6);
            put(sh.filter(function (x) { return x.side == 'right'; })[0], 5);
        }
        if (d.mainhand && d.mainhand.item)
            put((d.mainhand.item.models || [])[0], 1);
        if (d.offhand && d.offhand.item) {
            var oh = (d.offhand.item.models || [])[0];
            put(oh, oh && oh.slot == 'shield' ? 0 : 2);
        }
        if (d.ranged && d.ranged.item && !d.mainhand)
            put((d.ranged.item.models || [])[0], 2);       // bows / guns in hand when nothing else is held
        return Promise.all(jobs);
    };

    // ------------------------------------------------------------ public
    Char.prototype.refresh = function () {
        var self = this;
        this.model.setGeosets(this.geosetFn());
        return Promise.all([this.compose(), this.attachItems()]).then(function () { return self.model; });
    };

    Char.prototype.setLook = function (look) {
        for (var k in look) this.look[k] = look[k];
        return this.refresh();
    };

    Char.prototype.setItems = function (items) {
        var self = this;
        return this.loadItems(items).then(function () { return self.refresh(); });
    };

    function load(base, look, items) {
        var c;
        return Promise.all([json(base + 'meta/char/' + (look.race * 10 + look.sex) + '.json'), json(base + 'helmvis.json').catch(function () { return {}; })])
            .then(function (r) {
                c = new Char(base, r[0], look);
                c.helmvis = r[1];
                var o = c.options();                        // fill in anything not given with the first valid choice
                ['skin', 'hairStyle'].forEach(function (k) { if (c.look[k] == null || o[k].indexOf(c.look[k]) < 0) c.look[k] = o[k][0] || 0; });
                if (look.hairStyle == null) {                // first look: a style with hair (style 0 is bald for some races)
                    var haired = o.hairStyle.filter(function (v) { return c.meta.sections.hair.some(function (x) { return x.v == v && x.t[0] && !x.npc; }); });
                    if (haired.length) c.look.hairStyle = haired[0];
                }
                o = c.options();
                ['face', 'hairColor', 'facial'].forEach(function (k) { if (c.look[k] == null || o[k].indexOf(c.look[k]) < 0) c.look[k] = o[k][0] || 0; });
                return c.loadItems(items);
            })
            .then(function () {
                var tex = c.makeTextures();
                return AoM2.load(base, c.meta.f, { tex: tex, geosets: c.geosetFn() });
            })
            .then(function (model) {
                c.model = model;
                model.character = c;                        // the viewer / dressing room talk to this
                return Promise.all([c.compose(), c.attachItems()]).then(function () { return model; });
            });
    }

    return { load: load, INV: INV, SLOTS: SLOTS };
})();
