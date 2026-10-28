/*
 * Raid Composition (?raid-composition)
 *
 * Pick the expansion (Classic: 20 / 40 players and one faction - no Alliance shamans, no Horde paladins; The Burning
 * Crusade and Wrath of the Lich King: 10 / 25, Wrath adds death knights), then fill the groups: drag a spec onto a
 * slot (or click it to fill the next free slot), drag members between slots, double-click to remove or rename.
 * Below: which raid buffs and debuffs of that expansion the raid brings.
 *
 * Link: #<expansion v|t|w><size><faction a|h, classic only>-<one character per slot ('.' empty, else spec index base 36)>~<slot>=<name>|..
 */
var AoRaidComp = (function () {
    // class, spec key, name, talent tree (icon), role: T tank, H healer, M melee, R ranged
    var SPECS = [
        [1,  'arms',    'Arms',          1, 'M'], [1,  'fury',    'Fury',          2, 'M'], [1,  'prot',   'Protection',    3, 'T'],
        [2,  'holy',    'Holy',          1, 'H'], [2,  'prot',    'Protection',    2, 'T'], [2,  'ret',    'Retribution',   3, 'M'],
        [3,  'bm',      'Beast Mastery', 1, 'R'], [3,  'mm',      'Marksmanship',  2, 'R'], [3,  'sv',     'Survival',      3, 'R'],
        [4,  'assa',    'Assassination', 1, 'M'], [4,  'combat',  'Combat',        2, 'M'], [4,  'sub',    'Subtlety',      3, 'M'],
        [5,  'disc',    'Discipline',    1, 'H'], [5,  'holy',    'Holy',          2, 'H'], [5,  'shadow', 'Shadow',        3, 'R'],
        [6,  'blood',   'Blood',         1, 'T'], [6,  'frost',   'Frost',         2, 'M'], [6,  'unholy', 'Unholy',        3, 'M'],
        [7,  'ele',     'Elemental',     1, 'R'], [7,  'enh',     'Enhancement',   2, 'M'], [7,  'resto',  'Restoration',   3, 'H'],
        [8,  'arcane',  'Arcane',        1, 'R'], [8,  'fire',    'Fire',          2, 'R'], [8,  'frost',  'Frost',         3, 'R'],
        [9,  'aff',     'Affliction',    1, 'R'], [9,  'demo',    'Demonology',    2, 'R'], [9,  'destro', 'Destruction',   3, 'R'],
        [11, 'balance', 'Balance',       1, 'R'], [11, 'cat',     'Feral (Cat)',   2, 'M'], [11, 'bear',   'Feral (Bear)',  2, 'T'], [11, 'resto', 'Restoration', 3, 'H']
    ];
    var ROLE_NAME = { T: 'Tank', H: 'Healer', M: 'Melee', R: 'Ranged' };
    var ROLES = { T: 'Tanks', H: 'Healers', M: 'Melee', R: 'Ranged' };
    // palette columns
    var PALETTE = [['Melee', [1, 2, 4, 6]], ['Ranged', [3, 5, 8, 9]], ['Hybrid', [7, 11]]];

    var EXPANSIONS = {
        v: { name: 'Classic',                   sizes: [40, 20], factions: true },
        t: { name: 'The Burning Crusade',       sizes: [25, 10] },
        w: { name: 'Wrath of the Lich King',    sizes: [25, 10] }
    };

    // name, [[class, spec key or '' (any spec), ability], ..] per expansion
    var DATA = {
        w: {
            buffs: [
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
            ],
            debuffs: [
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
            ]
        },
        t: {
            buffs: [
                ['Bloodlust / Heroism',        [[7, '', 'Bloodlust / Heroism']]],
                ['All stats',                  [[11, '', 'Mark of the Wild']]],
                ['+10% All stats',             [[2, 'prot', 'Blessing of Kings']]],
                ['Stamina',                    [[5, '', 'Power Word: Fortitude'], [9, '', 'Blood Pact (Imp)']]],
                ['Health',                     [[1, '', 'Commanding Shout']]],
                ['Intellect',                  [[8, '', 'Arcane Intellect']]],
                ['Spirit',                     [[5, 'disc', 'Divine Spirit']]],
                ['Attack power',               [[1, '', 'Battle Shout'], [2, '', 'Blessing of Might']]],
                ['+10% Attack power',          [[3, 'mm', 'Trueshot Aura'], [7, 'enh', 'Unleashed Rage']]],
                ['Strength',                   [[7, '', 'Strength of Earth Totem']]],
                ['Agility',                    [[7, '', 'Grace of Air Totem']]],
                ['Melee haste',                [[7, '', 'Windfury Totem']]],
                ['Spell power',                [[7, '', 'Wrath of Air Totem']]],
                ['+3% Spell hit & crit',       [[7, 'ele', 'Totem of Wrath']]],
                ['+5% Melee & ranged crit',    [[11, 'cat', 'Leader of the Pack'], [11, 'bear', 'Leader of the Pack']]],
                ['+5% Spell crit',             [[11, 'balance', 'Moonkin Aura']]],
                ['+3% Damage',                 [[3, 'bm', 'Ferocious Inspiration']]],
                ['+10% Holy damage',           [[2, 'ret', 'Sanctity Aura']]],
                ['Mana per 5 sec.',            [[2, '', 'Blessing of Wisdom'], [7, '', 'Mana Spring Totem']]],
                ['Mana from shadow damage',    [[5, 'shadow', 'Vampiric Touch']]],
                ['-Threat',                    [[2, '', 'Blessing of Salvation']]],
                ['Healing received',           [[11, 'resto', 'Tree of Life'], [2, '', 'Blessing of Light']]],
                ['Armor',                      [[2, '', 'Devotion Aura']]],
                ['Resistances',                [[2, '', 'Resistance Auras'], [7, '', 'Resistance Totems'], [3, '', 'Aspect of the Wild'], [5, '', 'Shadow Protection']]]
            ],
            debuffs: [
                ['Armor (Sunder / Expose)',    [[1, '', 'Sunder Armor'], [4, '', 'Expose Armor']]],
                ['Armor (Faerie Fire)',        [[11, '', 'Faerie Fire']]],
                ['Armor (Curse of Recklessness)', [[9, '', 'Curse of Recklessness']]],
                ['Ranged attack power',        [[3, 'mm', "Improved Hunter's Mark"]]],
                ['+4% Physical damage taken',  [[1, 'arms', 'Blood Frenzy']]],
                ['+30% Bleed damage taken',    [[11, 'cat', 'Mangle'], [11, 'bear', 'Mangle']]],
                ['+3% Crit taken',             [[2, 'ret', 'Improved Seal of the Crusader']]],
                ['+5% Spell damage taken',     [[5, 'shadow', 'Misery']]],
                ['+10% Shadow damage taken',   [[5, 'shadow', 'Shadow Weaving']]],
                ['+10% Spell damage taken',    [[9, '', 'Curse of the Elements']]],
                ['Fire crit taken',            [[8, 'fire', 'Improved Scorch']]],
                ['Frost crit taken',           [[8, 'frost', "Winter's Chill"]]],
                ['Shadow damage taken',        [[9, 'destro', 'Improved Shadow Bolt']]],
                ['-Attack speed',              [[1, '', 'Thunder Clap']]],
                ['-Attack power',              [[1, '', 'Demoralizing Shout'], [11, 'bear', 'Demoralizing Roar']]],
                ['-Hit',                       [[11, 'balance', 'Insect Swarm'], [3, '', 'Scorpid Sting']]],
                ['-50% Healing received',      [[1, 'arms', 'Mortal Strike'], [4, '', 'Wound Poison'], [3, 'mm', 'Aimed Shot']]],
                ['Mana on hit',                [[2, '', 'Judgement of Wisdom']]],
                ['Health on hit',              [[2, '', 'Judgement of Light']]]
            ]
        },
        v: {
            buffs: [
                ['All stats',                  [[11, '', 'Mark of the Wild']]],
                ['+10% All stats',             [[2, 'prot', 'Blessing of Kings']]],
                ['Stamina',                    [[5, '', 'Power Word: Fortitude'], [9, '', 'Blood Pact (Imp)']]],
                ['Intellect',                  [[8, '', 'Arcane Intellect']]],
                ['Spirit',                     [[5, 'disc', 'Divine Spirit']]],
                ['Attack power',               [[1, '', 'Battle Shout'], [2, '', 'Blessing of Might']]],
                ['Ranged attack power',        [[3, 'mm', 'Trueshot Aura']]],
                ['Strength',                   [[7, '', 'Strength of Earth Totem']]],
                ['Agility',                    [[7, '', 'Grace of Air Totem']]],
                ['Windfury',                   [[7, '', 'Windfury Totem']]],
                ['+3% Melee & ranged crit',    [[11, 'cat', 'Leader of the Pack'], [11, 'bear', 'Leader of the Pack']]],
                ['+3% Spell crit',             [[11, 'balance', 'Moonkin Aura']]],
                ['Mana per 5 sec.',            [[2, '', 'Blessing of Wisdom'], [7, '', 'Mana Spring Totem']]],
                ['Mana Tide',                  [[7, 'resto', 'Mana Tide Totem']]],
                ['-Threat',                    [[2, '', 'Blessing of Salvation'], [7, '', 'Tranquil Air Totem']]],
                ['Healing received',           [[2, '', 'Blessing of Light']]],
                ['Armor',                      [[2, '', 'Devotion Aura']]],
                ['Resistances',                [[2, '', 'Resistance Auras'], [7, '', 'Resistance Totems'], [3, '', 'Aspect of the Wild'], [5, '', 'Shadow Protection']]]
            ],
            debuffs: [
                ['Armor (Sunder / Expose)',    [[1, '', 'Sunder Armor'], [4, '', 'Expose Armor']]],
                ['Armor (Faerie Fire)',        [[11, '', 'Faerie Fire']]],
                ['Armor (Curse of Recklessness)', [[9, '', 'Curse of Recklessness']]],
                ['Ranged attack power',        [[3, '', "Hunter's Mark"]]],
                ['Holy damage taken',          [[2, '', 'Judgement of the Crusader']]],
                ['+10% Shadow damage taken',   [[5, 'shadow', 'Shadow Weaving']]],
                ['Spell damage taken',         [[9, '', 'Curse of the Elements / Shadow']]],
                ['Fire crit taken',            [[8, 'fire', 'Improved Scorch']]],
                ['Frost crit taken',           [[8, 'frost', "Winter's Chill"]]],
                ['Shadow damage taken',        [[9, 'destro', 'Improved Shadow Bolt']]],
                ['Nature damage taken',        [[7, 'enh', 'Stormstrike']]],
                ['-Attack speed',              [[1, '', 'Thunder Clap']]],
                ['-Attack power',              [[1, '', 'Demoralizing Shout'], [11, 'bear', 'Demoralizing Roar']]],
                ['-50% Healing received',      [[1, 'arms', 'Mortal Strike'], [4, '', 'Wound Poison'], [3, 'mm', 'Aimed Shot']]],
                ['Mana on hit',                [[2, '', 'Judgement of Wisdom']]],
                ['Health on hit',              [[2, '', 'Judgement of Light']]]
            ]
        }
    };

    var el, exp = 'w', size = 25, faction = 'a', slots = [], names = {}, hash = '', renameMode = false;

    function esc(t) {
        return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    }
    function specIcon(s) { return g_staticUrl + '/images/wow/talents/trees/' + g_file_classes[s[0]] + '_' + s[3] + '.gif'; }
    function classIcon(c, size) { return g_staticUrl + '/images/wow/icons/' + (size || 'small') + '/class_' + g_file_classes[c] + '.jpg'; }
    function specLabel(s) { return s[2] + ' ' + g_chr_classes[s[0]]; }
    function provides(spec, p) { return spec[0] == p[0] && (!p[1] || p[1] == spec[1]); }

    // which classes exist: death knights from Wrath on; classic: no Alliance shamans, no Horde paladins
    function classOk(c) {
        if (c == 6) return exp == 'w';
        if (exp == 'v' && c == 7) return faction == 'h';
        if (exp == 'v' && c == 2) return faction == 'a';
        return true;
    }

    // ── link ──
    function save() {
        var code = slots.slice(0, size).map(function (i) { return i == null ? '.' : i.toString(36); }).join('').replace(/\.+$/, '');
        var nm = Object.keys(names).filter(function (k) { return names[k] && k < size; }).map(function (k) { return k + '=' + encodeURIComponent(names[k]); }).join('|');
        hash = exp + size + (EXPANSIONS[exp].factions ? faction : '') + (code ? '-' + code : '') + (nm ? '~' + nm : '');
        location.replace('#' + hash);
    }

    function load() {
        var h = location.hash.substr(1);
        if (h == hash) return false;
        hash = h;
        var parts = h.split('~'), m = /^([vtw]?)(\d+)([ah]?)(?:-([0-9a-z.]*))?$/.exec(parts[0]);
        exp = m && m[1] ? m[1] : 'w';
        size = m && EXPANSIONS[exp].sizes.indexOf(+m[2]) != -1 ? +m[2] : EXPANSIONS[exp].sizes[0];
        faction = m && m[3] ? m[3] : 'a';
        slots = [];
        (m && m[4] || '').split('').forEach(function (c, i) {
            var n = c == '.' ? null : parseInt(c, 36);
            slots[i] = n != null && SPECS[n] && classOk(SPECS[n][0]) ? n : null;
        });
        names = {};
        (parts[1] || '').split('|').forEach(function (p) {
            var kv = p.split('=');
            if (kv.length == 2 && +kv[0] >= 0) try { names[+kv[0]] = decodeURIComponent(kv[1]).substr(0, 24); } catch (e) {}
        });
        return true;
    }

    // ── drawing ──
    function members() {
        return slots.slice(0, size).filter(function (i) { return i != null; }).map(function (i) { return SPECS[i]; });
    }

    function render() {
        var mem = members(), E = EXPANSIONS[exp], html = '<div class="rc-bar">';

        html += '<span class="rc-seg rc-exp">' + Object.keys(EXPANSIONS).map(function (k) {
            return '<a href="javascript:;" data-exp="' + k + '"' + (exp == k ? ' class="on"' : '') + '>' + esc(EXPANSIONS[k].name) + '</a>';
        }).join('') + '</span>';
        html += '<span class="rc-seg rc-size">' + E.sizes.slice().sort(function (a, b) { return a - b; }).map(function (n) {
            return '<a href="javascript:;" data-size="' + n + '"' + (size == n ? ' class="on"' : '') + '>' + n + ' players</a>';
        }).join('') + '</span>';
        if (E.factions)
            html += '<span class="rc-seg rc-fac"><a href="javascript:;" data-fac="a"' + (faction == 'a' ? ' class="on"' : '') + '>Alliance</a><a href="javascript:;" data-fac="h"' + (faction == 'h' ? ' class="on"' : '') + '>Horde</a></span>';
        html += '<span class="rc-roles">' + Object.keys(ROLES).map(function (r) {
            return '<span class="rc-role">' + ROLES[r] + ' <b>' + mem.filter(function (s) { return s[4] == r; }).length + '</b></span>';
        }).join('') + '<span class="rc-role">Players <b>' + mem.length + ' / ' + size + '</b></span></span>'
            + '<span class="rc-actions"><label class="rc-check"><input type="checkbox" class="rc-rename"' + (renameMode ? ' checked' : '') + ' /> Double-click renames</label>'
            + '<a href="javascript:;" class="tc-nav-btn rc-clear">Clear</a><a href="javascript:;" class="tc-nav-btn rc-copy">Copy Link</a></span></div>';

        // palette: Melee | Ranged | Hybrid, each class with its specs
        html += '<div class="rc-palette">' + PALETTE.map(function (col) {
            return '<div class="rc-pcol"><div class="rc-phead">' + col[0] + '</div>' + col[1].filter(classOk).map(function (c) {
                return '<div class="rc-pclass"><span class="rc-pname c' + c + '"><img src="' + classIcon(c) + '" alt="" />' + esc(g_chr_classes[c]) + '</span><span class="rc-pspecs">'
                    + SPECS.map(function (s, i) { return s[0] == c ? i : -1; }).filter(function (i) { return i >= 0; }).map(function (i) {
                        var s = SPECS[i];
                        return '<a href="javascript:;" class="rc-add" draggable="true" data-spec="' + i + '"><img src="' + specIcon(s) + '" alt="" /><span>' + esc(s[2]) + '</span></a>';
                    }).join('') + '</span></div>';
            }).join('') + '</div>';
        }).join('') + '</div>';

        // groups: up to 5 per row; 8 groups as two rows of 4
        var groups = size / 5, perRow = groups > 5 ? 4 : groups;
        html += '<div class="rc-groups" style="grid-template-columns: repeat(' + perRow + ', minmax(0, 1fr))">';
        for (var g = 0; g < groups; g++) {
            html += '<div class="rc-group"><div class="rc-ghead">Group ' + (g + 1) + '</div>';
            for (var k = 0; k < 5; k++) {
                var idx = g * 5 + k, s = slots[idx] != null ? SPECS[slots[idx]] : null;
                html += '<div class="rc-line"><span class="rc-num">' + (k + 1) + '</span>' + (s
                    ? '<div class="rc-slot full" draggable="true" data-slot="' + idx + '"><img src="' + classIcon(s[0], 'medium') + '" alt="" />'
                      + '<span class="rc-who"><b class="c' + s[0] + '">' + esc(names[idx] || g_chr_classes[s[0]]) + '</b><i>' + esc(s[2]) + (names[idx] ? ' ' + esc(g_chr_classes[s[0]]) : '') + '</i></span>'
                      + '<span class="rc-rolename rc-r' + s[4] + '">' + ROLE_NAME[s[4]] + '</span><a href="javascript:;" class="rc-del" title="Remove">&times;</a></div>'
                    : '<div class="rc-slot empty" data-slot="' + idx + '">Empty</div>') + '</div>';
            }
            html += '</div>';
        }
        html += '</div>';

        // buffs and debuffs below
        var D = DATA[exp];
        html += '<div class="rc-lists">' + list('Buffs', D.buffs, mem) + list('Debuffs', D.debuffs, mem) + '</div>';

        el.innerHTML = html;
        bind(mem);
    }

    function list(title, defs, mem) {
        var have = 0, rows = defs.map(function (d, i) {
            var avail = d[1].filter(function (p) { return classOk(p[0]); });
            var got = avail.filter(function (p) { return mem.some(function (m) { return provides(m, p); }); });
            if (got.length) have++;
            return '<div class="rc-buff' + (got.length ? ' on' : '') + (avail.length ? '' : ' na') + '" data-def="' + title + ':' + i + '">'
                 + '<span class="rc-check">' + (got.length ? '&#10003;' : '') + '</span><span class="rc-bname">' + esc(d[0]) + '</span>'
                 + '<span class="rc-bsrc">' + avail.map(function (p) {
                     return '<img src="' + classIcon(p[0]) + '" class="' + (got.indexOf(p) != -1 ? 'on' : '') + '" alt="" />';
                 }).join('') + '</span></div>';
        });
        return '<div class="rc-list"><div class="rc-lhead">' + title + ' <span>' + have + ' / ' + defs.length + '</span></div><div class="rc-lgrid">' + rows.join('') + '</div></div>';
    }

    // what a spec brings, for its tooltip
    function specTip(s) {
        var D = DATA[exp], out = [];
        [['Buffs', D.buffs], ['Debuffs', D.debuffs]].forEach(function (L) {
            L[1].forEach(function (d) {
                d[1].forEach(function (p) { if (provides(s, p)) out.push('<span class="q2">' + esc(p[2]) + '</span> <span class="q0">(' + esc(d[0]) + ')</span>'); });
            });
        });
        return '<b class="c' + s[0] + '">' + esc(specLabel(s)) + '</b><br /><span class="q0">' + ROLE_NAME[s[4]] + '</span>' + (out.length ? '<br />' + out.join('<br />') : '<br /><span class="q0">No raid buffs or debuffs</span>');
    }

    function place(i, spec) { slots[i] = spec; save(); render(); }

    function bind(mem) {
        var $$ = function (s) { return el.querySelectorAll(s); };
        $$('.rc-exp a').forEach(function (a) {
            a.onclick = function () {
                exp = a.getAttribute('data-exp');
                if (EXPANSIONS[exp].sizes.indexOf(size) == -1) size = EXPANSIONS[exp].sizes[0];
                slots = slots.map(function (i) { return i != null && classOk(SPECS[i][0]) ? i : null; });
                save(); render();
            };
        });
        $$('.rc-size a').forEach(function (a) { a.onclick = function () { size = +a.getAttribute('data-size'); save(); render(); }; });
        $$('.rc-fac a').forEach(function (a) {
            a.onclick = function () {
                faction = a.getAttribute('data-fac');
                slots = slots.map(function (i) { return i != null && classOk(SPECS[i][0]) ? i : null; });
                save(); render();
            };
        });
        el.querySelector('.rc-rename').onchange = function () { renameMode = this.checked; };
        el.querySelector('.rc-clear').onclick = function () { slots = []; names = {}; save(); render(); };
        el.querySelector('.rc-copy').onclick = function () {
            var b = this;
            if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(function () { b.textContent = 'Copied!'; setTimeout(function () { b.textContent = 'Copy Link'; }, 1500); });
            else prompt('Copy this link:', location.href);
        };

        // palette: click fills the next free slot, drag onto a slot
        $$('.rc-add').forEach(function (a) {
            var spec = +a.getAttribute('data-spec');
            a.onclick = function () {
                for (var i = 0; i < size; i++)
                    if (slots[i] == null) { place(i, spec); return; }
            };
            a.ondragstart = function (e) { e.dataTransfer.setData('text/plain', 's' + spec); e.dataTransfer.effectAllowed = 'copyMove'; $WH.Tooltip.hide(); };
            a.onmouseover = function () { $WH.Tooltip.show(a, specTip(SPECS[spec])); };
            a.onmouseout = $WH.Tooltip.hide;
        });

        // slots: drop a spec or another member (swap), double-click removes or renames
        $$('.rc-slot').forEach(function (d) {
            var idx = +d.getAttribute('data-slot');
            d.ondragover = function (e) { e.preventDefault(); d.classList.add('over'); };
            d.ondragleave = function () { d.classList.remove('over'); };
            d.ondrop = function (e) {
                e.preventDefault();
                var v = e.dataTransfer.getData('text/plain') || '';
                if (v[0] == 's') place(idx, +v.substr(1));
                else if (v[0] == 'm') {
                    var from = +v.substr(1);
                    if (from == idx) return render();
                    var t = slots[idx], n = names[idx];
                    slots[idx] = slots[from]; slots[from] = t == null ? null : t;
                    names[idx] = names[from]; names[from] = n;
                    if (!names[idx]) delete names[idx];
                    if (!names[from]) delete names[from];
                    save(); render();
                }
            };
            if (!d.classList.contains('full')) return;
            var s = SPECS[slots[idx]];
            d.ondragstart = function (e) { e.dataTransfer.setData('text/plain', 'm' + idx); e.dataTransfer.effectAllowed = 'move'; $WH.Tooltip.hide(); };
            d.onmouseover = function () { $WH.Tooltip.show(d, (names[idx] ? '<b>' + esc(names[idx]) + '</b><br />' : '') + specTip(s)); };
            d.onmouseout = $WH.Tooltip.hide;
            d.ondblclick = function () {
                $WH.Tooltip.hide();
                if (renameMode) {
                    var n = prompt('Name for this player (empty: the class name):', names[idx] || '');
                    if (n === null) return;
                    n = n.trim().substr(0, 24);
                    if (n) names[idx] = n; else delete names[idx];
                    save(); render();
                }
                else { slots[idx] = null; delete names[idx]; save(); render(); }
            };
            d.querySelector('.rc-del').onclick = function (e) { e.stopPropagation(); $WH.Tooltip.hide(); slots[idx] = null; delete names[idx]; save(); render(); };
        });

        // dropping a member back on the palette takes it out
        var pal = el.querySelector('.rc-palette');
        pal.ondragover = function (e) { if ((e.dataTransfer.types || []).length) e.preventDefault(); };
        pal.ondrop = function (e) {
            var v = e.dataTransfer.getData('text/plain') || '';
            if (v[0] == 'm') { e.preventDefault(); var i = +v.substr(1); slots[i] = null; delete names[i]; save(); render(); }
        };

        el.querySelectorAll('.rc-buff').forEach(function (r) {
            var p = r.getAttribute('data-def').split(':'), d = DATA[exp][p[0] == 'Buffs' ? 'buffs' : 'debuffs'][+p[1]];
            r.onmouseover = function () {
                $WH.Tooltip.show(r, '<b>' + esc(d[0]) + '</b>' + d[1].filter(function (src) { return classOk(src[0]); }).map(function (src) {
                    var on = mem.some(function (m) { return provides(m, src); }), who = SPECS.filter(function (s) { return provides(s, src); });
                    return '<br /><span class="' + (on ? 'q2' : 'q0') + '">' + esc(src[2]) + '</span> <span class="c' + src[0] + '">' + esc(src[1] ? who.map(specLabel).join(', ') : g_chr_classes[src[0]]) + '</span>';
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
