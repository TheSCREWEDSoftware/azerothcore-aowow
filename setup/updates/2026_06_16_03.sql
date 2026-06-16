DELETE FROM `aowow_config` WHERE `key` = 'acc_email';
INSERT INTO `aowow_config` (`key`, `value`, `default`, `cat`, `flags`, `comment`) VALUES
    ('acc_email', '1', '1', 3, 132, 'enable/disable e-mail requirement on account registration (default: enabled)');
