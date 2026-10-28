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
        [11, 'balance', 'Balance',       1, 'R'], [11, 'feral',   'Feral Combat',  2, 'M'], [11, 'resto',  'Restoration',   3, 'H']
    ];
    // spec icons, same order as SPECS
    var SPEC_ICON = [
        'ability_warrior_savageblow', 'ability_warrior_innerrage', 'ability_warrior_defensivestance',
        'spell_holy_holybolt', 'spell_holy_devotionaura', 'spell_holy_auraoflight',
        'ability_hunter_beasttaming', 'ability_marksmanship', 'ability_hunter_swiftstrike',
        'ability_rogue_eviscerate', 'ability_backstab', 'ability_stealth',
        'spell_holy_wordfortitude', 'spell_holy_guardianspirit', 'spell_shadow_shadowwordpain',
        'spell_deathknight_bloodpresence', 'spell_deathknight_frostpresence', 'spell_deathknight_unholypresence',
        'spell_nature_lightning', 'spell_nature_lightningshield', 'spell_nature_magicimmunity',
        'spell_holy_magicalsentry', 'spell_fire_firebolt02', 'spell_frost_frostbolt02',
        'spell_shadow_deathcoil', 'spell_shadow_metamorphosis', 'spell_shadow_rainoffire',
        'spell_nature_starfall', 'ability_racial_bearform', 'spell_nature_healingtouch'
    ];
    // class colours as r,g,b for the tinted palette cards
    var CLASS_RGB = { 1: '199,156,110', 2: '245,140,186', 3: '171,212,115', 4: '255,245,105', 5: '255,255,255', 6: '196,31,59', 7: '0,112,222', 8: '105,204,240', 9: '148,130,201', 11: '255,125,10' };
    // palette layouts: r = rows with names, s = squares with spec icons
    var LAYOUTS = { r: 'Rows with names', s: 'Squares with Specs' };
    // effects that only reach the caster's own group: name, spell, icon, [[class, spec key or '']]
    var GROUP_ONLY = [
        ['Vampiric Embrace', 15286, 'spell_shadow_unsummonbuilding',   [[5, 'shadow']]],
        ['Mana Tide Totem',  16190, 'spell_frost_summonwaterelemental', [[7, 'resto']]],
        ['Tranquility',      48447, 'spell_nature_tranquility',         [[11, '']]]
    ];
    // raid utility and cooldown spells: name, spell, icon, [[class, spec key or '']], expansions that have it
    var SPELLS = [
        ['Rebirth',                48477, 'spell_nature_reincarnation',       [[11, '']],      'vtw'],
        ['Raise Ally',             61999, 'spell_shadow_deadofnight',         [[6, '']],       'w'],
        ['Soulstone Resurrection', 47883, 'spell_shadow_soulgem',             [[9, '']],       'vtw'],
        ['Innervate',              29166, 'spell_nature_lightning',           [[11, '']],      'vtw'],
        ['Hymn of Hope',           64901, 'spell_holy_symbolofhope',          [[5, '']],       'w'],
        ['Divine Hymn',            64843, 'spell_holy_divinehymn',            [[5, '']],       'w'],
        ['Power Infusion',         10060, 'spell_holy_powerinfusion',         [[5, 'disc']],   'vtw'],
        ['Pain Suppression',       33206, 'spell_holy_painsupression',        [[5, 'disc']],   'tw'],
        ['Guardian Spirit',        47788, 'spell_holy_guardianspirit',        [[5, 'holy']],   'w'],
        ['Mass Dispel',            32375, 'spell_arcane_massdispel',          [[5, '']],       'tw'],
        ['Hand of Sacrifice',       6940, 'spell_holy_sealofsacrifice',       [[2, '']],       'w'],
        ['Hand of Protection',     10278, 'spell_holy_sealofprotection',      [[2, '']],       'w'],
        ['Divine Sacrifice',       64205, 'spell_holy_powerwordbarrier',      [[2, 'prot']],   'w'],
        ['Aura Mastery',           31821, 'spell_holy_auramastery',           [[2, 'holy']],   'w'],
        ['Lay on Hands',           48788, 'spell_holy_layonhands',            [[2, '']],       'vtw'],
        ['Anti-Magic Zone',        51052, 'spell_deathknight_antimagiczone',  [[6, 'unholy']], 'w'],
        ['Misdirection',           34477, 'ability_hunter_misdirection',      [[3, '']],       'tw'],
        ['Tricks of the Trade',    57934, 'ability_rogue_tricksofthetrade',   [[4, '']],       'w'],
        ['Shattering Throw',       64382, 'ability_warrior_shatteringthrow',  [[1, '']],       'w'],
        ['Ritual of Summoning',      698, 'spell_shadow_twilight',            [[9, '']],       'vtw']
    ];
    var BENCH_AT = 40, BENCH = 25;                  // bench slots live at 40..64
    var ICON_EDIT = '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M11.7 1.3a1 1 0 0 1 1.4 0l1.6 1.6a1 1 0 0 1 0 1.4L5.4 13.6 1.5 14.5l.9-3.9zM3.6 11.2l-.4 1.6 1.6-.4 7.6-7.6-1.2-1.2z"/></svg>';
    var ICON_DEL  = '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M3.3 2.3 8 7l4.7-4.7 1 1L9 8l4.7 4.7-1 1L8 9l-4.7 4.7-1-1L7 8 2.3 3.3z"/></svg>';
    var ROLE_NAME = { T: 'Tank', H: 'Healer', M: 'DPS (Melee)', R: 'DPS (Ranged)' };
    var SLOT_ROLE = { T: 'Tank', H: 'Healer', M: 'Melee', R: 'Ranged' };
    var ROLES = { T: 'Tanks', H: 'Healers', M: 'Melee DPS', R: 'Ranged DPS' };
    // palette: one row per class, in class order
    var PALETTE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11];

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
                ['+5% Melee & ranged crit',    [[11, 'feral', 'Leader of the Pack'], [1, 'fury', 'Rampage']]],
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
                ['+30% Bleed damage taken',    [[11, 'feral', 'Mangle'], [1, 'arms', 'Trauma']]],
                ['+3% Crit taken',             [[2, 'ret', 'Heart of the Crusader'], [4, 'assa', 'Master Poisoner'], [7, 'ele', 'Totem of Wrath']]],
                ['+13% Spell damage taken',    [[6, 'unholy', 'Ebon Plaguebringer'], [11, 'balance', 'Earth and Moon'], [9, '', 'Curse of the Elements']]],
                ['+3% Spell hit taken',        [[11, 'balance', 'Improved Faerie Fire'], [5, 'shadow', 'Misery']]],
                ['+5% Spell crit taken',       [[8, 'fire', 'Improved Scorch'], [8, 'frost', "Winter's Chill"], [9, 'destro', 'Improved Shadow Bolt']]],
                ['-20% Attack speed',          [[1, '', 'Thunder Clap'], [6, '', 'Frost Fever'], [2, 'prot', 'Judgements of the Just'], [11, 'feral', 'Infected Wounds']]],
                ['-Attack power',              [[1, '', 'Demoralizing Shout'], [11, 'feral', 'Demoralizing Roar'], [9, '', 'Curse of Weakness'], [2, 'prot', 'Vindication']]],
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
                ['+5% Melee & ranged crit',    [[11, 'feral', 'Leader of the Pack']]],
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
                ['+30% Bleed damage taken',    [[11, 'feral', 'Mangle']]],
                ['+3% Crit taken',             [[2, 'ret', 'Improved Seal of the Crusader']]],
                ['+5% Spell damage taken',     [[5, 'shadow', 'Misery']]],
                ['+10% Shadow damage taken',   [[5, 'shadow', 'Shadow Weaving']]],
                ['+10% Spell damage taken',    [[9, '', 'Curse of the Elements']]],
                ['Fire crit taken',            [[8, 'fire', 'Improved Scorch']]],
                ['Frost crit taken',           [[8, 'frost', "Winter's Chill"]]],
                ['Shadow damage taken',        [[9, 'destro', 'Improved Shadow Bolt']]],
                ['-Attack speed',              [[1, '', 'Thunder Clap']]],
                ['-Attack power',              [[1, '', 'Demoralizing Shout'], [11, 'feral', 'Demoralizing Roar']]],
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
                ['+3% Melee & ranged crit',    [[11, 'feral', 'Leader of the Pack']]],
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
                ['-Attack power',              [[1, '', 'Demoralizing Shout'], [11, 'feral', 'Demoralizing Roar']]],
                ['-50% Healing received',      [[1, 'arms', 'Mortal Strike'], [4, '', 'Wound Poison'], [3, 'mm', 'Aimed Shot']]],
                ['Mana on hit',                [[2, '', 'Judgement of Wisdom']]],
                ['Health on hit',              [[2, '', 'Judgement of Light']]]
            ]
        }
    };

    var el, exp = 'w', size = 25, faction = 'a', layout = 'r', slots = [], names = {}, hash = '', askDelete = false, benchOpen = false;

    function esc(t) {
        return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    }
    function specIcon(s, size) { return g_staticUrl + '/images/wow/icons/' + (size || 'medium') + '/' + SPEC_ICON[SPECS.indexOf(s)] + '.jpg'; }
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
        var bench = slots.slice(BENCH_AT, BENCH_AT + BENCH).map(function (i) { return i == null ? '.' : i.toString(36); }).join('').replace(/\.+$/, '');
        var nm = Object.keys(names).filter(function (k) { return names[k] && (k < size || (k >= BENCH_AT && k < BENCH_AT + BENCH)); }).map(function (k) { return k + '=' + encodeURIComponent(names[k]); }).join('|');
        hash = exp + size + (EXPANSIONS[exp].factions ? faction : '') + (layout == 's' ? 's' : '') + (code ? '-' + code : '') + (bench ? '+' + bench : '') + (nm ? '~' + nm : '');
        location.replace('#' + hash);
    }

    function load() {
        var h = location.hash.substr(1);
        if (h == hash) return false;
        hash = h;
        var parts = h.split('~'), m = /^([vtw]?)(\d+)([ah]?)(s?)(?:-([0-9a-z.]*))?(?:\+([0-9a-z.]*))?$/.exec(parts[0]);
        exp = m && m[1] ? m[1] : 'w';
        size = m && EXPANSIONS[exp].sizes.indexOf(+m[2]) != -1 ? +m[2] : EXPANSIONS[exp].sizes[0];
        faction = m && m[3] ? m[3] : 'a';
        layout  = m && m[4] ? 's' : 'r';
        slots = [];
        (m && m[5] || '').split('').forEach(function (c, i) {
            var n = c == '.' ? null : parseInt(c, 36);
            slots[i] = n != null && SPECS[n] && classOk(SPECS[n][0]) ? n : null;
        });
        (m && m[6] || '').substr(0, BENCH).split('').forEach(function (c, i) {
            var n = c == '.' ? null : parseInt(c, 36);
            slots[BENCH_AT + i] = n != null && SPECS[n] && classOk(SPECS[n][0]) ? n : null;
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
            return '<a href="javascript:;" data-exp="' + k + '" class="rc-exp-' + k + (exp == k ? ' on' : '') + '">' + esc(EXPANSIONS[k].name) + '</a>';
        }).join('') + '</span>';
        html += '<span class="rc-seg rc-size">' + E.sizes.slice().sort(function (a, b) { return a - b; }).map(function (n) {
            return '<a href="javascript:;" data-size="' + n + '"' + (size == n ? ' class="on"' : '') + '>' + n + ' players</a>';
        }).join('') + '</span>';
        if (E.factions)
            html += '<span class="rc-seg rc-fac"><a href="javascript:;" data-fac="a"' + (faction == 'a' ? ' class="on"' : '') + '>Alliance</a><a href="javascript:;" data-fac="h"' + (faction == 'h' ? ' class="on"' : '') + '>Horde</a></span>';
        html += '<span class="rc-ltype"><span class="q0">Selector Type</span><span class="rc-seg rc-lay">' + Object.keys(LAYOUTS).map(function (k) {
            return '<a href="javascript:;" data-lay="' + k + '"' + (layout == k ? ' class="on"' : '') + '>' + LAYOUTS[k] + '</a>';
        }).join('') + '</span></span>';
        html += '<span class="rc-actions"><label class="rc-opt"><input type="checkbox" class="rc-ask"' + (askDelete ? ' checked' : '') + ' /> Ask before deleting</label>'
            + '<a href="javascript:;" class="tc-nav-btn rc-clear" data-clear="all">Clear All</a><a href="javascript:;" class="tc-nav-btn rc-clear" data-clear="raid">Clear Active Groups</a><a href="javascript:;" class="tc-nav-btn rc-clear" data-clear="bench">Clear Bench Groups</a><a href="javascript:;" class="tc-nav-btn rc-copy">Copy Link</a></span>' + summary(mem) + '</div>';

        // palette: a card per class (5 per row) with its three specs; hovering a spec shows its role
        html += '<div class="rc-palette rc-lay-' + layout + '" style="grid-template-columns: repeat(' + (exp == 'v' ? 4 : 5) + ', minmax(0, 1fr))">' + PALETTE.filter(classOk).map(function (c) {
            return '<div class="rc-pclass" style="--cc: ' + CLASS_RGB[c] + '">'
                + (layout == 'r' ? '<span class="rc-pname c' + c + '"><img src="' + classIcon(c, 'medium') + '" alt="" />' + esc(g_chr_classes[c]) + '</span>' : '')
                + '<span class="rc-pspecs">'
                + SPECS.map(function (s, i) { return s[0] == c ? i : -1; }).filter(function (i) { return i >= 0; }).map(function (i) {
                    var s = SPECS[i];
                    return '<a href="javascript:;" class="rc-add" draggable="true" data-spec="' + i + '"><img src="' + specIcon(s, layout == 's' ? 'large' : 'medium') + '" alt="" />' + (layout == 'r' ? '<span>' + esc(s[2]) + '</span>' : '') + '</a>';
                }).join('') + '</span></div>';
        }).join('') + '</div>';

        // groups: up to 5 per row; 8 groups as two rows of 4
        var groups = size / 5, perRow = groups > 5 ? 4 : groups;
        html += '<div class="rc-groups" style="grid-template-columns: repeat(' + perRow + ', minmax(0, 1fr))">';
        for (var g = 0; g < groups; g++) {
            html += '<div class="rc-group"><div class="rc-ghead">Group ' + (g + 1) + '</div>';
            for (var k = 0; k < 5; k++)
                html += slotLine(g * 5 + k, g * 5 + k + 1);
            html += groupOnly(g) + '</div>';
        }
        html += '</div>';

        // bench: one more row of five, folded away unless opened
        var benched = slots.slice(BENCH_AT, BENCH_AT + BENCH).filter(function (i) { return i != null; }).length;
        html += '<div class="rc-bench' + (benchOpen ? ' open' : '') + '"><a href="javascript:;" class="rc-btoggle">' + (benchOpen ? 'Hide bench' : 'Show bench') + (benched ? ' (' + benched + ')' : '') + '</a>';
        if (benchOpen) {
            html += '<div class="rc-groups" style="grid-template-columns: repeat(5, minmax(0, 1fr))">';
            for (var b = 0; b < BENCH / 5; b++) {
                html += '<div class="rc-group"><div class="rc-ghead">Bench</div>';
                for (var k = 0; k < 5; k++)
                    html += slotLine(BENCH_AT + b * 5 + k, b * 5 + k + 1);
                html += '</div>';
            }
            html += '</div>';
        }
        html += '</div>';

        html += summary(mem);

        // buffs and debuffs below
        var D = DATA[exp];
        html += '<div class="rc-lists"><div class="rc-lcol">' + list('Buffs', D.buffs, mem) + list('Debuffs', D.debuffs, mem) + '</div>' + spells(mem) + '</div>';

        el.innerHTML = html;
        bind(mem);
    }

    // role counts; the bench is added in brackets: Tanks 2 (+1), Players 20 / 25 (+3)
    function summary(mem) {
        var bench = slots.slice(BENCH_AT, BENCH_AT + BENCH).filter(function (i) { return i != null; }).map(function (i) { return SPECS[i]; });
        var plus = function (n) { return bench.length ? ' <i>(+' + n + ')</i>' : ''; };
        return '<div class="rc-roles">' + Object.keys(ROLES).map(function (r) {
            var f = function (s) { return s[4] == r; };
            return '<span class="rc-role">' + ROLES[r] + ' <b>' + mem.filter(f).length + '</b>' + plus(bench.filter(f).length) + '</span>';
        }).join('') + '<span class="rc-role">Players <b>' + mem.length + ' / ' + size + '</b>' + plus(bench.length) + '</span></div>';
    }

    function slotLine(idx, num) {
        var s = slots[idx] != null ? SPECS[slots[idx]] : null;
        return '<div class="rc-line"><span class="rc-num">' + num + '</span>' + (s
            ? '<div class="rc-slot full" draggable="true" data-slot="' + idx + '"><img src="' + specIcon(s) + '" alt="" />'
              + '<span class="rc-who"><b class="c' + s[0] + '">' + esc(names[idx] || g_chr_classes[s[0]]) + '</b><i>' + esc(s[2]) + (names[idx] ? ' ' + esc(g_chr_classes[s[0]]) : '') + '</i></span>'
              + '<span class="rc-rolename rc-r' + s[4] + '">' + SLOT_ROLE[s[4]] + '</span></div>'
              + '<a href="javascript:;" class="rc-act rc-edit" data-slot="' + idx + '" title="Rename">' + ICON_EDIT + '</a>'
              + '<a href="javascript:;" class="rc-act rc-rm" data-slot="' + idx + '" title="Delete">' + ICON_DEL + '</a>'
            : '<div class="rc-slot empty" data-slot="' + idx + '">Empty</div><span class="rc-act off"></span><span class="rc-act off"></span>') + '</div>';
    }

    // group-only effects present in group g, with how many of its members they reach
    function groupOnly(g) {
        var mem = slots.slice(g * 5, g * 5 + 5).filter(function (i) { return i != null; }).map(function (i) { return SPECS[i]; });
        var out = GROUP_ONLY.filter(function (e) {
            return e[3].some(function (src) { return classOk(src[0]) && mem.some(function (m) { return provides(m, src); }); });
        }).map(function (e) {
            return '<a href="' + g_host.replace(/\/?$/, '/') + '?spell=' + e[1] + '" class="rc-gbuff"><img src="' + g_staticUrl + '/images/wow/icons/small/' + e[2] + '.jpg" alt="" /><b>' + mem.length + '</b></a>';
        });
        return out.length ? '<div class="rc-gbuffs">' + out.join('') + '</div>' : '';
    }

    function remove(idx) {
        $WH.Tooltip.hide();
        var s = SPECS[slots[idx]];
        if (askDelete && !confirm('Remove ' + (names[idx] || specLabel(s)) + '?'))
            return;
        slots[idx] = null; delete names[idx]; save(); render();
    }

    // rename right in the slot: Enter or leaving the field keeps it, Escape cancels
    function rename(idx) {
        $WH.Tooltip.hide();
        var d = el.querySelector('.rc-slot[data-slot="' + idx + '"]'), b = d.querySelector('.rc-who b'), done = false;
        var f = document.createElement('input');
        f.type = 'text'; f.className = 'rc-name'; f.maxLength = 24; f.value = names[idx] || ''; f.placeholder = g_chr_classes[SPECS[slots[idx]][0]];
        b.replaceWith(f);
        d.draggable = false;
        f.focus(); f.select();
        var finish = function (keep) {
            if (done) return;
            done = true;
            if (keep) { var n = f.value.trim().substr(0, 24); if (n) names[idx] = n; else delete names[idx]; save(); }
            render();
        };
        f.onkeydown = function (e) { if (e.key == 'Enter') finish(true); else if (e.key == 'Escape') finish(false); e.stopPropagation(); };
        f.onblur = function () { finish(true); };
        f.onmousedown = f.onclick = f.ondblclick = function (e) { e.stopPropagation(); };
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

    // utility spells: how many in the raid can cast each, with the classes that have it
    function spells(mem) {
        var host = g_host.replace(/\/?$/, '/'), list = SPELLS.filter(function (sp) { return sp[4].indexOf(exp) != -1 && sp[3].some(function (src) { return classOk(src[0]); }); });
        var have = 0, rows = list.map(function (sp) {
            var n = mem.filter(function (m) { return sp[3].some(function (src) { return provides(m, src); }); }).length;
            if (n) have++;
            return '<a href="' + host + '?spell=' + sp[1] + '" class="rc-spell' + (n ? ' on' : '') + '"><img src="' + g_staticUrl + '/images/wow/icons/small/' + sp[2] + '.jpg" alt="" />'
                 + '<span class="rc-bname">' + esc(sp[0]) + '</span><b>' + (n ? n + 'x' : '') + '</b>'
                 + '<span class="rc-bsrc">' + sp[3].map(function (src) { return '<img src="' + classIcon(src[0]) + '" class="' + (n ? 'on' : '') + '" alt="" />'; }).join('') + '</span></a>';
        });
        return '<div class="rc-list"><div class="rc-lhead">Spells <span>' + have + ' / ' + list.length + '</span></div>' + rows.join('') + '</div>';
    }

    // what a spec brings, for its tooltip
    function specTip(s) {
        // yellow section header, then "<count>x <buff>" lines in white
        var D = DATA[exp], out = '';
        [['Buffs', D.buffs], ['Debuffs', D.debuffs]].forEach(function (L) {
            var lines = L[1].map(function (d) {
                var n = d[1].filter(function (p) { return provides(s, p); }).length;
                return n ? '<span class="q1">' + n + 'x ' + esc(d[0]) + '</span>' : '';
            }).filter(Boolean);
            if (lines.length)
                out += '<div class="q" style="margin-top: 8px">' + L[0] + '</div>' + lines.join('<br />');
        });
        return '<b class="c' + s[0] + '">' + esc(specLabel(s)) + '</b><br /><span class="q0">' + ROLE_NAME[s[4]] + '</span>' + (out || '<div class="q0" style="margin-top: 8px">No raid buffs or debuffs</div>');
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
        $$('.rc-lay a').forEach(function (a) { a.onclick = function () { layout = a.getAttribute('data-lay'); save(); render(); }; });
        $$('.rc-size a').forEach(function (a) { a.onclick = function () { size = +a.getAttribute('data-size'); save(); render(); }; });
        $$('.rc-fac a').forEach(function (a) {
            a.onclick = function () {
                faction = a.getAttribute('data-fac');
                slots = slots.map(function (i) { return i != null && classOk(SPECS[i][0]) ? i : null; });
                save(); render();
            };
        });
        el.querySelector('.rc-ask').onchange = function () { askDelete = this.checked; try { localStorage.setItem('aowow_rc_ask', askDelete ? '1' : ''); } catch (e) {} };
        el.querySelector('.rc-btoggle').onclick = function () { benchOpen = !benchOpen; try { localStorage.setItem('aowow_rc_bench', benchOpen ? '1' : ''); } catch (e) {} render(); };
        $$('.rc-edit').forEach(function (a) { a.onclick = function () { rename(+a.getAttribute('data-slot')); }; });
        $$('.rc-rm').forEach(function (a) { a.onclick = function () { remove(+a.getAttribute('data-slot')); }; });
        // clear everything, only the raid groups or only the bench
        $$('.rc-clear').forEach(function (a) {
            a.onclick = function () {
                var what = a.getAttribute('data-clear'), from = what == 'bench' ? BENCH_AT : 0, to = what == 'raid' ? BENCH_AT : BENCH_AT + BENCH;
                if (askDelete && !confirm(a.textContent + '?'))
                    return;
                for (var i = from; i < to; i++) { slots[i] = null; delete names[i]; }
                save(); render();
            };
        });
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

        // slots: drop a spec or another member (swap)
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
            try { askDelete = !!localStorage.getItem('aowow_rc_ask'); benchOpen = !!localStorage.getItem('aowow_rc_bench'); } catch (e) {}
            load();
            render();
            if (!location.hash) save();
            setInterval(function () { if (load()) render(); }, 1000);
        }
    };
})();
