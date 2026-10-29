-- lookup indexes: the quest, item and spell pages search these columns, and every search was a full table scan
--   (aowow_quests alone is ~280 MB with its localized texts, so each scan took over a second)
ALTER TABLE `aowow_quests`
    ADD INDEX `idx_nextQuestId` (`nextQuestId`),
    ADD INDEX `idx_prevQuestId` (`prevQuestId`),
    ADD INDEX `idx_exclusiveGroup` (`exclusiveGroup`),
    ADD INDEX `idx_breadcrumb` (`breadcrumbForQuestId`),
    ADD INDEX `idx_zoneOrSort` (`zoneOrSort`),
    ADD INDEX `idx_sourceSpellId` (`sourceSpellId`),
    ADD INDEX `idx_rewardSpell` (`rewardSpell`),
    ADD INDEX `idx_sourceItemId` (`sourceItemId`),
    ADD INDEX `idx_reqSourceItemId1` (`reqSourceItemId1`), ADD INDEX `idx_reqSourceItemId2` (`reqSourceItemId2`),
    ADD INDEX `idx_reqSourceItemId3` (`reqSourceItemId3`), ADD INDEX `idx_reqSourceItemId4` (`reqSourceItemId4`),
    ADD INDEX `idx_reqItemId1` (`reqItemId1`), ADD INDEX `idx_reqItemId2` (`reqItemId2`), ADD INDEX `idx_reqItemId3` (`reqItemId3`),
    ADD INDEX `idx_reqItemId4` (`reqItemId4`), ADD INDEX `idx_reqItemId5` (`reqItemId5`), ADD INDEX `idx_reqItemId6` (`reqItemId6`),
    ADD INDEX `idx_rewardChoiceItemId1` (`rewardChoiceItemId1`), ADD INDEX `idx_rewardChoiceItemId2` (`rewardChoiceItemId2`),
    ADD INDEX `idx_rewardChoiceItemId3` (`rewardChoiceItemId3`), ADD INDEX `idx_rewardChoiceItemId4` (`rewardChoiceItemId4`),
    ADD INDEX `idx_rewardChoiceItemId5` (`rewardChoiceItemId5`), ADD INDEX `idx_rewardChoiceItemId6` (`rewardChoiceItemId6`),
    ADD INDEX `idx_rewardItemId1` (`rewardItemId1`), ADD INDEX `idx_rewardItemId2` (`rewardItemId2`),
    ADD INDEX `idx_rewardItemId3` (`rewardItemId3`), ADD INDEX `idx_rewardItemId4` (`rewardItemId4`),
    ADD INDEX `idx_reqNpcOrGo1` (`reqNpcOrGo1`), ADD INDEX `idx_reqNpcOrGo2` (`reqNpcOrGo2`),
    ADD INDEX `idx_reqNpcOrGo3` (`reqNpcOrGo3`), ADD INDEX `idx_reqNpcOrGo4` (`reqNpcOrGo4`),
    ADD INDEX `idx_name0` (`name_loc0`(64)), ADD INDEX `idx_name1` (`name_loc1`(64)), ADD INDEX `idx_name2` (`name_loc2`(64)),
    ADD INDEX `idx_name3` (`name_loc3`(64)), ADD INDEX `idx_name4` (`name_loc4`(64)), ADD INDEX `idx_name5` (`name_loc5`(64)),
    ADD INDEX `idx_name6` (`name_loc6`(64)), ADD INDEX `idx_name7` (`name_loc7`(64)), ADD INDEX `idx_name8` (`name_loc8`(64));

ALTER TABLE `aowow_spell`
    ADD INDEX `idx_createItem2` (`effect2CreateItemId`), ADD INDEX `idx_createItem3` (`effect3CreateItemId`),
    ADD INDEX `idx_reagent1` (`reagent1`), ADD INDEX `idx_reagent2` (`reagent2`), ADD INDEX `idx_reagent3` (`reagent3`), ADD INDEX `idx_reagent4` (`reagent4`),
    ADD INDEX `idx_reagent5` (`reagent5`), ADD INDEX `idx_reagent6` (`reagent6`), ADD INDEX `idx_reagent7` (`reagent7`), ADD INDEX `idx_reagent8` (`reagent8`),
    ADD INDEX `idx_trigger1` (`effect1TriggerSpell`), ADD INDEX `idx_trigger2` (`effect2TriggerSpell`), ADD INDEX `idx_trigger3` (`effect3TriggerSpell`),
    ADD INDEX `idx_misc1` (`effect1MiscValue`), ADD INDEX `idx_misc2` (`effect2MiscValue`), ADD INDEX `idx_misc3` (`effect3MiscValue`),
    ADD INDEX `idx_family` (`spellFamilyId`), ADD INDEX `idx_spellcategory` (`category`);

ALTER TABLE `aowow_items`
    ADD INDEX `idx_modelstr` (`model`),
    ADD INDEX `idx_spellId1` (`spellId1`), ADD INDEX `idx_spellId2` (`spellId2`), ADD INDEX `idx_spellId3` (`spellId3`),
    ADD INDEX `idx_spellId4` (`spellId4`), ADD INDEX `idx_spellId5` (`spellId5`);

ALTER TABLE `aowow_creature`
    ADD INDEX `idx_spell1` (`spell1`), ADD INDEX `idx_spell2` (`spell2`), ADD INDEX `idx_spell3` (`spell3`), ADD INDEX `idx_spell4` (`spell4`),
    ADD INDEX `idx_spell5` (`spell5`), ADD INDEX `idx_spell6` (`spell6`), ADD INDEX `idx_spell7` (`spell7`), ADD INDEX `idx_spell8` (`spell8`);

ALTER TABLE `aowow_objects`
    ADD INDEX `idx_onUseSpell` (`onUseSpell`), ADD INDEX `idx_onSuccessSpell` (`onSuccessSpell`),
    ADD INDEX `idx_auraSpell` (`auraSpell`), ADD INDEX `idx_triggeredSpell` (`triggeredSpell`);

ALTER TABLE `aowow_quests_startend`
    ADD INDEX `idx_questId` (`questId`);

ALTER TABLE `aowow_achievementcriteria`
    ADD INDEX `idx_type_value1` (`type`, `value1`),
    ADD INDEX `idx_refAchievement` (`refAchievementId`);
