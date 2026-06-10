-- fix: widen aowow_items resistance columns to match AzerothCore smallint (was tinyint unsigned)
ALTER TABLE `aowow_items`
    MODIFY COLUMN `resHoly`   smallint NOT NULL DEFAULT 0,
    MODIFY COLUMN `resFire`   smallint NOT NULL DEFAULT 0,
    MODIFY COLUMN `resNature` smallint NOT NULL DEFAULT 0,
    MODIFY COLUMN `resFrost`  smallint NOT NULL DEFAULT 0,
    MODIFY COLUMN `resShadow` smallint NOT NULL DEFAULT 0,
    MODIFY COLUMN `resArcane` smallint NOT NULL DEFAULT 0;

-- fix: widen aowow_items description columns to text (was varchar(255), AC descriptions can be longer)
ALTER TABLE `aowow_items`
    MODIFY COLUMN `description_loc0` text DEFAULT NULL,
    MODIFY COLUMN `description_loc2` text DEFAULT NULL,
    MODIFY COLUMN `description_loc3` text DEFAULT NULL,
    MODIFY COLUMN `description_loc4` text DEFAULT NULL,
    MODIFY COLUMN `description_loc6` text DEFAULT NULL,
    MODIFY COLUMN `description_loc8` text DEFAULT NULL;

-- fix: widen aowow_quests specialFlags to int unsigned to match AzerothCore (was tinyint unsigned)
ALTER TABLE `aowow_quests`
    MODIFY COLUMN `specialFlags` int unsigned NOT NULL DEFAULT 0;
