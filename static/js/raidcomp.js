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
    var ICON_PAW  = '<svg viewBox="0 0 16 16" width="11" height="11"><path fill="currentColor" d="M8 8.5c2.2 0 4.5 2.6 4.5 4.3 0 1.4-1.6 1.7-2.4 1.2C9.5 13.6 8.8 13.3 8 13.3s-1.5.3-2.1.7c-.8.5-2.4.2-2.4-1.2C3.5 11.1 5.8 8.5 8 8.5zM3 4.8c.9-.3 2 .5 2.3 1.7.3 1.2-.1 2.3-1 2.6-.9.3-2-.5-2.3-1.7-.3-1.2.1-2.3 1-2.6zm10 0c.9.3 1.3 1.4 1 2.6-.3 1.2-1.4 2-2.3 1.7-.9-.3-1.3-1.4-1-2.6.3-1.2 1.4-2 2.3-1.7zM6 1c1 0 1.8 1.1 1.8 2.5S7 6 6 6s-1.8-1.1-1.8-2.5S5 1 6 1zm4 0c1 0 1.8 1.1 1.8 2.5S11 6 10 6s-1.8-1.1-1.8-2.5S9 1 10 1z"/></svg>';
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
    // spell, icon and kind (t talent, p pet) per ability name, for the Spells tab and tooltips
    var SPELL_INFO = {
        "Abomination's Might": [53138, 'ability_warrior_intensifyrage', 't'],
        'Acid Spit': [55754, 'spell_nature_acid_01', 'p'],
        'Ancestral Healing': [16240, 'spell_nature_undyingstrength', 't'],
        'Anti-Magic Zone': [51052, 'spell_deathknight_antimagiczone', 't'],
        'Arcane Brilliance': [43002, 'spell_holy_arcaneintellect', ''],
        'Arcane Empowerment': [31583, 'spell_nature_starfall', 't'],
        'Aura Mastery': [31821, 'spell_holy_auramastery', 't'],
        'Battle Shout': [47436, 'ability_warrior_battleshout', ''],
        'Blessing of Kings': [20217, 'spell_magic_magearmor', ''],
        'Blessing of Sanctuary': [20911, 'spell_nature_lightningshield', 't'],
        'Blood Frenzy': [29859, 'ability_warrior_bloodfrenzy', 't'],
        'Blood Pact': [47982, 'spell_shadow_bloodboil', 'p'],
        'Bloodlust': [2825, 'spell_nature_bloodlust', ''],
        'Commanding Shout': [47440, 'ability_warrior_rallyingcry', ''],
        'Curse of Weakness': [50511, 'spell_shadow_curseofmannoroth', ''],
        'Curse of the Elements': [47865, 'spell_shadow_chilltouch', ''],
        'Demonic Pact': [47240, 'spell_shadow_demonicpact', 't'],
        'Demoralizing Roar': [48560, 'ability_druid_demoralizingroar', ''],
        'Demoralizing Shout': [47437, 'ability_warrior_warcry', ''],
        'Divine Guardian': [53530, 'spell_holy_powerwordbarrier', 't'],
        'Divine Hymn': [64843, 'spell_holy_divinehymn', ''],
        'Divine Sacrifice': [64205, 'spell_holy_powerwordbarrier', 't'],
        'Earth and Moon': [48511, 'ability_druid_earthandsky', 't'],
        'Ebon Plaguebringer': [51161, 'ability_creature_cursed_03', 't'],
        'Elemental Oath': [51470, 'spell_shaman_elementaloath', 't'],
        'Enduring Winter': [44561, 'spell_frost_summonwaterelemental_2', 't'],
        'Expose Armor': [8647, 'ability_warrior_riposte', ''],
        'Faerie Fire': [770, 'spell_nature_faeriefire', ''],
        'Fel Intelligence': [57567, 'spell_shadow_brainwash', 'p'],
        'Ferocious Inspiration': [34460, 'ability_hunter_ferociousinspiration', 't'],
        'Flametongue Totem': [58656, 'spell_nature_guardianward', ''],
        'Focus Magic': [54646, 'spell_arcane_studentofmagic', 't'],
        'Gift of the Wild': [48470, 'spell_nature_giftofthewild', ''],
        'Greater Blessing of Might': [48934, 'spell_holy_greaterblessingofkings', ''],
        'Greater Blessing of Wisdom': [48938, 'spell_holy_greaterblessingofwisdom', ''],
        'Guardian Spirit': [47788, 'spell_holy_guardianspirit', 't'],
        'Hand of Protection': [10278, 'spell_holy_sealofprotection', ''],
        'Hand of Sacrifice': [6940, 'spell_holy_sealofsacrifice', ''],
        'Healing Stream Totem': [58757, 'inv_spear_04', ''],
        'Heart of the Crusader': [20337, 'spell_holy_holysmite', 't'],
        'Heroism': [32182, 'ability_shaman_heroism', ''],
        'Horn of Winter': [57623, 'inv_misc_horn_02', ''],
        'Hunting Party': [53292, 'ability_hunter_huntingparty', 't'],
        'Hymn of Hope': [64901, 'spell_holy_symbolofhope', ''],
        'Hysteria': [49016, 'spell_deathknight_bladedarmor', 't'],
        'Improved Devotion Aura': [20140, 'spell_holy_devotionaura', 't'],
        'Improved Faerie Fire': [33602, 'spell_nature_faeriefire', 't'],
        'Improved Icy Talons': [55610, 'spell_deathknight_icytalons', 't'],
        'Improved Icy Touch': [51456, 'spell_deathknight_icetouch', 't'],
        'Improved Leader of the Pack': [34300, 'spell_nature_unyeildingstamina', 't'],
        'Improved Moonkin Form': [48396, 'ability_druid_improvedmoonkinform', 't'],
        'Improved Scorch': [12873, 'spell_fire_soulburn', 't'],
        'Improved Shadow Bolt': [17803, 'spell_shadow_shadowbolt', 't'],
        'Improved Soul Leech': [54118, 'ability_warlock_improvedsoulleech', 't'],
        'Improved Thunder Clap': [12666, 'ability_thunderclap', 't'],
        'Improved Windfury Totem': [29193, 'spell_nature_windfury', 't'],
        'Infected Wounds': [48485, 'ability_druid_infectedwound', 't'],
        'Innervate': [29166, 'spell_nature_lightning', ''],
        'Insect Swarm': [48468, 'spell_nature_insectswarm', 't'],
        'Inspiration': [15363, 'spell_holy_layonhands', 't'],
        'Judgement of Light': [20271, 'spell_holy_righteousfury', ''],
        'Judgement of Wisdom': [53408, 'ability_paladin_judgementblue', ''],
        'Judgements of the Just': [53696, 'ability_paladin_judgementsofthejust', 't'],
        'Judgements of the Wise': [31878, 'ability_paladin_judgementofthewise', 't'],
        'Lay on Hands': [48788, 'spell_holy_layonhands', ''],
        'Leader of the Pack': [17007, 'spell_nature_unyeildingstamina', 't'],
        'Mana Spring Totem': [58774, 'spell_nature_manaregentotem', ''],
        'Mana Tide Totem': [16190, 'spell_frost_summonwaterelemental', 't'],
        'Mangle': [33917, 'ability_druid_mangle2', 't'],
        'Mass Dispel': [32375, 'spell_arcane_massdispel', ''],
        'Master Poisoner': [58410, 'ability_creature_poison_06', 't'],
        'Misdirection': [34477, 'ability_hunter_misdirection', ''],
        'Misery': [33193, 'spell_shadow_misery', 't'],
        'Moonkin Form': [24858, 'spell_nature_forceofnature', 't'],
        'Pain Suppression': [33206, 'spell_holy_painsupression', 't'],
        'Power Infusion': [10060, 'spell_holy_powerinfusion', 't'],
        'Prayer of Fortitude': [48162, 'spell_holy_prayeroffortitude', ''],
        'Prayer of Spirit': [48074, 'spell_holy_prayerofspirit', ''],
        'Raise Ally': [61999, 'spell_shadow_deadofnight', ''],
        'Rampage': [29801, 'ability_warrior_rampage', 't'],
        'Rapture': [47537, 'spell_holy_rapture', 't'],
        'Rebirth': [48477, 'spell_nature_reincarnation', ''],
        'Renewed Hope': [57472, 'spell_holy_holyprotection', 't'],
        'Revitalize': [48545, 'ability_druid_replenish', 't'],
        'Ritual of Summoning': [698, 'spell_shadow_twilight', ''],
        'Sanctified Retribution': [31869, 'spell_holy_mindvision', 't'],
        'Savage Combat': [58413, 'ability_creature_disease_03', 't'],
        'Scorpid Sting': [3043, 'ability_hunter_criticalshot', ''],
        'Shattering Throw': [64382, 'ability_warrior_shatteringthrow', ''],
        'Soulstone Resurrection': [47883, 'spell_shadow_soulgem', ''],
        'Sting': [56631, 'spell_nature_slowpoison', 'p'],
        'Strength of Earth Totem': [58643, 'spell_nature_earthbindtotem', ''],
        'Sunder Armor': [7386, 'ability_warrior_sunder', ''],
        'Swift Retribution': [53648, 'ability_paladin_swiftretribution', 't'],
        'Thunder Clap': [47502, 'spell_nature_thunderclap', ''],
        'Totem of Wrath': [57722, 'spell_fire_totemofwrath', 't'],
        'Trauma': [46855, 'ability_warrior_bloodnova', 't'],
        'Tree of Life': [33891, 'ability_druid_treeoflife', 't'],
        'Tricks of the Trade': [57934, 'ability_rogue_tricksofthetrade', ''],
        'Trueshot Aura': [19506, 'ability_trueshot', 't'],
        'Unleashed Rage': [30809, 'spell_nature_unleashedrage', 't'],
        'Vampiric Embrace': [15286, 'spell_shadow_unsummonbuilding', 't'],
        'Vampiric Touch': [48160, 'spell_holy_stoicism', 't'],
        'Vindication': [26016, 'spell_holy_vindication', 't'],
        'Windfury Totem': [8512, 'spell_nature_windfury', ''],
        "Winter's Chill": [28593, 'spell_frost_chillingblast', 't'],
        'Wrath of Air Totem': [3738, 'spell_nature_slowingtotem', '']
    };
    var DATA = {
        w: {
            sections: [
                ['Buffs', [
                    ['Bloodlust / Heroism',        [[7, '', 'Bloodlust'], [7, '', 'Heroism']]],
                    ['Blessing of Kings',          [[2, '', 'Blessing of Kings']]],
                    ['Spell Power',                [[7, '', 'Flametongue Totem'], [7, 'ele', 'Totem of Wrath'], [9, 'demo', 'Demonic Pact']]],
                    ['+3% Haste',                  [[11, 'balance', 'Improved Moonkin Form'], [2, 'ret', 'Swift Retribution']]],
                    ['+5% Spell Haste',            [[7, '', 'Wrath of Air Totem']]],
                    ['+5% Spell Crit',             [[11, 'balance', 'Moonkin Form'], [7, 'ele', 'Elemental Oath']]],
                    ['Attack Power',               [[1, '', 'Battle Shout'], [2, '', 'Greater Blessing of Might']]],
                    ['Gift of the Wild',           [[11, '', 'Gift of the Wild']]],
                    ['+5% Physical Crit',          [[11, 'feral', 'Leader of the Pack'], [1, 'fury', 'Rampage']]],
                    ['+20% Melee Haste',           [[6, 'frost', 'Improved Icy Talons'], [7, '', 'Windfury Totem'], [7, 'enh', 'Improved Windfury Totem']]],
                    ['Health',                     [[1, '', 'Commanding Shout'], [9, '', 'Blood Pact']]],
                    ['Strength and Agility',       [[6, '', 'Horn of Winter'], [7, '', 'Strength of Earth Totem']]],
                    ['+10% Attack Power',          [[6, 'blood', "Abomination's Might"], [3, 'mm', 'Trueshot Aura'], [7, 'enh', 'Unleashed Rage']]],
                    ['+3% Damage',                 [[2, 'ret', 'Sanctified Retribution'], [3, 'bm', 'Ferocious Inspiration'], [8, 'arcane', 'Arcane Empowerment']]],
                    ['Spirit',                     [[5, '', 'Prayer of Spirit'], [9, '', 'Fel Intelligence']]],
                    ['Healing',                    [[11, 'resto', 'Tree of Life'], [2, 'prot', 'Improved Devotion Aura']]],
                    ['Intellect',                  [[8, '', 'Arcane Brilliance'], [9, '', 'Fel Intelligence']]],
                    ['Stamina',                    [[5, '', 'Prayer of Fortitude']]]
                ]],
                ['External Buffs', [
                    ['Power Infusion',             [[5, 'disc', 'Power Infusion']]],
                    ['Hysteria',              [[6, 'blood', 'Hysteria']]],
                    ['Focus Magic',                [[8, 'arcane', 'Focus Magic']]],
                    ['Tricks of the Trade',        [[4, '', 'Tricks of the Trade']]]
                ]],
                ['Damage Reduction', [
                    ['10% Damage Reduction',       [[5, 'disc', 'Inspiration'], [7, 'resto', 'Ancestral Healing']]],
                    ['Reduced Damage Taken',       [[2, 'prot', 'Blessing of Sanctuary'], [5, 'disc', 'Renewed Hope']]],
                    ['Divine Guardian',            [[2, 'prot', 'Divine Guardian']]]
                ]],
                ['Debuffs', [
                    ['5% Armor Reduction',         [[11, '', 'Faerie Fire'], [9, '', 'Curse of Weakness'], [3, '', 'Sting']]],
                    ['20% Attack Speed Reduction', [[1, '', 'Thunder Clap'], [1, 'prot', 'Improved Thunder Clap'], [6, 'frost', 'Improved Icy Touch'], [2, 'prot', 'Judgements of the Just'], [11, 'feral', 'Infected Wounds']]],
                    ['Attack Power Reduction',     [[1, '', 'Demoralizing Shout'], [11, 'feral', 'Demoralizing Roar'], [9, '', 'Curse of Weakness'], [2, 'prot', 'Vindication']]],
                    ['+30% Bleed Damage',          [[11, 'feral', 'Mangle'], [1, 'arms', 'Trauma']]],
                    ['3% Physical Hit Reduction',  [[11, 'balance', 'Insect Swarm'], [3, '', 'Scorpid Sting']]],
                    ['+5% Spell Crit',             [[8, 'fire', 'Improved Scorch'], [8, 'frost', "Winter's Chill"], [9, 'destro', 'Improved Shadow Bolt']]],
                    ['+4% Physical Damage',        [[1, 'arms', 'Blood Frenzy'], [4, 'combat', 'Savage Combat']]],
                    ['+13% Spell Damage',          [[9, '', 'Curse of the Elements'], [11, 'balance', 'Earth and Moon'], [6, 'unholy', 'Ebon Plaguebringer']]],
                    ['20% Armor Reduction',        [[1, '', 'Sunder Armor'], [4, '', 'Expose Armor'], [3, '', 'Acid Spit']]],
                    ['+3% Crit',                   [[2, 'ret', 'Heart of the Crusader'], [4, 'assa', 'Master Poisoner'], [7, 'ele', 'Totem of Wrath']]],
                    ['+3% Spell Hit',              [[5, 'shadow', 'Misery'], [11, 'balance', 'Improved Faerie Fire']]]
                ]],
                ['Mana Regeneration', [
                    ['Mana Tide Totem',            [[7, 'resto', 'Mana Tide Totem']]],
                    ['Replenishment',              [[3, 'sv', 'Hunting Party'], [2, 'ret', 'Judgements of the Wise'], [5, 'shadow', 'Vampiric Touch'], [9, 'destro', 'Improved Soul Leech'], [8, 'frost', 'Enduring Winter']]],
                    ['Revitalize',                 [[11, 'resto', 'Revitalize']]],
                    ['Judgement of Wisdom',        [[2, '', 'Judgement of Wisdom']]],
                    ['Innervate',                  [[11, '', 'Innervate']]],
                    ['Rapture',                    [[5, 'disc', 'Rapture']]],
                    ['Mana Regen',                 [[7, '', 'Mana Spring Totem'], [2, '', 'Greater Blessing of Wisdom']]],
                    ['Hymn of Hope',               [[5, '', 'Hymn of Hope']]]
                ]],
                ['Health Regeneration', [
                    ['Vampiric Embrace',           [[5, 'shadow', 'Vampiric Embrace']]],
                    ['Judgement of Light',         [[2, '', 'Judgement of Light']]],
                    ['Improved Leader of the Pack', [[11, 'feral', 'Improved Leader of the Pack']]],
                    ['Healing Stream Totem',       [[7, '', 'Healing Stream Totem']]]
                ]],
                ['Utility', [
                    ['Battle Resurrection',        [[11, '', 'Rebirth'], [6, '', 'Raise Ally'], [9, '', 'Soulstone Resurrection']]],
                    ['Divine Hymn',                [[5, '', 'Divine Hymn']]],
                    ['Pain Suppression',           [[5, 'disc', 'Pain Suppression']]],
                    ['Guardian Spirit',            [[5, 'holy', 'Guardian Spirit']]],
                    ['Mass Dispel',                [[5, '', 'Mass Dispel']]],
                    ['Hand of Sacrifice',          [[2, '', 'Hand of Sacrifice']]],
                    ['Hand of Protection',         [[2, '', 'Hand of Protection']]],
                    ['Divine Sacrifice',           [[2, 'prot', 'Divine Sacrifice']]],
                    ['Aura Mastery',               [[2, 'holy', 'Aura Mastery']]],
                    ['Lay on Hands',               [[2, '', 'Lay on Hands']]],
                    ['Anti-Magic Zone',            [[6, 'unholy', 'Anti-Magic Zone']]],
                    ['Misdirection',               [[3, '', 'Misdirection']]],
                    ['Shattering Throw',           [[1, '', 'Shattering Throw']]],
                    ['Ritual of Summoning',        [[9, '', 'Ritual of Summoning']]]
                ]]
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

    var el, exp = 'w', size = 25, faction = 'a', layout = 'r', slots = [], names = {}, hash = '', askDelete = false, benchOpen = false, tab = 'c';

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
        html += bottom(mem);

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

    // the sections shown at the bottom: Wrath has its own; Classic and TBC use buffs, debuffs and the utility spells they have
    function sections() {
        var D = DATA[exp];
        if (D.sections) return D.sections;
        return [['Buffs', D.buffs], ['Debuffs', D.debuffs], ['Utility', SPELLS.filter(function (sp) { return sp[4].indexOf(exp) != -1; }).map(function (sp) { return [sp[0], sp[3].map(function (src) { return [src[0], src[1], sp[0]]; })]; })]];
    }

    function count(mem, srcs) {
        return mem.filter(function (m) { return srcs.some(function (src) { return provides(m, src); }); }).length;
    }

    function abilityIcon(name) {
        var i = SPELL_INFO[name];
        return i ? '<img src="' + g_staticUrl + '/images/wow/icons/tiny/' + i[1] + '.gif" alt="" />' : '';
    }

    // bottom panel: Categories (what the raid has) and Spells (who brings it)
    function bottom(mem) {
        var html = '<div class="rc-bottom"><div class="rc-tabs"><a href="javascript:;" data-tab="c"' + (tab == 'c' ? ' class="on"' : '') + '>Categories</a><a href="javascript:;" data-tab="s"' + (tab == 's' ? ' class="on"' : '') + '>Spells</a></div><div class="rc-tbody">';
        if (tab == 'c') {
            html += '<div class="rc-sect"><div class="rc-shead">Roles</div><div class="rc-sgrid">' + ['M', 'T', 'H', 'R'].map(function (r) {
                return '<span class="rc-item' + (mem.some(function (m) { return m[4] == r; }) ? '' : ' none') + '"><b>' + mem.filter(function (m) { return m[4] == r; }).length + '</b> ' + { M: 'Melee', T: 'Tanks', H: 'Healers', R: 'Ranged' }[r] + '</span>';
            }).join('') + '</div></div>';
            sections().forEach(function (S, si) {
                var defs = S[1].filter(function (d) { return d[1].some(function (src) { return classOk(src[0]); }); });
                if (!defs.length) return;
                html += '<div class="rc-sect"><div class="rc-shead">' + esc(S[0]) + '</div><div class="rc-sgrid">' + defs.map(function (d) {
                    var n = count(mem, d[1]);
                    return '<span class="rc-item rc-cat' + (n ? '' : ' none') + '" data-def="' + si + ':' + S[1].indexOf(d) + '"><b>' + n + '</b> ' + esc(d[0]) + '</span>';
                }).join('') + '</div></div>';
            });
        }
        else {
            var host = g_host.replace(/\/?$/, '/'), any = false;
            sections().forEach(function (S) {
                var seen = {}, items = [];
                S[1].forEach(function (d) {
                    d[1].forEach(function (src) {
                        var key = src[0] + ':' + src[2];
                        if (seen[key] || !classOk(src[0])) return;
                        seen[key] = 1;
                        var n = count(mem, d[1].filter(function (x) { return x[0] == src[0] && x[2] == src[2]; }));
                        if (n) items.push([src, n]);
                    });
                });
                if (!items.length) return;
                any = true;
                items.sort(function (a, b) { return a[0][0] - b[0][0] || (a[0][2] < b[0][2] ? -1 : 1); });
                html += '<div class="rc-sect"><div class="rc-shead">' + esc(S[0]) + '</div><div class="rc-scols">' + items.map(function (it) {
                    var src = it[0], i = SPELL_INFO[src[2]], mark = i && i[2] == 't' ? '<i class="rc-talent" title="Talent"></i>' : i && i[2] == 'p' ? '<i class="rc-pet" title="Pet">' + ICON_PAW + '</i>' : '';
                    var label = '<b>' + it[1] + '</b> ' + mark + '<span class="c' + src[0] + '">' + esc(src[2]) + '</span>';
                    return i ? '<a href="' + host + '?spell=' + i[0] + '" class="rc-item rc-sp">' + label + '</a>' : '<span class="rc-item rc-sp">' + label + '</span>';
                }).join('') + '</div></div>';
            });
            if (!any) html += '<div class="q0" style="padding: 10px">Add players to see their spells.</div>';
        }
        return html + '</div></div>';
    }

    // what a spec brings, for its tooltip
    function specTip(s) {
        // yellow section header, then "<count>x <buff>" lines in white
        var out = '';
        sections().forEach(function (L) {
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
            d.onmouseover = function () { $WH.Tooltip.show(d, (names[idx] ? '<b class="c' + s[0] + '" style="font-size: 14px">' + esc(names[idx]) + '</b><br />' : '') + specTip(s)); };
            d.onmouseout = $WH.Tooltip.hide;
        });

        // dropping a member back on the palette takes it out
        var pal = el.querySelector('.rc-palette');
        pal.ondragover = function (e) { if ((e.dataTransfer.types || []).length) e.preventDefault(); };
        pal.ondrop = function (e) {
            var v = e.dataTransfer.getData('text/plain') || '';
            if (v[0] == 'm') { e.preventDefault(); var i = +v.substr(1); slots[i] = null; delete names[i]; save(); render(); }
        };

        $$('.rc-tabs a').forEach(function (a) { a.onclick = function () { $WH.Tooltip.hide(); tab = a.getAttribute('data-tab'); try { localStorage.setItem('aowow_rc_tab', tab); } catch (e) {} render(); }; });
        // category: its name, then each ability with how many in the raid bring it
        $$('.rc-cat').forEach(function (r) {
            var p = r.getAttribute('data-def').split(':'), d = sections()[+p[0]][1][+p[1]];
            r.onmouseover = function () {
                $WH.Tooltip.show(r, '<b>' + esc(d[0]) + '</b>' + d[1].filter(function (src) { return classOk(src[0]); }).map(function (src) {
                    var n = count(mem, [src]);
                    return '<br /><span class="' + (n ? 'q1' : 'q0') + '">' + n + '</span> ' + abilityIcon(src[2]) + ' <span class="c' + src[0] + '">' + esc(src[2]) + '</span>' + (src[1] ? ' <span class="q0">(' + esc(SPECS.filter(function (s) { return provides(s, src); }).map(function (s) { return s[2]; }).join(', ')) + ')</span>' : '');
                }).join(''));
            };
            r.onmouseout = $WH.Tooltip.hide;
        });
    }

    return {
        init: function (container) {
            el = container;
            try { askDelete = !!localStorage.getItem('aowow_rc_ask'); benchOpen = !!localStorage.getItem('aowow_rc_bench'); tab = localStorage.getItem('aowow_rc_tab') == 's' ? 's' : 'c'; } catch (e) {}
            load();
            render();
            if (!location.hash) save();
            setInterval(function () { if (load()) render(); }, 1000);
        }
    };
})();
