-- fix: rename TC auth-table reference to AC auth-table for AzerothCore
UPDATE `aowow_config` SET `comment` = 'source to auth against - 0:AoWoW, 1:AC auth-table, 2:External script (config/extAuth.php)' WHERE `key` = 'acc_auth_mode';

-- add: aowow_updates table for AC-style per-file update tracking (replaces date+part in dbversion)
CREATE TABLE IF NOT EXISTS `aowow_updates` (
  `name`      VARCHAR(200) NOT NULL COMMENT 'filename with extension of the update.',
  `hash`      CHAR(40)     NULL DEFAULT '' COMMENT 'sha1 hash of the sql file.',
  `timestamp` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'timestamp when the query was applied.',
  `speed`     INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'time the query takes to apply in ms.',
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='List of all applied updates in this database.';

-- fix: widen aowow_items columns to match AzerothCore (resistance: tinyint→smallint, description: varchar→text)
ALTER TABLE `aowow_items`
    MODIFY COLUMN `resHoly`          smallint      NOT NULL DEFAULT 0,
    MODIFY COLUMN `resFire`          smallint      NOT NULL DEFAULT 0,
    MODIFY COLUMN `resNature`        smallint      NOT NULL DEFAULT 0,
    MODIFY COLUMN `resFrost`         smallint      NOT NULL DEFAULT 0,
    MODIFY COLUMN `resShadow`        smallint      NOT NULL DEFAULT 0,
    MODIFY COLUMN `resArcane`        smallint      NOT NULL DEFAULT 0,
    MODIFY COLUMN `description_loc0` text          DEFAULT NULL,
    MODIFY COLUMN `description_loc2` text          DEFAULT NULL,
    MODIFY COLUMN `description_loc3` text          DEFAULT NULL,
    MODIFY COLUMN `description_loc4` text          DEFAULT NULL,
    MODIFY COLUMN `description_loc6` text          DEFAULT NULL,
    MODIFY COLUMN `description_loc8` text          DEFAULT NULL;

-- fix: widen aowow_quests specialFlags to int unsigned to match AzerothCore (was tinyint unsigned)
ALTER TABLE `aowow_quests`
    MODIFY COLUMN `specialFlags` int unsigned NOT NULL DEFAULT 0;

-- fix: widen aowow_spawns phaseMask to int unsigned to match AzerothCore (was smallint unsigned)
ALTER TABLE `aowow_spawns`
    MODIFY COLUMN `phaseMask` int unsigned NOT NULL DEFAULT 0;
