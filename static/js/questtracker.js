/*
 * Quest Completion Tracker (?quest-tracker)
 *
 * Pick a zone (or dungeon, class, profession ..) from the quest menu's categories.
 *  - linked game account: the characters and their quest status come from the characters database (g_questStatus)
 *  - otherwise quests are ticked off by hand and kept in this browser (localStorage 'aowow_qct'); export / import moves them
 * ?quest-tracker=zone.<zoneOrSort> gives {quests: [id, name, level, reqLevel, side, flags, giver], givers: {key: [name, type]}, pins: {floor: [[x, y, giver]]}, map}
 */
var AoQuestTracker = (function () {
    var KEY = 'aowow_qct', el, cfg, store = { done: {}, totals: {} }, zones = [], cur = null, data = null, cache = {}, details = {},
        chars = [], charIdx = 0, charSort = 'name', sel = null, mapper = null,
        opt = { side: 0, repeatable: false, unavailable: false, q: '', show: { 0: true, 1: true, 2: true, 3: false, 4: true } };
    var ST = ['Not started', 'In progress', 'Ready to turn in', 'Completed', 'Failed'];

    function esc(t) {
        return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    }
    function host() { return cfg.host.replace(/\/?$/, '/'); }

    function load() {
        try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.done) store = { done: s.done, totals: s.totals || {} }; } catch (e) {}
        try { var c = localStorage.getItem('aowow_qct_char'); if (c != null) charIdx = +c; } catch (e) {}
    }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }

    function linked() { return chars.length > 0; }

    // status of a quest for the selected character (or the hand-kept list)
    function status(id) {
        if (linked()) return AoQuestStatus.codes(id)[charIdx] || 0;
        return store.done[id] ? 3 : 0;
    }
    function charLevel() { return linked() ? chars[charIdx][5] : 0; }

    // quest difficulty colour against the character level
    function diffColor(level) {
        var cl = charLevel();
        if (!cl || level <= 0) return '#ffd100';
        var d = level - cl, grey = cl <= 5 ? 0 : cl <= 39 ? cl - 5 - Math.floor(cl / 10) : cl <= 59 ? cl - 1 - Math.floor(cl / 5) : cl - 9;
        if (d >= 5) return '#ff3030';
        if (d >= 3) return '#ff8040';
        if (d >= -2) return '#ffff00';
        if (level > grey) return '#40c040';
        return '#808080';
    }

    // the quest menu's tree as a flat list: [zoneOrSort, name, group, depth]
    function readMenu() {
        var group = '';
        (typeof mn_quests != 'undefined' ? mn_quests : []).forEach(function (top) {
            if (top[0] == null || !top[3]) return;
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

    function counted(list) { return list.filter(function (q) { return !(q[5] & 15); }); }

    // ── layout ──
    function render() {
        el.innerHTML = '<div class="qt-account"></div><div class="qt-main"><div class="qt-zones"><input type="search" class="tc-tr-filter qt-zfilter" placeholder="Find a zone..." /><div class="qt-zlist"></div></div>'
            + '<div class="qt-body"><div class="qt-empty q0">Pick a zone on the left.</div></div></div>';
        el.querySelector('.qt-zfilter').oninput = function () { renderZones(this.value.trim().toLowerCase()); };
        renderAccount();
        renderZones('');
    }

    // characters of the linked account, or the link form, or the hand-kept list tools
    function renderAccount() {
        var box = el.querySelector('.qt-account'), html = '';
        if (linked()) {
            var order = chars.map(function (c, i) { return i; }).sort(function (a, b) {
                var A = chars[a], B = chars[b];
                return charSort == 'level' ? B[5] - A[5] || A[2].localeCompare(B[2]) : charSort == 'realm' ? A[6].localeCompare(B[6]) || A[2].localeCompare(B[2]) : A[2].localeCompare(B[2]) || A[6].localeCompare(B[6]);
            });
            html = '<div class="qt-chars"><div class="qt-chead"><b>Your Characters</b><span class="q0">Sort by:</span>'
                + ['name', 'level', 'realm'].map(function (k) { return '<a href="javascript:;" data-sort="' + k + '"' + (charSort == k ? ' class="on"' : '') + '>' + k.charAt(0).toUpperCase() + k.substr(1) + '</a>'; }).join('')
                + '<a href="javascript:;" class="qt-unlink">Unlink game account</a></div><div class="qt-clist">'
                + order.map(function (i) {
                    var c = chars[i];
                    return '<a href="javascript:;" class="qt-char' + (i == charIdx ? ' on' : '') + '" data-i="' + i + '"><span class="qt-cicon"><img src="' + g_staticUrl + '/images/wow/icons/small/class_' + g_file_classes[c[4]] + '.jpg" alt="" /><b>' + c[5] + '</b></span>'
                         + '<span class="c' + c[4] + '">' + esc(c[2]) + '</span> <span class="q0">' + esc(c[6]) + '</span></a>';
                }).join('') + '</div></div>';
        }
        else if (cfg.canLink) {
            html = '<form class="qt-link"><b>Link your game account</b><span class="q0">to load the quest progress of all your characters. The password is only used to check the account once and is not stored.</span>'
                + '<input type="text" name="name" placeholder="Account name" autocomplete="username" /><input type="password" name="pass" placeholder="Password" autocomplete="current-password" />'
                + '<button type="submit" class="tc-nav-btn">Link</button><span class="qt-lerr q10"></span></form>';
        }
        else {
            html = '<div class="qt-io"><span class="q0">' + (cfg.loggedIn ? 'Linking a game account is not available here.' : 'Log in and link your game account to load your characters\' progress.')
                + ' Ticked quests are saved in this browser (' + Object.keys(store.done).length + ' so far).</span>'
                + '<a href="javascript:;" class="tc-nav-btn qt-export">Export</a><a href="javascript:;" class="tc-nav-btn qt-import">Import</a></div>';
        }
        box.innerHTML = html;

        box.querySelectorAll('.qt-chead a[data-sort]').forEach(function (a) { a.onclick = function () { charSort = a.getAttribute('data-sort'); renderAccount(); }; });
        box.querySelectorAll('.qt-char').forEach(function (a) {
            a.onclick = function () {
                charIdx = +a.getAttribute('data-i');
                try { localStorage.setItem('aowow_qct_char', charIdx); } catch (e) {}
                renderAccount(); if (data) { renderZones(el.querySelector('.qt-zfilter').value.trim().toLowerCase()); renderBody(); }
            };
        });
        var un = box.querySelector('.qt-unlink');
        if (un) un.onclick = function () {
            post('unlink', {}).then(function () { location.reload(); });
        };
        var f = box.querySelector('.qt-link');
        if (f) f.onsubmit = function (e) {
            e.preventDefault();
            box.querySelector('.qt-lerr').textContent = '';
            post('link', { name: f.name.value, pass: f.pass.value }).then(function (r) {
                if (r.error) box.querySelector('.qt-lerr').textContent = r.error;
                else location.reload();
            });
        };
        var ex = box.querySelector('.qt-export');
        if (ex) ex.onclick = function () { prompt('Copy this list of completed quests:', Object.keys(store.done).join(',')); };
        var im = box.querySelector('.qt-import');
        if (im) im.onclick = function () {
            var s = prompt('Paste a list of completed quests (quest ids, comma separated). They are added to what is ticked here:', '');
            if (!s) return;
            s.split(/[^0-9]+/).forEach(function (id) { if (+id) store.done[+id] = 1; });
            save(); renderAccount(); if (data) renderBody();
        };
    }

    function post(what, fields) {
        var body = new URLSearchParams();
        Object.keys(fields).forEach(function (k) { body.append(k, fields[k]); });
        return fetch(host() + '?quest-tracker=' + what, { method: 'POST', body: body, credentials: 'same-origin' }).then(function (r) { return r.json(); });
    }

    function renderZones(filter) {
        var html = '', group = '';
        zones.forEach(function (z) {
            if (filter && z[1].toLowerCase().indexOf(filter) == -1) return;
            if (z[2] != group) { group = z[2]; html += '<div class="qt-zgroup">' + esc(group) + '</div>'; }
            var list = cache[z[0]] && counted(cache[z[0]].quests), tot = list ? list.length : store.totals[z[0]];
            var done = list ? list.filter(function (q) { return status(q[0]) == 3; }).length : null;
            var badge = tot ? '<i class="' + (done != null && done >= tot ? 'full' : '') + '">' + (done != null ? done : '?') + '/' + tot + '</i>' : '';
            html += '<a href="javascript:;" class="qt-zone' + (z[0] == cur ? ' on' : '') + '" data-zone="' + z[0] + '" style="padding-left:' + (8 + 12 * z[3]) + 'px">' + esc(z[1]) + badge + '</a>';
        });
        var list = el.querySelector('.qt-zlist');
        list.innerHTML = html || '<div class="q0" style="padding:6px">No zone found.</div>';
        list.querySelectorAll('.qt-zone').forEach(function (a) { a.onclick = function () { openZone(+a.getAttribute('data-zone')); }; });
    }

    function openZone(zone) {
        cur = zone; sel = null; mapper = null;
        var body = el.querySelector('.qt-body');
        body.innerHTML = '<div class="qt-empty q0">Loading&hellip;</div>';
        var got = cache[zone] ? Promise.resolve(cache[zone]) : fetch(host() + '?quest-tracker=zone.' + zone).then(function (r) { return r.json(); });
        got.then(function (d) {
            if (cur != zone) return;
            cache[zone] = data = d;
            store.totals[zone] = counted(d.quests).length;
            save();
            renderZones(el.querySelector('.qt-zfilter').value.trim().toLowerCase());
            renderBody(true);
        }, function () { body.innerHTML = '<div class="qt-empty q10">Could not load the quests.</div>'; });
    }

    function visible(q) {
        if (opt.side && q[4] != 3 && q[4] != opt.side) return false;
        if (!opt.repeatable && (q[5] & 7)) return false;
        if (!opt.unavailable && (q[5] & 8)) return false;
        return !opt.q || q[1].toLowerCase().indexOf(opt.q) != -1 || String(q[0]) == opt.q;
    }

    function statusIcon(code) { return '<i class="qc-dot qc-s' + code + '" title="' + ST[code] + '"></i>'; }

    function renderBody(newMap) {
        var body = el.querySelector('.qt-body'), z = zones.filter(function (x) { return x[0] == cur; })[0] || [cur, '', ''];
        var base = counted(data.quests).filter(function (q) { return !opt.side || q[4] == 3 || q[4] == opt.side; }),
            done = base.filter(function (q) { return status(q[0]) == 3; }).length,
            pct  = base.length ? Math.round(100 * done / base.length) : 0;
        var hasMap = data.map && Object.keys(data.pins).length;

        var html = '<div class="qt-head"><div class="qt-title"><b>' + esc(z[1]) + '</b> <span class="q0">' + esc(z[2]) + '</span></div></div>';

        // map + quest givers
        html += '<div class="qt-top' + (hasMap ? '' : ' nomap') + '">' + (hasMap ? '<div class="qt-map"><div id="qt-mapper"></div></div>' : '')
              + '<div class="qt-givers"><div class="qt-show"><span class="q0">Show:</span>' + [0, 1, 2, 4, 3].map(function (s) {
                    return '<label class="pc-check"><input type="checkbox" data-st="' + s + '"' + (opt.show[s] ? ' checked' : '') + ' /> ' + ST[s] + '</label>';
                }).join('') + '</div><div class="qt-glist">' + giverList() + '</div></div></div>';

        html += '<div class="qt-progress"><i style="width:' + pct + '%"></i><span>All quests in ' + esc(z[1]) + ': ' + done + ' / ' + base.length + ' (' + pct + '%)</span></div>';
        html += '<div class="qt-detail">' + (sel ? '' : '<div class="q0">Pick a quest to see its details.</div>') + '</div>';

        // full list with filters
        html += '<div class="tc-tr-bar qt-opts"><input type="search" class="tc-tr-filter qt-qfilter" placeholder="Filter quests..." value="' + esc(opt.q) + '" />'
              + '<select class="qt-side"><option value="0">Both factions</option><option value="1"' + (opt.side == 1 ? ' selected' : '') + '>Alliance</option><option value="2"' + (opt.side == 2 ? ' selected' : '') + '>Horde</option></select>'
              + '<label class="pc-check"><input type="checkbox" class="qt-rep"' + (opt.repeatable ? ' checked' : '') + ' /> Show daily / repeatable</label>'
              + '<label class="pc-check"><input type="checkbox" class="qt-unav"' + (opt.unavailable ? ' checked' : '') + ' /> Show unavailable</label>'
              + (linked() ? '' : '<span class="qt-acts"><a href="javascript:;" class="tc-nav-btn qt-all">Tick all shown</a><a href="javascript:;" class="tc-nav-btn qt-none">Untick all shown</a></span>') + '</div>';

        var shown = data.quests.filter(visible);
        html += '<div class="qt-list"><div class="qt-row qt-rhead' + (linked() ? ' linked' : '') + '"><span></span><span>Quest</span><span>Level</span><span>Req.</span><span>Side</span>' + (linked() ? '<span>Completion</span>' : '') + '</div>';
        shown.forEach(function (q) {
            var st = status(q[0]);
            var tags = (q[5] & 1 ? ' <span class="qt-tag">Daily</span>' : '') + (q[5] & 2 ? ' <span class="qt-tag">Weekly</span>' : '')
                     + (q[5] & 4 && !(q[5] & 3) ? ' <span class="qt-tag">Repeatable</span>' : '') + (q[5] & 8 ? ' <span class="qt-tag q0">Unavailable</span>' : '');
            html += '<div class="qt-row' + (linked() ? ' linked' : '') + (st == 3 ? ' done' : '') + '" data-q="' + q[0] + '">'
                  + (linked() ? statusIcon(st) : '<input type="checkbox" data-q="' + q[0] + '"' + (st == 3 ? ' checked' : '') + ' />')
                  + '<span><a href="' + host() + '?quest=' + q[0] + '">' + esc(q[1]) + '</a>' + tags + '</span>'
                  + '<span class="qt-num">' + (q[2] > 0 ? q[2] : '&ndash;') + '</span><span class="qt-num">' + (q[3] || '&ndash;') + '</span>'
                  + '<span>' + (q[4] == 1 ? '<span class="icon-alliance-padded">A</span>' : q[4] == 2 ? '<span class="icon-horde-padded">H</span>' : '<span class="q0">Both</span>') + '</span>'
                  + (linked() ? '<span>' + AoQuestStatus.dots(q[0]) + '</span>' : '') + '</div>';
        });
        if (!shown.length) html += '<div class="qt-empty q0">No quests to show.</div>';
        body.innerHTML = html + '</div>';

        if (hasMap) drawMap();
        if (linked()) AoQuestStatus.bindDots(body);
        if (sel) showDetail(sel);
        bindBody(shown);
    }

    // quests grouped by who starts them, filtered by status
    function giverList() {
        var groups = {}, order = [];
        data.quests.forEach(function (q) {
            if (!visible(q) || !opt.show[status(q[0])]) return;
            var k = q[6] || '';
            if (!groups[k]) { groups[k] = []; order.push(k); }
            groups[k].push(q);
        });
        if (!order.length) return '<div class="q0">No quests with this status.</div>';
        order.sort(function (a, b) { return !a ? 1 : !b ? -1 : 0; });
        return order.map(function (k) {
            return '<div class="qt-giver"><div class="qt-gname">' + (k ? esc(data.givers[k][0]) : '<span class="q0">Other</span>') + '</div>' + groups[k].map(function (q) {
                var st = status(q[0]);
                return '<a href="javascript:;" class="qt-gq' + (sel == q[0] ? ' on' : '') + '" data-q="' + q[0] + '">' + statusIcon(st)
                     + '<span style="color:' + (st == 3 ? '#808080' : diffColor(q[2])) + '">[' + (q[2] > 0 ? q[2] : '-') + '] ' + esc(q[1]) + '</span></a>';
            }).join('') + '</div>';
        }).join('');
    }

    function drawMap() {
        var coords = {};
        Object.keys(data.pins).forEach(function (floor) {
            coords[floor] = data.pins[floor].map(function (p) {
                var qs = data.quests.filter(function (q) { return q[6] == p[2] && visible(q); });
                return [p[0], p[1], {
                    label: '<b class="q">' + esc(data.givers[p[2]][0]) + '</b> ($)' + qs.map(function (q) { return '<br />' + statusIcon(status(q[0])) + ' ' + esc(q[1]); }).join(''),
                    type: 'start'
                }];
            });
        });
        mapper = new Mapper({ parent: 'qt-mapper', zone: cur, coords: coords, zoneLink: false, show: true, zoom: 1 });
    }

    function showDetail(id) {
        sel = id;
        el.querySelectorAll('.qt-gq').forEach(function (a) { a.classList.toggle('on', +a.getAttribute('data-q') == id); });
        var box = el.querySelector('.qt-detail'), q = data.quests.filter(function (x) { return x[0] == id; })[0];
        if (!box || !q) return;
        var giver = q[6] ? data.givers[q[6]][0] : '', pin = null;
        Object.keys(data.pins).forEach(function (f) { data.pins[f].forEach(function (p) { if (p[2] == q[6]) pin = p; }); });
        var st = status(id);
        var head = '<div class="qt-dleft"><div class="qt-dtitle"><a href="' + host() + '?quest=' + id + '" style="color:' + (st == 3 ? '#808080' : diffColor(q[2])) + '">' + esc(q[1]) + '</a><span class="q0">Level ' + (q[2] > 0 ? q[2] : '&ndash;') + '</span></div>'
                 + (giver ? '<div><span class="qt-mark">!</span><span class="q">' + esc(giver) + '</span>' + (pin ? ' <span class="q0">(' + pin[0] + ', ' + pin[1] + ')</span>' : '') + '</div>' : '')
                 + (linked() ? '<div class="qt-dstat"><span class="c' + chars[charIdx][4] + '">' + esc(chars[charIdx][2]) + ':</span> ' + statusIcon(st) + ' <span class="qc-st' + st + '">' + ST[st] + '</span></div>' : '');
        var fill = function (d) {
            box.innerHTML = head + '<div class="qt-obj">' + (d.objectives || '') + '</div></div><div class="qt-dright"><h3>Description</h3><div>' + (d.details || '<span class="q0">No description.</span>') + '</div></div>';
        };
        if (details[id]) fill(details[id]);
        else {
            box.innerHTML = head + '</div><div class="qt-dright q0">Loading&hellip;</div>';
            fetch(host() + '?quest-tracker=quest.' + id).then(function (r) { return r.json(); }).then(function (d) { details[id] = d; if (sel == id) fill(d); });
        }
    }

    function bindBody(shown) {
        var body = el.querySelector('.qt-body');
        body.querySelectorAll('.qt-show input').forEach(function (c) { c.onchange = function () { opt.show[c.getAttribute('data-st')] = c.checked; refreshGivers(); }; });
        bindGivers();
        body.querySelector('.qt-qfilter').oninput = function () { opt.q = this.value.trim().toLowerCase(); renderBody(); var f = el.querySelector('.qt-qfilter'); f.focus(); f.setSelectionRange(f.value.length, f.value.length); };
        body.querySelector('.qt-side').onchange = function () { opt.side = +this.value; renderBody(); };
        body.querySelector('.qt-rep').onchange = function () { opt.repeatable = this.checked; renderBody(); };
        body.querySelector('.qt-unav').onchange = function () { opt.unavailable = this.checked; renderBody(); };
        body.querySelectorAll('.qt-row[data-q]').forEach(function (r) {
            r.onclick = function (e) { if (e.target.tagName != 'A' && e.target.tagName != 'INPUT') showDetail(+r.getAttribute('data-q')); };
        });
        var mark = function (on) {
            shown.forEach(function (q) { if (on) store.done[q[0]] = 1; else delete store.done[q[0]]; });
            save(); renderBody(); renderZones(el.querySelector('.qt-zfilter').value.trim().toLowerCase());
        };
        var a = body.querySelector('.qt-all'), n = body.querySelector('.qt-none');
        if (a) a.onclick = function () { mark(true); };
        if (n) n.onclick = function () { mark(false); };
        body.querySelectorAll('.qt-row input[data-q]').forEach(function (c) {
            c.onchange = function () {
                var id = +c.getAttribute('data-q');
                if (c.checked) store.done[id] = 1; else delete store.done[id];
                save(); renderBody(); renderZones(el.querySelector('.qt-zfilter').value.trim().toLowerCase());
            };
        });
    }

    function refreshGivers() { el.querySelector('.qt-glist').innerHTML = giverList(); bindGivers(); }
    function bindGivers() { el.querySelectorAll('.qt-gq').forEach(function (a) { a.onclick = function () { showDetail(+a.getAttribute('data-q')); }; }); }

    return {
        init: function (container, config) {
            el = container;
            cfg = config || {};
            chars = typeof AoQuestStatus != 'undefined' ? AoQuestStatus.chars() : [];
            load();
            if (charIdx >= chars.length) charIdx = 0;
            readMenu();
            render();
        }
    };
})();
