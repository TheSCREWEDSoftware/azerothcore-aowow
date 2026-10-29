/*
 * aowow dressing room (?dressing-room) and outfit pages (?outfit=<id>)
 *
 * Link format: ?dressing-room#<race>-<body>-<skin>-<face>-<hairStyle>-<hairColor>-<facial>:<items>
 *   items: comma separated item ids, i<id> (same) or s<itemsetId> (every piece of a set)
 *
 * Uses the model viewer core: AoStage / AoViewer (viewer.js), AoChar (charmodel.js), AoM2 (m2.js)
 */
var AoDressing = (function () {
    // paper doll, laid out like the in-game character pane: key, label, inventory types it takes,
    // side (L / R columns, B the weapon row below), empty slot icon, shows on the model
    var SLOTS = [
        ['head',     'Head',      [1],              'L', 'inventoryslot_head',     1],
        ['neck',     'Neck',      [2],              'L', 'inventoryslot_neck',     0],
        ['shoulder', 'Shoulder',  [3],              'L', 'inventoryslot_shoulder', 1],
        ['back',     'Back',      [16],             'L', 'inventoryslot_chest',    1],
        ['chest',    'Chest',     [5, 20],          'L', 'inventoryslot_chest',    1],
        ['shirt',    'Shirt',     [4],              'L', 'inventoryslot_shirt',    1],
        ['tabard',   'Tabard',    [19],             'L', 'inventoryslot_tabard',   1],
        ['wrist',    'Wrist',     [9],              'L', 'inventoryslot_wrists',   1],
        ['hands',    'Hands',     [10],             'R', 'inventoryslot_hands',    1],
        ['waist',    'Waist',     [6],              'R', 'inventoryslot_waist',    1],
        ['legs',     'Legs',      [7],              'R', 'inventoryslot_legs',     1],
        ['feet',     'Feet',      [8],              'R', 'inventoryslot_feet',     1],
        ['finger1',  'Finger 1',  [11],             'R', 'inventoryslot_finger',   0],
        ['finger2',  'Finger 2',  [11],             'R', 'inventoryslot_finger',   0],
        ['trinket1', 'Trinket 1', [12],             'R', 'inventoryslot_trinket',  0],
        ['trinket2', 'Trinket 2', [12],             'R', 'inventoryslot_trinket',  0],
        ['mainhand', 'Main Hand', [13, 17, 21],     'B', 'inventoryslot_mainhand', 1],
        ['offhand',  'Off Hand',  [14, 22, 23, 13], 'B', 'inventoryslot_offhand',  1],
        ['ranged',   'Ranged',    [15, 25, 26, 28], 'B', 'inventoryslot_ranged',   1],
        ['ammo',     'Ammo',      [24],             'B', 'inv_ammo_arrow_01',      0]
    ];
    function slotDef(key) { return SLOTS.filter(function (s) { return s[0] == key; })[0]; }
    function slotGroup(def) { return def[1].replace(/ \d$/, ''); }      // Finger 1 / Finger 2 -> Finger

    var LOOK = [['skin', 'Skin Color'], ['face', 'Face'], ['hairStyle', 'Hair Style'], ['hairColor', 'Hair Color'], ['facial', 'Features']];

    function slotFor(invType, taken) {                      // first free paper doll slot for an inventory type
        taken = taken || {};
        if (invType == 17 && taken.offhand) return null;                       // two-hander: both hands free
        if (invType == 13 && taken.mainhand && !taken.offhand) invType = 22;   // second one-hander
        if ([14, 22, 23].indexOf(invType) >= 0 && taken.mainhand && taken.mainhand.slot == 17) return null;
        var fits = SLOTS.filter(function (s) { return s[2].indexOf(invType) >= 0; });
        if (!fits.length) return null;
        for (var i = 0; i < fits.length; i++)                // rings, trinkets: the second one if the first is taken
            if (!taken[fits[i][0]]) return fits[i][0];
        return fits[0][0];
    }

    function esc(s) {                                       // safe in text and in quoted attributes
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function host() { return typeof g_host != 'undefined' ? g_host.replace(/\/?$/, '/') : ''; }
    function icon(name, size) { return g_staticUrl + '/images/wow/icons/' + (size || 'medium') + '/' + name + '.jpg'; }
    function getJSON(url) { return fetch(host() + url, { credentials: 'same-origin' }).then(function (r) { return r.json(); }); }

    function el(tag, cls, html) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html != null) e.innerHTML = html;
        return e;
    }

    // ---------------------------------------------------------------- link format
    function parseHash(h) {
        var out = { race: 1, sex: 0, look: [], tokens: [] };
        h = (h || '').replace(/^#/, '');
        if (!h) return out;
        var parts = h.split(':'), n = parts[0].split('-').map(function (x) { return parseInt(x, 10) || 0; });
        if (AoViewer.PREFIX[n[0]]) out.race = n[0];
        out.sex = n[1] ? 1 : 0;
        out.look = n.length >= 7 ? n.slice(2, 7) : [];          // race-body only: default looks
        if (parts[1]) out.tokens = parts[1].split(',').filter(function (t) { return /^(i?\d+|s-?\d+)$/.test(t); });
        return out;
    }

    function resolveTokens(tokens) {                        // -> [item rows]
        var ids = [], sets = [];
        tokens.forEach(function (t) {
            if (t[0] == 's') sets.push(+t.slice(1));
            else ids.push(+t.replace(/^i/, ''));
        });
        var jobs = sets.map(function (s) { return getJSON('?dressing-room=set&id=' + s); });
        if (ids.length) jobs.push(getJSON('?dressing-room=items&ids=' + ids.join(',')).then(function (rows) {
            return rows.sort(function (a, b) { return ids.indexOf(a.id) - ids.indexOf(b.id); });   // the order of the link
        }));
        return Promise.all(jobs).then(function (lists) { return [].concat.apply([], lists); });
    }

    function itemsMap(items) {                              // {slot: row} -> {slot: {display}} for AoChar
        var m = {};
        SLOTS.forEach(function (s) { if (s[5] && items[s[0]]) m[s[0]] = { display: items[s[0]].displayId }; });
        return m;
    }

    function stageTools(box, stage) {
        var tools = el('div', 'mv-tools',
            '<a class="mv-ico dr-bgbtn">Background</a>' +
            '<a class="mv-ico dr-pause">Pause</a>' +
            '<a class="mv-ico dr-full">Full screen</a>');
        var menu = el('div', 'mv-bgmenu');
        AoStage.BACKGROUNDS.forEach(function (b) {
            var a = el('a', null, '<i class="mv-bg-' + b[0] + '"></i>' + b[1]);
            a.onclick = function () { stage.setBackground(b[0]); menu.classList.remove('open'); };
            menu.appendChild(a);
        });
        box.appendChild(tools);
        box.appendChild(menu);
        tools.querySelector('.dr-bgbtn').onclick = function () { menu.classList.toggle('open'); };
        tools.querySelector('.dr-pause').onclick = function () {
            stage.paused = !stage.paused;
            this.innerHTML = stage.paused ? 'Play' : 'Pause';
        };
        tools.querySelector('.dr-full').onclick = function () {
            if (document.fullscreenElement) document.exitFullscreen();
            else if (box.requestFullscreen) box.requestFullscreen();
        };
        document.addEventListener('fullscreenchange', function () { stage.resize(); });
        window.addEventListener('resize', function () { stage.resize(); });
    }

    // ================================================================ the dressing room
    function DressingRoom(root, cfg) {
        this.root = root;
        this.cfg = cfg || {};
        this.items = {};
        this.race = 1;
        this.sex = 0;
        this.look = {};
        this.model = null;
        this.busy = null;
        this.outfit = cfg.outfit || null;
        this.build();
    }

    DressingRoom.prototype.build = function () {
        var self = this, r = this.root;
        r.innerHTML =
            '<div class="dr-main">' +
            '<div class="dr-pane">' +
                '<div class="dr-doll">' +
                    '<div class="dr-slots dr-left"></div>' +
                    '<div class="dr-stage mv-stage"><div class="mv-msg">Loading&hellip;</div></div>' +
                    '<div class="dr-slots dr-right"></div>' +
                    '<div class="dr-slots dr-bottom"></div>' +
                '</div>' +
                '<div class="dr-bar">' +
                    '<select class="dr-race" title="Race"></select>' +
                    '<select class="dr-sex" title="Body"><option value="0">Body 1</option><option value="1">Body 2</option></select>' +
                    '<label class="dr-anim-l">Animation <select class="dr-anim"></select></label>' +
                '</div>' +
            '</div>' +
            '<div class="dr-side">' +
                '<div class="dr-tabs"><a data-tab="look" class="selected">Character</a><a data-tab="find">Find Items</a><a data-tab="outfit">Outfit</a><a data-tab="help">Help</a></div>' +
                '<div class="dr-tab dr-tab-look"></div>' +
                '<div class="dr-tab dr-tab-find" style="display:none"></div>' +
                '<div class="dr-tab dr-tab-outfit" style="display:none"></div>' +
                '<div class="dr-tab dr-tab-help" style="display:none">' +
                    '<p><b>Items:</b> click a slot around the model to search Find Items for that slot; right-click a slot (or its &times;) takes the item off again. Find Items also searches every slot at once, by quality and by how or where an item is obtained.</p>' +
                    '<p><b>Character:</b> pick the race and body below the model, then skin, face and hair on the Character tab.</p>' +
                    '<p><b>Model:</b> drag to rotate, right-drag to pan, scroll to zoom; Background changes the backdrop.</p>' +
                    '<p><b>Share:</b> the address of this page always holds the current outfit &ndash; copy it from the Outfit tab.</p>' +
                    '<p><b>Save:</b> signed in, you can save outfits; they show up under Database &rsaquo; Outfits and on the pages of their items.</p>' +
                '</div>' +
            '</div>' +
            '</div>';

        var $ = function (s) { return r.querySelector(s); };
        this.$ = $;

        SLOTS.forEach(function (s) {
            var b = el('div', 'dr-slot', '<a class="dr-icon" href="javascript:;"><img src="' + icon(s[4]) + '" alt=""></a><a class="dr-x" href="javascript:;" title="Remove">&times;</a>');
            b.setAttribute('data-slot', s[0]);
            b.title = s[1];
            b.querySelector('.dr-icon').onclick = function (e) { e.preventDefault(); self.pick(s[0]); };
            b.querySelector('.dr-icon').oncontextmenu = function (e) { e.preventDefault(); self.setItem(s[0], null); };
            b.querySelector('.dr-x').onclick = function () { self.setItem(s[0], null); };
            $({ L: '.dr-left', R: '.dr-right', B: '.dr-bottom' }[s[3]]).appendChild(b);
        });

        var race = $('.dr-race');
        AoViewer.RACES.forEach(function (x) { race.appendChild(new Option(x[1], x[0])); });
        race.onchange = $('.dr-sex').onchange = function () {
            self.race = +race.value;
            self.sex = +$('.dr-sex').value;
            self.look = {};
            self.rebuild();
        };
        $('.dr-anim').onchange = function () { if (self.model) self.model.play(+this.value); };

        r.querySelectorAll('.dr-tabs a').forEach(function (a) {
            a.onclick = function () { self.tab(a.getAttribute('data-tab')); };
        });

        this.buildOutfitTab();
        this.buildFindTab();
        document.addEventListener('keydown', function (e) { if (e.key == 'Escape') self.pick(null); });
    };

    DressingRoom.prototype.tab = function (name) {
        var r = this.root;
        r.querySelectorAll('.dr-tabs a').forEach(function (x) { x.classList.toggle('selected', x.getAttribute('data-tab') == name); });
        r.querySelectorAll('.dr-tab').forEach(function (t) { t.style.display = t.classList.contains('dr-tab-' + name) ? '' : 'none'; });
    };

    DressingRoom.prototype.start = function () {
        var self = this;
        return AoViewer.ready().then(function () {
            var box = self.$('.dr-stage');
            self.stage = new AoStage(box);
            stageTools(box, self.stage);
            self.stage.start();

            var st = self.outfit ? { race: self.outfit.race, sex: self.outfit.gender, look: self.outfit.look, tokens: [] } : parseHash(location.hash);
            if (!location.hash && !self.outfit) {
                var saved = AoViewer.savedChar();
                if (saved.race != 'none') { st.race = saved.race; st.sex = saved.sex || 0; }
            }
            self.race = st.race;
            self.sex = st.sex;
            if (st.look && st.look.length)
                LOOK.forEach(function (l, i) { self.look[l[0]] = st.look[i] || 0; });

            var rows = self.outfit ? Promise.resolve(self.outfit.items) : resolveTokens(st.tokens);
            return rows.then(function (list) {
                list.forEach(function (it) {
                    var s = slotFor(it.slot, self.items);
                    if (s && !self.items[s]) self.items[s] = it;
                });
                self.$('.dr-race').value = self.race;
                self.$('.dr-sex').value = self.sex;
                return self.rebuild();
            });
        }).catch(function (e) {
            self.message('The dressing room could not start: ' + esc(e.message || e));
        });
    };

    DressingRoom.prototype.message = function (t) {
        var m = this.$('.mv-msg');
        m.innerHTML = t || '';
        m.style.display = t ? '' : 'none';
    };

    // new race / body: a new model
    DressingRoom.prototype.rebuild = function () {
        var self = this, look = { race: this.race, sex: this.sex };
        for (var k in this.look) look[k] = this.look[k];
        this.message('Loading&hellip;');
        var job = this.busy = AoChar.load(AoViewer.base(), look, itemsMap(this.items)).then(function (m) {
            if (job !== self.busy) return;
            self.model = m;
            self.stage.setModel(m);
            var c = m.character;
            LOOK.forEach(function (l) { self.look[l[0]] = c.look[l[0]]; });
            var sel = self.$('.dr-anim'), list = m.animations(AoViewer.animNames());
            sel.innerHTML = '';
            list.forEach(function (a) { sel.appendChild(new Option(a.name, a.index)); });
            sel.value = m.want != null ? m.want : m.seq;
            self.message('');
            self.drawSlots();
            self.drawLook();
            self.save();
        }).catch(function (e) {
            if (job === self.busy) self.message('Could not build the character.<br><span class="q0">' + esc(e.message || e) + '</span>');
        });
        return job;
    };

    DressingRoom.prototype.setItem = function (slot, row) {
        var self = this;
        if (row) this.items[slot] = row; else delete this.items[slot];
        if (slot == 'mainhand' && row && row.slot == 17) delete this.items.offhand;          // two-handers take both hands
        if (slot == 'offhand' && row && this.items.mainhand && this.items.mainhand.slot == 17) delete this.items.mainhand;
        this.drawSlots();
        this.save();
        if (!this.model) return;
        this.model.character.setItems(itemsMap(this.items));
    };

    DressingRoom.prototype.drawSlots = function () {
        var self = this;
        SLOTS.forEach(function (s) {
            var b = self.root.querySelector('.dr-slot[data-slot=' + s[0] + ']'), it = self.items[s[0]], a = b.querySelector('.dr-icon');
            b.classList.toggle('dr-filled', !!it);
            b.classList.toggle('dr-picking', self.target == s[0]);
            b.querySelector('img').src = icon(it ? it.icon : s[4]);
            a.className = 'dr-icon' + (it ? ' q' + it.quality : (s[4].indexOf('inventoryslot_') ? ' dr-faded' : ''));
            a.href = it ? host() + '?item=' + it.id : 'javascript:;';     // filled: hover shows the item tooltip
            b.title = it ? '' : s[1];
        });
        if (this.drawTarget) this.drawTarget();
    };

    // ---------------------------------------------------------------- skin, face, hair
    DressingRoom.prototype.drawLook = function () {
        var self = this, box = this.$('.dr-tab-look'), c = this.model && this.model.character;
        if (!c) return;
        var o = c.options();
        box.innerHTML = '';
        LOOK.forEach(function (l) {
            var list = o[l[0]] || [], i = Math.max(0, list.indexOf(c.look[l[0]]));
            var row = el('div', 'dr-look' + (list.length < 2 ? ' dr-off' : ''),
                '<span>' + l[1] + '</span><a class="dr-prev" href="javascript:;">&lsaquo;</a><b>' + (list.length ? (i + 1) + ' / ' + list.length : '&ndash;') + '</b><a class="dr-next" href="javascript:;">&rsaquo;</a>');
            row.querySelector('.dr-prev').onclick = function () { self.step(l[0], -1); };
            row.querySelector('.dr-next').onclick = function () { self.step(l[0], 1); };
            box.appendChild(row);
        });
        var acts = el('div', 'dr-acts', '<a class="mv-btn dr-rand" href="javascript:;">Random look</a> <a class="mv-btn dr-reset" href="javascript:;">Default look</a>');
        acts.querySelector('.dr-rand').onclick = function () { self.randomLook(); };
        acts.querySelector('.dr-reset').onclick = function () { self.look = {}; self.rebuild(); };
        box.appendChild(acts);
    };

    // keep choices that depend on others valid (faces per skin colour, colours per hair style)
    DressingRoom.prototype.fixLook = function (c) {
        var o = c.options(), L = c.look;
        ['face', 'hairColor', 'facial'].forEach(function (k) {
            if (o[k].length && o[k].indexOf(L[k]) < 0) L[k] = o[k][0];
        });
    };

    DressingRoom.prototype.step = function (key, dir) {
        var self = this, c = this.model && this.model.character;
        if (!c) return;
        var list = c.options()[key] || [];
        if (list.length < 2) return;
        var i = list.indexOf(c.look[key]);
        c.look[key] = list[(i + dir + list.length) % list.length];
        this.fixLook(c);
        c.refresh().then(function () {
            LOOK.forEach(function (l) { self.look[l[0]] = c.look[l[0]]; });
            self.drawLook();
            self.save();
        });
    };

    DressingRoom.prototype.randomLook = function () {
        var self = this, c = this.model && this.model.character;
        if (!c) return;
        LOOK.forEach(function (l) {
            var list = c.options()[l[0]] || [];
            if (list.length) c.look[l[0]] = list[Math.floor(Math.random() * list.length)];
            self.fixLook(c);
        });
        c.refresh().then(function () {
            LOOK.forEach(function (l) { self.look[l[0]] = c.look[l[0]]; });
            self.drawLook();
            self.save();
        });
    };

    // ---------------------------------------------------------------- the address holds the outfit
    DressingRoom.prototype.hash = function () {
        var self = this, ids = [];
        SLOTS.forEach(function (s) { if (self.items[s[0]]) ids.push(self.items[s[0]].id); });
        return '#' + [this.race, this.sex].concat(LOOK.map(function (l) { return self.look[l[0]] || 0; })).join('-') + (ids.length ? ':' + ids.join(',') : '');
    };

    DressingRoom.prototype.save = function () {
        var h = this.hash();
        if (history.replaceState) history.replaceState(history.state, '', location.pathname + location.search + h);
        var share = this.$('.dr-share');
        if (share) share.value = location.href;
        try { localStorage.setItem('aowow_mv_char', JSON.stringify({ race: this.race, sex: this.sex })); } catch (e) {}
    };

    // ---------------------------------------------------------------- a slot click: find items for that slot
    DressingRoom.prototype.pick = function (slot) {
        this.target = slot || null;
        var box = this.$('.dr-tab-find');
        if (slot) {
            box.querySelector('.dr-find-slot').value = slotDef(slot)[2].join(',');
            this.tab('find');
            this.runFind();
            var q = box.querySelector('.dr-find-q');
            setTimeout(function () { q.focus(); }, 0);
        }
        this.drawSlots();
    };

    // ---------------------------------------------------------------- find items: every slot, filtered by quality and source
    var QUALITIES = [[0, 'Poor'], [1, 'Common'], [2, 'Uncommon'], [3, 'Rare'], [4, 'Epic'], [5, 'Legendary'], [6, 'Artifact'], [7, 'Heirloom']];
    var SOURCES   = [[0, 'Any source'], [2, 'Drop'], [4, 'Quest'], [5, 'Vendor'], [1, 'Crafted'], [3, 'PvP'], [12, 'Achievement'], [10, 'Starter']];

    DressingRoom.prototype.buildFindTab = function () {
        var self = this, box = this.$('.dr-tab-find');
        box.innerHTML =
            '<div class="dr-find-target"></div>' +
            '<input class="dr-find-q" type="search" placeholder="Item name&hellip;" autocomplete="off">' +
            '<div class="dr-find-opts">' +
                '<select class="dr-find-slot"><option value="">Any slot</option>' + SLOTS.filter(function (s, i) {
                    return !SLOTS.slice(0, i).some(function (o) { return slotGroup(o) == slotGroup(s); });
                }).map(function (s) { return '<option value="' + s[2].join(',') + '">' + slotGroup(s) + '</option>'; }).join('') + '</select>' +
                '<select class="dr-find-src">' + SOURCES.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join('') + '</select>' +
                '<input class="dr-find-from" type="search" placeholder="Dropped by / found in&hellip;" autocomplete="off">' +
            '</div>' +
            '<div class="dr-find-qual">' + QUALITIES.map(function (q) {
                return '<label class="q' + q[0] + '"><input type="checkbox" value="' + q[0] + '"' + ' checked' + '> ' + q[1] + '</label>';
            }).join('') + '</div>' +
            '<div class="dr-find-more">' +
                '<label><input type="checkbox" class="dr-find-avail" checked> Hide items not available to players</label>' +
                '<label><input type="checkbox" class="dr-find-exist"> Only show qualities that exist</label>' +
                '<span class="dr-find-sortbox">Sort <select class="dr-find-sort"><option value="id">ID &uarr;</option><option value="-id">ID &darr;</option><option value="name">Name A&ndash;Z</option><option value="-name">Name Z&ndash;A</option></select>' +
                ' Show <select class="dr-find-limit"><option>10</option><option selected>25</option><option>50</option><option>100</option></select></span>' +
            '</div>' +
            '<div class="dr-find-list"><div class="q0 dr-hint">Loading&hellip;</div></div>';

        var timer = 0, seq = 0, list = box.querySelector('.dr-find-list');
        var qseq = 0;
        function showQualities(filters) {                   // hide quality boxes nothing matches (when asked to)
            var labels = box.querySelectorAll('.dr-find-qual label'), my = ++qseq;
            if (!box.querySelector('.dr-find-exist').checked) {
                labels.forEach(function (l) { l.style.display = ''; });
                return;
            }
            getJSON('?dressing-room=qualities' + filters).then(function (have) {
                if (my != qseq) return;
                labels.forEach(function (l) { l.style.display = have.indexOf(+l.querySelector('input').value) >= 0 ? '' : 'none'; });
            });
        }
        function run() {
            var my = ++seq;
            var quals = [].map.call(box.querySelectorAll('.dr-find-qual input:checked'), function (c) { return c.value; });
            var filters = '&q=' + encodeURIComponent(box.querySelector('.dr-find-q').value.trim()) +
                      '&slot=' + box.querySelector('.dr-find-slot').value +
                      '&src=' + box.querySelector('.dr-find-src').value +
                      '&from=' + encodeURIComponent(box.querySelector('.dr-find-from').value.trim()) +
                      '&avail=' + (box.querySelector('.dr-find-avail').checked ? 1 : 0);
            var url = '?dressing-room=search' + filters + '&quality=' + quals.join(',') +
                      '&sort=' + box.querySelector('.dr-find-sort').value +
                      '&limit=' + box.querySelector('.dr-find-limit').value;
            showQualities(filters);
            list.innerHTML = '<div class="q0 dr-hint">Searching&hellip;</div>';
            getJSON(url).then(function (rows) {
                if (my != seq) return;
                list.innerHTML = rows.length ? '' : '<div class="q0 dr-hint">Nothing found.</div>';
                rows.forEach(function (it) {
                    var slot = slotFor(it.slot, {}), def = slotDef(slot);
                    var where = it.from && it.zone ? it.from + ' (' + it.zone + ')' : (it.from || it.zone);
                    var worn = SLOTS.some(function (s) { return self.items[s[0]] && self.items[s[0]].id == it.id; });
                    var a = el('a', 'dr-find-row' + (worn ? ' worn' : '') + (it.na ? ' na' : ''),
                        '<span class="dr-find-id">' + it.id + '</span>' +
                        '<ins style="background-image:url(' + icon(it.icon, 'small') + ')"></ins>' +
                        '<span class="dr-find-main"><span class="dr-find-name q' + it.quality + '">' + esc(it.name) + '</span>' +
                        (it.na ? '<span class="dr-find-na" title="This item is not available to players.">Not available to players</span>' : '') +
                        '<small class="q0">' + (def ? slotGroup(def) : '') + ' &middot; ' + it.level + (it.source.length ? ' &middot; ' + esc(it.source.join(', ')) : '') + (where ? ' &middot; ' + esc(where) : '') + '</small></span>');
                    a.href = host() + '?item=' + it.id;                 // hover: the item tooltip
                    a.onclick = function (e) {
                        e.preventDefault();
                        var t = self.target && slotDef(self.target);
                        var s = t && t[2].indexOf(it.slot) >= 0 ? self.target : (slotFor(it.slot, self.items) || slot);
                        if (!s) return;
                        self.setItem(s, it);
                        list.querySelectorAll('.dr-find-row').forEach(function (x) {
                            x.classList.toggle('worn', SLOTS.some(function (q) { return self.items[q[0]] && x.href.match(/item=(\d+)/)[1] == self.items[q[0]].id; }));
                        });
                    };
                    list.appendChild(a);
                });
            }).catch(function () { if (my == seq) list.innerHTML = '<div class="q10 dr-hint">Search failed.</div>'; });
        }
        var later = function () { clearTimeout(timer); timer = setTimeout(run, 250); };
        box.querySelectorAll('input[type=search]').forEach(function (i) { i.oninput = later; });
        box.querySelectorAll('select, .dr-find-qual input, .dr-find-more input').forEach(function (i) { i.onchange = run; });
        box.querySelector('.dr-find-slot').addEventListener('change', function () {       // picked another slot by hand
            if (self.target && slotDef(self.target)[2].join(',') != this.value) self.pick(null);
        });
        box.querySelector('.dr-find-q').onkeydown = function (e) {
            if (e.key == 'Enter') { var f = list.querySelector('.dr-find-row'); if (f) f.click(); }
        };

        // the slot a click on the paper doll asked for
        var bar = box.querySelector('.dr-find-target');
        this.drawTarget = function () {
            var t = self.target && slotDef(self.target), it = t && self.items[t[0]];
            bar.style.display = t ? '' : 'none';
            if (!t) return;
            bar.innerHTML = 'Choosing for <b>' + t[1] + '</b>' +
                (it ? ' &middot; worn: <a class="q' + it.quality + '" href="' + host() + '?item=' + it.id + '">' + esc(it.name) + '</a> <a class="dr-find-off" href="javascript:;">Take off</a>' : '') +
                '<a class="dr-find-any" href="javascript:;">All slots</a>';
            if (it) bar.querySelector('.dr-find-off').onclick = function () { self.setItem(t[0], null); };
            bar.querySelector('.dr-find-any').onclick = function () {
                box.querySelector('.dr-find-slot').value = '';
                self.pick(null);
                run();
            };
        };
        this.drawTarget();
        this.runFind = run;
        run();
    };

    // ---------------------------------------------------------------- share, save
    DressingRoom.prototype.buildOutfitTab = function () {
        var self = this, box = this.$('.dr-tab-outfit'), cfg = this.cfg, o = this.outfit;
        var classes = '<option value="0">Any class</option>' + (cfg.classes || []).map(function (c) {
            return '<option value="' + c[0] + '"' + (o && o.classId == c[0] ? ' selected' : '') + '>' + esc(c[1]) + '</option>';
        }).join('');
        box.innerHTML =
            '<label class="dr-field">Link to this outfit<span class="dr-row"><input class="dr-share" readonly><a class="mv-btn dr-copy" href="javascript:;">Copy</a></span></label>' +
            '<div class="dr-acts"><a class="mv-btn dr-shot" href="javascript:;">Screenshot</a> <a class="mv-btn dr-clear" href="javascript:;">Take everything off</a></div>' +
            '<h3>Save</h3>' +
            (cfg.signedIn
                ? '<label class="dr-field">Name<input class="dr-name" maxlength="64" value="' + esc(o ? o.name : '') + '"></label>' +
                  '<label class="dr-field">Class<select class="dr-class">' + classes + '</select></label>' +
                  '<label class="dr-field">Description <small class="q0">(optional)</small><input class="dr-desc" maxlength="255" value="' + esc(o ? o.desc : '') + '"></label>' +
                  '<div class="dr-acts"><a class="mv-btn dr-save" href="javascript:;">' + (o && o.mine ? 'Save changes' : 'Save outfit') + '</a>' +
                  (o && o.mine ? ' <a class="mv-btn dr-saveas" href="javascript:;">Save as new</a>' : '') + '</div>' +
                  '<div class="dr-status"></div>'
                : '<p class="q0">Sign in to save outfits &ndash; the link above works without an account.</p>') +
            '<p><a href="' + host() + '?outfits">Browse outfits</a></p>';

        box.querySelector('.dr-copy').onclick = function () {
            var i = box.querySelector('.dr-share');
            i.select();
            if (navigator.clipboard) navigator.clipboard.writeText(i.value);
            this.textContent = 'Copied';
        };
        box.querySelector('.dr-shot').onclick = function () { if (self.stage) self.stage.screenshot('outfit'); };
        box.querySelector('.dr-clear').onclick = function () {
            self.items = {};
            self.drawSlots();
            self.save();
            if (self.model) self.model.character.setItems({});
        };
        if (box.querySelector('.dr-save'))
            box.querySelector('.dr-save').onclick = function () { self.store(!!(o && o.mine)); };
        if (box.querySelector('.dr-saveas'))
            box.querySelector('.dr-saveas').onclick = function () { self.store(false); };
    };

    DressingRoom.prototype.store = function (update) {
        var self = this, box = this.$('.dr-tab-outfit'), status = box.querySelector('.dr-status');
        var name = box.querySelector('.dr-name').value.trim();
        if (!name) { status.innerHTML = '<span class="dr-err">Give the outfit a name first.</span>'; return; }
        var ids = [];
        SLOTS.forEach(function (s) { if (self.items[s[0]]) ids.push(self.items[s[0]].id); });

        var fd = new FormData();
        fd.append('id', update && this.outfit ? this.outfit.id : 0);
        fd.append('name', name);
        fd.append('description', box.querySelector('.dr-desc').value.trim());
        fd.append('classId', box.querySelector('.dr-class').value);
        fd.append('race', this.race);
        fd.append('gender', this.sex);
        fd.append('look', LOOK.map(function (l) { return self.look[l[0]] || 0; }).join(':'));
        fd.append('items', ids.join(','));
        if (this.stage && this.model) {                     // a framed picture, then the user's own view back
            var cam = this.stage.camera, ctl = this.stage.controls, pos = cam.position.clone(), tgt = ctl.target.clone();
            this.stage.frame();
            fd.append('shot', this.stage.snapshot(320, 400));
            cam.position.copy(pos);
            ctl.target.copy(tgt);
            ctl.update();
        }
        status.textContent = 'Saving…';
        fetch(host() + '?outfit=save', { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (!res.id) throw new Error(res.error || 'could not save');
                self.outfit = { id: res.id, name: name, mine: true };
                status.innerHTML = 'Saved. <a href="' + host() + '?outfit=' + res.id + '">View outfit</a>';
                if (!update && history.replaceState)
                    history.replaceState(history.state, '', location.pathname + '?dressing-room=' + res.id + self.hash());
                box.querySelector('.dr-save').textContent = 'Save changes';
                box.querySelector('.dr-save').onclick = function () { self.store(true); };
            })
            .catch(function (e) { status.innerHTML = '<span class="dr-err">' + esc(e.message || e) + '</span>'; });
    };

    // ================================================================ an outfit's own page
    function outfitPage(root, o) {
        root.innerHTML =
            '<div class="outfit-stage mv-stage"><div class="mv-msg">Loading&hellip;</div></div>' +
            '<div class="outfit-info">' +
                '<table class="outfit-facts">' +
                    (o.classId ? '<tr><th>Class</th><td class="c' + o.classId + '">' + esc(g_chr_classes[o.classId] || '') + '</td></tr>' : '') +
                    '<tr><th>Race</th><td>' + esc(g_chr_races[o.race] || '') + ' &middot; ' + (o.gender ? 'Body 2' : 'Body 1') + '</td></tr>' +
                    '<tr><th>By</th><td>' + esc(o.author || '?') + '</td></tr>' +
                    '<tr><th>Created</th><td>' + esc(o.created) + (o.updated ? ' <small class="q0">(changed ' + esc(o.updated) + ')</small>' : '') + '</td></tr>' +
                '</table>' +
                '<div class="outfit-items"></div>' +
                '<div class="dr-acts">' +
                    '<a class="mv-btn" href="' + host() + '?dressing-room#' + [o.race, o.gender].concat(o.look).join('-') + ':' + o.items.map(function (i) { return i.id; }).join(',') + '">Open in the Dressing Room</a>' +
                    (o.mine ? ' <a class="mv-btn" href="' + host() + '?dressing-room=' + o.id + '">Edit</a> <a class="mv-btn outfit-del" href="javascript:;">Delete</a>' : '') +
                '</div>' +
                '<div class="dr-status"></div>' +
            '</div>';

        var list = root.querySelector('.outfit-items');
        if (!o.items.length) list.innerHTML = '<p class="q0">No items &ndash; just the character.</p>';
        o.items.forEach(function (it) {
            list.appendChild(el('a', 'dr-res', '<ins style="background-image:url(' + icon(it.icon, 'small') + ')"></ins><span class="q' + it.quality + '">' + esc(it.name) + '</span>'));
            list.lastChild.href = host() + '?item=' + it.id;
        });

        var del = root.querySelector('.outfit-del');
        if (del) del.onclick = function () {
            if (!del.classList.contains('armed')) {
                del.classList.add('armed');
                del.textContent = 'Click again to delete';
                return;
            }
            var fd = new FormData();
            fd.append('id', o.id);
            fetch(host() + '?outfit=delete', { method: 'POST', body: fd, credentials: 'same-origin' })
                .then(function (r) { return r.json(); })
                .then(function (res) {
                    if (res.ok) location.href = host() + '?outfits=mine';
                    else root.querySelector('.dr-status').textContent = res.error || 'Could not delete';
                });
        };

        AoViewer.ready().then(function () {
            var box = root.querySelector('.outfit-stage'), stage = new AoStage(box);
            stageTools(box, stage);
            stage.start();
            var items = {}, taken = {};
            o.items.forEach(function (it) {
                var s = slotFor(it.slot, taken);
                if (s && !taken[s]) { taken[s] = it; if (slotDef(s)[5]) items[s] = { display: it.displayId }; }
            });
            var look = { race: o.race, sex: o.gender };
            LOOK.forEach(function (l, i) { look[l[0]] = o.look[i]; });
            return AoChar.load(AoViewer.base(), look, items).then(function (m) {
                stage.setModel(m);
                box.querySelector('.mv-msg').style.display = 'none';
            });
        }).catch(function (e) {
            root.querySelector('.mv-msg').innerHTML = 'Could not show the outfit.<br><span class="q0">' + esc(e.message || e) + '</span>';
        });
    }

    return {
        SLOTS: SLOTS,
        init: function (root, cfg) {
            var dr = new DressingRoom(root, cfg);
            dr.start();
            AoDressing.current = dr;                        // for the console
            return dr;
        },
        outfit: outfitPage
    };
})();
