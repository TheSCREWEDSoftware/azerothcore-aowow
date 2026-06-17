-- add: aowow_page_config table for DB-overrideable page element visibility per user group
-- If no row exists for a given name, AoWoW's hardcoded default applies.
-- default_group is a U_GROUP_* bitmask (decimal):
--   0    = everyone,  1  = tester,  2  = admin,   4   = editor
--   8    = mod,       16 = bureau,  32 = dev,      50  = employee (admin|bureau|dev)
--   1726 = staff (admin|editor|mod|bureau|dev|blogger|localizer|salesagent)
-- override_group: NULL = use default_group; any valid bitmask = staff override
DROP TABLE IF EXISTS `aowow_page_config`;

CREATE TABLE `aowow_page_config` (
    `name`           varchar(100)  NOT NULL                  COMMENT 'dot-notation key identifying the page element',
    `label`          varchar(200)  NOT NULL DEFAULT ''        COMMENT 'human-readable description shown in staff UI',
    `default_group`  int unsigned  NOT NULL DEFAULT 0         COMMENT 'hardcoded default U_GROUP_* bitmask from PHP source',
    `override_group` int unsigned           DEFAULT NULL      COMMENT 'staff-set override; NULL = use default_group',
    PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Per-element page visibility overrides keyed by dot-notation name.';

-- Only seed entries for genuinely optional user-facing features.
-- Staff access controls (employee_info, excluded lists, etc.) stay as hardcoded
-- User::isInGroup() checks in PHP — no need to expose them here.
INSERT INTO `aowow_page_config` (`name`, `label`, `default_group`) VALUES
    ('npc.gossip', 'Show gossip dialogue section on NPC pages [Default: Everyone]', 0);
