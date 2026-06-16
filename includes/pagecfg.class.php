<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');


class PageCfg
{
    private static $cache = null;
    private static $used  = [];

    private static $groupNames = [
        0    => 'Everyone',
        1    => 'Tester+',
        2    => 'Admin',
        4    => 'Editor+',
        8    => 'Moderator+',
        32   => 'Dev+',
        50   => 'Employee (Admin | Bureau | Dev)',
        1726 => 'Staff (any)',
    ];

    private static function load() : void
    {
        if (self::$cache !== null)
            return;

        self::$cache = [];

        if (!DB::isConnected(DB_AOWOW))
            return;

        foreach (DB::Aowow()->select('SELECT `name`, `label`, `default_group`, `override_group` FROM ?_page_config') as $row)
            self::$cache[$row['name']] = [
                'label'    => $row['label'],
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

        self::$used[$name] = true;

        if ($group === 0)
            return true;

        return User::isInGroup($group);
    }

    public static function getUsed() : array
    {
        return array_keys(self::$used);
    }

    /*
     * Returns all page_config entries relevant to the given URL key (e.g. "npc", "npcs").
     * Matches keys whose first segment equals $pageKey (e.g. "npc.employee_info")
     * OR whose second segment equals $pageKey (e.g. "list.npcs.excluded").
     * Each entry: { name, label (stripped of [Default:...]), group, groupName }
     */
    public static function getForPage(string $pageKey) : array
    {
        self::load();

        if (!$pageKey)
            return [];

        $result = [];
        foreach (self::$cache as $name => $entry)
        {
            $parts = explode('.', $name);
            if ($parts[0] !== $pageKey && !(isset($parts[1]) && $parts[1] === $pageKey))
                continue;

            $group     = $entry['override'] !== null ? $entry['override'] : $entry['default'];
            $groupName = self::$groupNames[$group] ?? ('Custom ['.$group.']');

            // strip " [Default: ...]" suffix from label
            $label = preg_replace('/\s*\[Default:[^\]]*\]\s*$/', '', $entry['label']);

            $result[] = [
                'name'      => $name,
                'label'     => $label,
                'group'     => $group,
                'groupName' => $groupName,
                'canSee'    => $group === 0 || User::isInGroup($group),
            ];
        }

        usort($result, fn($a, $b) => strcmp($a['name'], $b['name']));
        return $result;
    }
}

?>
