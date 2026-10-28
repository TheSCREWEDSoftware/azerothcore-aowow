/*
 * Gear Planner (?gear-planner)
 *
 * A paper doll: pick an item per slot, its gems and enchant, and see what it all adds up to - stats from gear,
 * active socket and set bonuses, ratings as percentages at level 80, average item level, and a score by the stat
 * weights of a spec (wt_presets). Everything is kept in the #link: #<class>.<spec>:<slot letter><item>-<gem>-<gem>-<gem>-<enchant>:..
 *
 * Data: ?gear-planner=search|items|gems|enchants (pages/gearplanner.php)
 */
var AoGearPlanner = (function () {
    // key, label, search group, inventory type for enchants
    var SLOTS = [
        ['head', 'Head', 'head', 1], ['neck', 'Neck', 'neck', 2], ['shoulder', 'Shoulder', 'shoulder', 3], ['back', 'Back', 'back', 16],
        ['chest', 'Chest', 'chest', 5], ['wrist', 'Wrist', 'wrist', 9], ['hands', 'Hands', 'hands', 10], ['waist', 'Waist', 'waist', 6],
        ['legs', 'Legs', 'legs', 7], ['feet', 'Feet', 'feet', 8], ['finger1', 'Finger', 'finger', 11], ['finger2', 'Finger', 'finger', 11],
        ['trinket1', 'Trinket', 'trinket', 12], ['trinket2', 'Trinket', 'trinket', 12],
        ['mainhand', 'Main Hand', 'mainhand', 21], ['offhand', 'Off Hand', 'offhand', 22], ['ranged', 'Ranged / Relic', 'ranged', 15]
    ];
    var LEFT = ['head', 'neck', 'shoulder', 'back', 'chest', 'wrist'], RIGHT = ['hands', 'waist', 'legs', 'feet', 'finger1', 'finger2', 'trinket1', 'trinket2'], BOTTOM = ['mainhand', 'offhand', 'ranged'];
    var CLASSES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11];
    var SOCKET = { 1: ['meta', 'Meta'], 2: ['red', 'Red'], 4: ['yellow', 'Yellow'], 8: ['blue', 'Blue'] };

    // what the totals show, in this order: key, group
    var STATS = [
        ['str', 'Base'], ['agi', 'Base'], ['sta', 'Base'], ['int', 'Base'], ['spi', 'Base'], ['health', 'Base'], ['mana', 'Base'],
        ['atkpwr', 'Melee & ranged'], ['feratkpwr', 'Melee & ranged'], ['rgdatkpwr', 'Melee & ranged'], ['armorpenrtng', 'Melee & ranged'], ['exprtng', 'Melee & ranged'],
        ['splpwr', 'Spell'], ['splpen', 'Spell'], ['manargn', 'Spell'],
        ['hitrtng', 'Ratings'], ['critstrkrtng', 'Ratings'], ['hastertng', 'Ratings'],
        ['armor', 'Defense'], ['armorbonus', 'Defense'], ['defrtng', 'Defense'], ['dodgertng', 'Defense'], ['parryrtng', 'Defense'], ['blockrtng', 'Defense'], ['block', 'Defense'], ['resirtng', 'Defense'],
        ['arcres', 'Resistance'], ['firres', 'Resistance'], ['frores', 'Resistance'], ['natres', 'Resistance'], ['shares', 'Resistance'], ['holres', 'Resistance']
    ];
    // rating per 1 % (expertise: per expertise point, defense: per skill point) at level 80
    var RATING80 = { hitrtng: [32.79, '% melee', 26.23, '% spell'], critstrkrtng: [45.91, '%'], hastertng: [32.79, '%'], armorpenrtng: [13.99, '%'],
                     exprtng: [8.2, ' expertise'], defrtng: [4.92, ' defense'], dodgertng: [45.25, '%'], parryrtng: [45.25, '%'], blockrtng: [16.39, '%'], resirtng: [94.27, '%'] };

    var el, cfg, st = { cls: 0, spec: '', slots: {} }, items = {}, enchants = {}, enchCache = {}, hash = '', picker = null;

    function esc(t) {
        return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    }
    function host() { return cfg.host.replace(/\/?$/, '/'); }
    function icon(n, size) { return g_staticUrl + '/images/wow/icons/' + (size || 'medium') + '/' + String(n || 'inv_misc_questionmark').toLowerCase() + '.jpg'; }
    function slotDef(key) { return SLOTS.filter(function (s) { return s[0] == key; })[0]; }
    function statName(k) { return (LANG.traits && LANG.traits[k]) ? LANG.traits[k][0] : k; }
    function getJson(q) { return fetch(host() + '?gear-planner=' + q).then(function (r) { return r.json(); }); }

    // ── link ──
    function save() {
        var parts = [st.cls + (st.spec ? '.' + st.spec : '')];
        SLOTS.forEach(function (s, i) {
            var v = st.slots[s[0]];
            if (!v || !v.item) return;
            var extra = [v.gems[0] || 0, v.gems[1] || 0, v.gems[2] || 0, v.ench || 0];
            while (extra.length && !extra[extra.length - 1]) extra.pop();
            parts.push(String.fromCharCode(97 + i) + v.item + (extra.length ? '-' + extra.join('-') : ''));
        });
        hash = parts.join(':');
        location.replace('#' + hash);
    }

    function load() {
        var h = location.hash.substr(1);
        if (h == hash) return false;
        hash = h;
        st = { cls: 0, spec: '', slots: {} };
        var parts = h.split(':'), head = (parts.shift() || '').split('.');
        st.cls = CLASSES.indexOf(+head[0]) != -1 ? +head[0] : 0;
        st.spec = /^\w+$/.test(head[1] || '') ? head[1] : '';
        parts.forEach(function (p) {
            var m = /^([a-q])(\d+)((?:-\d+)*)$/.exec(p);
            if (!m) return;
            var s = SLOTS[m[1].charCodeAt(0) - 97], x = m[3] ? m[3].substr(1).split('-').map(Number) : [];
            st.slots[s[0]] = { item: +m[2], gems: [x[0] || 0, x[1] || 0, x[2] || 0], ench: x[3] || 0 };
        });
        return true;
    }

    // items, gems and enchants the gear uses, then draw
    function fetchAll() {
        var need = [], inv = {};
        SLOTS.forEach(function (s) {
            var v = st.slots[s[0]];
            if (!v) return;
            [v.item].concat(v.gems).forEach(function (id) { if (id && !items[id]) need.push(id); });
            if (v.ench && !enchants[v.ench]) inv[s[3]] = 1;
        });
        var jobs = [];
        if (need.length) jobs.push(getJson('items&ids=' + need.join(',')).then(function (r) { for (var id in r) items[id] = r[id]; }));
        Object.keys(inv).forEach(function (t) { jobs.push(loadEnchants(+t)); });
        return Promise.all(jobs);
    }

    function loadEnchants(inv) {
        if (enchCache[inv]) return Promise.resolve(enchCache[inv]);
        return getJson('enchants&inv=' + inv).then(function (list) {
            enchCache[inv] = list;
            list.forEach(function (e) { enchants[e.id] = e; });
            return list;
        });
    }

    // ── totals ──
    function totals() {
        var t = {}, sets = {}, lvl = 0, n = 0, gs = 0;
        var add = function (stats) { for (var k in stats) t[k] = (t[k] || 0) + stats[k]; };
        SLOTS.forEach(function (s) {
            var v = st.slots[s[0]], it = v && items[v.item];
            if (!it) return;
            add(it.stats);
            lvl += it.level; n++; gs += it.gs || 0;
            var allMatch = it.sockets.length > 0;
            it.sockets.forEach(function (c, i) {
                var g = items[v.gems[i]];
                if (g) add(g.stats);
                if (!g || !(g.gemColor & c)) allMatch = false;
            });
            if (allMatch && it.bonus) add(it.bonus);
            if (v.ench && enchants[v.ench]) add(enchants[v.ench].stats);
            if (it.set && it.setInfo) {
                sets[it.set] = sets[it.set] || { info: it.setInfo, n: 0, ids: {} };
                if (!sets[it.set].ids[it.id]) { sets[it.set].ids[it.id] = 1; sets[it.set].n++; }
            }
        });
        return { stats: t, sets: sets, avg: n ? Math.round(lvl / n) : 0, n: n, gs: gs };
    }

    // ── drawing ──
    function render() {
        var specs = st.cls && wt_presets[st.cls] ? wt_presets[st.cls].pve : {};
        var html = '<div class="gp-bar"><select class="gp-cls"><option value="0">Any class</option>' + CLASSES.map(function (c) {
                return '<option value="' + c + '"' + (st.cls == c ? ' selected' : '') + '>' + esc(g_chr_classes[c]) + '</option>';
            }).join('') + '</select>'
            + '<select class="gp-spec"' + (st.cls ? '' : ' disabled') + '><option value="">No stat weights</option>' + Object.keys(specs).filter(function (k) { return Object.keys(specs[k]).length > 1; }).map(function (k) {
                return '<option value="' + k + '"' + (st.spec == k ? ' selected' : '') + '>' + esc((LANG.presets && LANG.presets[k]) || k) + '</option>';
            }).join('') + '</select>'
            + '<span class="gp-actions"><a href="javascript:;" class="tc-nav-btn gp-clear">Clear</a><a href="javascript:;" class="tc-nav-btn gp-copy">Copy Link</a></span></div>'
            + '<div class="gp-main"><div class="gp-doll"><div class="gp-col">' + LEFT.map(slotHtml).join('') + '</div>'
            + '<div class="gp-col">' + RIGHT.map(slotHtml).join('') + '</div>'
            + '<div class="gp-bottom">' + BOTTOM.map(slotHtml).join('') + '</div></div>'
            + '<div class="gp-stats">' + statsHtml() + '</div></div>';
        el.innerHTML = html;
        bind();
    }

    function slotHtml(key) {
        var s = slotDef(key), v = st.slots[key], it = v && items[v.item];
        if (!it)
            return '<div class="gp-slot empty" data-slot="' + key + '"><span class="gp-ico"></span><span class="gp-name q0">' + esc(s[1]) + '</span></div>';

        var rel = [];
        if (v.gems.some(Number)) rel.push('gems=' + v.gems.join(':'));
        if (v.ench) rel.push('ench=' + v.ench);
        var sock = it.sockets.map(function (c, i) {
            var g = items[v.gems[i]];
            return '<a href="javascript:;" class="gp-sock gp-sock-' + (SOCKET[c] || ['prismatic'])[0] + (g && !(g.gemColor & c) ? ' off' : '') + '" data-sock="' + i + '" title="' + esc((SOCKET[c] || ['', 'Prismatic'])[1]) + ' socket' + (g ? ': ' + esc(g.name) : '') + '">'
                 + (g ? '<img src="' + icon(g.icon, 'small') + '" alt="" />' : '') + '</a>';
        }).join('');
        var e = v.ench && enchants[v.ench];
        return '<div class="gp-slot" data-slot="' + key + '"><a href="' + host() + '?item=' + it.id + '" rel="' + rel.join('&') + '" class="gp-ico" style="background-image:url(' + icon(it.icon) + ')"></a>'
             + '<span class="gp-info"><a href="' + host() + '?item=' + it.id + '" rel="' + rel.join('&') + '" class="gp-name q' + it.quality + '">' + esc(it.name) + '</a>'
             + '<span class="gp-sub">' + it.level + (it.heroic ? ' <span class="q2">Heroic</span>' : '') + sock
             + ' <a href="javascript:;" class="gp-ench' + (e ? ' on' : '') + '">' + (e ? esc(e.name) : 'Enchant') + '</a></span></span>'
             + '<a href="javascript:;" class="gp-del" title="Remove">&times;</a></div>';
    }

    function statsHtml() {
        var T = totals(), t = T.stats, html = '<div class="gp-head"><b>' + T.n + '</b> items, average item level <b>' + T.avg + '</b>'
            + (T.gs ? ', gear score <b>' + T.gs + '</b>' : '') + '</div>', group = '';

        var any = false;
        STATS.forEach(function (d) {
            var v = t[d[0]];
            if (!v) return;
            if (d[0] == 'feratkpwr' && st.cls && st.cls != 11) return;     // only druids in forms use it
            any = true;
            if (d[1] != group) { group = d[1]; html += '<div class="gp-sgroup">' + esc(group) + '</div>'; }
            var r = RATING80[d[0]], pct = '';
            if (r) pct = r.length > 2 ? (v / r[0]).toFixed(2) + r[1] + ', ' + (v / r[2]).toFixed(2) + r[3] : (v / r[0]).toFixed(r[1] == '%' ? 2 : 1) + r[1];
            html += '<div class="gp-stat"><span>' + esc(statName(d[0])) + '</span><b>' + v + '</b>' + (pct ? '<i>' + pct + '</i>' : '') + '</div>';
        });
        if (!any) html += '<div class="q0 gp-none">Pick items on the left to see their stats.</div>';
        else html += '<div class="q0 gp-note">Ratings as percent at level 80. Gear only: no base stats, talents or buffs.</div>';

        // stat weights score
        var w = st.cls && st.spec && wt_presets[st.cls] && wt_presets[st.cls].pve[st.spec];
        if (w && any) {
            var score = 0, max = 0;
            for (var k in w) if (k != '__icon') { score += (t[k] || 0) * w[k]; max = Math.max(max, w[k]); }
            html += '<div class="gp-sgroup">Score</div><div class="gp-stat"><span>' + esc((LANG.presets && LANG.presets[st.spec]) || st.spec) + '</span><b>' + Math.round(score / (max || 1)) + '</b></div>';
        }

        // set bonuses
        var sets = Object.keys(T.sets);
        if (sets.length) {
            html += '<div class="gp-sgroup">Sets</div>';
            sets.forEach(function (sid) {
                var s = T.sets[sid];
                html += '<div class="gp-set"><a href="' + host() + '?itemset=' + sid + '" class="q">' + esc(s.info.name) + '</a> <span class="q0">(' + s.n + ')</span>'
                      + s.info.bonus.map(function (b) { return '<div class="' + (s.n >= b[0] ? 'q2' : 'q0') + '">(' + b[0] + ') ' + esc(b[1]) + '</div>'; }).join('') + '</div>';
            });
        }
        return html;
    }

    function bind() {
        el.querySelector('.gp-cls').onchange = function () { st.cls = +this.value; st.spec = ''; var p = st.cls && wt_presets[st.cls] ? wt_presets[st.cls].pve : {}; for (var k in p) if (Object.keys(p[k]).length > 1) { st.spec = k; break; } save(); render(); };
        el.querySelector('.gp-spec').onchange = function () { st.spec = this.value; save(); render(); };
        el.querySelector('.gp-clear').onclick = function () { st.slots = {}; save(); render(); };
        el.querySelector('.gp-copy').onclick = function () {
            var b = this;
            if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(function () { b.textContent = 'Copied!'; setTimeout(function () { b.textContent = 'Copy Link'; }, 1500); });
            else prompt('Copy this link:', location.href);
        };
        el.querySelectorAll('.gp-slot').forEach(function (row) {
            var key = row.getAttribute('data-slot');
            row.onclick = function (e) {
                if (e.target.closest('.gp-sock, .gp-ench, .gp-del, a[href^="http"]')) return;
                pickItem(key);
            };
            var del = row.querySelector('.gp-del');
            if (del) del.onclick = function () { delete st.slots[key]; save(); render(); };
            row.querySelectorAll('.gp-sock').forEach(function (a) { a.onclick = function () { pickGem(key, +a.getAttribute('data-sock')); }; });
            var en = row.querySelector('.gp-ench');
            if (en) en.onclick = function () { pickEnchant(key); };
        });
    }

    // ── picker ──
    function openPicker(title, onSearch, placeholder) {
        closePicker();
        picker = document.createElement('div');
        picker.className = 'gp-overlay';
        picker.innerHTML = '<div class="gp-picker"><div class="gp-phead"><b>' + esc(title) + '</b><a href="javascript:;" class="gp-pclose">&times;</a></div>'
            + '<input type="search" class="tc-tr-filter gp-pq" placeholder="' + esc(placeholder || 'Search...') + '" /><div class="gp-plist"><div class="q0 gp-pmsg">Loading&hellip;</div></div></div>';
        document.body.appendChild(picker);
        picker.querySelector('.gp-pclose').onclick = closePicker;
        picker.addEventListener('mousedown', function (e) { if (e.target == picker) closePicker(); });
        var q = picker.querySelector('.gp-pq'), timer;
        q.oninput = function () { clearTimeout(timer); timer = setTimeout(function () { onSearch(q.value.trim()); }, 250); };
        q.focus();
        onSearch('');
    }
    function closePicker() { if (picker) { picker.remove(); picker = null; $WH.Tooltip.hide(); } }
    function listInto(rows) {
        var l = picker && picker.querySelector('.gp-plist');
        if (!l) return null;
        l.innerHTML = rows || '<div class="q0 gp-pmsg">Nothing found.</div>';
        return l;
    }

    function pickItem(key) {
        var s = slotDef(key), seq = 0;
        openPicker(s[1], function (q) {
            var my = ++seq;
            getJson('search&slot=' + s[2] + '&q=' + encodeURIComponent(q)).then(function (rows) {
                if (my != seq) return;
                var l = listInto(rows.map(function (r) {
                    return '<a href="javascript:;" class="gp-prow" data-id="' + r[0] + '"><img src="' + icon(r[3], 'small') + '" alt="" /><span class="q' + r[2] + '">' + esc(r[1]) + '</span>'
                         + '<i>' + esc(g_item_slots[r[4]] || '') + '</i><i>' + r[5] + '</i><i>' + (r[6] ? 'Req. ' + r[6] : '') + '</i></a>';
                }).join(''));
                if (!l) return;
                l.querySelectorAll('.gp-prow').forEach(function (a) {
                    a.onclick = function () {
                        var id = +a.getAttribute('data-id'), old = st.slots[key];
                        st.slots[key] = { item: id, gems: [0, 0, 0], ench: old && old.item ? old.ench : 0 };
                        closePicker();
                        fetchAll().then(function () { save(); render(); });
                    };
                });
            });
        }, 'Search by name (empty: best item level first)');
    }

    var gemList = null;
    function pickGem(key, idx) {
        var v = st.slots[key], it = items[v.item], color = it.sockets[idx];
        openPicker((SOCKET[color] || ['', 'Prismatic'])[1] + ' socket', function (q) {
            getJson('gems&q=' + encodeURIComponent(q)).then(function (rows) {
                rows.forEach(function (g) { items[g.id] = g; });
                rows.sort(function (a, b) { return (!!(b.gemColor & color)) - (!!(a.gemColor & color)) || b.level - a.level; });
                var l = listInto('<a href="javascript:;" class="gp-prow gp-none-row" data-id="0"><span class="q0">No gem</span></a>' + rows.map(function (g) {
                    var fit = g.gemColor & color, stats = Object.keys(g.stats).map(function (k) { return '+' + g.stats[k] + ' ' + statName(k); }).join(', ');
                    return '<a href="javascript:;" class="gp-prow' + (fit ? '' : ' nofit') + '" data-id="' + g.id + '"><img src="' + icon(g.icon, 'small') + '" alt="" /><span class="q' + g.quality + '">' + esc(g.name) + '</span>'
                         + '<i class="gp-pstats">' + esc(stats) + '</i><i>' + (fit ? 'matches' : '') + '</i></a>';
                }).join(''));
                if (!l) return;
                l.querySelectorAll('.gp-prow').forEach(function (a) {
                    a.onclick = function () { v.gems[idx] = +a.getAttribute('data-id'); closePicker(); save(); render(); };
                });
            });
        }, 'Search gems by name');
    }

    function pickEnchant(key) {
        var v = st.slots[key], it = items[v.item], inv = it ? it.slot : slotDef(key)[3];
        openPicker('Enchant', function (q) {
            loadEnchants(inv).then(function (list) {
                var f = q.toLowerCase(), rows = list.filter(function (e) { return !f || (e.name + ' ' + e.source).toLowerCase().indexOf(f) != -1; });
                var l = listInto('<a href="javascript:;" class="gp-prow gp-none-row" data-id="0"><span class="q0">No enchant</span></a>' + rows.map(function (e) {
                    return '<a href="javascript:;" class="gp-prow" data-id="' + e.id + '"><span class="q2">' + esc(e.name) + '</span><i class="gp-pstats">' + esc(e.source) + '</i></a>';
                }).join(''));
                if (!l) return;
                l.querySelectorAll('.gp-prow').forEach(function (a) {
                    a.onclick = function () { v.ench = +a.getAttribute('data-id'); closePicker(); save(); render(); };
                });
            });
        }, 'Filter enchants');
    }

    return {
        init: function (container, config) {
            el = container;
            cfg = config || {};
            document.addEventListener('keydown', function (e) { if (e.key == 'Escape') closePicker(); });
            load();
            render();
            fetchAll().then(render);
            setInterval(function () { if (load()) fetchAll().then(render); }, 1000);
        }
    };
})();
