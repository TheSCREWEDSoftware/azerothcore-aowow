-- Outfits saved from the dressing room (?dressing-room, ?outfits, ?outfit=<id>)
CREATE TABLE IF NOT EXISTS `aowow_outfits` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `userId` int unsigned NOT NULL,
  `name` varchar(64) NOT NULL,
  `description` varchar(255) NOT NULL DEFAULT '',
  `classId` tinyint unsigned NOT NULL DEFAULT 0,
  `race` tinyint unsigned NOT NULL,
  `gender` tinyint unsigned NOT NULL DEFAULT 0,
  `look` varchar(40) NOT NULL DEFAULT '' COMMENT 'skin:face:hairStyle:hairColor:facialHair',
  `items` varchar(255) NOT NULL DEFAULT '' COMMENT 'item ids, comma separated',
  `public` tinyint unsigned NOT NULL DEFAULT 1,
  `views` int unsigned NOT NULL DEFAULT 0,
  `created` int unsigned NOT NULL,
  `updated` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `userId` (`userId`),
  KEY `classId` (`classId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `aowow_outfits_items` (
  `outfitId` int unsigned NOT NULL,
  `itemId` mediumint unsigned NOT NULL,
  PRIMARY KEY (`outfitId`, `itemId`),
  KEY `itemId` (`itemId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
