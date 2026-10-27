<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');

/*
 * Spawn pools on the object / NPC map.
 *
 * Every pool the viewed object (or creature) belongs to gets one of the 16 group colours. Every distinct
 * object / creature in those pools gets a pin shape (the viewed one is always a circle), so a pool that
 * mixes e.g. Copper Vein and Tin Vein shows both in the same colour but with different shapes.
 *
 *   $pm = new PoolMap(Type::OBJECT, $id, $name);
 *   if ($pm->load())  $subject->setSpawnColorMap($pm->colorMap());     // before getSpawns()
 *   ... $spawns = $subject->getSpawns(SPAWNINFO_FULL) ...
 *   $pm->inject($spawns, $map['extra']);                               // other members of the pools
 *   $info = $pm->info($spawns);                                        // data for the legend (template)
 */
class PoolMap
{
    public const SHAPES = 6;                                 // circle, diamond, triangle, square, hexagon, star
    public const ORDER  = [0, 3, 1, 2, 4, 5];                // handed out as: circle (viewed), square, diamond, triangle, hexagon, star
    public const COLORS = 16;                                // the loot group colours (css: .pool-g-1 .. .pool-g-16)

    private $type;
    private $typeId;
    private $name;
    private $poolTable;
    private $spawnTable;
    private $aowowTable;

    private $pools   = [];                                   // pool_entry => ['color', 'max', 'total', 'desc']
    private $own     = [];                                   // guid => pool_entry   (viewed entry)
    private $foreign = [];                                   // guid => [pool_entry, entry]
    private $entries = [];                                   // entry => ['name', 'shape', 'count']

    public function __construct(int $type, int $typeId, string $name)
    {
        $this->type   = $type;
        $this->typeId = $typeId;
        $this->name   = $name;

        if ($type == Type::NPC)
            [$this->poolTable, $this->spawnTable, $this->aowowTable] = ['pool_creature',   'creature',   '?_creature'];
        else
            [$this->poolTable, $this->spawnTable, $this->aowowTable] = ['pool_gameobject', 'gameobject', '?_objects'];
    }

    public function load() : bool
    {
        $own = DB::World()->select(
            'SELECT pm.`guid`, pm.`pool_entry`, COALESCE(pt.`max_limit`, 0) AS "max", COALESCE(pt.`description`, "") AS "desc"
             FROM   '.$this->poolTable.' pm
             JOIN   '.$this->spawnTable.' s ON s.`guid` = pm.`guid`
             LEFT JOIN pool_template pt ON pt.`entry` = pm.`pool_entry`
             WHERE  s.`id` = ?d',
            $this->typeId
        );
        if (!$own)
            return false;

        $poolIds = array_values(array_unique(array_map('intval', array_column($own, 'pool_entry'))));
        sort($poolIds);
        foreach ($poolIds as $i => $pe)
            $this->pools[$pe] = ['color' => ($i % self::COLORS) + 1, 'max' => 0, 'total' => 0, 'desc' => ''];

        foreach ($own as $r)
        {
            $pe = (int)$r['pool_entry'];
            $this->own[(int)$r['guid']] = $pe;
            $this->pools[$pe]['max']    = (int)$r['max'];
            $this->pools[$pe]['desc']   = $r['desc'];
        }

        // every member of these pools, with its entry
        $counts = [$this->typeId => 0];
        foreach (DB::World()->select(
            'SELECT pm.`guid`, pm.`pool_entry`, s.`id`
             FROM   '.$this->poolTable.' pm
             JOIN   '.$this->spawnTable.' s ON s.`guid` = pm.`guid`
             WHERE  pm.`pool_entry` IN (?a)',
            $poolIds
        ) ?: [] as $r)
        {
            $pe    = (int)$r['pool_entry'];
            $entry = (int)$r['id'];
            $this->pools[$pe]['total']++;
            $counts[$entry] = ($counts[$entry] ?? 0) + 1;
            if ($entry != $this->typeId)
                $this->foreign[(int)$r['guid']] = [$pe, $entry];
        }

        // shapes: the viewed entry is the circle, the others by how often they appear; entries sharing a name
        // (several "Tin Vein" templates) share the shape, so the map reads by what you'd gather / fight
        $names = DB::Aowow()->selectCol('SELECT `id` AS ARRAY_KEY, `name_loc0` FROM '.$this->aowowTable.' WHERE `id` IN (?a)', array_keys($counts));
        $names[$this->typeId] = $this->name;

        $byName = [];                                        // name => total count
        foreach ($counts as $entry => $n)
        {
            $nm = $names[$entry] ?? ('#'.$entry);
            $byName[$nm] = ($byName[$nm] ?? 0) + $n;
        }
        unset($byName[$this->name]);
        arsort($byName);

        $shapeOf = [$this->name => 0];
        $i = 1;
        foreach (array_keys($byName) as $nm)
            $shapeOf[$nm] = self::ORDER[$i++ % self::SHAPES];

        foreach ($counts as $entry => $n)
        {
            $nm = $names[$entry] ?? ('#'.$entry);
            $this->entries[$entry] = ['name' => $nm, 'shape' => $shapeOf[$nm], 'count' => $n];
        }

        return true;
    }

    // guid => pin options for the viewed entry's own spawns (BaseType::setSpawnColorMap)
    public function colorMap() : array
    {
        $map = [];
        foreach ($this->own as $guid => $pe)
            $map[$guid] = ['type' => $this->pools[$pe]['color'], 'pool' => $pe, 'max' => $this->pools[$pe]['max'], 'shape' => 0];

        return $map;
    }

    // 0 = viewed entry; a mixed spot takes the first other shape handed out (lowest rank above 0)
    private function rank(int $shape) : int
    {
        $r = array_search($shape, self::ORDER);
        return $r ? self::SHAPES - $r : 0;
    }

    private function poolLine(int $pe) : string
    {
        $p = $this->pools[$pe];
        return '<span class="pool-tag pool-g-'.$p['color'].'">Pool '.$pe.'</span> <span class="q0">'.$p['max'].' of '.$p['total'].' active at a time</span>';
    }

    // add the other members of the pools to the map, then merge pins that sit on the same spot
    public function inject(array &$spawns, ?array &$zoneNames) : void
    {
        if ($this->foreign && ($rows = DB::Aowow()->select(
            'SELECT `guid`, `areaId`, `floor`, `posX`, `posY` FROM ?_spawns WHERE `type` = ?d AND `guid` IN (?a) AND `posX` > 0 AND `posY` > 0',
            $this->type, array_keys($this->foreign)
        )))
        {
            foreach ($rows as $r)
            {
                [$pe, $entry] = $this->foreign[(int)$r['guid']];
                $areaId = (int)$r['areaId'];
                $floor  = (int)$r['floor'];

                if (!isset($spawns[$areaId]))
                {
                    $spawns[$areaId] = [];
                    $zoneNames[$areaId] = ZoneList::getName($areaId);
                }
                if (!isset($spawns[$areaId][$floor]))
                    $spawns[$areaId][$floor] = ['coords' => [], 'count' => 0];

                // prepend: the viewed entry's pins render on top
                array_unshift($spawns[$areaId][$floor]['coords'], [$r['posX'], $r['posY'], [
                    'type'    => $this->pools[$pe]['color'],
                    'pool'    => $pe,
                    'shape'   => $this->entries[$entry]['shape'],
                    'tooltip' => [$this->entries[$entry]['name'] => ['info' => [6 => $this->poolLine($pe)]]],
                ]]);
            }
        }

        // pins rounded to the same 0.1 spot: one pin listing everything there (viewed entry first)
        foreach ($spawns as &$areaData)
        {
            foreach ($areaData as &$floorData)
            {
                $cells = [];
                foreach ($floorData['coords'] as $idx => $c)
                    $cells[number_format((float)$c[0], 1).'|'.number_format((float)$c[1], 1)][] = $idx;

                $out = [];
                foreach ($cells as $idxs)
                {
                    if (count($idxs) == 1)
                    {
                        $out[] = $floorData['coords'][$idxs[0]];
                        continue;
                    }

                    $tt = $pools = [];
                    $lead = null;
                    foreach ($idxs as $i)
                    {
                        $o = $floorData['coords'][$i][2] ?? [];
                        if (isset($o['pool']))
                            $pools[$o['pool']] = true;
                        foreach ($o['tooltip'] ?? [] as $nm => $data)
                            $tt[$nm] ??= $data;
                        if (isset($o['pool']) && (!$lead || $this->rank($o['shape'] ?? 0) > $this->rank($lead['shape'] ?? 0)))
                            $lead = $o;          // mixed spot: show the other object's shape (square first)
                    }

                    if (!$pools || count($tt) <= 1)          // not a pool spot, or the same thing twice: keep as is
                    {
                        foreach ($idxs as $i)
                            $out[] = $floorData['coords'][$i];
                        continue;
                    }

                    if (isset($tt[$this->name]))            // viewed entry first in the tooltip
                        $tt = [$this->name => $tt[$this->name]] + $tt;

                    $base  = $floorData['coords'][$idxs[0]];
                    $out[] = [$base[0], $base[1], [
                        'type'    => $lead['type'],
                        'pool'    => $lead['pool'],
                        'pools'   => array_keys($pools),
                        'shape'   => $lead['shape'] ?? 0,
                        'multi'   => true,
                        'tooltip' => $tt,
                    ]];
                }

                $floorData['coords'] = $out;
                $floorData['count']  = count($out);
            }
            unset($floorData);
        }
        unset($areaData);
    }

    // legend data: pools (colour, limits, members, pins per zone) + entries (shape)
    public function info(array $spawns) : array
    {
        $pins = [];                                          // pool => entry => areaId => n
        foreach ($spawns as $areaId => $areaData)
            foreach ($areaData as $floorData)
                foreach ($floorData['coords'] as $c)
                {
                    $o = $c[2] ?? [];
                    if (!isset($o['pool']))
                        continue;
                    foreach ($o['pools'] ?? [$o['pool']] as $pe)
                        $pins[$pe][$areaId] = ($pins[$pe][$areaId] ?? 0) + 1;
                }

        $members = [];                                       // pool => entry => n
        foreach ($this->own as $pe)
            $members[$pe][$this->typeId] = ($members[$pe][$this->typeId] ?? 0) + 1;
        foreach ($this->foreign as [$pe, $entry])
            $members[$pe][$entry] = ($members[$pe][$entry] ?? 0) + 1;

        $pools = [];
        foreach ($this->pools as $pe => $p)
            $pools[] = [
                'id'      => $pe,
                'color'   => $p['color'],
                'max'     => $p['max'],
                'total'   => $p['total'],
                'desc'    => $p['desc'],
                'members' => $members[$pe] ?? [],
                'areas'   => $pins[$pe] ?? [],
            ];

        $zones = [];
        foreach (array_keys($spawns) as $areaId)
            $zones[$areaId] = ZoneList::getName($areaId);

        return ['viewed' => $this->typeId, 'type' => $this->type == Type::NPC ? 'npc' : 'object', 'pools' => $pools, 'entries' => $this->entries, 'zones' => $zones];
    }
}

?>
