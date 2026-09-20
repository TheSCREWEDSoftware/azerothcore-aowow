-- Fix Argent Hippogryph (45725) misclassified as Consumable (class=0) instead of Misc/Mount (class=15, subClass=5).
-- This item is sold by all Argent Tournament race-specific vendors and should appear on every race's Mounts tab.
UPDATE `aowow_items` SET `class` = 15, `subClass` = 5 WHERE `id` = 45725;
