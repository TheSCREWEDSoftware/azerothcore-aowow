DELETE FROM `aowow_home_featuredbox` WHERE `id` = 1;
INSERT INTO `aowow_home_featuredbox` (`id`, `editorId`, `editDate`, `startDate`, `endDate`, `extraWide`, `boxBG`, `altHomeLogo`, `altHeaderLogo`, `text_loc0`)
VALUES (
    1,
    NULL,
    UNIX_TIMESTAMP(),
    0,
    2147483647,
    0,
    NULL,
    NULL,
    NULL,
    '[b]Welcome to AoWoW[/b]\n\nA World of Warcraft: Wrath of the Lich King (3.3.5a) database browser, powered by [url=https://www.azerothcore.org/]AzerothCore[/url].\n\nBrowse [url=/?items]items[/url], [url=/?npcs]NPCs[/url], [url=/?quests]quests[/url], [url=/?spells]spells[/url], [url=/?zones]zones[/url] and more — all data pulled live from your server database.'
);
