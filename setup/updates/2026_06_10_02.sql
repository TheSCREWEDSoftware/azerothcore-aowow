-- add: aowow_updates table for AC-style per-file update tracking (replaces date+part in dbversion)
CREATE TABLE IF NOT EXISTS `aowow_updates` (
  `name`      VARCHAR(200) NOT NULL COMMENT 'filename with extension of the update.',
  `hash`      CHAR(40)     NULL DEFAULT '' COMMENT 'sha1 hash of the sql file.',
  `timestamp` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'timestamp when the query was applied.',
  `speed`     INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'time the query takes to apply in ms.',
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='List of all applied updates in this database.';
