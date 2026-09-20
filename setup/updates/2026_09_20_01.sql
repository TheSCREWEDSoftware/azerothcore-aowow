-- Fix Blood Elf/Draenei racial reqRaceMask: stored as race ID instead of bitmask.
UPDATE `aowow_spell` SET `reqRaceMask` = 512  WHERE `typeCat` = -4 AND `reqRaceMask` = 10;
UPDATE `aowow_spell` SET `reqRaceMask` = 1024 WHERE `typeCat` = -4 AND `reqRaceMask` = 11;
