/*
 * Item Finder (?item-finder)
 *
 * Class -> spec -> slot -> level: opens the item list filtered to what the class can use, scored and sorted by the
 * spec's stat weights (wt_presets, ?data=weight-presets). The weights are the ones the item filter's presets use.
 */
var AoItemFinder = (function () {
    var CLASSES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11];
    // slot buttons: label (g_item_slots) and the inventory types they search
    var SLOTS = [
        [1, [1]], [2, [2]], [3, [3]], [16, [16]], [5, [5, 20]], [9, [9]], [10, [10]], [6, [6]], [7, [7]], [8, [8]],
        [11, [11]], [12, [12]],
        [13, [13]], [17, [17]], [21, [21]], [22, [22]], [14, [14]], [23, [23]], [15, [15, 26]], [25, [25]], [28, [28]]
    ];
    var QUALITIES = [[2, 'Uncommon'], [3, 'Rare'], [4, 'Epic'], [5, 'Legendary']];

    var st = { cls: 0, spec: '', slots: [], minrl: 70, maxrl: 80, minle: '', qu: [3, 4], gb: true }, el, cfg;

    function esc(t) {
        return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    }

    function icon(name, size) {
        return g_staticUrl + '/images/wow/icons/' + (size || 'medium') + '/' + String(name).toLowerCase() + '.jpg';
    }

    // the spec presets of a class that carry weights
    function specs(cls) {
        var pve = (wt_presets[cls] || {}).pve || {}, out = [];
        for (var k in pve) {
            var n = 0;
            for (var w in pve[k]) if (w != '__icon') n++;
            out.push({ key: k, icon: pve[k].__icon, weights: pve[k], usable: n > 0 });
        }
        return out;
    }

    function specName(key) {
        return (LANG.presets && LANG.presets[key]) || key;
    }

    // stat name -> item filter criterion id (filters.js)
    function critId(name) {
        var list = (typeof fi_filters != 'undefined' && fi_filters.items) || [];
        for (var i = 0; i < list.length; i++)
            if (list[i].name == name && list[i].type == 'num')
                return list[i].id;
        return 0;
    }

    function weights() {
        var w = ((wt_presets[st.cls] || {}).pve || {})[st.spec];
        if (!w) return [];
        var out = [];
        for (var k in w)
            if (k != '__icon' && critId(k))
                out.push([k, w[k]]);
        return out.sort(function (a, b) { return b[1] - a[1]; });
    }

    function filterUrl() {
        var f = ['ub=' + st.cls], w = weights();
        if (st.slots.length) {
            var inv = [];
            st.slots.forEach(function (s) { SLOTS.forEach(function (d) { if (d[0] == s) inv = inv.concat(d[1]); }); });
            f.push('sl=' + inv.join(':'));
        }
        if (st.qu.length) f.push('qu=' + st.qu.join(':'));
        if (st.minrl) f.push('minrl=' + st.minrl);
        if (st.maxrl) f.push('maxrl=' + st.maxrl);
        if (st.minle) f.push('minle=' + st.minle);
        if (w.length) {
            f.push('wt=' + w.map(function (x) { return critId(x[0]); }).join(':'));
            f.push('wtv=' + w.map(function (x) { return Math.max(1, Math.min(999, Math.round(x[1]))); }).join(':'));
        }
        if (st.gb && st.slots.length != 1) f.push('gb=1');
        return g_host.replace(/\/?$/, '/') + '?items&filter=' + f.join(';');
    }

    function render() {
        var html = '';

        // 1. class
        html += '<div class="tf-step"><div class="tf-head"><b>1</b> Class</div><div class="tf-classes">';
        CLASSES.forEach(function (c) {
            html += '<a href="javascript:;" class="tf-class c' + c + (st.cls == c ? ' on' : '') + '" data-cls="' + c + '">'
                  + '<img src="' + icon('class_' + g_file_classes[c]) + '" alt="" /><span>' + esc(g_chr_classes[c]) + '</span></a>';
        });
        html += '</div></div>';

        // 2. spec
        html += '<div class="tf-step' + (st.cls ? '' : ' off') + '"><div class="tf-head"><b>2</b> Specialization</div><div class="tf-specs">';
        if (st.cls)
            specs(st.cls).forEach(function (s) {
                html += '<a href="javascript:;" class="tf-spec' + (st.spec == s.key ? ' on' : '') + (s.usable ? '' : ' disabled') + '" data-spec="' + s.key + '"'
                      + (s.usable ? '' : ' title="No stat weights for this spec yet"') + '>'
                      + '<img src="' + icon(s.icon || 'inv_misc_questionmark') + '" alt="" /><span>' + esc(specName(s.key)) + '</span></a>';
            });
        else
            html += '<span class="q0">Pick a class first.</span>';
        html += '</div></div>';

        // 3. slot
        html += '<div class="tf-step"><div class="tf-head"><b>3</b> Slot <span class="q0">(none picked: every slot, grouped)</span></div><div class="tf-slots">';
        SLOTS.forEach(function (d) {
            html += '<a href="javascript:;" class="tf-slot' + (st.slots.indexOf(d[0]) != -1 ? ' on' : '') + '" data-slot="' + d[0] + '">' + esc(g_item_slots[d[0]] || d[0]) + '</a>';
        });
        html += '</div></div>';

        // 4. level and quality
        html += '<div class="tf-step"><div class="tf-head"><b>4</b> Level &amp; quality</div><div class="tf-opts">'
              + '<label>Required level <input type="number" class="tf-minrl" min="1" max="' + cfg.maxLevel + '" value="' + esc(st.minrl) + '" /> &ndash; '
              + '<input type="number" class="tf-maxrl" min="1" max="' + cfg.maxLevel + '" value="' + esc(st.maxrl) + '" /></label>'
              + '<label>Item level at least <input type="number" class="tf-minle" min="1" max="999" value="' + esc(st.minle) + '" /></label>'
              + '<span class="tf-qus">';
        QUALITIES.forEach(function (q) {
            html += '<label class="q' + q[0] + '"><input type="checkbox" class="tf-qu" value="' + q[0] + '"' + (st.qu.indexOf(q[0]) != -1 ? ' checked' : '') + ' /> ' + esc(q[1]) + '</label>';
        });
        html += '</span></div></div>';

        // weights of the spec + go
        var w = weights(), max = w.length ? w[0][1] : 1;
        html += '<div class="tf-step tf-go"><div class="tf-weights">';
        if (w.length)
            html += '<div class="tf-head">Stat weights: ' + esc(specName(st.spec)) + '</div>' + w.map(function (x) {
                return '<div class="tf-w"><span>' + esc((LANG.traits[x[0]] || [x[0]])[0]) + '</span><i style="width:' + Math.round(100 * x[1] / max) + '%"></i><b>' + x[1] + '</b></div>';
            }).join('');
        else
            html += '<span class="q0">' + (st.cls ? 'Pick a specialization to score items by its stat weights.' : 'Pick a class, a specialization and a slot.') + '</span>';
        html += '</div><a href="javascript:;" class="tf-find' + (st.cls ? '' : ' disabled') + '">Find items</a></div>';

        el.innerHTML = html;
        bind();
    }

    function bind() {
        var $$ = function (s) { return el.querySelectorAll(s); };
        $$('.tf-class').forEach(function (a) {
            a.onclick = function () {
                var c = +a.getAttribute('data-cls');
                if (st.cls != c) { st.cls = c; st.spec = ''; var s = specs(c).filter(function (x) { return x.usable; }); if (s.length) st.spec = s[0].key; }
                render();
            };
        });
        $$('.tf-spec:not(.disabled)').forEach(function (a) { a.onclick = function () { st.spec = a.getAttribute('data-spec'); render(); }; });
        $$('.tf-slot').forEach(function (a) {
            a.onclick = function () {
                var s = +a.getAttribute('data-slot'), i = st.slots.indexOf(s);
                if (i == -1) st.slots.push(s); else st.slots.splice(i, 1);
                render();
            };
        });
        var num = function (sel, key) { el.querySelector(sel).onchange = function () { st[key] = this.value ? Math.max(1, parseInt(this.value) || 1) : ''; }; };
        num('.tf-minrl', 'minrl');
        num('.tf-maxrl', 'maxrl');
        num('.tf-minle', 'minle');
        $$('.tf-qu').forEach(function (c) {
            c.onchange = function () { st.qu = [].map.call(el.querySelectorAll('.tf-qu:checked'), function (x) { return +x.value; }); };
        });
        el.querySelector('.tf-find').onclick = function () {
            if (!st.cls) return;
            location.href = filterUrl();
        };
    }

    return {
        init: function (container, config) {
            el = container;
            cfg = config || {};
            st.maxrl = cfg.maxLevel || 80;
            render();
        }
    };
})();
