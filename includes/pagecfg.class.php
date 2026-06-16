<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');


class PageCfg
{
    private static $cache = null;

    private static function load() : void
    {
        if (self::$cache !== null)
            return;

        self::$cache = [];

        if (!DB::isConnected(DB_AOWOW))
            return;

        foreach (DB::Aowow()->select('SELECT `name`, `min_group` FROM ?_page_config') as $row)
            self::$cache[$row['name']] = (int)$row['min_group'];
    }

    /*
     * Returns true if the current user may see the element identified by $name.
     * $hardcodedDefault is the U_GROUP_* bitmask used in the AoWoW source code —
     * it is applied when no DB row exists for $name.
     */
    public static function can(string $name, int $hardcodedDefault) : bool
    {
        self::load();

        $group = array_key_exists($name, self::$cache) ? self::$cache[$name] : $hardcodedDefault;

        if ($group === 0)
            return true;

        return User::isInGroup($group);
    }
}

?>
