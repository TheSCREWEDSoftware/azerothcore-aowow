/*
 * Quest Completion Tracker (?quest-tracker)
 *
 * Pick a zone (or dungeon, class, profession ..) from the quest menu's categories, tick off the quests done.
 * Progress is kept in this browser (localStorage 'aowow_qct'); export / import moves it to another one.
 * Quests come from ?quest-tracker=zone.<zoneOrSort> as [id, name, level, reqLevel, side, flags].
 */
var AoQuestTracker = (function () {
    var KEY = 'aowow_qct', el, cfg, store = { done: {}, totals: {} }, zones = [], cur = null, quests = [], cache = {},
        opt = { side: 0, hideDone: false, repeatable: false, unavailable: false, q: '' };

    function esc(t) {
        return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    }

    function load() {
        try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.done) store = { done: s.done, totals: s.totals || {} }; } catch (e) {}
    }

    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}
    }

    // the quest menu's tree as a flat list: [zoneOrSort, name, group, depth]
    function readMenu() {
        var group = '';
        (typeof mn_quests != 'undefined' ? mn_quests : []).forEach(function (top) {
            if (top[0] == null) return;                     // separators
            if (!top[3]) return;                            // Uncategorized
            group = top[1];
            (function walk(list, depth) {
                list.forEach(function (e) {
                    if (e[0] == null) return;
                    var id = e[2] ? +String(e[2]).split('.').pop() : +e[0];
                    zones.push([id, e[1], group, depth]);
                    if (e[3]) walk(e[3], depth + 1);
                });
            })(top[3], 0);
        });
    }

    function doneIn(zone) {
        var list = cache[zone], n = 0;
        if (!list) return null;
        list.forEach(function (q) { if (store.done[q[0]]) n++; });
        return n;
    }

    function counted(list) {                            // what counts toward a zone's progress: one-time, available quests
        return list.filter(function (q) { return !(q[5] & 15); });
    }

    // ── layout ──
    function render() {
        el.innerHTML = '<div class="qt-main"><div class="qt-zones"><input type="search" class="tc-tr-filter qt-zfilter" placeholder="Find a zone..." /><div class="qt-zlist"></div></div>'
            + '<div class="qt-body"><div class="qt-empty q0">Pick a zone on the left.</div></div></div>'
            + '<div class="qt-io"><a href="javascript:;" class="tc-nav-btn qt-export">Export</a><a href="javascript:;" class="tc-nav-btn qt-import">Import</a>'
            + '<span class="q0">Progress is saved in this browser. ' + Object.keys(store.done).length + ' quests ticked off in total.</span></div>';

        el.querySelector('.qt-zfilter').oninput = function () { renderZones(this.value.trim().toLowerCase()); };
        el.querySelector('.qt-export').onclick = function () {
            prompt('Copy this list of completed quests:', Object.keys(store.done).join(','));
        };
        el.querySelector('.qt-import').onclick = function () {
            var s = prompt('Paste a list of completed quests (quest ids, comma separated). They are added to what is ticked here:', '');
            if (!s) return;
            s.split(/[^0-9]+/).forEach(function (id) { if (+id) store.done[+id] = 1; });
            save();
            render();
            if (cur != null) openZone(cur);
        };
        renderZones('');
    }

    function renderZones(filter) {
        var html = '', group = '';
        zones.forEach(function (z) {
            if (filter && z[1].toLowerCase().indexOf(filter) == -1) return;
            if (z[2] != group) { group = z[2]; html += '<div class="qt-zgroup">' + esc(group) + '</div>'; }
            var tot = store.totals[z[0]], done = cache[z[0]] ? counted(cache[z[0]]).filter(function (q) { return store.done[q[0]]; }).length : null;
            var badge = tot ? '<i class="' + (done != null && done >= tot ? 'full' : '') + '">' + (done != null ? done : '?') + '/' + tot + '</i>' : '';
            html += '<a href="javascript:;" class="qt-zone' + (z[0] == cur ? ' on' : '') + '" data-zone="' + z[0] + '" style="padding-left:' + (8 + 12 * z[3]) + 'px">' + esc(z[1]) + badge + '</a>';
        });
        var list = el.querySelector('.qt-zlist');
        list.innerHTML = html || '<div class="q0" style="padding:6px">No zone found.</div>';
        list.querySelectorAll('.qt-zone').forEach(function (a) { a.onclick = function () { openZone(+a.getAttribute('data-zone')); }; });
    }

    function openZone(zone) {
        cur = zone;
        var body = el.querySelector('.qt-body');
        body.innerHTML = '<div class="qt-empty q0">Loading&hellip;</div>';
        var got = cache[zone] ? Promise.resolve(cache[zone])
                              : fetch(cfg.host.replace(/\/?$/, '/') + '?quest-tracker=zone.' + zone).then(function (r) { return r.json(); });
        got.then(function (list) {
            if (cur != zone) return;
            cache[zone] = list;
            store.totals[zone] = counted(list).length;
            save();
            quests = list;
            renderZones(el.querySelector('.qt-zfilter').value.trim().toLowerCase());
            renderQuests();
        }, function () {
            body.innerHTML = '<div class="qt-empty q10">Could not load the quests.</div>';
        });
    }

    function renderQuests() {
        var body = el.querySelector('.qt-body'), z = zones.filter(function (x) { return x[0] == cur; })[0] || [cur, '', ''];
        var shown = quests.filter(function (q) {
            if (opt.side && q[4] != 3 && q[4] != opt.side) return false;
            if (!opt.repeatable && (q[5] & 7)) return false;
            if (!opt.unavailable && (q[5] & 8)) return false;
            if (opt.hideDone && store.done[q[0]]) return false;
            return !opt.q || q[1].toLowerCase().indexOf(opt.q) != -1 || String(q[0]) == opt.q;
        });
        var base = counted(quests).filter(function (q) { return !opt.side || q[4] == 3 || q[4] == opt.side; }),
            done = base.filter(function (q) { return store.done[q[0]]; }).length,
            pct  = base.length ? Math.round(100 * done / base.length) : 0;

        var html = '<div class="qt-head"><div class="qt-title"><b>' + esc(z[1]) + '</b> <span class="q0">' + esc(z[2]) + '</span></div>'
            + '<div class="qt-progress"><i style="width:' + pct + '%"></i><span>' + done + ' / ' + base.length + ' quests (' + pct + '%)</span></div></div>'
            + '<div class="tc-tr-bar qt-opts"><input type="search" class="tc-tr-filter qt-qfilter" placeholder="Filter quests..." value="' + esc(opt.q) + '" />'
            + '<select class="qt-side"><option value="0">Both factions</option><option value="1"' + (opt.side == 1 ? ' selected' : '') + '>Alliance</option><option value="2"' + (opt.side == 2 ? ' selected' : '') + '>Horde</option></select>'
            + '<label class="pc-check"><input type="checkbox" class="qt-hide"' + (opt.hideDone ? ' checked' : '') + ' /> Hide completed</label>'
            + '<label class="pc-check"><input type="checkbox" class="qt-rep"' + (opt.repeatable ? ' checked' : '') + ' /> Show daily / repeatable</label>'
            + '<label class="pc-check"><input type="checkbox" class="qt-unav"' + (opt.unavailable ? ' checked' : '') + ' /> Show unavailable</label>'
            + '<span class="qt-acts"><a href="javascript:;" class="tc-nav-btn qt-all">Tick all shown</a><a href="javascript:;" class="tc-nav-btn qt-none">Untick all shown</a></span></div>';

        html += '<div class="qt-list"><div class="qt-row qt-rhead"><span></span><span>Quest</span><span>Level</span><span>Req.</span><span>Side</span></div>';
        shown.forEach(function (q) {
            var tags = (q[5] & 1 ? ' <span class="qt-tag">Daily</span>' : '') + (q[5] & 2 ? ' <span class="qt-tag">Weekly</span>' : '')
                     + (q[5] & 4 && !(q[5] & 3) ? ' <span class="qt-tag">Repeatable</span>' : '') + (q[5] & 8 ? ' <span class="qt-tag q0">Unavailable</span>' : '');
            html += '<label class="qt-row' + (store.done[q[0]] ? ' done' : '') + '"><input type="checkbox" data-q="' + q[0] + '"' + (store.done[q[0]] ? ' checked' : '') + ' />'
                  + '<span><a href="?quest=' + q[0] + '">' + esc(q[1]) + '</a>' + tags + '</span>'
                  + '<span class="qt-num">' + (q[2] > 0 ? q[2] : '&ndash;') + '</span><span class="qt-num">' + (q[3] || '&ndash;') + '</span>'
                  + '<span>' + (q[4] == 1 ? '<span class="icon-alliance-padded">Alliance</span>' : q[4] == 2 ? '<span class="icon-horde-padded">Horde</span>' : '<span class="q0">Both</span>') + '</span></label>';
        });
        if (!shown.length)
            html += '<div class="qt-empty q0">No quests to show.</div>';
        body.innerHTML = html + '</div>';

        body.querySelector('.qt-qfilter').oninput = function () { opt.q = this.value.trim().toLowerCase(); renderQuests(); focusEnd(); };
        body.querySelector('.qt-side').onchange = function () { opt.side = +this.value; renderQuests(); };
        body.querySelector('.qt-hide').onchange = function () { opt.hideDone = this.checked; renderQuests(); };
        body.querySelector('.qt-rep').onchange = function () { opt.repeatable = this.checked; renderQuests(); };
        body.querySelector('.qt-unav').onchange = function () { opt.unavailable = this.checked; renderQuests(); };
        var mark = function (on) {
            shown.forEach(function (q) { if (on) store.done[q[0]] = 1; else delete store.done[q[0]]; });
            save(); renderQuests(); renderZones(el.querySelector('.qt-zfilter').value.trim().toLowerCase());
        };
        body.querySelector('.qt-all').onclick = function () { mark(true); };
        body.querySelector('.qt-none').onclick = function () { mark(false); };
        body.querySelectorAll('.qt-row input[data-q]').forEach(function (c) {
            c.onchange = function () {
                var id = +c.getAttribute('data-q');
                if (c.checked) store.done[id] = 1; else delete store.done[id];
                save(); renderQuests(); renderZones(el.querySelector('.qt-zfilter').value.trim().toLowerCase());
            };
        });
    }

    function focusEnd() {
        var f = el.querySelector('.qt-qfilter');
        if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
    }

    return {
        init: function (container, config) {
            el = container;
            cfg = config || {};
            load();
            readMenu();
            render();
        }
    };
})();
