-- fix: rename TC auth-table reference to AC auth-table for AzerothCore
UPDATE `aowow_config` SET `comment` = 'source to auth against - 0:AoWoW, 1:AC auth-table, 2:External script (config/extAuth.php)' WHERE `key` = 'acc_auth_mode';
