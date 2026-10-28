/*
 * aowow model viewer: the "View in 3D" window (replaces the old Flash viewer behind ModelViewer.show)
 *
 *   ModelViewer.show({type: 1, displayId: 987})                  npc (humanoids are built as characters)
 *   ModelViewer.show({type: 2, displayId: 310})                  object
 *   ModelViewer.show({type: 3, displayId: 41428, slot: 13})      item (slot = inventory type)
 *   ModelViewer.show({type: 4, equipList: [slot, display, ..]})  several items on one character (item sets)
 *
 *   AoStage   - renderer / camera / lights / background / render loop for any element (also used by the dressing room)
 *   AoViewer  - the window: show(), hide(), ready(), stage()
 *
 * Data: static/modelviewer/data (setup/tools/modelviewer/extract.py)
 * Code: static/js/modelviewer/m2.js (models), charmodel.js (characters), particles.js (particle effects), three.js
 */
var AoViewer = (function () {
    var BASE, scriptsReady = null, animNames = null;
    var dlg, stage, current = null;

    var RACES = [[10, 'Blood Elf'], [11, 'Draenei'], [3, 'Dwarf'], [7, 'Gnome'], [1, 'Human'],
                 [4, 'Night Elf'], [2, 'Orc'], [6, 'Tauren'], [8, 'Troll'], [5, 'Undead']];
    var PREFIX = { 1: 'Hu', 2: 'Or', 3: 'Dw', 4: 'Ni', 5: 'Sc', 6: 'Ta', 7: 'Gn', 8: 'Tr', 10: 'Be', 11: 'Dr' };

    function base() {
        return BASE || (BASE = g_staticUrl + '/modelviewer/data/');
    }

    function loadScript(src) {
        return new Promise(function (ok, fail) {
            var s = document.createElement('script');
            s.src = src;
            s.onload = ok;
            s.onerror = function () { fail(new Error('cannot load ' + src)); };
            document.head.appendChild(s);
        });
    }

    function ready() {
        if (!scriptsReady) {
            var js = g_staticUrl + '/js/modelviewer/';
            scriptsReady = (typeof THREE != 'undefined' ? Promise.resolve() : loadScript(js + 'lib/three.min.js'))
                .then(function () { return THREE.OrbitControls ? 0 : loadScript(js + 'lib/OrbitControls.js'); })
                .then(function () { return typeof AoM2 != 'undefined' ? 0 : loadScript(js + 'm2.js'); })
                .then(function () { return typeof AoParticles != 'undefined' ? 0 : loadScript(js + 'particles.js').catch(function () {}); })
                .then(function () { return typeof AoChar != 'undefined' ? 0 : loadScript(js + 'charmodel.js'); })
                .then(function () { return fetch(base() + 'anims.json').then(function (r) { return r.ok ? r.json() : {}; }, function () { return {}; }); })
                .then(function (n) { animNames = n; });
        }
        return scriptsReady;
    }

    // remembered race / body for character previews ('none' = item on its own)
    function savedChar() {
        try {
            var v = JSON.parse(localStorage.getItem('aowow_mv_char') || 'null');
            if (v && (v.race == 'none' || PREFIX[v.race])) return v;
        } catch (e) {}
        return { race: 1, sex: 0 };
    }
    function saveChar(v) {
        try { localStorage.setItem('aowow_mv_char', JSON.stringify(v)); } catch (e) {}
    }

    // ---------------------------------------------------------------- window

    function buildDialog() {
        dlg = document.createElement('div');
        dlg.className = 'mv-overlay';
        dlg.innerHTML =
            '<div class="mv-box">' +
                '<div class="mv-stage"><div class="mv-msg"></div>' +
                    '<div class="mv-tools">' +
                        '<a class="mv-ico mv-bgbtn" title="Background">&#9680;</a>' +
                        '<a class="mv-ico mv-pause" title="Pause / play">&#10074;&#10074;</a>' +
                        '<a class="mv-ico mv-full" title="Full screen">&#x26F6;</a>' +
                    '</div>' +
                    '<div class="mv-bgmenu"></div>' +
                    '<div class="mv-help"><b>Model viewer</b>' +
                        '<p><b>Rotate:</b> drag with the left mouse button</p>' +
                        '<p><b>Pan:</b> drag with the right mouse button (or Shift + drag)</p>' +
                        '<p><b>Zoom:</b> mouse wheel</p>' +
                        '<p><b>Race / Body:</b> show worn items on a character, or <i>None</i> for the item on its own</p>' +
                        '<p><b>Animation:</b> play any animation the model has</p>' +
                        '<p><b>Background</b> (&#9680;): pattern, plain colours, or transparent for screenshots</p>' +
                        '<p><b>Screenshot:</b> saves the current view as a PNG</p>' +
                        '<p class="q0">Models and textures come from the game client. Esc closes the viewer.</p>' +
                        '<a class="mv-btn mv-help-close">Close help</a>' +
                    '</div>' +
                '</div>' +
                '<div class="mv-bar">' +
                    '<a class="mv-btn mv-shot" title="Save a screenshot">&#128247; Screenshot</a>' +
                    '<select class="mv-race" title="Race"></select>' +
                    '<select class="mv-sex" title="Body"><option value="0">Body 1</option><option value="1">Body 2</option></select>' +
                    '<a class="mv-btn mv-dr" title="Open in the dressing room">&#128085; Dressing Room</a>' +
                    '<span class="mv-sp"></span>' +
                    '<label class="mv-anim-l">Animation <select class="mv-anim"></select></label>' +
                '</div>' +
                '<div class="mv-foot"><span>Drag to rotate. Drag with right-click to pan. Scroll to zoom.</span>' +
                    '<span><a class="mv-helpbtn">? Help</a> <a class="mv-close">&#10006; Close</a></span></div>' +
            '</div>';
        document.body.appendChild(dlg);
        stage = new AoStage(dlg.querySelector('.mv-stage'));

        var $ = function (s) { return dlg.querySelector(s); };
        $('.mv-close').onclick = hide;
        dlg.addEventListener('mousedown', function (e) { if (e.target == dlg) hide(); });
        document.addEventListener('keydown', function (e) { if (e.key == 'Escape' && dlg.classList.contains('open')) hide(); });
        $('.mv-pause').onclick = function () {
            stage.paused = !stage.paused;
            this.innerHTML = stage.paused ? '&#9654;' : '&#10074;&#10074;';
        };
        $('.mv-full').onclick = function () {
            if (document.fullscreenElement) document.exitFullscreen();
            else if ($('.mv-box').requestFullscreen) $('.mv-box').requestFullscreen();
        };
        document.addEventListener('fullscreenchange', function () { stage.resize(); });
        window.addEventListener('resize', function () { if (dlg.classList.contains('open')) stage.resize(); });
        $('.mv-shot').onclick = function () { stage.screenshot(document.title.split(' - ')[0]); };
        $('.mv-anim').onchange = function () { if (stage.model) stage.model.play(parseInt(this.value)); };
        $('.mv-helpbtn').onclick = function () { $('.mv-help').classList.toggle('open'); };
        $('.mv-help-close').onclick = function () { $('.mv-help').classList.remove('open'); };

        var menu = $('.mv-bgmenu');
        AoStage.BACKGROUNDS.forEach(function (b) {
            var a = document.createElement('a');
            a.innerHTML = '<i class="mv-bg-' + b[0] + '"></i>' + b[1];
            a.onclick = function () { stage.setBackground(b[0]); menu.classList.remove('open'); };
            menu.appendChild(a);
        });
        $('.mv-bgbtn').onclick = function () { menu.classList.toggle('open'); };

        var race = $('.mv-race');
        race.appendChild(new Option('None', 'none'));
        RACES.forEach(function (r) { race.appendChild(new Option(r[1], r[0])); });
        race.onchange = $('.mv-sex').onchange = function () {
            if (!current) return;
            saveChar({ race: race.value == 'none' ? 'none' : +race.value, sex: +$('.mv-sex').value });
            open(current);
        };
        $('.mv-dr').onclick = function () {
            var m = stage.model, c = m && m.character;
            location.href = '?dressing-room' + (window.AoDressing ? AoDressing.hashFor(c, current) : '');
        };
    }

    function msg(text) {
        var m = dlg.querySelector('.mv-msg');
        m.innerHTML = text || '';
        m.style.display = text ? '' : 'none';
    }

    function setModel(m) {
        stage.setModel(m);
        var sel = dlg.querySelector('.mv-anim'), list = m.animations ? m.animations(animNames) : [];
        sel.innerHTML = '';
        list.forEach(function (a) { sel.appendChild(new Option(a.name, a.index)); });
        sel.value = m.seq;
        dlg.querySelector('.mv-anim-l').style.display = list.length > 1 ? '' : 'none';
        msg('');
    }

    // ---------------------------------------------------------------- what to show

    function fetchJson(url) {
        return fetch(url).then(function (r) { if (!r.ok) throw new Error('nometa'); return r.json(); });
    }

    function open(opt) {
        current = opt;
        var $ = function (s) { return dlg.querySelector(s); };
        var raceSel = $('.mv-race'), sexSel = $('.mv-sex'), drBtn = $('.mv-dr');
        raceSel.style.display = sexSel.style.display = drBtn.style.display = 'none';
        msg('Loading&hellip;');

        var job;
        if (opt.type == 3 && opt.displayId)
            job = openItem(opt, raceSel, sexSel, drBtn);
        else if (opt.type == 4 && opt.equipList)
            job = openSet(opt, raceSel, sexSel, drBtn);
        else if (opt.type == 1 && opt.displayId)
            job = fetchJson(base() + 'meta/npc/' + opt.displayId + '.json').then(function (meta) {
                if (meta.extra)                             // humanoid: a character with its looks and clothes
                    return fetchJson(base() + 'meta/npcx/' + meta.extra + '.json').then(npcCharacter);
                return AoM2.load(base(), meta.f, { tex: meta.tex }).then(function (m) {
                    if (meta.scale && meta.scale != 1) m.root.scale.setScalar(meta.scale);
                    return m;
                });
            });
        else if (opt.type == 2 && opt.displayId)
            job = fetchJson(base() + 'meta/object/' + opt.displayId + '.json').then(function (meta) {
                return AoM2.load(base(), meta.f, { tex: meta.tex });
            });
        else
            return msg('Nothing to show.');

        job.then(function (mdl) {
            if (mdl && opt === current) setModel(mdl);
        }).catch(function (e) {
            if (opt !== current) return;
            var t = { nometa: 'This model has not been extracted yet.<br><span class="q0">Run setup/tools/modelviewer/extract.py</span>' }[e.message];
            msg(t || ('Could not load the model.<br><span class="q0">' + $WH.htmlentities(String(e.message || e)) + '</span>'));
            if (window.console) console.warn('model viewer', e);
        });
    }

    var NPC_SLOTS = ['head', 'shoulder', 'shirt', 'chest', 'waist', 'legs', 'feet', 'wrist', 'hands', 'tabard', 'back'];

    function npcCharacter(x) {
        var items = {};
        x.items.forEach(function (d, i) { if (d) items[NPC_SLOTS[i]] = { display: d }; });
        return AoChar.load(base(), { race: x.race, sex: x.sex, skin: x.skin, face: x.face, hairStyle: x.hairStyle,
                                     hairColor: x.hairColor, facial: x.facial, bake: x.bake, npc: true }, items);
    }

    function openItem(opt, raceSel, sexSel, drBtn) {
        return Promise.all([
            fetchJson(base() + 'meta/item/' + opt.displayId + '.json'),
            fetch(base() + 'meta/body/' + opt.displayId + '.json').then(function (r) { return r.ok ? r.json() : null; }, function () { return null; })
        ]).then(function (r) {
            var meta = r[0], body = r[1];
            var slot = AoChar.INV[opt.slot] || (meta.models.length ? (meta.models[0].slot == 'head' ? 'head' : meta.models[0].slot == 'shoulder' ? 'shoulder' : 'mainhand') : (meta.cape ? 'back' : 'chest'));
            var alone = meta.models.length > 0 && slot != 'back';    // can be shown without a character
            var ch = savedChar();
            if (!alone && ch.race == 'none') ch = { race: 1, sex: 0 };

            raceSel.style.display = sexSel.style.display = drBtn.style.display = '';
            raceSel.querySelector('option[value=none]').disabled = !alone;
            raceSel.value = ch.race;
            sexSel.value = ch.sex || 0;
            sexSel.disabled = ch.race == 'none';

            if (ch.race == 'none') {
                var first = meta.models[0];
                if (first.slot == 'head') {
                    var pre = PREFIX[1] + 'M';
                    first = { slot: 'head', f: first.race[pre] || first.race[Object.keys(first.race)[0]], tex: first.tex };
                }
                return loadItemAlone(meta, first);
            }
            var items = {};
            items[slot] = { display: opt.displayId };
            return AoChar.load(base(), { race: ch.race, sex: ch.sex }, items);
        });
    }

    // item sets: every piece on one character
    function openSet(opt, raceSel, sexSel, drBtn) {
        var ch = savedChar();
        if (ch.race == 'none') ch = { race: 1, sex: 0 };
        raceSel.style.display = sexSel.style.display = drBtn.style.display = '';
        raceSel.querySelector('option[value=none]').disabled = true;
        raceSel.value = ch.race;
        sexSel.value = ch.sex;
        sexSel.disabled = false;
        var items = {}, l = opt.equipList;
        for (var i = 0; i + 1 < l.length; i += 2) {
            var slot = AoChar.INV[l[i]];
            if (slot && l[i + 1] && !items[slot]) items[slot] = { display: +l[i + 1] };
        }
        return AoChar.load(base(), { race: ch.race, sex: ch.sex }, items);
    }

    // an item on its own: shoulders as a pair side by side, weapons / shields side on
    function loadItemAlone(meta, first) {
        var pair = meta.models.filter(function (x) { return x.slot == 'shoulder'; });
        if (pair.length == 2) {
            return Promise.all(pair.map(function (p) { return AoM2.load(base(), p.f, { tex: p.tex }); })).then(function (ms) {
                var g = new THREE.Group();
                ms.forEach(function (mm, i) {
                    mm.root.position.x = (i ? 1 : -1) * 0.35;
                    g.add(mm.root);
                });
                return {
                    root: g, seq: -1,
                    update: function (dt) { ms.forEach(function (mm) { mm.update(dt); }); },
                    animations: function () { return []; },
                    play: function () {}
                };
            });
        }
        return AoM2.load(base(), first.f, { tex: first.tex }).then(function (mdl) {
            if (first.slot != 'head')
                mdl.root.rotation.z = 0;
            return mdl;
        });
    }

    function show(opt) {
        ready().then(function () {
            if (!dlg) buildDialog();
            dlg.classList.add('open');
            document.documentElement.classList.add('mv-noscroll');
            stage.start();
            open(opt);
        }).catch(function (e) {
            alert('The 3D viewer could not start: ' + e.message);
        });
    }

    function hide() {
        if (!dlg) return;
        dlg.classList.remove('open');
        document.documentElement.classList.remove('mv-noscroll');
        if (document.fullscreenElement) document.exitFullscreen();
        stage.stop();
        current = null;
        if (location.hash.indexOf('#modelviewer') == 0 && history.replaceState)
            history.replaceState(history.state, '', location.pathname + location.search);
    }

    return {
        show: show, hide: hide, ready: ready, base: base, animNames: function () { return animNames; },
        RACES: RACES, PREFIX: PREFIX,
        model: function () { return stage && stage.model; },
        frame: function () { if (stage) stage.frame(); }
    };
})();

// take over the old Flash viewer's entry point
(function () {
    function hook() {
        if (typeof ModelViewer == 'undefined')
            return;
        ModelViewer.show = function (opt) {
            if (opt && !opt.noPound && history.replaceState)
                history.replaceState(history.state, '', location.pathname + location.search + '#modelviewer');
            AoViewer.show(opt || {});
        };
        // opened through a link with #modelviewer: the page's own button knows what to show
        if (location.hash.indexOf('#modelviewer') == 0) {
            var b = document.getElementById('view3D-button') || document.querySelector('a.button-red[onclick*="ModelViewer"]');
            if (b) setTimeout(function () { b.click(); }, 0);
        }
    }
    if (document.readyState == 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
})();
