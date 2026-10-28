/*
 * Raid Composition (?raid-composition)
 *
 * Fill a 10 or 25 player raid with class specs and see which raid buffs and debuffs it covers (Wrath of the Lich King
 * 3.3.5). The raid is kept in the #link: #25-<one character per slot> ('.' empty, else the spec index in base 36).
 */
var AoRaidComp = (function () {
    // class id, spec key, name, talent tree (icon), role: T tank, H healer, M melee, R ranged
    var SPECS = [
        [1,  'arms',     'Arms',          1, 'M'], [1,  'fury',    'Fury',          2, 'M'], [1,  'prot',    'Protection',    3, 'T'],
        [2,  'holy',     'Holy',          1, 'H'], [2,  'prot',    'Protection',    2, 'T'], [2,  'ret',     'Retribution',   3, 'M'],
        [3,  'bm',       'Beast Mastery', 1, 'R'], [3,  'mm',      'Marksmanship',  2, 'R'], [3,  'sv',      'Survival',      3, 'R'],
        [4,  'assa',     'Assassination', 1, 'M'], [4,  'combat',  'Combat',        2, 'M'], [4,  'sub',     'Subtlety',      3, 'M'],
        [5,  'disc',     'Discipline',    1, 'H'], [5,  'holy',    'Holy',          2, 'H'], [5,  'shadow',  'Shadow',        3, 'R'],
        [6,  'blood',    'Blood',         1, 'T'], [6,  'frost',   'Frost',         2, 'M'], [6,  'unholy',  'Unholy',        3, 'M'],
        [7,  'ele',      'Elemental',     1, 'R'], [7,  'enh',     'Enhancement',   2, 'M'], [7,  'resto',   'Restoration',   3, 'H'],
        [8,  'arcane',   'Arcane',        1, 'R'], [8,  'fire',    'Fire',          2, 'R'], [8,  'frost',   'Frost',         3, 'R'],
        [9,  'aff',      'Affliction',    1, 'R'], [9,  'demo',    'Demonology',    2, 'R'], [9,  'destro',  'Destruction',   3, 'R'],
        [11, 'balance',  'Balance',       1, 'R'], [11, 'cat',     'Feral (Cat)',   2, 'M'], [11, 'bear',    'Feral (Bear)',  2, 'T'], [11, 'resto', 'Restoration', 3, 'H']
    ];
    var ROLES = { T: 'Tanks', H: 'Healers', M: 'Melee', R: 'Ranged' };

    // what a raid can bring: name, [[class, spec key or '' (any spec), ability], ..]
    var BUFFS = [
        ['Bloodlust / Heroism',        [[7, '', 'Bloodlust / Heroism']]],
        ['Replenishment',              [[3, 'sv', 'Hunting Party'], [2, 'ret', 'Judgements of the Wise'], [5, 'shadow', 'Vampiric Touch'], [9, 'destro', 'Improved Soul Leech'], [8, 'frost', 'Enduring Winter']]],
        ['+10% All stats',             [[2, '', 'Blessing of Kings']]],
        ['All stats',                  [[11, '', 'Mark of the Wild']]],
        ['Stamina',                    [[5, '', 'Power Word: Fortitude'], [9, '', 'Blood Pact (Imp)']]],
        ['Health',                     [[1, '', 'Commanding Shout']]],
        ['Intellect',                  [[8, '', 'Arcane Intellect'], [9, '', 'Fel Intelligence (Felhunter)']]],
        ['Spirit',                     [[5, 'disc', 'Divine Spirit'], [9, '', 'Fel Intelligence (Felhunter)']]],
        ['Strength & Agility',         [[6, '', 'Horn of Winter'], [7, '', 'Strength of Earth Totem']]],
        ['Attack power',               [[1, '', 'Battle Shout'], [2, '', 'Blessing of Might']]],
        ['+10% Attack power',          [[6, 'blood', "Abomination's Might"], [3, 'mm', 'Trueshot Aura'], [7, 'enh', 'Unleashed Rage']]],
        ['+20% Melee haste',           [[6, 'frost', 'Improved Icy Talons'], [7, '', 'Windfury Totem']]],
        ['+5% Spell haste',            [[7, '', 'Wrath of Air Totem']]],
        ['+3% Haste',                  [[11, 'balance', 'Improved Moonkin Form'], [2, 'ret', 'Swift Retribution']]],
        ['+5% Melee & ranged crit',    [[11, 'cat', 'Leader of the Pack'], [11, 'bear', 'Leader of the Pack'], [1, 'fury', 'Rampage']]],
        ['+5% Spell crit',             [[11, 'balance', 'Moonkin Aura'], [7, 'ele', 'Elemental Oath']]],
        ['Spell power',                [[7, 'ele', 'Totem of Wrath'], [7, '', 'Flametongue Totem'], [9, 'demo', 'Demonic Pact']]],
        ['+3% Damage',                 [[3, 'bm', 'Ferocious Inspiration'], [2, 'ret', 'Sanctified Retribution'], [8, 'arcane', 'Arcane Empowerment']]],
        ['Mana per 5 sec.',            [[2, '', 'Blessing of Wisdom'], [7, '', 'Mana Spring Totem']]],
        ['Armor',                      [[2, '', 'Devotion Aura'], [7, '', 'Stoneskin Totem']]],
        ['+6% Healing received',       [[2, 'prot', 'Improved Devotion Aura'], [11, 'resto', 'Tree of Life']]],
        ['-3% Damage taken',           [[2, 'prot', 'Blessing of Sanctuary'], [5, 'disc', 'Renewed Hope']]],
        ['Resistances',                [[2, '', 'Resistance Auras'], [7, '', 'Resistance Totems'], [3, '', 'Aspect of the Wild'], [5, '', 'Shadow Protection']]]
    ];
    var DEBUFFS = [
        ['-20% Armor',                 [[1, '', 'Sunder Armor'], [4, '', 'Expose Armor']]],
        ['-5% Armor',                  [[11, '', 'Faerie Fire'], [9, '', 'Curse of Weakness'], [3, '', 'Sting (Wasp)']]],
        ['+4% Physical damage taken',  [[1, 'arms', 'Blood Frenzy'], [4, 'combat', 'Savage Combat']]],
        ['+30% Bleed damage taken',    [[11, 'cat', 'Mangle'], [11, 'bear', 'Mangle'], [1, 'arms', 'Trauma']]],
        ['+3% Crit taken',             [[2, 'ret', 'Heart of the Crusader'], [4, 'assa', 'Master Poisoner'], [7, 'ele', 'Totem of Wrath']]],
        ['+13% Spell damage taken',    [[6, 'unholy', 'Ebon Plaguebringer'], [11, 'balance', 'Earth and Moon'], [9, '', 'Curse of the Elements']]],
        ['+3% Spell hit taken',        [[11, 'balance', 'Improved Faerie Fire'], [5, 'shadow', 'Misery']]],
        ['+5% Spell crit taken',       [[8, 'fire', 'Improved Scorch'], [8, 'frost', "Winter's Chill"], [9, 'destro', 'Improved Shadow Bolt']]],
        ['-20% Attack speed',          [[1, '', 'Thunder Clap'], [6, '', 'Frost Fever'], [2, 'prot', 'Judgements of the Just'], [11, 'cat', 'Infected Wounds'], [11, 'bear', 'Infected Wounds']]],
        ['-Attack power',              [[1, '', 'Demoralizing Shout'], [11, 'bear', 'Demoralizing Roar'], [9, '', 'Curse of Weakness'], [2, 'prot', 'Vindication']]],
        ['-3% Hit',                    [[11, 'balance', 'Insect Swarm'], [3, '', 'Scorpid Sting']]],
        ['-50% Healing received',      [[1, 'arms', 'Mortal Strike'], [1, 'fury', 'Furious Attacks'], [4, '', 'Wound Poison'], [3, 'mm', 'Aimed Shot']]],
        ['Mana on hit',                [[2, '', 'Judgement of Wisdom']]],
        ['Health on hit',              [[2, '', 'Judgement of Light']]]
    ];

    var el, size = 25, slots = [], hash = '';

    function esc(t) {
        return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    }

    function specIcon(s) {
        return g_staticUrl + '/images/wow/talents/trees/' + g_file_classes[s[0]] + '_' + s[3] + '.gif';
    }

    function specLabel(s) {
        return s[2] + ' ' + g_chr_classes[s[0]];
    }

    function provides(spec, p) {
        return spec[0] == p[0] && (!p[1] || p[1] == spec[1]);
    }

    // ── link ──
    function save() {
        var code = slots.slice(0, size).map(function (i) { return i == null ? '.' : i.toString(36); }).join('').replace(/\.+$/, '');
        hash = size + (code ? '-' + code : '');
        location.replace('#' + hash);
    }

    function load() {
        var h = location.hash.substr(1);
        if (h == hash) return false;
        hash = h;
        var m = /^(10|25)(?:-([0-9a-z.]*))?$/.exec(h);
        size = m ? +m[1] : 25;
        slots = [];
        (m && m[2] || '').split('').forEach(function (c, i) {
            var n = c == '.' ? null : parseInt(c, 36);
            slots[i] = n != null && SPECS[n] ? n : null;
        });
        return true;
    }

    // ── drawing ──
    function render() {
        var members = slots.slice(0, size).filter(function (i) { return i != null; }).map(function (i) { return SPECS[i]; });
        var html = '<div class="rc-bar">'
            + '<span class="rc-size"><a href="javascript:;" data-size="10"' + (size == 10 ? ' class="on"' : '') + '>10 players</a><a href="javascript:;" data-size="25"' + (size == 25 ? ' class="on"' : '') + '>25 players</a></span>'
            + '<span class="rc-roles">' + Object.keys(ROLES).map(function (r) {
                return '<span class="rc-role rc-role-' + r + '">' + ROLES[r] + ' <b>' + members.filter(function (s) { return s[4] == r; }).length + '</b></span>';
            }).join('') + '<span class="rc-role">Players <b>' + members.length + ' / ' + size + '</b></span></span>'
            + '<span class="rc-actions"><a href="javascript:;" class="tc-nav-btn rc-clear">Clear</a><a href="javascript:;" class="tc-nav-btn rc-copy">Copy Link</a></span></div>';

        // spec palette: click to add
        html += '<div class="rc-main"><div class="rc-left"><div class="rc-palette">';
        var byClass = {};
        SPECS.forEach(function (s, i) { (byClass[s[0]] = byClass[s[0]] || []).push(i); });
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 11].forEach(function (c) {
            html += '<div class="rc-pclass"><span class="rc-pname c' + c + '">' + esc(g_chr_classes[c]) + '</span>' + byClass[c].map(function (i) {
                return '<a href="javascript:;" class="rc-add" data-spec="' + i + '" title="Add ' + esc(specLabel(SPECS[i])) + '"><img src="' + specIcon(SPECS[i]) + '" alt="" /></a>';
            }).join('') + '</div>';
        });
        html += '</div>';

        // groups of 5
        html += '<div class="rc-groups">';
        for (var g = 0; g < size / 5; g++) {
            html += '<div class="rc-group"><div class="rc-ghead">Group ' + (g + 1) + '</div>';
            for (var k = 0; k < 5; k++) {
                var idx = g * 5 + k, s = slots[idx] != null ? SPECS[slots[idx]] : null;
                html += s
                    ? '<a href="javascript:;" class="rc-slot full" data-slot="' + idx + '" title="Remove"><img src="' + specIcon(s) + '" alt="" /><span class="c' + s[0] + '">' + esc(s[2]) + '</span><i class="rc-role-' + s[4] + '">' + s[4] + '</i></a>'
                    : '<span class="rc-slot empty">Empty</span>';
            }
            html += '</div>';
        }
        html += '</div></div>';

        // buffs and debuffs
        html += '<div class="rc-right">' + list('Buffs', BUFFS, members) + list('Debuffs', DEBUFFS, members) + '</div></div>';

        el.innerHTML = html;
        bind(members);
    }

    function list(title, defs, members) {
        var have = 0, rows = defs.map(function (d, i) {
            var got = d[1].filter(function (p) { return members.some(function (m) { return provides(m, p); }); });
            if (got.length) have++;
            return '<div class="rc-buff' + (got.length ? ' on' : '') + '" data-def="' + title + ':' + i + '">'
                 + '<span class="rc-check">' + (got.length ? '&#10003;' : '') + '</span><span class="rc-bname">' + esc(d[0]) + '</span>'
                 + '<span class="rc-bsrc">' + d[1].map(function (p) {
                     return '<img src="' + g_staticUrl + '/images/wow/icons/tiny/class_' + g_file_classes[p[0]] + '.gif" class="' + (got.indexOf(p) != -1 ? 'on' : '') + '" alt="" />';
                 }).join('') + '</span></div>';
        });
        return '<div class="rc-list"><div class="rc-lhead">' + title + ' <span>' + have + ' / ' + defs.length + '</span></div>' + rows.join('') + '</div>';
    }

    function bind(members) {
        el.querySelectorAll('.rc-size a').forEach(function (a) {
            a.onclick = function () { size = +a.getAttribute('data-size'); save(); render(); };
        });
        el.querySelector('.rc-clear').onclick = function () { slots = []; save(); render(); };
        el.querySelector('.rc-copy').onclick = function () {
            var b = this;
            if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(function () { b.textContent = 'Copied!'; setTimeout(function () { b.textContent = 'Copy Link'; }, 1500); });
            else prompt('Copy this link:', location.href);
        };
        el.querySelectorAll('.rc-add').forEach(function (a) {
            a.onclick = function () {
                for (var i = 0; i < size; i++)
                    if (slots[i] == null) { slots[i] = +a.getAttribute('data-spec'); save(); render(); return; }
            };
        });
        el.querySelectorAll('.rc-slot.full').forEach(function (a) {
            a.onclick = function () { $WH.Tooltip.hide(); slots[+a.getAttribute('data-slot')] = null; save(); render(); };
        });
        el.querySelectorAll('.rc-buff').forEach(function (r) {
            var p = r.getAttribute('data-def').split(':'), d = (p[0] == 'Buffs' ? BUFFS : DEBUFFS)[+p[1]];
            r.onmouseover = function () {
                $WH.Tooltip.show(r, '<b>' + esc(d[0]) + '</b>' + d[1].map(function (src) {
                    var on = members.some(function (m) { return provides(m, src); });
                    var who = SPECS.filter(function (s) { return provides(s, src); });
                    return '<br /><span class="' + (on ? 'q2' : 'q0') + '">' + esc(src[2]) + '</span> <span class="c' + src[0] + '">'
                         + esc(src[1] ? who.map(specLabel).join(', ') : g_chr_classes[src[0]]) + '</span>';
                }).join(''));
            };
            r.onmouseout = $WH.Tooltip.hide;
        });
    }

    return {
        init: function (container) {
            el = container;
            load();
            render();
            if (!location.hash) save();
            setInterval(function () { if (load()) render(); }, 1000);
        }
    };
})();
