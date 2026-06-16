-- add: aowow_page_config table for DB-overrideable page element visibility per user group
-- If no row exists for a given name, AoWoW's hardcoded default applies.
-- min_group is a U_GROUP_* bitmask (decimal):
--   0    = everyone,  1  = tester,  2  = admin,   4   = editor
--   8    = mod,       16 = bureau,  32 = dev,      50  = employee (admin|bureau|dev)
--   1726 = staff (admin|editor|mod|bureau|dev|blogger|localizer|salesagent)
DROP TABLE IF EXISTS `aowow_page_config`;

CREATE TABLE `aowow_page_config` (
    `name`      varchar(100)     NOT NULL                COMMENT 'dot-notation key identifying the page element',
    `label`     varchar(200)     NOT NULL DEFAULT ''     COMMENT 'human-readable description shown in staff UI',
    `min_group` int unsigned     NOT NULL DEFAULT 0      COMMENT 'U_GROUP_* bitmask override; 0 = everyone can see it',
    PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Per-element page visibility overrides keyed by dot-notation name.';

INSERT INTO `aowow_page_config` (`name`, `label`, `min_group`) VALUES
    ('achievement.scripts',            'Show achievement script data on Achievement detail pages [Default: Employee]',                50),
    ('emote.sounds',                   'Show sound data tab on Emote detail pages [Default: Staff]',                                 1726),
    ('event.staff_info',               'Show staff-only event information on Event detail pages [Default: Staff]',                   1726),
    ('faction.hidden',                 'Show hidden/unlisted factions in Factions list [Default: Employee]',                         50),
    ('list.achievements.excluded',     'Show excluded achievements in Achievements list [Default: Employee]',                        50),
    ('list.arenateams.excluded',       'Show excluded arena teams in Arena Teams list [Default: Employee]',                          50),
    ('list.currencies.excluded',       'Show excluded currencies in Currencies list [Default: Employee]',                            50),
    ('list.emotes',                    'Show Emotes list entirely [Default: Staff]',                                                 1726),
    ('list.enchantments.excluded',     'Show excluded enchantments in Enchantments list [Default: Employee]',                       50),
    ('list.events.excluded',           'Show excluded events in Events list [Default: Employee]',                                    50),
    ('list.icons.excluded',            'Show excluded icons in Icons list [Default: Employee]',                                      50),
    ('list.items.excluded',            'Show excluded items in Items list [Default: Employee]',                                      50),
    ('list.itemsets.excluded',         'Show excluded itemsets in Itemsets list [Default: Employee]',                                50),
    ('list.npcs.excluded',             'Show excluded NPCs in NPCs list [Default: Employee]',                                        50),
    ('list.objects.excluded',          'Show excluded objects in Objects list [Default: Employee]',                                  50),
    ('list.pets.excluded',             'Show excluded pets in Pets list [Default: Employee]',                                        50),
    ('list.quests.excluded',           'Show excluded quests in Quests list [Default: Employee]',                                    50),
    ('list.races.excluded',            'Show excluded races in Races list [Default: Employee]',                                      50),
    ('list.skills.excluded',           'Show excluded skills in Skills list [Default: Employee]',                                    50),
    ('list.spells.excluded',           'Show excluded spells in Spells list [Default: Employee]',                                    50),
    ('list.titles.excluded',           'Show unused titles in Titles list [Default: Employee]',                                      50),
    ('list.zones.excluded',            'Show sub-areas and unused zones in Zones list [Default: Employee]',                         50),
    ('loot.reference_groups',          'Show reference loot group entries on NPC/object drop tables [Default: Employee]',            50),
    ('npc.areatrigger_spawns',         'Show area trigger spawn markers on NPC map [Default: Staff]',                               1726),
    ('npc.employee_info',              'Show AI script name and debug info in NPC infobox [Default: Employee]',                      50),
    ('npc.passenger_seats',            'Show seat column in NPC passenger/accessory tab [Default: Staff]',                          1726),
    ('object.employee_info',           'Show debug info in Object infobox [Default: Employee]',                                      50),
    ('quest.areatrigger_map',          'Show area trigger markers on quest maps [Default: Staff]',                                   1726),
    ('quest.spell_types',              'Show accurate internal spell type labels on quest pages [Default: Employee]',                 50),
    ('search.excluded',                'Show CUSTOM_EXCLUDE_FOR_LISTVIEW entries in global search [Default: Employee]',              50),
    ('smartai.raw_events',             'Show raw SmartAI event type in event descriptions [Default: Employee]',                      50),
    ('sound.staff_only',               'Show full sound file listing on Sound detail pages [Default: Staff]',                        1726),
    ('spell.employee_info',            'Show areatrigger UsedBy tab and extra data in Spell infobox [Default: Employee]',            50),
    ('spell.family_cooldown_filter',   'Disable spell family filter on shared cooldown list [Default: Staff]',                       1726),
    ('spell.reagent_info',             'Show reagent source debug info on Spell pages [Default: Employee]',                          50),
    ('spell.script_name',              'Show spell script name in Spell infobox [Default: Staff]',                                   1726),
    ('zone.areatrigger_spawns',        'Show area trigger overlays on zone maps [Default: Staff]',                                   1726),
    ('zone.excluded',                  'Show excluded sub-zones on Zone detail page [Default: Employee]',                            50);
