/*
 * aowow model viewer - thumbnails
 *
 * Pictures under static/modelviewer/thumbs/<item|npc|object|itemset>/<id>.png that do not exist yet are drawn
 * here in the browser the first time a page asks for them (same models as the 3D viewer). Staff browsers send
 * them to the server (?modelviewer-thumb=save) so everybody gets the stored file afterwards.
 *
 *   <img src=".../modelviewer/thumbs/item/41428.png" data-slot="13">          drawn when missing
 *   <img src=".../modelviewer/thumbs/itemset/627.png" data-race="1" data-sex="0">
 *   AoThumbs.generateList('appearances', button)                              every picture of a listview (staff)
 */
var AoThumbs = (function () {
    var SIZE = 256, stage = null, queue = Promise.resolve(), pending = 0, hooked = false, setCache = {}, memo = {};

    function canStore() {
        return typeof g_user != 'undefined' && g_user.roles && (g_user.roles & U_GROUP_STAFF);
    }

    // count textures still loading, to take the picture once everything is in
    function trackLoads() {
        if (hooked) return;
        hooked = true;
        var M = THREE.DefaultLoadingManager, start = M.itemStart, end = M.itemEnd;
        M.itemStart = function (u) { pending++; return start.call(M, u); };
        M.itemEnd = function (u) { pending = Math.max(0, pending - 1); return end.call(M, u); };
    }

    function settled() {
        return new Promise(function (ok) {
            var calm = 0, t0 = Date.now();
            (function tick() {
                calm = pending ? 0 : calm + 1;
                if (calm >= 4 || Date.now() - t0 > 10000) ok();
                else setTimeout(tick, 50);
            })();
        });
    }

    function getStage() {
        if (!stage) {
            var el = document.createElement('div');
            el.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + SIZE + 'px;height:' + SIZE + 'px;pointer-events:none';
            document.body.appendChild(el);
            stage = new AoStage(el);
        }
        return stage;
    }

    function dispose(m) {
        if (!m || !m.root) return;
        m.root.traverse(function (o) {
            if (o.geometry) o.geometry.dispose();
            (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []).forEach(function (x) { x.dispose(); });
        });
    }

    function host() {
        return typeof g_host != 'undefined' ? g_host.replace(/\/?$/, '/') : '';
    }

    // the pieces of an item set as an equip list
    function setList(id) {
        if (!setCache[id])
            setCache[id] = fetch(host() + '?dressing-room=set&id=' + id).then(function (r) { return r.json(); }).then(function (items) {
                return items.map(function (it) { return [it.slot, it.displayId]; });
            });
        return setCache[id];
    }

    // data url of the picture, or null; one at a time (each picture is drawn once per page)
    function render(type, id, extra) {
        extra = extra || {};
        var key = type + ':' + id + ':' + (extra.slot || 0) + ':' + (extra.race || 0) + ':' + (extra.sex || 0);
        if (memo[key])
            return memo[key];
        var job = queue.then(function () {
            return AoViewer.ready().then(function () {
                trackLoads();
                var st = getStage(), ch = { race: extra.race || 1, sex: extra.sex || 0 };
                var opt = type == 'itemset' ? setList(id).then(function (l) { return { type: 4, equipList: l }; })
                                            : Promise.resolve({ type: { item: 3, npc: 1, object: 2 }[type], displayId: id, slot: extra.slot });
                return opt.then(function (o) {
                    if (o.type == 4 && !o.equipList.length) return null;
                    return AoViewer.build(o, ch).then(function (m) {
                        st.setModel(m);
                        m.update(0);
                        return settled().then(function () {
                            for (var i = 0; m.emitters && m.emitters.length && i < 45; i++)
                                m.update(33);                   // let fire and glows build up
                            m.update(0);
                            st.frame();
                            var url = st.snapshot(SIZE, SIZE);
                            st.setModel(null);
                            dispose(m);
                            return url;
                        });
                    });
                });
            });
        }).catch(function (e) {
            if (window.console) console.warn('thumbnail', type, id, e);
            return null;
        });
        queue = job;
        memo[key] = job;
        return job;
    }

    function store(type, id, url) {
        if (!url || !canStore()) return Promise.resolve(false);
        var fd = new FormData();
        fd.append('type', type);
        fd.append('id', id);
        fd.append('png', url);
        return fetch(host() + '?modelviewer-thumb=save', { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function (r) { return r.ok; }, function () { return false; });
    }

    var RX = /\/modelviewer\/thumbs\/(item|npc|object|itemset)\/(-?\d+)\.png/;    // generated item sets have negative ids

    // a missing picture on the page: draw it in place
    document.addEventListener('error', function (e) {
        var im = e.target;
        if (!im || im.tagName != 'IMG' || im.getAttribute('data-ao-thumb')) return;
        var m = RX.exec(im.src || '');
        if (!m) return;
        im.setAttribute('data-ao-thumb', '1');
        im.classList.add('ao-thumb-wait');
        var extra = { slot: +im.getAttribute('data-slot') || 0, race: +im.getAttribute('data-race') || 0, sex: +im.getAttribute('data-sex') || 0 };
        render(m[1], +m[2], extra).then(function (url) {
            im.classList.remove('ao-thumb-wait');
            if (!url) { im.classList.add('ao-thumb-none'); return; }
            im.src = url;
            store(m[1], +m[2], url);
        });
    }, true);

    // staff: draw and store every missing picture of a listview (all its pages)
    function generateList(lvId, button) {
        var lv = typeof g_listviews != 'undefined' && g_listviews[lvId];
        if (!lv || !canStore()) return;
        var rows = lv.data.slice(), done = 0, made = 0, label = button && button.querySelector('span');
        function status(t) { if (label) label.textContent = t; if (button) { var i = button.querySelector('i'); if (i) i.textContent = t; } }
        (function next() {
            if (!rows.length) { status('Done: ' + made + ' new pictures'); return; }
            var r = rows.shift(), type = lv.genericlinktype == 'npc' ? 'npc' : 'item', id = r.displayid || r.npcmodel;
            done++;
            if (!id) return next();
            fetch(g_staticUrl + '/modelviewer/thumbs/' + type + '/' + id + '.png', { method: 'HEAD', cache: 'no-store' }).then(function (res) {
                if (res.ok) return false;
                return render(type, id, { slot: r.slotbak || r.slot }).then(function (url) { return store(type, id, url); });
            }).then(function (stored) {
                if (stored) made++;
                status(done + ' / ' + lv.data.length);
                next();
            }, function () { next(); });
        })();
    }

    // staff: draw and store every missing picture of a list of ids (type item|npc|object|itemset); progress(done, total, made)
    function generateIds(type, ids, progress) {
        var rows = ids.filter(function (v, i, a) { return v && a.indexOf(v) == i; }), total = rows.length, done = 0, made = 0;
        return new Promise(function (finished) {
            (function next() {
                if (!rows.length) { finished(made); return; }
                var id = rows.shift();
                fetch(g_staticUrl + '/modelviewer/thumbs/' + type + '/' + id + '.png', { method: 'HEAD', cache: 'no-store' }).then(function (res) {
                    if (res.ok) return false;
                    return render(type, id).then(function (url) { return store(type, id, url); });
                }).then(function (stored) {
                    if (stored) made++;
                    if (progress) progress(++done, total, made);
                    next();
                }, function () { if (progress) progress(++done, total, made); next(); });
            })();
        });
    }

    return { render: render, store: store, generateList: generateList, generateIds: generateIds, canStore: canStore, SIZE: SIZE };
})();
