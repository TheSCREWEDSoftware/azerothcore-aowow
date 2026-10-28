/*
 * Hunter pet talent calculator page (?petcalc)
 *
 * Laid out like the class calculator (static/js/talent.js): the families by talent tree and the build actions on
 * top, a banner, then the hunter spec (Beast Mastery gives 4 more points) with the points summary and the three pet
 * trees side by side - the chosen family's tree in colour, the other two greyed out (a click picks that tree) -
 * followed by the family's abilities, the chosen talents and every beast of the family that can be tamed.
 *
 * Each tree is its own TalentCalc (pet mode shows one tree); only the one of the chosen family is editable.
 *
 * Data: g_pet_talents / g_pets (?data=pet-talents.pets), g_pet_info (family -> tree, exotic, abilities; pages/talent.php)
 */
var
    pc_loaded   = false,
    pc_calcs    = [],               // one TalentCalc per tree: Ferocity, Tenacity, Cunning
    pc_tree     = -1,               // tree of the chosen family
    pc_classId  = -1,               // chosen family
    pc_spec     = '',               // hunter spec: b(east mastery) | m(arksmanship) | s(urvival) | ''
    pc_navIcons = {},
    pc_hash     = '',
    pc_prevHash = '';

// the calculator still asks for its old Flash model, which is not shown any more
if (typeof swfobject == 'undefined')
    var swfobject = { embedSWF: function () {} };

var PC_ENCODING    = '0zMcmVokRsaqbdrfwihuGINALpTjnyxtgevElBCDFHJKOPQSUWXYZ123456789';   // as TalentCalc
var PC_SPECS       = [['b', 'Beast Mastery', 1, 'q2'], ['m', 'Marksmanship', 2, 'q'], ['s', 'Survival', 3, 'q']];

function pc_esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}

function pc_treeOf(family) {
    if (typeof g_pet_info != 'undefined' && g_pet_info[family])
        return g_pet_info[family].type;
    for (var i = 0; i < g_pet_talents.length; i++)
        if ($WH.in_array(g_pet_talents[i].f, +family) >= 0)
            return i;
    return 0;
}

function pc_isExotic(family) {
    return !!(typeof g_pet_info != 'undefined' && g_pet_info[family] && g_pet_info[family].exotic);
}

// families per tree, alphabetical
function pc_groups() {
    var groups = [[], [], []];
    g_sortJsonArray(g_pet_families, g_pet_families).forEach(function (f) { groups[pc_treeOf(f)].push(+f); });
    return groups;
}

function pc_treeIcon(tree, size) {
    return g_staticUrl + '/images/wow/icons/' + (size || 'small') + '/' + String(g_pet_talents[tree].icon).toLowerCase() + '.jpg';
}

function pc_familyFromBuild(build) {
    var n = PC_ENCODING.indexOf(build.charAt(0)), d = PC_ENCODING.indexOf(build.charAt(1));
    if (n < 0 || n > 4 || d < 0)
        return -1;
    var f = n * 10 + (d - d % 2) / 2;
    return g_pet_families[f] != null ? f : -1;
}

function pc_init() {
    // sub zones (starting areas ...) named for the location columns
    if (typeof g_pet_zones != 'undefined')
        for (var z in g_pet_zones)
            if (g_zones[z] == null)
                g_zones[z] = g_pet_zones[z];

    var inner = $WH.ge('pc-classes-inner'), groups = pc_groups();

    $WH.ge('pc-classes').className = 'choose';
    var title = $WH.ce('p');
    title.textContent = inner.textContent.trim();          // "Choose a pet family:" from the template
    $WH.ee(inner);
    $WH.ae(inner, title);

    // choose screen: the three trees side by side, their families below the tree name
    var wrap = $WH.ce('div');
    wrap.className = 'pc-choose-groups';
    groups.forEach(function (fams, tree) {
        var col = $WH.ce('div');
        col.className = 'pc-choose-group';
        col.innerHTML = '<div class="pc-choose-head"><img src="' + pc_treeIcon(tree, 'medium') + '" alt="" />' + pc_esc(g_pet_talents[tree].n) + '</div>';
        var list = $WH.ce('div');
        list.className = 'pc-choose-list';
        fams.forEach(function (f) {
            var item = $WH.ce('a');
            item.href = 'javascript:;';
            item.className = 'pc-choose-item';
            item.innerHTML = '<img src="' + g_staticUrl + '/images/wow/icons/medium/' + pc_esc(g_pet_icons[f]) + '.jpg" alt="" /><span>' + pc_esc(g_pet_families[f]) + '</span>'
                           + (pc_isExotic(f) ? '<i>Exotic</i>' : '');
            item.onclick = function () { pc_pick(f); };
            $WH.ae(list, item);
        });
        $WH.ae(col, list);
        $WH.ae(wrap, col);
    });
    $WH.ae(inner, wrap);

    // the three trees
    var trees = $WH.ge('pc-itself');
    trees.className = 'pc-trees choose';
    groups.forEach(function (fams, tree) {
        var col = $WH.ce('div');
        col.className = 'pc-tree pc-tree' + tree;
        col.id = 'pc-tree-' + tree;
        col.innerHTML = '<div class="pc-tree-head"><img src="' + pc_treeIcon(tree, 'medium') + '" alt="" /><span class="pc-tree-name">' + pc_esc(g_pet_talents[tree].n)
                      + '</span><span class="pc-tree-pts"></span></div><div class="pc-tree-calc"><div id="pc-calc-' + tree + '"></div></div>'
                      + '<a class="pc-tree-reset" href="javascript:;">Reset</a><div class="pc-tree-pick" title="Pick a ' + pc_esc(g_pet_talents[tree].n) + ' family"></div>'
                      + '<div class="pc-tree-famsbox"><div class="pc-tree-famshead pc-tree' + tree + '"><span class="pc-tree-name">' + pc_esc(g_pet_talents[tree].n) + '</span></div><div class="pc-tree-fams"></div></div>';
        $WH.ae(trees, col);

        // the tree's families, below it
        var famBox = col.querySelector('.pc-tree-fams');
        fams.forEach(function (f) {
            var link = $WH.ce('a');
            link.href = 'javascript:;';
            link.className = 'pc-nav-icon' + (pc_isExotic(f) ? ' exotic' : '');
            link.innerHTML = '<img src="' + g_staticUrl + '/images/wow/icons/medium/' + pc_esc(g_pet_icons[f]) + '.jpg" alt="" />';
            link.onclick     = function () { pc_pick(f); return false; };
            link.onmouseover = function () {
                $WH.Tooltip.show(this, '<b>' + pc_esc(g_pet_families[f]) + '</b>' + (pc_isExotic(f) ? ' <span class="q4">(Exotic)</span>' : '')
                    + '<br /><span class="q0">' + pc_esc(g_pet_talents[tree].n) + '</span>'
                    + (pc_isExotic(f) ? '<br /><span class="' + (pc_spec == 'b' ? 'q' : 'q10') + '">Requires to be: Beast Mastery Spec</span>' : ''));
            };
            link.onmouseout  = $WH.Tooltip.hide;
            pc_navIcons[f] = link;
            $WH.ae(famBox, link);
        });

        col.querySelector('.pc-tree-reset').onclick = function () { if (tree == pc_tree) pc_calcs[tree].resetAll(); };
        col.querySelector('.pc-tree-pick').onclick  = function () { if (tree != pc_tree) pc_pick(fams[0]); };

        var calc = new TalentCalc();
        calc.initialize('pc-calc-' + tree, { onChange: pc_onChange.bind(null, tree), mode: TalentCalc.MODE_PET });
        calc.setClass(fams[0]);                             // shows the tree; locked until it is the chosen one
        calc.setLock(true);
        pc_calcs[tree] = calc;
    });

    pc_readPound();
    setInterval(pc_readPound, 1000);
}

// choose a family: its tree becomes the editable one, the others go back to a locked preview
function pc_pick(family, build) {
    var tree = pc_treeOf(family);
    $WH.Tooltip.hide();

    if (!pc_loaded) {
        pc_loaded = true;
        $WH.ge('pc-classes').style.display = 'none';
        $WH.ge('pc-itself').className = 'pc-trees';
        pc_buildSpecBar();
        pc_buildSections();
    }

    pc_tree    = tree;
    pc_classId = family;

    pc_calcs.forEach(function (calc, t) {
        var col = $WH.ge('pc-tree-' + t);
        col.classList.toggle('active', t == tree);
        if (t == tree)
            return;
        calc.setLock(false);
        calc.resetAll();
        calc.setLock(true);
    });

    var calc = pc_calcs[tree];
    if (build)
        calc.setWhBuild(build);
    else {
        calc.setLock(false);
        calc.setClass(family);
    }
    calc.setLock(false);
    if ((pc_spec == 'b') != !!calc.getBonusPoints())
        pc_toggleBonus(tree);

    PageTemplate.set({ breadcrumb: [1, 2, family] });
    pc_updateFamily();
    pc_update();
}

// ── Build actions (in the spec bar) ──────────────────────────────
function pc_buildButtons(bar) {
    var right = $WH.ce('div');
    right.className = 'tc-navbar-right pc-buttons';
    [['pc-btn-undo', 'Undo', pc_undoBuild], ['pc-btn-reset', 'Reset', function () { pc_calcs[pc_tree].resetAll(); }],
     ['pc-btn-copy', 'Copy Link', pc_copyLink], ['pc-btn-link', 'Link', function () { prompt('Share this build:', location.href); }]].forEach(function (b) {
        var a = $WH.ce('a');
        a.href = 'javascript:;';
        a.className = 'tc-nav-btn';
        a.id = b[0];
        $WH.st(a, b[1]);
        a.onclick = b[2];
        $WH.ae(right, a);
    });
    var sep = $WH.ce('span');
    sep.className = 'tc-nav-sep';
    $WH.ae(right, sep);
    var fam = $WH.ce('a');
    fam.id = 'pc-btn-family';
    fam.className = 'tc-nav-btn tc-nav-btn-abilities';
    $WH.st(fam, 'Family Page');
    $WH.ae(right, fam);
    $WH.ae(bar, right);
}

function pc_undoBuild() {
    if (pc_prevHash) {
        location.hash = pc_prevHash;
        pc_prevHash = '';
    }
}

function pc_copyLink() {
    var url = location.href, btn = $WH.ge('pc-btn-copy');
    if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(url).then(function () {
            $WH.st(btn, 'Copied!');
            setTimeout(function () { $WH.st(btn, 'Copy Link'); }, 1500);
        });
    else
        prompt('Copy this link:', url);
}

// ── Hunter spec + points bar, above the trees ─────────────────────
function pc_buildSpecBar() {
    var bar = $WH.ce('div');
    bar.id = 'pc-specbar';
    bar.innerHTML = '<span class="pc-specs"></span><span class="pc-spec-name"></span><span class="pc-spec-tree"></span>'
                  + '<span class="pc-spec-stat">Required level: <b class="pc-reqlvl">-</b></span><span class="pc-spec-stat">Points left: <b class="pc-ptsleft">16</b></span>';
    var trees = $WH.ge('pc-itself');
    trees.parentNode.insertBefore(bar, trees);
    pc_buildButtons(bar);

    var specs = bar.querySelector('.pc-specs');
    PC_SPECS.forEach(function (s) {
        var a = $WH.ce('a');
        a.href = 'javascript:;';
        a.className = 'pc-spec';
        a.setAttribute('data-spec', s[0]);
        a.innerHTML = '<img src="' + g_staticUrl + '/images/wow/talents/trees/hunter_' + s[2] + '.gif" alt="" />';
        a.onmouseover = function () {
            $WH.Tooltip.show(this, '<b>' + s[1] + '</b><br /><span class="q0">Hunter spec' + (s[0] == 'b' ? '<br /><span class="q2">+4 pet talent points, can tame exotic beasts</span>' : '') + '</span>');
        };
        a.onmouseout = $WH.Tooltip.hide;
        a.onclick = function () { pc_setSpec(pc_spec == s[0] ? '' : s[0]); };
        $WH.ae(specs, a);
    });
}

function pc_setSpec(spec) {
    pc_spec = spec;
    var calc = pc_calcs[pc_tree];
    if (calc && !!calc.getBonusPoints() != (spec == 'b'))
        pc_toggleBonus(pc_tree);                            // fires onChange -> pc_update
    else
        pc_update();
}

// the calculator only toggles its Beast Mastery bonus through its own [+] / [-] link (in its hidden title bar)
function pc_toggleBonus(tree) {
    var link = document.querySelector('#pc-calc-' + tree + ' .talentcalc-upper-ptsleft a');
    if (link) {
        link.onclick({ pageX: 0, pageY: 0, clientX: 0, clientY: 0 });    // it also shows its hint at the cursor
        $WH.Tooltip.hide();
    }
}

// family related parts: icon highlight, abilities, tameable beasts
function pc_updateFamily() {
    for (var f in pc_navIcons)
        pc_navIcons[f].classList.toggle('on', f == pc_classId);
    $WH.ge('pc-btn-family').href = '?pet=' + pc_classId;

    pc_updateAbilities();
    pc_updateTameable();
}

// ── Sections: abilities, chosen talents, tameable beasts ───────────
function pc_buildSections() {
    var wrap = $WH.ge('pc-sections');
    wrap.innerHTML = '<div class="pc-sec-row">'
        + '<div class="tc-section"><div class="tc-section-header">Abilities</div><div class="tc-section-body" id="pc-sec-abilities"></div></div>'
        + '<div class="tc-section"><div class="tc-section-header" id="pc-sec-hdr-talents">Talents</div><div class="tc-section-body" id="pc-sec-talents"></div></div>'
        + '</div>'
        + '<div class="tc-section"><div class="tc-section-header" id="pc-sec-hdr-tameable">Tameable</div><div class="tc-section-body" id="pc-sec-tameable"></div></div>';
    wrap.style.display = '';
    pc_buildAllTameable();
}

function pc_spellRow(id, extra) {
    var sp = g_spells[id] || {}, name = sp['name_' + Locale.getName()] || sp.name_enus || ('Spell #' + id);
    return '<a class="pc-row" href="?spell=' + id + '">'
         + '<img src="' + g_staticUrl + '/images/wow/icons/small/' + pc_esc(String(sp.icon || 'inv_misc_questionmark').toLowerCase()) + '.jpg" alt="" />'
         + '<span class="pc-row-name">' + pc_esc(name) + '</span>' + (extra || '') + '</a>';
}

function pc_updateAbilities() {
    var ids = (typeof g_pet_info != 'undefined' && g_pet_info[pc_classId]) ? g_pet_info[pc_classId].abilities : [];
    $WH.ge('pc-sec-abilities').innerHTML = ids.length ? ids.map(function (id) { return pc_spellRow(id); }).join('') : '<em class="q0">No family abilities.</em>';
}

function pc_familyPets(family) {
    var list = [];
    for (var id in g_pets)
        if (g_pets[id].family == family)
            list.push(g_pets[id]);
    return list.sort(function (a, b) { return a.minlevel - b.minlevel || a.name.localeCompare(b.name); });
}

// ── Tameable beasts of the family: look groups, filter, sort ───────
var pc_tame = { sort: 'level', desc: false, look: 0, unobtainable: true, q: '' };

function pc_level(p) {
    return p.minlevel == p.maxlevel ? '' + p.minlevel : p.minlevel + ' - ' + p.maxlevel;
}

// zone ids of a beast's spawns (g_pets keeps them as an object)
function pc_zones(p) {
    var l = p.location, out = [];
    if (l) for (var k in l) out.push(+l[k]);
    return out;
}

function pc_zoneText(p) {
    return pc_zones(p).map(function (z) { return g_zones[z] || (typeof g_pet_zones != 'undefined' && g_pet_zones[z]) || ('Zone #' + z); }).join(', ');
}

function pc_reactHtml(p) {
    var r = p.react || [], sides = [LANG.lvnpc_alliance || 'A', LANG.lvnpc_horde || 'H'];
    return [0, 1].map(function (k) {
        return r[k] == null ? '' : '<span class="' + (r[k] < 0 ? 'q10' : r[k] > 0 ? 'q2' : 'q') + '">' + sides[k] + '</span>';
    }).join(' ');
}

// a beast with no spawn anywhere cannot be tamed in the game (test and event creatures)
function pc_unobtainable(p) {
    return !pc_zones(p).length;
}

function pc_previewTip(e, p) {
    $WH.Tooltip.showAtCursor(e, '<div class="pc-preview"><b>' + pc_esc(p.name) + '</b><br /><span class="q0">Level ' + pc_level(p)
        + (pc_zoneText(p) ? '<br />' + pc_esc(pc_zoneText(p)) : '') + '</span><img src="' + g_staticUrl + '/modelviewer/thumbs/npc/' + p.displayId + '.png" width="160" height="160" alt="" /></div>', 0, 0);
}

function pc_updateTameable() {
    var pets = pc_familyPets(pc_classId), body = $WH.ge('pc-sec-tameable');

    // beasts that look the same (same model and skin) share a number - only a look two or more beasts have;
    // the colours repeat after 16
    var count = {}, looks = {}, nLooks = 0, key = function (p) { return p.skin || ('d' + p.displayId); };
    pets.forEach(function (p) { count[key(p)] = (count[key(p)] || 0) + 1; });
    pets.forEach(function (p) {
        var k = key(p);
        if (count[k] < 2) { p._look = 0; return; }
        if (!looks[k]) looks[k] = ++nLooks;
        p._look = looks[k];
    });
    pc_tame.look = 0;
    pc_tame.pets = pets;

    $WH.ge('pc-sec-hdr-tameable').innerHTML = 'Tameable <span class="tc-pts-left">' + pets.length + ' beasts, ' + nLooks + ' shared looks</span>';
    if (!pets.length) {
        body.innerHTML = '<em class="q0">No tameable beasts found.</em>';
        return;
    }

    body.innerHTML = '<div class="tc-tr-bar pc-tame-bar"><input type="search" class="tc-tr-filter pc-filter" placeholder="Filter by name, ID or zone..." />'
        + '<label class="pc-check"><input type="checkbox" class="pc-unob"' + (pc_tame.unobtainable ? ' checked' : '') + ' /> Show unobtainable</label>'
        + '<span class="pc-lookfilter"></span><span class="tc-tr-count pc-tame-count"></span></div>'
        + '<div class="pc-tame-table"></div><div class="pc-tame-note q0">Beasts that look the same (same model and skin) share a coloured group number - beasts with a look of their own have none; click a number to show only that group.</div>';

    var f = body.querySelector('.pc-filter');
    f.value = pc_tame.q;
    f.oninput = function () { pc_tame.q = this.value.trim().toLowerCase(); pc_renderTameable(); };
    body.querySelector('.pc-unob').onchange = function () { pc_tame.unobtainable = this.checked; pc_renderTameable(); };
    pc_renderTameable();
}

function pc_renderTameable() {
    var body = $WH.ge('pc-sec-tameable'), t = pc_tame, cols = [['look', '#'], ['id', 'ID'], ['name', 'Name'], ['level', 'Level'], ['location', 'Location'], ['react', 'React'], ['', 'Preview']];
    var list = t.pets.filter(function (p) {
        if (!t.unobtainable && pc_unobtainable(p)) return false;
        if (t.look && p._look != t.look) return false;
        return !t.q || p.name.toLowerCase().indexOf(t.q) != -1 || ('' + p.id) == t.q || pc_zoneText(p).toLowerCase().indexOf(t.q) != -1;
    });

    var cmp = {
        look:     function (a, b) { return (a._look || 1e9) - (b._look || 1e9); },
        id:       function (a, b) { return a.id - b.id; },
        name:     function (a, b) { return a.name.localeCompare(b.name); },
        level:    function (a, b) { return a.minlevel - b.minlevel || a.maxlevel - b.maxlevel; },
        location: function (a, b) { return pc_zoneText(a).localeCompare(pc_zoneText(b)); },
        react:    function (a, b) { return String(a.react).localeCompare(String(b.react)); }
    }[t.sort];
    list.sort(function (a, b) { var r = cmp(a, b) || a.minlevel - b.minlevel || a.name.localeCompare(b.name); return t.desc ? -r : r; });

    var html = '<div class="pc-tame-row pc-tame-head">' + cols.map(function (c) {
        return c[0] ? '<a href="javascript:;" data-sort="' + c[0] + '"' + (t.sort == c[0] ? ' class="on' + (t.desc ? ' desc' : '') + '"' : '') + '>' + c[1] + '</a>' : '<span>' + c[1] + '</span>';
    }).join('') + '</div>';
    list.forEach(function (p) {
        var cls = { 1: ['Elite', 'q2'], 2: ['Rare Elite', 'q3'], 4: ['Rare', 'q3'] }[p.classification], unob = pc_unobtainable(p);
        html += '<div class="pc-tame-row' + (unob ? ' unob' : '') + '" data-npc="' + p.id + '">'
              + (p._look ? '<a href="javascript:;" class="pc-look pc-look-' + ((p._look - 1) % 16 + 1) + '" title="Show only group ' + p._look + '">' + p._look + '</a>' : '<span></span>')
              + '<span class="pc-tame-id">' + p.id + '</span>'
              + '<span class="pc-tame-namecell"><a class="pc-tame-name" href="?npc=' + p.id + '">' + pc_esc(p.name) + '</a>'
              + (cls ? ' <span class="pc-tame-cls ' + cls[1] + '">' + cls[0] + '</span>' : '') + (unob ? ' <span class="pc-tame-cls q0">Unobtainable</span>' : '') + '</span>'
              + '<span class="pc-tame-lvl">' + pc_level(p) + '</span>'
              + '<span class="pc-tame-loc">' + (pc_zoneText(p) ? pc_esc(pc_zoneText(p)) : '<span class="q0">&mdash;</span>') + '</span>'
              + '<span class="pc-tame-react">' + pc_reactHtml(p) + '</span>'
              + '<a class="pc-tame-3d" href="javascript:;">View in 3D</a></div>';
    });
    if (!list.length)
        html += '<div class="pc-tame-empty q0">No beasts match.</div>';

    var table = body.querySelector('.pc-tame-table');
    table.innerHTML = html;
    body.querySelector('.pc-tame-count').textContent = list.length + ' / ' + t.pets.length + ' beasts';
    body.querySelector('.pc-lookfilter').innerHTML = t.look
        ? '<a href="javascript:;" class="pc-look-chip">Group <span class="pc-look pc-look-' + ((t.look - 1) % 16 + 1) + '">' + t.look + '</span> only &times;</a>' : '';
    var chip = body.querySelector('.pc-look-chip');
    if (chip) chip.onclick = function () { t.look = 0; pc_renderTameable(); };

    table.querySelectorAll('.pc-tame-head a').forEach(function (a) {
        a.onclick = function () {
            var s = a.getAttribute('data-sort');
            t.desc = t.sort == s ? !t.desc : false;
            t.sort = s;
            pc_renderTameable();
        };
    });
    table.querySelectorAll('.pc-tame-row[data-npc]').forEach(function (row) {
        var id = +row.getAttribute('data-npc'), p = g_pets[id];
        row.querySelector('.pc-tame-name').onmouseover = function (e) { pc_previewTip(e, p); };
        row.querySelector('.pc-tame-name').onmousemove = $WH.Tooltip.cursorUpdate;
        row.querySelector('.pc-tame-name').onmouseout  = $WH.Tooltip.hide;
        if (p._look)
            row.querySelector('.pc-look').onclick = function () { t.look = t.look == p._look ? 0 : p._look; pc_renderTameable(); };
        row.querySelector('.pc-tame-3d').onclick = function () {
            $WH.Tooltip.hide();
            ModelViewer.show({ type: 1, typeId: id, displayId: p.displayId });
        };
    });
}

// ── Every tameable beast, whatever the family (bottom listview) ─────
function pc_buildAllTameable() {
    var box = $WH.ce('div');
    box.className = 'tc-section pc-sec-all';
    box.innerHTML = '<div class="tc-section-header">All tameable beasts</div><div class="tc-section-body">'
        + '<label class="pc-check pc-all-unob"><input type="checkbox" checked /> Show unobtainable</label><div id="lv-pc-alltame" class="listview"></div></div>';
    $WH.ae($WH.ge('pc-sections'), box);

    var data = [];
    for (var id in g_pets) {
        var p = g_pets[id];
        data.push({ id: p.id, name: p.name, minlevel: p.minlevel, maxlevel: p.maxlevel, classification: p.classification,
                    location: pc_zones(p), react: p.react, family: p.family, displayId: p.displayId, type: 1 });
    }

    new Listview({
        template:    'npc',
        id:          'pc-alltame',
        parent:      'lv-pc-alltame',
        data:        data,
        hiddenCols:  ['type', 'petfamily'],
        extraCols:   [{
            id: 'pc-family',
            name: LANG.type,
            type: 'text',
            width: '12%',
            after: 'name',
            compute: function (npc, td) {
                var a = $WH.ce('a');
                a.href = '?pet=' + npc.family;
                $WH.st(a, g_pet_families[npc.family] || '');
                $WH.ae(td, a);
                if (pc_isExotic(npc.family)) {
                    var i = $WH.ce('div');
                    i.className = 'small q4';
                    $WH.st(i, 'Exotic');
                    $WH.ae(td, i);
                }
            },
            getVisibleText: function (npc) { return g_pet_families[npc.family] || ''; },
            sortFunc: function (a, b) { return $WH.strcmp(g_pet_families[a.family], g_pet_families[b.family]); }
        }, {
            id: 'pc-preview',
            name: 'Preview',
            type: 'text',
            width: '60px',
            before: 'name',
            filtrable: 0,
            compute: function (npc, td) {
                var a = $WH.ce('a'), img = $WH.ce('img');
                a.href = 'javascript:;';
                a.className = 'pc-lv-thumb';
                img.src = g_staticUrl + '/modelviewer/thumbs/npc/' + npc.displayId + '.png';
                img.loading = 'lazy';
                img.width = img.height = 44;
                a.onclick = function () { ModelViewer.show({ type: 1, typeId: npc.id, displayId: npc.displayId }); };
                a.onmouseover = function (e) { pc_previewTip(e, g_pets[npc.id]); };
                a.onmousemove = $WH.Tooltip.cursorUpdate;
                a.onmouseout  = $WH.Tooltip.hide;
                $WH.ae(a, img);
                $WH.ae(td, a);
            },
            sortFunc: function (a, b) { return a.displayId - b.displayId; }
        }],
        sort: ['name']
    });

    box.querySelector('.pc-all-unob input').onchange = function () {
        var lv = g_listviews['pc-alltame'], on = this.checked;
        lv.customFilter = on ? null : function (row) { return row.location.length > 0; };
        lv.updateFilters(true);
    };
}

// points, spec bar, chosen talents, hash and title
function pc_update() {
    var calc = pc_calcs[pc_tree];
    if (!calc || pc_classId < 0)
        return;

    var talents = calc.getTalents(), spent = 0, bonus = calc.getBonusPoints() ? 4 : 0;
    talents.forEach(function (t) { spent += t.k; });
    var total = 16 + bonus, req = Math.max(bonus ? 60 : 0, spent > 0 ? (spent - bonus) * 4 + 16 : 0);

    // a Beast Mastery bonus from a shared link picks the spec
    if (bonus && pc_spec != 'b') pc_spec = 'b';
    if (!bonus && pc_spec == 'b') pc_spec = '';

    pc_calcs.forEach(function (c, t) {
        $WH.ge('pc-tree-' + t).querySelector('.pc-tree-pts').innerHTML = t == pc_tree ? spent + ' / ' + total : '';
    });

    var bar = $WH.ge('pc-specbar'), spec = PC_SPECS.filter(function (s) { return s[0] == pc_spec; })[0];
    bar.querySelectorAll('.pc-spec').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-spec') == pc_spec); });
    bar.querySelector('.pc-spec-name').innerHTML = spec ? '<span class="' + spec[3] + '">' + spec[1] + '</span>' : '<span class="q0">No hunter spec</span>';
    bar.querySelector('.pc-spec-tree').innerHTML = '<img src="' + g_staticUrl + '/images/wow/icons/small/' + pc_esc(g_pet_icons[pc_classId]) + '.jpg" alt="" /><b>'
        + pc_esc(g_pet_families[pc_classId]) + '</b> <span class="pc-tree' + pc_tree + '"><span class="pc-tree-name">' + pc_esc(g_pet_talents[pc_tree].n) + '</span></span>'
        + (pc_isExotic(pc_classId) ? ' <span class="' + (pc_spec == 'b' ? 'q0' : 'q10') + '" title="Exotic beasts need the Beast Mastery spec">(exotic)</span>' : '');
    bar.querySelector('.pc-reqlvl').textContent = req || '-';
    bar.querySelector('.pc-ptsleft').textContent = total - spent;

    $WH.ge('pc-sec-hdr-talents').innerHTML = 'Talents <span class="tc-pts-left">' + spent + ' / ' + total + ' points</span>';
    $WH.ge('pc-sec-talents').innerHTML = talents.length
        ? talents.map(function (t) { return pc_spellRow(t.s[Math.max(0, t.k - 1)], '<span class="pc-row-rank">' + t.k + ' / ' + t.m + '</span>'); }).join('')
        : '<em class="q0">No talents chosen yet. Click a talent to add a point, right-click to remove one.</em>';

    var url = '#' + calc.getWhBuild() + (pc_spec && pc_spec != 'b' ? ':' + pc_spec : '');
    if (location.hash && location.hash != url)
        pc_prevHash = location.hash;
    pc_hash = url.substr(1);
    location.replace(url);

    var buff = document.title;
    if (buff.indexOf(' (') != -1) {
        var pos = buff.indexOf('- ');
        if (pos != -1)
            buff = buff.substring(pos + 2);
    }
    document.title = g_pet_families[pc_classId] + ' (' + spent + ') - ' + buff;
}

function pc_onChange(tree, tc, info, data) {
    if (tree != pc_tree || !pc_loaded)
        return;
    if (info.locked) {                                      // a shared build opens locked: always edit here
        tc.setLock(false);
        return;
    }
    pc_update();
}

function pc_readPound() {
    var hash = location.hash.substr(1);
    if (!hash || hash == pc_hash)
        return;

    var parts = hash.split(':'), family = pc_familyFromBuild(parts[0]);
    pc_hash = hash;
    if (family < 0)
        return;
    pc_spec = parts[1] && /^[ms]$/.test(parts[1]) ? parts[1] : '';
    pc_pick(family, parts[0]);
}
