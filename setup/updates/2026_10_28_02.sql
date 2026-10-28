-- Every 3.3.5 client locale: Korean (loc1), Traditional Chinese (loc5) and Mexican Spanish (loc7) next to the existing ones.
-- Run php aowow --setup / --sql afterwards to fill them (client data in setup/mpqdata/kokr, zhtw, esmx).

ALTER TABLE `aowow_achievement`
  ADD COLUMN `name_loc1` varchar(86) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(86) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(86) DEFAULT NULL AFTER `name_loc6`,
  ADD COLUMN `description_loc1` text DEFAULT NULL AFTER `description_loc0`,
  ADD COLUMN `description_loc5` text DEFAULT NULL AFTER `description_loc4`,
  ADD COLUMN `description_loc7` text DEFAULT NULL AFTER `description_loc6`,
  ADD COLUMN `reward_loc1` varchar(95) DEFAULT NULL AFTER `reward_loc0`,
  ADD COLUMN `reward_loc5` varchar(95) DEFAULT NULL AFTER `reward_loc4`,
  ADD COLUMN `reward_loc7` varchar(95) DEFAULT NULL AFTER `reward_loc6`;

ALTER TABLE `aowow_achievementcriteria`
  ADD COLUMN `name_loc1` varchar(213) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(213) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(213) DEFAULT NULL AFTER `name_loc6`;

ALTER TABLE `aowow_announcements`
  ADD COLUMN `text_loc1` text DEFAULT NULL AFTER `text_loc0`,
  ADD COLUMN `text_loc5` text DEFAULT NULL AFTER `text_loc4`,
  ADD COLUMN `text_loc7` text DEFAULT NULL AFTER `text_loc6`;

ALTER TABLE `aowow_classes`
  ADD COLUMN `name_loc1` varchar(128) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(128) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(128) DEFAULT NULL AFTER `name_loc6`;

ALTER TABLE `aowow_creature`
  ADD COLUMN `name_loc1` varchar(100) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(100) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(100) DEFAULT NULL AFTER `name_loc6`,
  ADD COLUMN `subname_loc1` varchar(100) DEFAULT NULL AFTER `subname_loc0`,
  ADD COLUMN `subname_loc5` varchar(100) DEFAULT NULL AFTER `subname_loc4`,
  ADD COLUMN `subname_loc7` varchar(100) DEFAULT NULL AFTER `subname_loc6`;

ALTER TABLE `aowow_currencies`
  ADD COLUMN `name_loc1` varchar(64) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(64) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(64) DEFAULT NULL AFTER `name_loc6`,
  ADD COLUMN `description_loc1` varchar(256) DEFAULT NULL AFTER `description_loc0`,
  ADD COLUMN `description_loc5` varchar(256) DEFAULT NULL AFTER `description_loc4`,
  ADD COLUMN `description_loc7` varchar(256) DEFAULT NULL AFTER `description_loc6`;

ALTER TABLE `aowow_emotes`
  ADD COLUMN `extToExt_loc1` varchar(150) DEFAULT NULL AFTER `extToExt_loc0`,
  ADD COLUMN `extToExt_loc5` varchar(150) DEFAULT NULL AFTER `extToExt_loc4`,
  ADD COLUMN `extToExt_loc7` varchar(150) DEFAULT NULL AFTER `extToExt_loc6`,
  ADD COLUMN `extToMe_loc1` varchar(150) DEFAULT NULL AFTER `extToMe_loc0`,
  ADD COLUMN `extToMe_loc5` varchar(150) DEFAULT NULL AFTER `extToMe_loc4`,
  ADD COLUMN `extToMe_loc7` varchar(150) DEFAULT NULL AFTER `extToMe_loc6`,
  ADD COLUMN `meToExt_loc1` varchar(150) DEFAULT NULL AFTER `meToExt_loc0`,
  ADD COLUMN `meToExt_loc5` varchar(150) DEFAULT NULL AFTER `meToExt_loc4`,
  ADD COLUMN `meToExt_loc7` varchar(150) DEFAULT NULL AFTER `meToExt_loc6`,
  ADD COLUMN `extToNone_loc1` varchar(150) DEFAULT NULL AFTER `extToNone_loc0`,
  ADD COLUMN `extToNone_loc5` varchar(150) DEFAULT NULL AFTER `extToNone_loc4`,
  ADD COLUMN `extToNone_loc7` varchar(150) DEFAULT NULL AFTER `extToNone_loc6`,
  ADD COLUMN `meToNone_loc1` varchar(150) DEFAULT NULL AFTER `meToNone_loc0`,
  ADD COLUMN `meToNone_loc5` varchar(150) DEFAULT NULL AFTER `meToNone_loc4`,
  ADD COLUMN `meToNone_loc7` varchar(150) DEFAULT NULL AFTER `meToNone_loc6`;

ALTER TABLE `aowow_factions`
  ADD COLUMN `name_loc1` varchar(50) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(50) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(50) DEFAULT NULL AFTER `name_loc6`;

ALTER TABLE `aowow_holidays`
  ADD COLUMN `name_loc1` varchar(49) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(49) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(49) DEFAULT NULL AFTER `name_loc6`,
  ADD COLUMN `description_loc1` text DEFAULT NULL AFTER `description_loc0`,
  ADD COLUMN `description_loc5` text DEFAULT NULL AFTER `description_loc4`,
  ADD COLUMN `description_loc7` text DEFAULT NULL AFTER `description_loc6`;

ALTER TABLE `aowow_home_featuredbox`
  ADD COLUMN `text_loc1` text DEFAULT NULL AFTER `text_loc0`,
  ADD COLUMN `text_loc5` text DEFAULT NULL AFTER `text_loc4`,
  ADD COLUMN `text_loc7` text DEFAULT NULL AFTER `text_loc6`;

ALTER TABLE `aowow_home_featuredbox_overlay`
  ADD COLUMN `title_loc1` varchar(100) DEFAULT '' AFTER `title_loc0`,
  ADD COLUMN `title_loc5` varchar(100) DEFAULT '' AFTER `title_loc4`,
  ADD COLUMN `title_loc7` varchar(100) DEFAULT '' AFTER `title_loc6`;

ALTER TABLE `aowow_home_oneliner`
  ADD COLUMN `text_loc1` varchar(200) DEFAULT NULL AFTER `text_loc0`,
  ADD COLUMN `text_loc5` varchar(200) DEFAULT NULL AFTER `text_loc4`,
  ADD COLUMN `text_loc7` varchar(200) DEFAULT NULL AFTER `text_loc6`;

ALTER TABLE `aowow_itemenchantment`
  ADD COLUMN `name_loc1` varchar(96) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(96) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(96) DEFAULT NULL AFTER `name_loc6`;

ALTER TABLE `aowow_itemlimitcategory`
  ADD COLUMN `name_loc1` varchar(68) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(68) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(68) DEFAULT NULL AFTER `name_loc6`;

ALTER TABLE `aowow_itemrandomenchant`
  ADD COLUMN `name_loc1` varchar(250) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(250) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(250) DEFAULT NULL AFTER `name_loc6`;

ALTER TABLE `aowow_items`
  ADD COLUMN `name_loc1` varchar(127) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(127) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(127) DEFAULT NULL AFTER `name_loc6`,
  ADD COLUMN `description_loc1` text DEFAULT NULL AFTER `description_loc0`,
  ADD COLUMN `description_loc5` text DEFAULT NULL AFTER `description_loc4`,
  ADD COLUMN `description_loc7` text DEFAULT NULL AFTER `description_loc6`;

ALTER TABLE `aowow_itemset`
  ADD COLUMN `name_loc1` varchar(255) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(255) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(255) DEFAULT NULL AFTER `name_loc6`,
  ADD COLUMN `bonusText_loc1` text DEFAULT NULL AFTER `bonusText_loc0`,
  ADD COLUMN `bonusText_loc5` text DEFAULT NULL AFTER `bonusText_loc4`,
  ADD COLUMN `bonusText_loc7` text DEFAULT NULL AFTER `bonusText_loc6`;

ALTER TABLE `aowow_mails`
  ADD COLUMN `subject_loc1` varchar(128) DEFAULT NULL AFTER `subject_loc0`,
  ADD COLUMN `subject_loc5` varchar(128) DEFAULT NULL AFTER `subject_loc4`,
  ADD COLUMN `subject_loc7` varchar(128) DEFAULT NULL AFTER `subject_loc6`,
  ADD COLUMN `text_loc1` text DEFAULT NULL AFTER `text_loc0`,
  ADD COLUMN `text_loc5` text DEFAULT NULL AFTER `text_loc4`,
  ADD COLUMN `text_loc7` text DEFAULT NULL AFTER `text_loc6`;

ALTER TABLE `aowow_objects`
  ADD COLUMN `name_loc1` varchar(100) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(100) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(100) DEFAULT NULL AFTER `name_loc6`;

ALTER TABLE `aowow_pet`
  ADD COLUMN `name_loc1` varchar(64) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(64) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(64) DEFAULT NULL AFTER `name_loc6`;

ALTER TABLE `aowow_quests`
  ADD COLUMN `name_loc1` text DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` text DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` text DEFAULT NULL AFTER `name_loc6`,
  ADD COLUMN `objectives_loc1` text DEFAULT NULL AFTER `objectives_loc0`,
  ADD COLUMN `objectives_loc5` text DEFAULT NULL AFTER `objectives_loc4`,
  ADD COLUMN `objectives_loc7` text DEFAULT NULL AFTER `objectives_loc6`,
  ADD COLUMN `details_loc1` text DEFAULT NULL AFTER `details_loc0`,
  ADD COLUMN `details_loc5` text DEFAULT NULL AFTER `details_loc4`,
  ADD COLUMN `details_loc7` text DEFAULT NULL AFTER `details_loc6`,
  ADD COLUMN `end_loc1` text DEFAULT NULL AFTER `end_loc0`,
  ADD COLUMN `end_loc5` text DEFAULT NULL AFTER `end_loc4`,
  ADD COLUMN `end_loc7` text DEFAULT NULL AFTER `end_loc6`,
  ADD COLUMN `offerReward_loc1` text DEFAULT NULL AFTER `offerReward_loc0`,
  ADD COLUMN `offerReward_loc5` text DEFAULT NULL AFTER `offerReward_loc4`,
  ADD COLUMN `offerReward_loc7` text DEFAULT NULL AFTER `offerReward_loc6`,
  ADD COLUMN `requestItems_loc1` text DEFAULT NULL AFTER `requestItems_loc0`,
  ADD COLUMN `requestItems_loc5` text DEFAULT NULL AFTER `requestItems_loc4`,
  ADD COLUMN `requestItems_loc7` text DEFAULT NULL AFTER `requestItems_loc6`,
  ADD COLUMN `completed_loc1` text DEFAULT NULL AFTER `completed_loc0`,
  ADD COLUMN `completed_loc5` text DEFAULT NULL AFTER `completed_loc4`,
  ADD COLUMN `completed_loc7` text DEFAULT NULL AFTER `completed_loc6`,
  ADD COLUMN `objectiveText1_loc1` text DEFAULT NULL AFTER `objectiveText1_loc0`,
  ADD COLUMN `objectiveText1_loc5` text DEFAULT NULL AFTER `objectiveText1_loc4`,
  ADD COLUMN `objectiveText1_loc7` text DEFAULT NULL AFTER `objectiveText1_loc6`,
  ADD COLUMN `objectiveText2_loc1` text DEFAULT NULL AFTER `objectiveText2_loc0`,
  ADD COLUMN `objectiveText2_loc5` text DEFAULT NULL AFTER `objectiveText2_loc4`,
  ADD COLUMN `objectiveText2_loc7` text DEFAULT NULL AFTER `objectiveText2_loc6`,
  ADD COLUMN `objectiveText3_loc1` text DEFAULT NULL AFTER `objectiveText3_loc0`,
  ADD COLUMN `objectiveText3_loc5` text DEFAULT NULL AFTER `objectiveText3_loc4`,
  ADD COLUMN `objectiveText3_loc7` text DEFAULT NULL AFTER `objectiveText3_loc6`,
  ADD COLUMN `objectiveText4_loc1` text DEFAULT NULL AFTER `objectiveText4_loc0`,
  ADD COLUMN `objectiveText4_loc5` text DEFAULT NULL AFTER `objectiveText4_loc4`,
  ADD COLUMN `objectiveText4_loc7` text DEFAULT NULL AFTER `objectiveText4_loc6`;

ALTER TABLE `aowow_races`
  ADD COLUMN `name_loc1` varchar(64) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(64) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(64) DEFAULT NULL AFTER `name_loc6`;

ALTER TABLE `aowow_skillline`
  ADD COLUMN `name_loc1` varchar(64) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(64) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(64) DEFAULT NULL AFTER `name_loc6`,
  ADD COLUMN `description_loc1` text DEFAULT NULL AFTER `description_loc0`,
  ADD COLUMN `description_loc5` text DEFAULT NULL AFTER `description_loc4`,
  ADD COLUMN `description_loc7` text DEFAULT NULL AFTER `description_loc6`;

ALTER TABLE `aowow_spell`
  ADD COLUMN `name_loc1` varchar(184) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(184) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(184) DEFAULT NULL AFTER `name_loc6`,
  ADD COLUMN `rank_loc1` varchar(56) DEFAULT NULL AFTER `rank_loc0`,
  ADD COLUMN `rank_loc5` varchar(56) DEFAULT NULL AFTER `rank_loc4`,
  ADD COLUMN `rank_loc7` varchar(56) DEFAULT NULL AFTER `rank_loc6`,
  ADD COLUMN `description_loc1` text DEFAULT NULL AFTER `description_loc0`,
  ADD COLUMN `description_loc5` text DEFAULT NULL AFTER `description_loc4`,
  ADD COLUMN `description_loc7` text DEFAULT NULL AFTER `description_loc6`,
  ADD COLUMN `buff_loc1` text DEFAULT NULL AFTER `buff_loc0`,
  ADD COLUMN `buff_loc5` text DEFAULT NULL AFTER `buff_loc4`,
  ADD COLUMN `buff_loc7` text DEFAULT NULL AFTER `buff_loc6`;

ALTER TABLE `aowow_spellfocusobject`
  ADD COLUMN `name_loc1` varchar(169) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(169) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(169) DEFAULT NULL AFTER `name_loc6`;

ALTER TABLE `aowow_spellrange`
  ADD COLUMN `name_loc1` varchar(27) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(27) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(27) DEFAULT NULL AFTER `name_loc6`;

ALTER TABLE `aowow_taxinodes`
  ADD COLUMN `name_loc1` varchar(142) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(142) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(142) DEFAULT NULL AFTER `name_loc6`;

ALTER TABLE `aowow_titles`
  ADD COLUMN `male_loc1` varchar(37) DEFAULT NULL AFTER `male_loc0`,
  ADD COLUMN `male_loc5` varchar(37) DEFAULT NULL AFTER `male_loc4`,
  ADD COLUMN `male_loc7` varchar(37) DEFAULT NULL AFTER `male_loc6`,
  ADD COLUMN `female_loc1` varchar(41) DEFAULT NULL AFTER `female_loc0`,
  ADD COLUMN `female_loc5` varchar(41) DEFAULT NULL AFTER `female_loc4`,
  ADD COLUMN `female_loc7` varchar(41) DEFAULT NULL AFTER `female_loc6`;

ALTER TABLE `aowow_totemcategory`
  ADD COLUMN `name_loc1` varchar(69) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(69) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(69) DEFAULT NULL AFTER `name_loc6`;

ALTER TABLE `aowow_zones`
  ADD COLUMN `name_loc1` varchar(120) DEFAULT NULL AFTER `name_loc0`,
  ADD COLUMN `name_loc5` varchar(120) DEFAULT NULL AFTER `name_loc4`,
  ADD COLUMN `name_loc7` varchar(120) DEFAULT NULL AFTER `name_loc6`;

UPDATE `aowow_config` SET `comment` = 'allowed locales - 0:English, 1:Korean, 2:French, 3:German, 4:Chinese, 5:Taiwanese, 6:Spanish, 7:Mexican, 8:Russian' WHERE `key` = 'locales';
