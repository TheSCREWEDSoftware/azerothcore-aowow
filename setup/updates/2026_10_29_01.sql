-- Hogger (creature guid 80531) stands in Elwynn Forest, not Westfall: keep that when the spawns are rebuilt
REPLACE INTO `aowow_spawns_override` (`type`, `typeGuid`, `areaId`, `floor`, `revision`) VALUES (1, 80531, 12, 0, 40);
UPDATE `aowow_spawns` SET `areaId` = 12, `floor` = 0, `posX` = 26.5, `posY` = 93.6 WHERE `type` = 1 AND `guid` = 80531;
