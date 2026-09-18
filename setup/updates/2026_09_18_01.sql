INSERT IGNORE INTO `aowow_config` (`key`, `value`, `default`, `cat`, `flags`, `comment`)
VALUES ('errlog_ttl', '604800', '604800', 1, 129, 'auto-delete error log entries older than this (in seconds, 0 = keep forever)');
