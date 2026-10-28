<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');


// tabId 1: Tools g_initHeader()
// put a character's gear together (items, gems, enchants) and see the stats it adds up to; the gear is kept in the #link
//   ?gear-planner=search&slot=<group>&q=<name>&maxrl=<level>   items for a paper doll slot
//   ?gear-planner=items&ids=1,2,3                              item details (stats, sockets, socket bonus, set)
//   ?gear-planner=gems&q=<name>                                gems (colour, stats)
//   ?gear-planner=enchants&inv=<inventory type>                permanent enchants that fit that kind of item
class GearplannerPage extends GenericPage
{
    // paper doll slot -> inventory types it takes
    public const SLOTS = array(
        'head'     => [1],          'neck'     => [2],          'shoulder' => [3],          'back'     => [16],
        'chest'    => [5, 20],      'wrist'    => [9],          'hands'    => [10],         'waist'    => [6],
        'legs'     => [7],          'feet'     => [8],          'finger'   => [11],         'trinket'  => [12],
        'mainhand' => [13, 17, 21], 'offhand'  => [13, 14, 22, 23], 'ranged' => [15, 25, 26, 28]
    );

    protected $tpl      = 'tool';
    protected $tabId    = 1;
    protected $path     = [1, 15];
    protected $mode     = CACHE_TYPE_NONE;
    protected $scripts  = array(
        [SC_JS_FILE,  '?data=weight-presets'],
        [SC_JS_FILE,  'js/gearplanner.js'],
        [SC_CSS_FILE, 'css/tools.css']
    );

    protected $toolId   = 'gearplanner';
    protected $toolInit = 'AoGearPlanner.init';
    protected $config   = [];

    public function __construct($pageCall, $pageParam)
    {
        parent::__construct($pageCall, $pageParam);

        $json = match ((string)$pageParam)
        {
            'search'   => fn() => self::search((string)($_GET['slot'] ?? ''), trim((string)($_GET['q'] ?? '')), (int)($_GET['maxrl'] ?? 0)),
            'items'    => fn() => self::items(array_map('intval', explode(',', (string)($_GET['ids'] ?? '')))),
            'gems'     => fn() => self::gems(trim((string)($_GET['q'] ?? ''))),
            'enchants' => fn() => self::enchants((int)($_GET['inv'] ?? 0)),
            default    => null
        };

        if ($json)
        {
            header('Content-Type: application/json; charset=utf-8');
            exit(Util::toJSON($json()));
        }

        $this->name   = Lang::main('gearPlanner');
        $this->config = ['host' => Cfg::get('HOST_URL'), 'maxLevel' => MAX_LEVEL];
    }

    private static function nameCol() : string
    {
        $loc = Lang::getLocale()->value;
        return 'IF(i.`name_loc'.$loc.'` <> "", i.`name_loc'.$loc.'`, i.`name_loc0`)';
    }

    private static function search(string $slot, string $q, int $maxrl) : array
    {
        if (!isset(self::SLOTS[$slot]))
            return [];

        $rows = DB::Aowow()->select(
           'SELECT i.`id`, '.self::nameCol().' AS "name", i.`quality`, i.`slot`, i.`itemLevel` AS "level", i.`requiredLevel` AS "reqlevel", ic.`name` AS "icon"
            FROM   ?_items i
            LEFT   JOIN ?_icons ic ON ic.`id` = i.`iconId`
            WHERE  i.`slot` IN (?a) AND i.`class` IN (?a) AND i.`quality` BETWEEN 1 AND 5 AND (i.`cuFlags` & ?d) = 0
              { AND (i.`name_loc0` LIKE ? OR i.`name_loc'.Lang::getLocale()->value.'` LIKE ?) }
              { AND i.`requiredLevel` <= ?d }
            ORDER  BY i.`itemLevel` DESC, i.`quality` DESC, i.`id` DESC
            LIMIT  60',
            self::SLOTS[$slot], [ITEM_CLASS_WEAPON, ITEM_CLASS_ARMOR], CUSTOM_EXCLUDE_FOR_LISTVIEW,
            $q !== '' ? '%'.$q.'%' : DBSIMPLE_SKIP, $q !== '' ? '%'.$q.'%' : DBSIMPLE_SKIP,
            $maxrl > 0 ? $maxrl : DBSIMPLE_SKIP
        );

        return array_map(fn($r) => [(int)$r['id'], $r['name'], (int)$r['quality'], strtolower($r['icon'] ?: DEFAULT_ICON), (int)$r['slot'], (int)$r['level'], (int)$r['reqlevel']], $rows);
    }

    // non-zero stats only, without the bookkeeping keys of the stat containers
    private static function cleanStats(?array $in) : array
    {
        $out = [];
        foreach ((array)$in as $k => $v)
            if (is_numeric($v) && $v != 0 && $k[0] != '_' && !in_array($k, ['type', 'typeId', 'reqskill', 'reqskillrank', 'reqlevel', 'nsockets', 'id', 'slotbak', 'repaircost', 'buyprice', 'sellprice', 'avgmoney', 'avgbuyout', 'dps', 'speed', 'mledps', 'rgddps', 'gearscore']))
                $out[$k] = $v + 0;

        return $out;
    }

    // stats as the item listviews have them (str, sta, splpwr, critstrkrtng ..), sockets, socket bonus, item set, gem colour
    private static function items(array $ids) : array
    {
        $ids = array_slice(array_values(array_unique(array_filter($ids))), 0, 60);
        if (!$ids)
            return [];

        $list = new ItemList([['i.id', $ids], Cfg::get('SQL_LIMIT_NONE')]);
        if ($list->error)
            return [];

        $lv   = $list->getListviewData(ITEMINFO_JSON);
        $keep = ['id', 'slot', 'classs', 'subclass', 'level', 'reqlevel', 'itemset', 'socket1', 'socket2', 'socket3', 'socketbonus', 'socketbonusstat', 'gearscore'];
        $out  = [];
        foreach ($list->iterate() as $id => $__)
        {
            $row   = $lv[$id] ?? [];
            $stats = [];
            foreach ($row as $k => $v)
                if (is_numeric($v) && !in_array($k, $keep) && !in_array($k, ['name', 'nsockets', 'displayid', 'side', 'dura', 'scadist', 'scaflags', 'dmgtype1', 'dmgmin1', 'dmgmax1', 'mledmgmin', 'mledmgmax', 'mlespeed', 'rgddmgmin', 'rgddmgmax', 'rgdspeed', 'source', 'sourcemore', 'reqclass', 'reqrace', 'heroic', 'gemcolor']))
                    $stats[$k] = $v + 0;

            $out[$id] = array(
                'id'       => $id,
                'name'     => Lang::unescapeUISequences($list->getField('name', true), Lang::FMT_RAW),
                'quality'  => (int)$list->getField('quality'),
                'icon'     => strtolower($list->getField('iconString') ?: DEFAULT_ICON),
                'slot'     => (int)$list->getField('slot'),
                'class'    => (int)$list->getField('class'),
                'subclass' => (int)$list->getField('subClass'),
                'level'    => (int)$list->getField('itemLevel'),
                'reqlevel' => (int)$list->getField('requiredLevel'),
                'heroic'   => (bool)($list->getField('flags') & ITEM_FLAG_HEROIC),
                'stats'    => self::cleanStats($stats),
                'sockets'  => array_values(array_filter([(int)$list->getField('socketColor1'), (int)$list->getField('socketColor2'), (int)$list->getField('socketColor3')])),
                'bonus'    => self::cleanStats($row['socketbonusstat'] ?? null) ?: null,
                'set'      => (int)$list->getField('itemset'),
                'gemColor' => (int)$list->getField('gemColorMask'),
                'gs'       => (int)($row['gearscore'] ?? 0)
            );
        }

        // item sets: name and pieces, to count what is worn
        if ($sets = array_filter(array_unique(array_column($out, 'set'))))
        {
            $setList = new ItemsetList([['id', array_values($sets)]]);
            $info    = [];
            foreach ($setList->iterate() as $sid => $__)
            {
                $bonus = [];
                for ($i = 1; $i <= 8; $i++)
                    if (($sp = (int)$setList->getField('spell'.$i)) && ($n = (int)$setList->getField('bonus'.$i)))
                        $bonus[] = [$n, $sp];
                $info[$sid] = ['name' => $setList->getField('name', true), 'bonus' => $bonus];
            }

            $spellIds = [];
            foreach ($info as $s)
                foreach ($s['bonus'] as $b)
                    $spellIds[] = $b[1];

            if ($spellIds)
            {
                $spells = new SpellList([['id', array_values(array_unique($spellIds))], Cfg::get('SQL_LIMIT_NONE')]);
                $desc   = [];
                foreach ($spells->iterate() as $spId => $__)
                    $desc[$spId] = $spells->parseText('description')[0] ?? '';

                foreach ($info as $sid => $s)
                    foreach ($s['bonus'] as $k => $b)
                        $info[$sid]['bonus'][$k][1] = strip_tags($desc[$b[1]] ?? '');
            }

            foreach ($out as $id => $it)
                if ($it['set'] && isset($info[$it['set']]))
                    $out[$id]['setInfo'] = $info[$it['set']];
        }

        return $out;
    }

    // gems: their colour mask (1 meta, 2 red, 4 yellow, 8 blue - as the sockets) and stats
    private static function gems(string $q) : array
    {
        $ids = DB::Aowow()->selectCol(
           'SELECT i.`id` FROM ?_items i
            WHERE  i.`class` = ?d AND i.`subClass` IN (0, 1, 2, 3, 4, 5, 6, 8) AND i.`quality` BETWEEN 2 AND 5 AND i.`gemEnchantmentId` > 0 AND (i.`cuFlags` & ?d) = 0
              { AND (i.`name_loc0` LIKE ? OR i.`name_loc'.Lang::getLocale()->value.'` LIKE ?) }
            ORDER  BY i.`itemLevel` DESC, i.`quality` DESC
            LIMIT  60',
            ITEM_CLASS_GEM, CUSTOM_EXCLUDE_FOR_LISTVIEW,
            $q !== '' ? '%'.$q.'%' : DBSIMPLE_SKIP, $q !== '' ? '%'.$q.'%' : DBSIMPLE_SKIP
        );

        return array_values(self::items($ids));
    }

    // permanent enchants (spells with ENCHANT_ITEM) that may go on this inventory type
    private static function enchants(int $inv) : array
    {
        $weapon = in_array($inv, [13, 15, 17, 21, 22, 25, 26]);
        $rows   = DB::Aowow()->select(
           'SELECT s.`effect1MiscValue` AS "ench", '.str_replace('i.', 's.', self::nameCol()).' AS "name"
            FROM   ?_spell s
            WHERE  s.`effect1Id` = ?d AND s.`effect1MiscValue` > 0 AND (s.`cuFlags` & ?d) = 0
              AND  ((s.`equippedItemClass` = ?d AND (s.`equippedItemInventoryTypeMask` & ?d)) { OR s.`equippedItemClass` = ?d })',
            SPELL_EFFECT_ENCHANT_ITEM, CUSTOM_EXCLUDE_FOR_LISTVIEW,
            ITEM_CLASS_ARMOR, 1 << $inv,
            $weapon ? ITEM_CLASS_WEAPON : DBSIMPLE_SKIP
        );

        $bySpell = [];
        foreach ($rows as $r)
            $bySpell[(int)$r['ench']] ??= $r['name'];

        if (!$bySpell)
            return [];

        $list = new EnchantmentList([['id', array_keys($bySpell)], Cfg::get('SQL_LIMIT_NONE')]);
        $lv   = $list->getListviewData();
        $out  = [];
        foreach ($lv as $id => $e)
        {
            $out[] = ['id' => $id, 'name' => $e['name'], 'source' => $bySpell[$id] ?? '', 'stats' => self::cleanStats($e)];
        }

        usort($out, fn($a, $b) => count($b['stats']) <=> count($a['stats']) ?: strcmp($a['name'], $b['name']));
        return $out;
    }

    protected function generateContent() { }

    protected function generateTitle()
    {
        array_unshift($this->title, $this->name);
    }

    protected function generatePath() { }
}

?>
