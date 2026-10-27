var
    tc_loaded          = false,
    tc_object,
    tc_classId         = -1,
    tc_classIcons      = {},      // large icons on choose screen
    tc_navbarClassIcons = {},     // small icons in navbar
    tc_build           = '',
    tc_glyphs          = '',
    tc_prevHash        = '',      // for Undo
    tc_curLevel        = 80,      // current level
    tc_treeData        = null;    // current tree data (name, points)

function tc_init() {
    var _, clear;

    $WH.ge('tc-classes').className = 'choose';

    var classes = g_sortJsonArray(g_chr_classes, g_chr_classes);

    _ = $WH.ge('tc-classes-inner');
    for (var i = 0, len = classes.length; i < len; ++i) {
        var
            classId = classes[i],
            icon    = Icon.create('class_' + g_file_classes[classId], 2, null, 'javascript:;'),
            link    = Icon.getLink(icon),
            wrapper = $WH.ce('div'),
            label   = $WH.ce('span');

        wrapper.className = 'tc-class-item';
        label.className   = 'tc-class-name c' + classId;
        $WH.st(label, g_chr_classes[classId]);

        tc_classIcons[classId] = icon;

        if ($WH.Browser.ie6) link.onfocus = tb;

        link.onclick      = tc_classClick.bind(link, classId);
        link.onmouseover  = tc_classOver.bind(link, classId);
        link.onmouseout   = $WH.Tooltip.hide;
        label.onclick     = tc_classClick.bind(label, classId);
        label.onmouseover = tc_classOver.bind(label, classId);
        label.onmouseout  = $WH.Tooltip.hide;

        $WH.ae(wrapper, icon);
        $WH.ae(wrapper, label);
        $WH.ae(_, wrapper);
    }
    clear = $WH.ce('div');
    clear.className = 'clear';
    $WH.ae(_, clear);

    var desc = $WH.ce('p');
    desc.className = 'tc-choose-desc';
    desc.innerHTML = 'Customize and share talent builds for World of Warcraft Wrath of the Lich King.<br>Select your talents and glyphs to create character builds for each class.';
    $WH.ae($WH.ge('tc-classes'), desc);

    tc_object = new TalentCalc();
    tc_object.initialize('tc-itself', {
        onChange: tc_onChange,
        mode: TalentCalc.MODE_DEFAULT
    });

    $WH.ge('tc-itself').className += ' choose';

    tc_readPound();
    setInterval(tc_readPound, 1000);
}

// ── Class icon click / hover ──────────────────────────────────────
function tc_classClick(classId) {
    if (tc_object.setClass(classId)) $WH.Tooltip.hide();
    return false;
}

function tc_classOver(classId) {
    $WH.Tooltip.show(this, '<b>' + g_chr_classes[classId] + '</b>', 0, 0, 'c' + classId);
}

// ── Navbar ────────────────────────────────────────────────────────
function tc_buildNavbar() {
    var navbar = $WH.ge('tc-navbar');
    navbar.innerHTML = '';

    // Left: all class icons (small) as a strip
    var left = $WH.ce('div');
    left.className = 'tc-navbar-left';
    left.id = 'tc-navbar-classes';

    var classes = g_sortJsonArray(g_chr_classes, g_chr_classes);
    for (var i = 0; i < classes.length; i++) {
        var cid     = classes[i];
        var icon    = Icon.create('class_' + g_file_classes[cid], 1, null, 'javascript:;');
        var link    = Icon.getLink(icon);
        icon.style.cursor = 'pointer';
        link.onclick     = tc_classClick.bind(link, cid);
        link.onmouseover = tc_classOver.bind(link, cid);
        link.onmouseout  = $WH.Tooltip.hide;
        // Store the icon element (not a wrapper) so we can apply iconmedium-gold-selected
        icon.id = 'tc-navbar-icon-' + cid;
        tc_navbarClassIcons[cid] = icon;
        $WH.ae(left, icon);
    }
    $WH.ae(navbar, left);

    // Center: level control
    var center = $WH.ce('div');
    center.className = 'tc-navbar-center';

    var levelLabel = $WH.ce('span');
    levelLabel.className = 'tc-level-label';
    $WH.st(levelLabel, 'Level');

    var btnMinus = $WH.ce('a');
    btnMinus.href = 'javascript:;';
    btnMinus.className = 'tc-level-btn';
    $WH.st(btnMinus, '−');
    btnMinus.onclick = function() { tc_setLevel(-1); };

    var levelInput = $WH.ce('input');
    levelInput.id = 'tc-level-input';
    levelInput.type = 'text';
    levelInput.className = 'tc-level-input';
    levelInput.value = tc_curLevel;
    levelInput.onchange = function() { tc_setLevelDirect(parseInt(this.value) || tc_curLevel); };
    levelInput.onkeydown = function(e) {
        if ((e || window.event).keyCode == 13) tc_setLevelDirect(parseInt(this.value) || tc_curLevel);
    };

    var btnPlus = $WH.ce('a');
    btnPlus.href = 'javascript:;';
    btnPlus.className = 'tc-level-btn';
    $WH.st(btnPlus, '+');
    btnPlus.onclick = function() { tc_setLevel(1); };

    var levelWrap = $WH.ce('span');
    levelWrap.className = 'tc-level-wrap';
    $WH.ae(levelWrap, btnMinus);
    $WH.ae(levelWrap, levelInput);
    $WH.ae(levelWrap, btnPlus);

    $WH.ae(center, levelLabel);
    $WH.ae(center, levelWrap);
    $WH.ae(navbar, center);

    // Right: action buttons
    var right = $WH.ce('div');
    right.className = 'tc-navbar-right';

    var btns = [
        { id: 'tc-btn-undo',  label: 'Undo',      fn: tc_undoBuild  },
        { id: 'tc-btn-reset', label: 'Reset',      fn: tc_resetBuild },
        { id: 'tc-btn-copy',  label: 'Copy Link',  fn: tc_copyLink   },
        { id: 'tc-btn-link',  label: 'Link',       fn: tc_showLink   }
    ];
    for (var b = 0; b < btns.length; b++) {
        var btn = $WH.ce('a');
        btn.href = 'javascript:;';
        btn.className = 'tc-nav-btn';
        btn.id = btns[b].id;
        $WH.st(btn, btns[b].label);
        btn.onclick = btns[b].fn;
        $WH.ae(right, btn);
    }

    var sep = $WH.ce('span');
    sep.className = 'tc-nav-sep';
    $WH.ae(right, sep);

    var aLink = $WH.ce('a');
    aLink.id = 'tc-btn-abilities';
    aLink.className = 'tc-nav-btn tc-nav-btn-abilities';
    aLink.target = '_blank';
    $WH.st(aLink, 'Class Abilities');
    $WH.ae(right, aLink);

    $WH.ae(navbar, right);
    navbar.style.display = '';
}

function tc_updateNavbar(classId) {
    // Highlight selected class using iconmedium-gold-selected (same system as the choose screen's
    // iconlarge-gold-selected). ID lookup via string concat is type-safe for both number and string classId.
    for (var cid in tc_navbarClassIcons) {
        var ic = tc_navbarClassIcons[cid];
        ic.className = ic.className.replace(' iconmedium-gold-selected', '');
    }
    var sel = $WH.ge('tc-navbar-icon-' + classId);
    if (sel) sel.className += ' iconmedium-gold-selected';

    // Class Abilities link
    var ab = $WH.ge('tc-btn-abilities');
    if (ab) ab.href = '?classes=' + classId;

    // Enforce DK minimum level
    var minLvl = (classId == 6) ? 55 : 10;
    if (tc_curLevel < minLvl) {
        tc_curLevel = minLvl;
        var inp = $WH.ge('tc-level-input');
        if (inp) inp.value = tc_curLevel;
        tc_object.setLevelAndNotify(tc_curLevel);
    }
}

// ── Banner (single spec background, reacts to point distribution) ──
function tc_getDominantTree(data) {
    var max = -1, best = 0;
    for (var t = 0; t < 3; t++) {
        var pts = (data && data[t]) ? data[t].k : 0;
        if (pts > max) { max = pts; best = t; }
        // strict > so ties always fall back to the leftmost tree
    }
    return best;
}

function tc_buildBanner() {
    var banner = $WH.ge('tc-banner');
    if (!banner) return;
    banner.innerHTML = '';

    // Single background image (swapped per dominant spec)
    var bg = $WH.ce('div');
    bg.id = 'tc-banner-bg';
    bg.className = 'tc-banner-bg';
    $WH.ae(banner, bg);

    // Overlay with class name (left) and spec name (right)
    var overlay = $WH.ce('div');
    overlay.className = 'tc-banner-overlay';

    var nameEl = $WH.ce('span');
    nameEl.id = 'tc-banner-classname';
    $WH.ae(overlay, nameEl);

    var specEl = $WH.ce('span');
    specEl.id = 'tc-banner-specname';
    $WH.ae(overlay, specEl);

    $WH.ae(banner, overlay);

    banner.style.display = '';
}

// Per-class, per-spec (tree 0/1/2) banner gradient colours [inner, outer].
// Radial glow at 30% 50% (left-centre) matches the original artwork layout.
var TC_BANNER_GRADIENTS = {
    //           Tree 0                    Tree 1                    Tree 2
    deathknight:[['#FF2020','#6A0808'],  ['#20A0FF','#061828'],  ['#20DD40','#062010']],
    // Blood (crimson)       Frost (ice blue)          Unholy (plague green)
    druid:      [['#8060FF','#140A38'],  ['#FF9020','#381A04'],  ['#20DD40','#062010']],
    // Balance (arcane pur)  Feral (amber)             Restoration (green)
    hunter:     [['#D07820','#281404'],  ['#EED020','#282804'],  ['#80CC10','#142004']],
    // Beast Mastery (brn)   Marksmanship (gold)       Survival (dark green)
    mage:       [['#A040FF','#180840'],  ['#FF5010','#300A04'],  ['#10C0FF','#041C2C']],
    // Arcane (purple)       Fire (orange-red)         Frost (ice blue)
    paladin:    [['#FFE010','#302800'],  ['#5080D0','#080C24'],  ['#FF9010','#301800']],
    // Holy (gold)           Protection (steel blue)   Retribution (orange)
    priest:     [['#C0C0C0','#202020'],  ['#EEEE90','#282810'],  ['#9020FF','#180440']],
    // Discipline (silver)   Holy (warm white)         Shadow (deep purple)
    rogue:      [['#EEEE10','#282800'],  ['#D07820','#281404'],  ['#5060A0','#080C1C']],
    // Assassination (yel)   Combat (brown)            Subtlety (slate blue)
    shaman:     [['#3070FF','#040C30'],  ['#D07820','#281404'],  ['#20DD40','#062010']],
    // Elemental (lightning) Enhancement (earth)       Restoration (green)
    warlock:    [['#A020FF','#180440'],  ['#40DD10','#082004'],  ['#FF2020','#300404']],
    // Affliction (purple)   Demonology (fel green)    Destruction (fire red)
    warrior:    [['#FF2020','#300404'],  ['#E09020','#281C04'],  ['#5080D0','#080C24']],
    // Arms (blood red)      Fury (amber)              Protection (steel blue)
};

function tc_updateBanner(classId, data) {
    var tree      = tc_getDominantTree(data);
    var className = g_file_classes[classId];

    var bg = $WH.ge('tc-banner-bg');
    if (bg) {
        var gc = (TC_BANNER_GRADIENTS[className] || [])[tree] || ['#2A2A2A','#0A0A0A'];
        bg.style.backgroundImage = 'radial-gradient(ellipse 35% 200% at center, ' + gc[0] + ' 0%, ' + gc[1] + ' 55%, #000 100%)';
        bg.style.backgroundColor = '#000';
    }

    var nameEl = $WH.ge('tc-banner-classname');
    if (nameEl) {
        nameEl.className = 'c' + classId;
        $WH.st(nameEl, g_chr_classes[classId]);
    }

    var trees   = tc_object.getTalentTrees();
    var specName = (trees && trees[tree]) ? trees[tree].n : '';
    var specEl  = $WH.ge('tc-banner-specname');
    if (specEl) $WH.st(specEl, '[PH] Specialization: ' + specName);
}

// ── Level control ─────────────────────────────────────────────────
function tc_setLevel(delta) {
    var minLvl = (tc_classId == 6) ? 55 : 10;
    tc_curLevel = Math.max(minLvl, Math.min(80, tc_curLevel + delta));
    var inp = $WH.ge('tc-level-input');
    if (inp) inp.value = tc_curLevel;
    tc_object.setLevelAndNotify(tc_curLevel);
    // Refresh trainer rank and header for the new level
    tc_updateTrainerHeader();
    tc_loadTrainerRank(tc_classId, tc_curLevel);
}

function tc_setLevelDirect(lvl) {
    if (isNaN(lvl)) return;
    var minLvl = (tc_classId == 6) ? 55 : 10;
    tc_curLevel = Math.max(minLvl, Math.min(80, lvl));
    var inp = $WH.ge('tc-level-input');
    if (inp) inp.value = tc_curLevel;
    tc_object.setLevelAndNotify(tc_curLevel);
    tc_updateTrainerHeader();
    tc_loadTrainerRank(tc_classId, tc_curLevel);
}

// ── Navbar actions ────────────────────────────────────────────────
function tc_undoBuild() {
    if (tc_prevHash) {
        location.hash = tc_prevHash;
        tc_prevHash = '';
    }
}

function tc_resetBuild() {
    tc_object.resetAll();
}

function tc_copyLink() {
    var url = location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function() {
            var btn = $WH.ge('tc-btn-copy');
            if (btn) { $WH.st(btn, 'Copied!'); setTimeout(function() { $WH.st(btn, 'Copy Link'); }, 1500); }
        });
    } else {
        prompt('Copy this link:', url);
    }
}

function tc_showLink() {
    prompt('Share this build:', location.href);
}

// ── Sections ──────────────────────────────────────────────────────
function tc_buildSections() {
    var wrap = $WH.ge('tc-sections');
    wrap.innerHTML = '';

    var defs = [
        { id: 'trainer', label: 'Highest Trainable Rank' },
        { id: 'talents', label: 'Talents'                },
        { id: 'glyphs',  label: 'Glyphs'                 }
    ];

    for (var s = 0; s < defs.length; s++) {
        var sec = $WH.ce('div');
        sec.className = 'tc-section';

        var hdr = $WH.ce('div');
        hdr.className = 'tc-section-header';
        hdr.id = 'tc-sec-hdr-' + defs[s].id;
        $WH.st(hdr, defs[s].label);

        var body = $WH.ce('div');
        body.id = 'tc-sec-' + defs[s].id;
        body.className = 'tc-section-body';

        $WH.ae(sec, hdr);
        $WH.ae(sec, body);
        $WH.ae(wrap, sec);
    }

    tc_moveGlyphs();
    tc_placeGlyphCard();

    wrap.style.display = '';
}

// The Glyphs card sits to the right of the talent trees (the calculator's own sidebar spot) instead of below them.
function tc_placeGlyphCard() {
    var card = $WH.ge('tc-sec-glyphs'), calc = $WH.ge('tc-itself');
    if (!card || !calc)
        return;
    card = card.parentNode;                                 // the .tc-section
    if (card.parentNode !== calc) {
        card.classList.add('tc-glyph-card');
        calc.appendChild(card);
        calc.classList.add('tc-with-glyphs');
    }
}

// Move the glyph panel from the calculator's sidebar into the Glyphs section. The calculator can build (or rebuild)
// its sidebar after the sections exist, so this runs again on every update.
function tc_moveGlyphs() {
    var glyphBody = $WH.ge('tc-sec-glyphs');
    var major     = document.querySelector('#tc-itself .talentcalc-sidebar .talentcalc-sidebar-majorglyphs');
    if (!glyphBody || !major)
        return;

    var panel = major;
    while (panel.parentNode && !(panel.parentNode.classList && panel.parentNode.classList.contains('talentcalc-sidebar-inner')))
        panel = panel.parentNode;

    if (panel.parentNode && panel !== glyphBody)
        glyphBody.appendChild(panel);
}

function tc_updateSections(classId, data, forceTrainer) {
    tc_moveGlyphs();
    tc_placeGlyphCard();
    tc_updateTrainerHeader();
    tc_updateTalentsSection(data);
    if (forceTrainer) tc_loadTrainerRank(classId, tc_curLevel);
}

function tc_updateTrainerHeader() {
    var hdr = $WH.ge('tc-sec-hdr-trainer');
    if (hdr) $WH.st(hdr, 'Highest Trainable Rank at Level ' + tc_curLevel);
}

// Spec dot colours per class (3 trees each), used in place of the low-quality gif icons.
// Inner → outer radial gradient gives a nice glowing orb effect.
var TC_SPEC_COLORS = {
    deathknight: [['#C44040','#7A0A0A'], ['#60B4D8','#1A5A80'], ['#50A858','#1A5A20']],
    druid:       [['#B07820','#704A00'], ['#88C840','#3A6010'], ['#60C890','#206040']],
    hunter:      [['#78A858','#3A5A20'], ['#D4C040','#806800'], ['#B07840','#6A3A00']],
    mage:        [['#A070D8','#4A1A90'], ['#E07040','#901800'], ['#60B8E0','#1A5890']],
    paladin:     [['#E8D870','#907000'], ['#A0B8D8','#3A5870'], ['#E8A040','#904800']],
    priest:      [['#D0D090','#707030'], ['#E8E8B0','#909040'], ['#9858C8','#4A1080']],
    rogue:       [['#E0D040','#887000'], ['#D09858','#805000'], ['#808898','#303848']],
    shaman:      [['#4880D8','#0A2870'], ['#C87830','#703000'], ['#50A870','#105030']],
    warlock:     [['#9060C8','#380870'], ['#70C858','#205010'], ['#C84040','#680808']],
    warrior:     [['#B83030','#580808'], ['#D89848','#784000'], ['#5888B8','#183860']],
};

function tc_updateTalentsSection(data) {
    if (!data) return;

    var trees     = tc_object.getTalentTrees();
    var total     = Math.max(0, tc_curLevel - 9); // points available at this level
    var ptLeft    = total - (data.k || 0);
    var className = g_file_classes[tc_classId];

    // Hide the bottom section card entirely — bar above the trees replaces it
    var secCard = $WH.ge('tc-sec-hdr-talents');
    if (secCard && secCard.parentNode) secCard.parentNode.style.display = 'none';

    // Find or create the two-row talents bar inside .talentcalc-wrapper, above .talentcalc-main
    var bar = $WH.ge('tc-talents-bar');
    if (!bar) {
        bar = $WH.ce('div');
        bar.id = 'tc-talents-bar';
        var mainDiv = document.querySelector('#tc-itself .talentcalc-main');
        if (mainDiv) mainDiv.parentNode.insertBefore(bar, mainDiv);
        else return;
    }

    // Row 2: per-column spec headers aligned to the 204px tree columns
    var treesHtml = '';
    for (var t = 0; t < 3; t++) {
        var treeName = (trees && trees[t]) ? trees[t].n : ('Tree ' + (t + 1));
        var spent    = data[t] ? data[t].k : 0;
        treesHtml += '<div class="tc-bar-tree">'
            + '<img src="' + g_staticUrl + '/images/wow/talents/trees/' + className + '_' + (t + 1) + '.gif" width="22" height="22">'
            + '<span class="tc-bar-tree-name">' + treeName + '</span>'
            + '<span class="tc-bar-tree-pts">' + spent + ' / ' + total + '</span>'
            + '</div>';
    }

    bar.innerHTML = '<div class="tc-bar-row1">'
            + '<span class="tc-bar-label">Talents</span>'
            + '<span class="tc-bar-pts-left">Points left: <b>' + ptLeft + '</b></span>'
        + '</div>'
        + '<div class="tc-bar-row2">' + treesHtml + '</div>';
}

// ── Trainer rank AJAX ─────────────────────────────────────────────
function tc_loadTrainerRank(classId, level) {
    var div = $WH.ge('tc-sec-trainer');
    if (!div) return;
    div.innerHTML = '<em style="color:#888">Loading...</em>';

    var xhr = new XMLHttpRequest();
    xhr.open('GET', '?trainerrank&class=' + classId + '&level=' + level, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState != 4) return;
        if (xhr.status == 200) {
            try {
                var data = JSON.parse(xhr.responseText);
                tc_renderTrainerRank(div, data);
            } catch(e) {
                div.innerHTML = '<em style="color:#888">Trainer data not available.</em>';
            }
        } else {
            div.innerHTML = '<em style="color:#888">Trainer data not available.</em>';
        }
    };
    xhr.send();
}

// Trainer spells as one column per talent tree (like the trees above), each spell a compact row:
// icon + name, "Rank N" and the level it is learned at. A filter box narrows the list.
function tc_renderTrainerRank(div, data) {
    if (!data || !data.spells || !data.spells.length) {
        div.innerHTML = '<em style="color:#888">No spells trainable at level ' + tc_curLevel + '.</em>';
        return;
    }

    // one card per talent tree (in tree order), everything else (Defense, Runeforging, ..) under "Others"
    var rename = { 'Shadow Magic': 'Shadow', 'Elemental Combat': 'Elemental' };
    var trees = [];
    try { trees = tc_object.getTalentTrees().map(function (t) { return t.n; }); } catch (e) {}
    var groups = {}, order = trees.slice();
    trees.forEach(function (t) { groups[t] = []; });
    groups['Others'] = [];
    order.push('Others');
    data.spells.forEach(function (sp) {
        var key = sp.skillName ? (rename[sp.skillName] || sp.skillName) : '';
        groups[groups[key] && key != 'Others' ? key : 'Others'].push(sp);
    });
    order = order.filter(function (g) { return groups[g].length; });
    // lowest level first
    order.forEach(function (g) {
        groups[g].sort(function (a, b) { return a.reqLevel - b.reqLevel || a.name.localeCompare(b.name); });
    });

    var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var html = '<div class="tc-tr-bar"><input type="search" class="tc-tr-filter" placeholder="Filter spells..." />'
             + '<span class="tc-tr-count">' + data.spells.length + ' spells</span></div><div class="tc-tr-cols">';
    order.forEach(function (g) {
        html += '<div class="tc-tr-col"><div class="tc-tr-head">' + esc(g) + ' <i>' + groups[g].length + '</i></div>'
              + '<div class="tc-tr-row tc-tr-cols-head"><span></span><span>Spell</span><span>Rank</span><span>Level</span></div>';
        groups[g].forEach(function (sp) {
            html += '<a class="tc-tr-row" href="?spell=' + sp.id + '" data-name="' + esc(sp.name.toLowerCase()) + '">'
                  + '<img src="' + g_staticUrl + '/images/wow/icons/small/' + esc(sp.icon.toLowerCase()) + '.jpg" alt="" />'
                  + '<span class="tc-tr-name">' + esc(sp.name) + '</span>'
                  + '<span class="tc-tr-rank">' + (sp.rank ? esc(sp.rank) : '\u2014') + '</span>'
                  + '<span class="tc-tr-lvl">' + sp.reqLevel + '</span></a>';
        });
        html += '</div>';
    });
    html += '</div>';
    div.innerHTML = html;

    var input = div.querySelector('.tc-tr-filter'), count = div.querySelector('.tc-tr-count');
    input.oninput = function () {
        var q = this.value.trim().toLowerCase(), n = 0;
        div.querySelectorAll('.tc-tr-row').forEach(function (r) {
            var on = !q || r.getAttribute('data-name').indexOf(q) != -1;
            r.style.display = on ? '' : 'none';
            n += on ? 1 : 0;
        });
        div.querySelectorAll('.tc-tr-col').forEach(function (c) {
            c.style.display = c.querySelector('.tc-tr-row:not([style*="none"])') ? '' : 'none';
        });
        count.textContent = n + ' spells';
    };
}

// ── Main onChange ─────────────────────────────────────────────────
function tc_onChange(tc, info, data) {
    var _;
    var currentHash = location.hash;

    if (info.classId != tc_classId) { // class changed
        if (!tc_loaded) {
            _ = $WH.ge('tc-itself');
            _.className = _.className.replace('choose', '');

            // Remove heading/subtitle <p> elements from choose screen
            _ = $WH.ge('tc-classes');
            var _ps = $WH.gE(_, 'p');
            while (_ps.length) $WH.de(_ps[0]);

            // Hide the choose class strip — replaced by navbar icons
            $WH.ge('tc-classes').style.display = 'none';

            tc_loaded = true;
            tc_buildNavbar();
            tc_buildBanner();
            tc_buildSections();

            // setWhBuild/_registerClass set _locked=true for "view-only" mode.
            // We always want edit mode. Unlocking here (after class data is loaded)
            // is safe — _refreshAll has valid _data[classId] at this point.
            // The setLock call fires another tc_onChange (else branch) which finishes
            // updating navbar/banner/etc.; we return early to avoid double-updating.
            if (info.locked) {
                tc_object.setLock(false);
                return;
            }
        }

        // Update large icon gold border on choose strip (hidden but maintained for reference)
        if (tc_classId != -1) {
            _ = tc_classIcons[tc_classId];
            if (_) _.className = _.className.replace(' iconlarge-gold-selected', '');
        }
        tc_classId = info.classId;
        _ = tc_classIcons[tc_classId];
        if (_) _.className += ' iconlarge-gold-selected';

        PageTemplate.set({ breadcrumb: [1, 0, tc_classId] });

        // Force trainer reload on class change
        tc_updateSections(tc_classId, data, true);
    }
    else {
        // Talent point change only — update talents summary, no trainer reload
        tc_updateSections(tc_classId, data, false);
    }

    // Always update navbar highlight and banner — runs every onChange so reload path
    // gets the correct highlight even when classId type differs between the build paths.
    if (tc_loaded) tc_updateNavbar(tc_classId);
    tc_updateBanner(tc_classId, data);

    tc_build  = tc.getWhBuild();
    tc_glyphs = tc.getWhGlyphs();

    var url = '#' + tc_build;
    if (tc_glyphs != '') url += ':' + tc_glyphs;

    if (currentHash && currentHash != url) tc_prevHash = currentHash;
    location.replace(url);

    // Sync level display
    var tcLvl = tc_object.getCurrentLevel();
    if (tcLvl != tc_curLevel) {
        tc_curLevel = tcLvl;
        var inp = $WH.ge('tc-level-input');
        if (inp) inp.value = tc_curLevel;
    }

    // Page title
    var buff = document.title;
    if (buff.indexOf('/') != -1) {
        var pos = buff.indexOf('- ');
        if (pos != -1) buff = buff.substring(pos + 2);
    }
    document.title = g_chr_classes[tc_classId] + ' (' + data[0].k + '/' + data[1].k + '/' + data[2].k + ') - ' + buff;
}

function tc_readPound() {
    if (location.hash) {
        if (location.hash.indexOf('-') != -1) { // Blizz-Build
            var
                pounds  = location.hash.substr(1).split('-'),
                classs  = pounds[0] || '',
                build   = pounds[1] || '',
                classId = -1;

            for (var i in g_file_classes) {
                if (g_file_classes[i] == classs) { classId = i; break; }
            }
            if (classId != -1) { tc_object.setBlizzBuild(classId, build); }
        }
        else { // WH-Build
            var
                pounds = location.hash.substr(1).split(':'),
                build  = pounds[0] || '',
                glyphs = pounds[1] || '';

            if (tc_build != build) {
                tc_build = build;
                tc_object.setWhBuild(tc_build);
            }
            if (tc_glyphs != glyphs) { tc_glyphs = glyphs; tc_object.setWhGlyphs(tc_glyphs); }
        }
    }
}
