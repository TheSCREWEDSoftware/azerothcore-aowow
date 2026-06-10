-- Assumed you're running default values from: https://github.com/azerothcore/azerothcore-wotlk/blob/master/data/sql/create/create_mysql.sql
CREATE DATABASE IF NOT EXISTS `acore_aowow` DEFAULT CHARACTER SET UTF8MB4 COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON `acore_aowow` . * TO 'acore'@'localhost' WITH GRANT OPTION;
