INSERT IGNORE INTO `aowow_config` (`key`, `value`, `default`, `cat`, `flags`, `comment`) VALUES
('discord_webhook', '', '', 1, 136, 'Discord webhook URL (channel settings > Integrations > Webhooks) the site posts to; empty = off'),
('discord_events', '7', '7', 1, 161, 'what the Discord webhook posts - 0:New comments, 1:New screenshots, 2:Approved guides');
