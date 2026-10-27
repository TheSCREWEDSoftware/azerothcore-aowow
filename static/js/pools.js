/*
 * aowow: spawn pool legend for object / NPC maps
 *
 *   PoolLegend.init(info)       info from includes/components/PoolMap::info()
 *
 * Pools get a group colour (pool-g-N), each object / creature in them a shape. The panel under the map shows:
 * a shape key, the pools on the current map as chips (hover = highlight its pins, click = hide / show), the
 * other zones as a collapsed list (click = open that map) and a sortable table of every pool.
 */

var PoolLegend = new function () {
    var self = this;
    var info, panel, mapper;
    var hidden = {};                                        // pool id => true
    var sort   = { col: 'pins', dir: -1 };

    // ── helpers ─────────────────────────────────────────────────────────────

    var SHAPES = [
        function (s) { return '<circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + (s / 2 - .5) + '"/>'; },
        function (s) { return '<polygon points="' + [s / 2, 0, s, s / 2, s / 2, s, 0, s / 2].join(',') + '"/>'; },
        function (s) { return '<polygon points="' + [s / 2, 0, s, s * .92, 0, s * .92].join(',') + '"/>'; },
        function (s) { return '<rect x=".5" y=".5" width="' + (s - 1) + '" height="' + (s - 1) + '" rx="1.5"/>'; },
        function (s) { return '<polygon points="' + [s * .25, s * .04, s * .75, s * .04, s, s / 2, s * .75, s * .96, s * .25, s * .96, 0, s / 2].join(',') + '"/>'; },
        function (s) {
            var p = [50, 0, 61, 35, 98, 35, 68, 57, 79, 91, 50, 70, 21, 91, 32, 57, 2, 35, 39, 35];
            return '<polygon points="' + p.map(function (v) { return v * s / 100; }).join(',') + '"/>';
        }
    ];

    function shape(k, fill, size) {
        size = size || 11;
        return '<svg class="pool-shape" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">'
             + '<g style="fill:' + fill + '" stroke="rgba(0,0,0,.8)" stroke-width="1">' + SHAPES[(k || 0) % SHAPES.length](size) + '</g></svg>';
    }

    function esc(t) {
        return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    }

    function pinsOf(pool, zone) {
        return pool.areas[zone] || 0;
    }

    function totalPins(pool) {
        var n = 0;
        for (var a in pool.areas)
            n += pool.areas[a];
        return n;
    }

    function mainZone(pool) {
        var best = null;
        for (var a in pool.areas)
            if (best === null || pool.areas[a] > pool.areas[best])
                best = a;
        return best === null ? null : parseInt(best);
    }

    var ORDER = [0, 3, 1, 2, 4, 5];                          // circle (viewed), square, diamond, triangle, hexagon, star

    // chip icon: circle = only the viewed object, otherwise the shape of the other object in the pool
    function memberShapes(pool, light) {
        var best = 0, viewed = info.entries[info.viewed] && info.entries[info.viewed].name;
        for (var e in pool.members) {
            var en = info.entries[e];
            if (en && en.name != viewed && (!best || ORDER.indexOf(en.shape) < ORDER.indexOf(best)))
                best = en.shape;
        }
        return shape(best, light ? '#fff' : 'var(--pg)', 9);
    }

    function pins() {
        return mapper && mapper.parent ? mapper.parent.querySelectorAll('.pin-pool') : [];
    }

    // ── map interaction ─────────────────────────────────────────────────────

    // poolIds: one id, a space separated list or null
    function focus(poolIds) {
        if (!mapper || !mapper.parent)
            return;
        var want = poolIds == null ? null : String(poolIds).split(' ');
        var hit  = function (attr) { return want && (attr || '').split(' ').some(function (id) { return want.indexOf(id) != -1; }); };
        mapper.parent.classList.toggle('pool-focus', !!want);
        Array.prototype.forEach.call(pins(), function (p) { p.classList.toggle('pool-hl', hit(p.getAttribute('data-pools'))); });
        Array.prototype.forEach.call(panel.querySelectorAll('.pool-chip'), function (c) { c.classList.toggle('pool-hl', hit(c.getAttribute('data-pool'))); });
    }

    function applyHidden() {
        Array.prototype.forEach.call(pins(), function (p) {
            var ids = (p.getAttribute('data-pools') || '').split(' ').filter(Boolean);
            p.classList.toggle('pool-off', ids.length > 0 && ids.every(function (id) { return hidden[id]; }));
        });
    }

    function curZone() {
        return mapper ? parseInt(mapper.zone) : null;
    }

    function openZone(zone, poolId) {
        if (!mapper)
            return;
        mapper.update({ zone: zone });
        var links = document.querySelectorAll('#mapper-zone-generic a');
        Array.prototype.forEach.call(links, function (a) {
            if ((a.getAttribute('onclick') || '').indexOf('zone: ' + zone + '}') != -1 && typeof g_setSelectedLink == 'function')
                g_setSelectedLink(a, 'mapper');
        });
        if (poolId != null)
            setTimeout(function () { focus(poolId); setTimeout(function () { focus(null); }, 1600); }, 50);
    }

    // ── rendering ───────────────────────────────────────────────────────────

    // one entry per name (several templates can share a name, and then a shape)
    function keyEntries() {
        var byName = {}, list = [];
        for (var id in info.entries) {
            var e = info.entries[id];
            if (!byName[e.name]) {
                byName[e.name] = { name: e.name, shape: e.shape, count: 0, id: id, viewed: false };
                list.push(byName[e.name]);
            }
            byName[e.name].count += e.count;
            if (id == info.viewed) {
                byName[e.name].id = id;
                byName[e.name].viewed = true;
            }
        }
        return list.sort(function (a, b) { return ORDER.indexOf(a.shape) - ORDER.indexOf(b.shape); });
    }

    function renderKey() {
        var h = '<div class="pool-key">';
        keyEntries().forEach(function (e) {
            h += '<span class="' + (e.viewed ? 'viewed' : '') + '">' + shape(e.shape, '#b8b8b8', 12)
               + '<a href="?' + info.type + '=' + e.id + '">' + esc(e.name) + '</a><i>' + e.count + '</i></span>';
        });
        return h + '</div>';
    }

    function renderZone() {
        var zone = curZone(), here = [], elsewhere = {}, nPins = 0, nActive = 0;

        info.pools.forEach(function (p) {
            var n = pinsOf(p, zone);
            if (n) {
                here.push(p);
                nPins   += n;
                nActive += p.max;
            }
            for (var a in p.areas)
                if (parseInt(a) != zone)
                    (elsewhere[a] = elsewhere[a] || []).push(p);
        });
        here.sort(function (a, b) { return pinsOf(b, zone) - pinsOf(a, zone) || a.id - b.id; });

        var zoneName = info.zones[zone] || 'this map';
        var h = '<div class="pool-head"><b>Spawn pools</b><span class="pool-sum">'
              + here.length + ' pool' + (here.length == 1 ? '' : 's') + ' on ' + esc(zoneName) + ' &middot; '
              + nPins + ' spawn points &middot; up to ' + nActive + ' active at once</span>'
              + '<span class="pool-btns"><a class="pool-btn" data-act="all">Show all</a><a class="pool-btn" data-act="none">Hide all</a></span></div>';

        if (keyEntries().length > 1)
            h += renderKey();

        if (here.length > 24) {
            // many small pools (typically one node spot each): one chip per kind of pool - same members, same limits
            var groups = {}, order = [];
            here.forEach(function (p) {
                var names = {};
                for (var e in p.members)
                    if (info.entries[e])
                        names[info.entries[e].shape] = info.entries[e].name;
                var shapes = Object.keys(names).sort();
                var key = shapes.join(',') + '|' + p.max + '/' + p.total;
                if (!groups[key]) {
                    groups[key] = { shapes: shapes, names: shapes.map(function (k) { return names[k]; }), max: p.max, total: p.total, ids: [], pins: 0 };
                    order.push(key);
                }
                groups[key].ids.push(p.id);
                groups[key].pins += pinsOf(p, zone);
            });
            order.sort(function (a, b) { return groups[b].ids.length - groups[a].ids.length; });

            h += '<div class="pool-chips pool-grouped">';
            order.forEach(function (k) {
                var g = groups[k], off = g.ids.every(function (id) { return hidden[id]; });
                h += '<span class="pool-chip pool-group' + (off ? ' off' : '') + '" data-pool="' + g.ids.join(' ') + '" title="' + esc('Pools ' + g.ids.join(', ')) + '">'
                   + shape(g.shapes.map(Number).filter(function (sh) { return sh; }).sort(function (a, b) { return ORDER.indexOf(a) - ORDER.indexOf(b); })[0] || 0, '#ddd', 9)
                   + '<b>' + esc(g.names.join(' / ')) + '</b><em>' + g.ids.length + ' pools &middot; ' + g.max + ' of ' + g.total + ' active each</em></span>';
            });
            h += '</div>';
        }
        else if (here.length) {
            h += '<div class="pool-chips">';
            here.forEach(function (p) {
                h += '<span class="pool-chip pool-g-' + p.color + (hidden[p.id] ? ' off' : '') + '" data-pool="' + p.id + '" title="'
                   + esc('Pool ' + p.id + (p.desc ? ' - ' + p.desc : '') + ': ' + p.max + ' of ' + p.total + ' spawns active at a time') + '">'
                   + memberShapes(p, false) + '<b>Pool ' + p.id + '</b><em>' + p.max + ' / ' + p.total + '</em></span>';
            });
            h += '</div>';
        }

        var zones = Object.keys(elsewhere).sort(function (a, b) { return elsewhere[b].length - elsewhere[a].length; });
        if (zones.length) {
            var open = panel.querySelector('.pool-else') && panel.querySelector('.pool-else').open;
            h += '<details class="pool-else"' + (open ? ' open' : '') + '><summary>Also pooled in ' + zones.length + ' other zone' + (zones.length == 1 ? '' : 's') + '</summary><ul class="pool-else-list">';
            zones.forEach(function (z) {
                h += '<li><a class="pool-zone" data-zone="' + z + '">' + esc(info.zones[z] || ('Zone ' + z)) + '</a><i>' + elsewhere[z].length + '</i></li>';
            });
            h += '</ul></details>';
        }

        return h;
    }

    function renderTable() {
        var rows = info.pools.slice();
        var val = {
            id:      function (p) { return p.id; },
            zone:    function (p) { return info.zones[mainZone(p)] || ''; },
            pins:    function (p) { return totalPins(p); },
            max:     function (p) { return p.max; },
            total:   function (p) { return p.total; }
        };
        rows.sort(function (a, b) {
            var x = val[sort.col](a), y = val[sort.col](b);
            return (typeof x == 'string' ? x.localeCompare(y) : x - y) * sort.dir || a.id - b.id;
        });

        var arrow = function (c) { return sort.col == c ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''; };
        var h = '<table class="pool-table"><thead><tr>'
              + '<th data-sort="id">Pool' + arrow('id') + '</th>'
              + '<th data-sort="zone">Zone' + arrow('zone') + '</th>'
              + '<th>Members</th>'
              + '<th data-sort="max" style="text-align:right">Active' + arrow('max') + '</th>'
              + '<th data-sort="total" style="text-align:right">Spawns' + arrow('total') + '</th>'
              + '<th data-sort="pins" style="text-align:right">On maps' + arrow('pins') + '</th>'
              + '</tr></thead><tbody>';
        rows.forEach(function (p) {
            var zones = Object.keys(p.areas).map(function (a) { return info.zones[a] || a; });
            var mem = '';
            for (var e in p.members)
                if (info.entries[e])
                    mem += '<span class="pool-mem">' + shape(info.entries[e].shape, 'var(--pg)', 10) + esc(info.entries[e].name) + ' <span class="q0">&times;' + p.members[e] + '</span></span>';
            h += '<tr class="pool-row pool-g-' + p.color + '" data-pool="' + p.id + '" data-zone="' + (mainZone(p) || '') + '">'
               + '<td><span class="pool-tag pool-g-' + p.color + '">' + p.id + '</span>' + (p.desc ? ' <span class="q0">' + esc(p.desc) + '</span>' : '') + '</td>'
               + '<td class="pool-zl">' + esc(zones.join(', ')) + '</td>'
               + '<td>' + mem + '</td>'
               + '<td class="num">' + p.max + '</td>'
               + '<td class="num">' + p.total + '</td>'
               + '<td class="num">' + totalPins(p) + '</td></tr>';
        });
        return h + '</tbody></table>';
    }

    function render() {
        var open = panel.querySelector('.pool-all') && panel.querySelector('.pool-all').open;
        panel.innerHTML = renderZone()
            + '<details class="pool-all"' + (open ? ' open' : '') + '><summary>All ' + info.pools.length + ' pools</summary><div class="pool-scroll">' + renderTable() + '</div></details>';
    }

    // ── events ──────────────────────────────────────────────────────────────

    function bind() {
        panel.addEventListener('mouseover', function (e) {
            var c = e.target.closest('.pool-chip, .pool-row');
            if (c && c.getAttribute('data-pool'))
                focus(c.getAttribute('data-pool'));
        });
        panel.addEventListener('mouseout', function (e) {
            var c = e.target.closest('.pool-chip, .pool-row');
            if (c && !c.contains(e.relatedTarget))
                focus(null);
        });
        panel.addEventListener('click', function (e) {
            var t;
            if ((t = e.target.closest('.pool-chip'))) {
                var ids = t.getAttribute('data-pool').split(' ');
                var hide = !ids.every(function (id) { return hidden[id]; });
                ids.forEach(function (id) { hidden[id] = hide; });
                t.classList.toggle('off', hide);
                applyHidden();
            }
            else if ((t = e.target.closest('.pool-btn'))) {
                var zone = curZone(), all = t.getAttribute('data-act') == 'all';
                info.pools.forEach(function (p) { if (pinsOf(p, zone)) hidden[p.id] = !all; });
                render();
                applyHidden();
            }
            else if ((t = e.target.closest('.pool-zone')))
                openZone(parseInt(t.getAttribute('data-zone')));
            else if ((t = e.target.closest('th[data-sort]'))) {
                var col = t.getAttribute('data-sort');
                sort = { col: col, dir: sort.col == col ? -sort.dir : (col == 'zone' || col == 'id' ? 1 : -1) };
                panel.querySelector('.pool-table').outerHTML = renderTable();
            }
            else if ((t = e.target.closest('.pool-row')) && !e.target.closest('a')) {
                var z = parseInt(t.getAttribute('data-zone'));
                if (z && z != curZone())
                    openZone(z, parseInt(t.getAttribute('data-pool')));
                else
                    focus(parseInt(t.getAttribute('data-pool')));
            }
        });

        // pin hover -> its chip lights up
        mapper.parent.addEventListener('mouseover', function (e) {
            var p = e.target.closest('.pin-pool');
            if (!p)
                return;
            var ids = (p.getAttribute('data-pools') || '').split(' ');
            Array.prototype.forEach.call(panel.querySelectorAll('.pool-chip'), function (c) {
                c.classList.toggle('pool-hl', (c.getAttribute('data-pool') || '').split(' ').some(function (id) { return ids.indexOf(id) != -1; }));
            });
        });
        mapper.parent.addEventListener('mouseout', function (e) {
            if (e.target.closest('.pin-pool'))
                Array.prototype.forEach.call(panel.querySelectorAll('.pool-chip.pool-hl'), function (c) { c.classList.remove('pool-hl'); });
        });

        // zone switches re-create the pins
        var upd = mapper.update.bind(mapper);
        mapper.update = function (opts) {
            upd(opts);
            if (opts && opts.zone) {
                render();
                applyHidden();
            }
        };
    }

    // ── scroll zoom (centred on the cursor) ─────────────────────────────────

    function initZoom() {
        var box = mapper.parent, layer = mapper.span;
        if (!box || !layer || box.classList.contains('pool-zoom-on'))
            return;
        box.classList.add('pool-zoom-on');
        if (mapper.sZoom)
            box.appendChild(mapper.sZoom);

        var hint = document.createElement('div');
        hint.className = 'pool-zoom-hint';
        hint.textContent = 'Tip: Scroll to zoom (double-click resets)';
        box.appendChild(hint);

        // the box always clips (toggling overflow on the way back to 1x made the map flash) and the layer
        // keeps one GPU layer for its whole life; the origin only moves while zoomed in
        box.style.overflow = 'hidden';
        layer.style.transformOrigin = '50% 50%';
        layer.style.transform = 'scale(1)';

        var scale = 1, MIN = 1, MAX = 6;
        function originAt(e) {
            var r = box.getBoundingClientRect();
            if (r.width && r.height)
                layer.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + '% ' + ((e.clientY - r.top) / r.height * 100) + '%';
        }
        box.addEventListener('mousemove', function (e) { if (scale > 1) originAt(e); });
        box.addEventListener('wheel', function (e) {
            e.preventDefault();
            if (scale == MIN)
                originAt(e);
            scale = Math.max(MIN, Math.min(MAX, scale + (e.deltaY < 0 ? .5 : -.5)));
            layer.style.transform = 'scale(' + scale + ')';
            hint.style.display = scale > 1 ? 'none' : '';
        }, { passive: false });
        box.addEventListener('dblclick', function () {
            scale = 1;
            layer.style.transform = 'scale(1)';
            hint.style.display = '';
        });
    }

    // ── entry point ─────────────────────────────────────────────────────────

    this.init = function (data) {
        info   = data;
        mapper = typeof myMapper != 'undefined' ? myMapper : null;
        panel  = document.getElementById('pool-panel');
        if (!info || !panel || !mapper)
            return;

        render();
        bind();
        applyHidden();
        initZoom();
    };
};
