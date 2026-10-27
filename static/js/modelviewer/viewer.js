/*
 * aowow model viewer: the "View in 3D" window (replaces the old Flash viewer behind ModelViewer.show)
 *
 *   ModelViewer.show({type: 1, displayId: 987})                 npc
 *   ModelViewer.show({type: 2, displayId: 310})                 object
 *   ModelViewer.show({type: 3, displayId: 41428, slot: 13})     item
 *
 * Data: static/modelviewer/data (setup/tools/modelviewer/extract.py), drawing: static/js/modelviewer/m2.js + three.js
 */
var AoViewer = (function () {
    var BASE, scriptsReady = null, animNames = null;
    var dlg, stage, renderer, scene, camera, controls, model = null, clockLast = 0, raf = 0, current = null;

    var RACES = [
        [10, 'Be', 'Blood Elf'], [11, 'Dr', 'Draenei'], [3, 'Dw', 'Dwarf'], [7, 'Gn', 'Gnome'], [1, 'Hu', 'Human'],
        [4, 'Ni', 'Night Elf'], [2, 'Or', 'Orc'], [6, 'Ta', 'Tauren'], [8, 'Tr', 'Troll'], [5, 'Sc', 'Undead']
    ];

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
                .then(function () { return fetch(base() + 'anims.json').then(function (r) { return r.ok ? r.json() : {}; }, function () { return {}; }); })
                .then(function (n) { animNames = n; });
        }
        return scriptsReady;
    }

    // ---------------------------------------------------------------- window

    function el(tag, cls, html) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html != null) e.innerHTML = html;
        return e;
    }

    function buildDialog() {
        dlg = el('div', 'mv-overlay');
        dlg.innerHTML =
            '<div class="mv-box">' +
                '<div class="mv-stage"><div class="mv-msg"></div>' +
                    '<div class="mv-tools"><a class="mv-ico mv-pause" title="Pause / play">&#10074;&#10074;</a><a class="mv-ico mv-full" title="Full screen">&#x26F6;</a></div>' +
                '</div>' +
                '<div class="mv-bar">' +
                    '<a class="mv-btn mv-shot" title="Save a screenshot">&#128247; Screenshot</a>' +
                    '<select class="mv-race" title="Race"></select><select class="mv-sex" title="Body"><option value="M">Body 1</option><option value="F">Body 2</option></select>' +
                    '<span class="mv-sp"></span>' +
                    '<label class="mv-anim-l">Animation <select class="mv-anim"></select></label>' +
                '</div>' +
                '<div class="mv-foot"><span>Drag to rotate. Drag with right-click to pan. Scroll to zoom.</span><a class="mv-close">&#10006; Close</a></div>' +
            '</div>';
        document.body.appendChild(dlg);
        stage = dlg.querySelector('.mv-stage');

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        stage.insertBefore(renderer.domElement, stage.firstChild);

        scene = new THREE.Scene();
        scene.add(new THREE.AmbientLight(0xffffff, 0.75));
        var sun = new THREE.DirectionalLight(0xffffff, 0.6);
        sun.position.set(2, 3, 4);
        scene.add(sun);
        var back = new THREE.DirectionalLight(0xffffff, 0.25);
        back.position.set(-3, 1, -4);
        scene.add(back);

        camera = new THREE.PerspectiveCamera(40, 1, 0.01, 2000);
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.screenSpacePanning = true;

        dlg.querySelector('.mv-close').onclick = hide;
        dlg.addEventListener('mousedown', function (e) { if (e.target == dlg) hide(); });
        document.addEventListener('keydown', function (e) { if (e.key == 'Escape' && dlg.classList.contains('open')) hide(); });
        dlg.querySelector('.mv-pause').onclick = function () {
            if (!model) return;
            model.paused = !model.paused;
            this.innerHTML = model.paused ? '&#9654;' : '&#10074;&#10074;';
        };
        dlg.querySelector('.mv-full').onclick = function () {
            var box = dlg.querySelector('.mv-box');
            if (document.fullscreenElement) document.exitFullscreen();
            else if (box.requestFullscreen) box.requestFullscreen();
        };
        document.addEventListener('fullscreenchange', resize);
        window.addEventListener('resize', function () { if (dlg.classList.contains('open')) resize(); });
        dlg.querySelector('.mv-shot').onclick = screenshot;
        dlg.querySelector('.mv-anim').onchange = function () { if (model) model.play(parseInt(this.value)); };

        var race = dlg.querySelector('.mv-race');
        RACES.forEach(function (r) { race.appendChild(new Option(r[2], r[1])); });
        race.onchange = dlg.querySelector('.mv-sex').onchange = function () {
            if (!current) return;
            try { localStorage.setItem('aowow_mv_race', race.value + dlg.querySelector('.mv-sex').value); } catch (e) {}
            open(current);
        };
    }

    function resize() {
        var w = stage.clientWidth, h = stage.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }

    function msg(text) {
        var m = dlg.querySelector('.mv-msg');
        m.innerHTML = text || '';
        m.style.display = text ? '' : 'none';
    }

    function loop(t) {
        raf = requestAnimationFrame(loop);
        var dt = clockLast ? Math.min(t - clockLast, 100) : 0;
        clockLast = t;
        if (model) model.update(dt);
        controls.update();
        renderer.render(scene, camera);
    }

    function frame(m) {
        // fit the camera to the model's bind pose box (in three.js space)
        m.root.updateMatrixWorld(true);
        var box = new THREE.Box3().setFromObject(m.root);
        if (box.isEmpty())
            box = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
        var size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
        var r = Math.max(size.x, size.y, size.z) || 1;
        var dist = r / (2 * Math.tan(camera.fov * Math.PI / 360)) * 1.25;
        camera.near = dist / 100;
        camera.far  = dist * 100;
        camera.position.set(center.x, center.y + dist * 0.18, center.z + dist);   // a little from above
        camera.updateProjectionMatrix();
        controls.target.copy(center);
        controls.update();
    }

    function screenshot() {
        renderer.render(scene, camera);
        var a = document.createElement('a');
        a.href = renderer.domElement.toDataURL('image/png');
        a.download = (document.title.split(' - ')[0] || 'model').replace(/[^\w\- ]+/g, '').trim() + '.png';
        a.click();
    }

    // ---------------------------------------------------------------- what to show

    function raceSex() {
        var v = '';
        try { v = localStorage.getItem('aowow_mv_race') || ''; } catch (e) {}
        return /^[A-Z][a-z][MF]$/.test(v) ? v : 'HuM';
    }

    function setModel(m) {
        if (model) {
            scene.remove(model.root);
            model.root.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
        }
        model = m;
        scene.add(m.root);
        frame(m);

        var sel = dlg.querySelector('.mv-anim'), list = m.animations(animNames);
        sel.innerHTML = '';
        list.forEach(function (a) { sel.appendChild(new Option(a.name, a.index)); });
        sel.value = m.seq;
        dlg.querySelector('.mv-anim-l').style.display = list.length > 1 ? '' : 'none';
        msg('');
    }

    function open(opt) {
        current = opt;
        var kind = { 1: 'npc', 2: 'object', 3: 'item' }[opt.type];
        var raceSel = dlg.querySelector('.mv-race'), sexSel = dlg.querySelector('.mv-sex');
        raceSel.style.display = sexSel.style.display = 'none';
        msg('Loading&hellip;');
        if (!kind || !opt.displayId)
            return msg('Nothing to show.');

        fetch(base() + 'meta/' + kind + '/' + opt.displayId + '.json').then(function (r) {
            if (!r.ok) throw new Error('nometa');
            return r.json();
        }).then(function (meta) {
            if (opt !== current) return;
            var m;
            if (kind == 'item') {
                if (!meta.models || !meta.models.length)
                    throw new Error('worn');
                m = meta.models[0];
                if (m.slot == 'head') {                     // helms differ per race / body
                    var rs = raceSex();
                    raceSel.style.display = sexSel.style.display = '';
                    raceSel.value = rs.substr(0, 2);
                    sexSel.value = rs.substr(2, 1);
                    m = { slot: 'head', f: m.race[rs] || m.race.HuM || m.race[Object.keys(m.race)[0]], tex: m.tex };
                }
                return loadItem(meta, m);
            }
            if (kind == 'npc' && meta.extra)
                throw new Error('humanoid');
            return AoM2.load(base(), meta.f, { tex: meta.tex }).then(function (mdl) {
                if (meta.scale && meta.scale != 1)
                    mdl.root.scale.setScalar(meta.scale);
                return mdl;
            });
        }).then(function (mdl) {
            if (mdl && opt === current) setModel(mdl);
        }).catch(function (e) {
            if (opt !== current) return;
            var t = {
                nometa: 'This model has not been extracted yet.<br><span class="q0">Run setup/tools/modelviewer/extract.py</span>',
                worn: 'This item is worn on the character.<br><span class="q0">Character preview is coming with the dressing room.</span>',
                humanoid: 'This NPC uses a character model.<br><span class="q0">Character preview is coming with the dressing room.</span>'
            }[e.message];
            msg(t || ('Could not load the model.<br><span class="q0">' + $WH.htmlentities(String(e.message || e)) + '</span>'));
            if (window.console) console.warn('model viewer', e);
        });
    }

    // shoulders come as a pair: both models side by side
    function loadItem(meta, first) {
        var pair = meta.models.filter(function (x) { return x.slot == 'shoulder'; });
        if (pair.length == 2) {
            return Promise.all(pair.map(function (p) { return AoM2.load(base(), p.f, { tex: p.tex }); })).then(function (ms) {
                var g = new THREE.Group();
                var holder = Object.create(ms[0]);           // drive both through one object
                ms.forEach(function (mm, i) {
                    mm.root.position.x = (i ? 1 : -1) * 0.35;
                    g.add(mm.root);
                });
                holder.root = g;
                holder.box = ms[0].box.clone().union(ms[1].box);
                holder.update = function (dt) { ms.forEach(function (mm) { mm.update(dt); }); };
                holder.animations = function () { return []; };
                return holder;
            });
        }
        return AoM2.load(base(), first.f, { tex: first.tex }).then(function (mdl) {
            if (first.slot != 'head')                       // weapons / shields lie along X: show them side on
                mdl.root.rotation.z = 0;
            return mdl;
        });
    }

    function show(opt) {
        ready().then(function () {
            if (!dlg) buildDialog();
            dlg.classList.add('open');
            document.documentElement.classList.add('mv-noscroll');
            resize();
            if (!raf) { clockLast = 0; raf = requestAnimationFrame(loop); }
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
        cancelAnimationFrame(raf);
        raf = 0;
        current = null;
        if (location.hash.indexOf('#modelviewer') == 0 && history.replaceState)
            history.replaceState(history.state, '', location.pathname + location.search);
    }

    return { show: show, hide: hide, model: function () { return model; }, frame: function () { if (model) frame(model); } };
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
