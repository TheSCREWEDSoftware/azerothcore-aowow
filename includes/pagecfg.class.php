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

        foreach (DB::Aowow()->select('SELECT `name`, `default_group`, `override_group` FROM ?_page_config') as $row)
            self::$cache[$row['name']] = [
                'default'  => (int)$row['default_group'],
                'override' => $row['override_group'] !== null ? (int)$row['override_group'] : null,
            ];
    }

    /*
     * Returns true if the current user may see the element identified by $name.
     * $hardcodedDefault is the U_GROUP_* bitmask from the AoWoW source code —
     * used when no DB row exists for $name, or when override_group is NULL.
     */
    public static function can(string $name, int $hardcodedDefault) : bool
    {
        self::load();

        if (array_key_exists($name, self::$cache))
        {
            $entry = self::$cache[$name];
            $group = $entry['override'] !== null ? $entry['override'] : $entry['default'];
        }
        else
            $group = $hardcodedDefault;

        if ($group === 0)
            return true;

        return User::isInGroup($group);
    }
}

?>
