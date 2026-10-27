<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');

if (!CLI)
    die('not in cli mode');


/*
 * Map points of interest for the ?maps page (Questie-like): flight masters, innkeepers, spirit healers, auctioneers,
 * bankers, battlemasters, stable masters, mailboxes, meeting stones, dungeon / raid entrances, quest hubs, world PvP
 * areas and faction territory - plus a small info set (expansion + territory per zone).
 *
 * Positions come from ?_spawns (already converted to zone map coords by the 'spawns' step) and ?_zones (instance
 * entrances). Continent maps get flight masters, instance entrances and territory shields, converted through the
 * zone rects that 'zoneshapes' stores with the continent outlines. Quest hubs and world PvP markers use the subzone
 * outlines from 'zoneshapes'.
 *
 * Output:
 *   static/js/zone-pois/<locale>/<mapZoneId>.json : [{t: type, x, y, n: name, ...}, ..]   (fetched on demand)
 *   datasets/map-info                              : var g_map_info = {exp: {zoneId: 1|2}, terr: {zoneId: 0..5}, par: {..}, rt: [zoneId, ..]}
 *   static/js/zone-routes/<mapZoneId>.json         : [{t: boat|zep|gun, r: [A, H], l: [[x, y, x, y, ..], ..]}, ..]  transport paths in travel order
 */
CLISetup::registerSetup("build", new class extends SetupScript
{
    protected $info = array(
        'mappois' => [[], CLISetup::ARGV_PARAM, 'Compile flight masters, innkeepers, instance entrances, quest hubs, .. for the maps page.']
    );

    protected $setupAfter      = [['spawns', 'creature', 'objects', 'zones', 'factions'], ['zoneshapes']];
    protected $dbcSourceFiles  = ['areatrigger'];
    protected $worldDependency = ['npc_vendor', 'transports', 'areatrigger_teleport', 'spell_target_position', 'gameobject', 'graveyard_zone'];
    protected $requiredDirs = ['datasets/', 'static/js/zone-pois/', 'static/js/zone-nb/', 'static/js/zone-routes/'];
    protected $localized    = true;

    private const OUT_POIS  = 'static/js/zone-pois/%s/%d.json';
    private const OUT_INFO  = 'datasets/map-info';
    private const OUT_NB    = 'static/js/zone-nb/%d.json';   // neighbouring zones per zone map (outlines / edge buttons)
    private const OUT_RT    = 'static/js/zone-routes/%d.json';   // transport paths per map
    private const PASS_MAPS = [369 => 'Deeprun Tram'];  // maps you only travel through: map => label
    private const SHAPES    = 'datasets/zone-shapes';
    private const SUBSHAPES = 'static/js/zone-shapes/%d.json';

    private const CONTINENTS = [-3, -6, -2, -5];

    // npcflag => poi type
    private const NPC_TYPES = array(
        0x00002000 => 'fm',                                 // UNIT_NPC_FLAG_FLIGHTMASTER
        0x00010000 => 'inn',                                // UNIT_NPC_FLAG_INNKEEPER
        0x0000C000 => 'sh',                                 // UNIT_NPC_FLAG_SPIRITHEALER | UNIT_NPC_FLAG_SPIRITGUIDE
        0x00200000 => 'ah',                                 // UNIT_NPC_FLAG_AUCTIONEER
        0x00020000 => 'bank',                               // UNIT_NPC_FLAG_BANKER
        0x00100000 => 'bm',                                 // UNIT_NPC_FLAG_BATTLEMASTER
        0x00400000 => 'stable'                              // UNIT_NPC_FLAG_STABLEMASTER
    );
    private const NPC_QUESTGIVER = 0x2;
    private const NPC_TRAINER    = 0x10;
    private const NPC_VENDOR     = 0x80;
    private const NPC_REPAIR     = 0x1000;

    // ?_creature.trainerType
    private const TRAINER_CLASS     = 0;
    private const TRAINER_MOUNTS    = 1;
    private const TRAINER_TRADESKILL = 2;

    // trainerRequirement (skill line) => poi type
    private const PROFESSIONS = array(
        171 => 'p-alch',  164 => 'p-bs',    333 => 'p-ench',  202 => 'p-eng',   182 => 'p-herb', 773 => 'p-insc', 755 => 'p-jc',
        165 => 'p-lw',    186 => 'p-mine',  393 => 'p-skin',  197 => 'p-tail',  185 => 'p-cook', 129 => 'p-aid',  356 => 'p-fish'
    );

    // vendor categories by the items they sell (Questie-like)
    private const VENDOR_MIN_ITEMS = 2;                     // sells at least this many items of a category
    private const SPELL_CATEGORY_FOOD  = 11;
    private const SPELL_CATEGORY_DRINK = 59;

    // gameobject type => poi type
    private const OBJECT_TYPES = array(
        19 => 'mail',                                       // GAMEOBJECT_TYPE_MAILBOX
        23 => 'stone'                                       // GAMEOBJECT_TYPE_MEETINGSTONE
    );

    // ?_zones.type => poi type (g_zone_instancetypes)
    private const INSTANCE_TYPES = array(
        2 => 'dg',                                          // dungeon
        5 => 'dg',                                          // dungeon w/ heroic
        3 => 'rd',                                          // raid
        7 => 'rd',                                          // raid 10/25
        8 => 'rd'                                           // raid 10/25 w/ heroic
    );

    private const AREA_FLAG_OUTDOOR_PVP = 0x00008000;       // world pvp objectives: EPL towers, Halaa, Hellfire towers, ..
    private const AREA_FLAG_TOWN        = 0x00200000;
    private const AREA_FLAG_CAPITAL     = 0x00000100;       // capital cities sit inside a zone of the same faction: no extra shield
    private const TERR_WORLD_PVP        = 5;                // ?_zones.faction (g_zone_territories): Wintergrasp
    private const HUB_MIN_GIVERS        = 3;                // subzone with at least this many quest givers (or a town with one) is a quest hub
    private const MERGE_DIST          = 0.8;                // % - same-type markers closer than this are merged into one

    private const NB_MIN_PX    = 1200;                      // visible neighbour area on a zone map (px of 1002x668) to get an outline
    private const NB_TOUCH_PCT = 1.0;                       // continent outlines closer than this (%) are neighbours

    private $rects    = [];                                 // zoneId => [contZoneId, [x0, y0, x1, y1]]
    private $capitals = [];                                 // zoneId => true
    private $outlines = [];                                 // contZoneId => [zoneId => rings]

    public function generate() : bool
    {
        if (!$this->loadShapes())
        {
            CLI::write('[mappois] '.self::SHAPES.' not found or outdated - run --build=zoneshapes first.', CLI::LOG_ERROR);
            return false;
        }

        $zones = DB::Aowow()->select('SELECT `id` AS ARRAY_KEY, `id`, `mapId`, `parentArea`, `flags`, `faction`, `expansion`, `type`, `levelMin`, `levelMax`, `parentMapId`, `parentX`, `parentY`, `name_loc0`, `name_loc2`, `name_loc3`, `name_loc4`, `name_loc6`, `name_loc8` FROM ?_zones');
        if (!$zones)
        {
            CLI::write('[mappois] could not read ?_zones', CLI::LOG_ERROR);
            return false;
        }

        foreach ($zones as $id => $z)
            if ($z['flags'] & self::AREA_FLAG_CAPITAL)
                $this->capitals[$id] = true;

        $mask = 0;
        foreach (self::NPC_TYPES as $m => $_)
            $mask |= $m;

        $npcs = DB::Aowow()->select(
           'SELECT s.`areaId`, s.`floor`, s.`posX`, s.`posY`, c.`id`, c.`npcflag`, c.`trainerType`, c.`trainerRequirement`, IFNULL(ft.`A`, 0) AS "A", IFNULL(ft.`H`, 0) AS "H",
                   c.`name_loc0`, c.`name_loc2`, c.`name_loc3`, c.`name_loc4`, c.`name_loc6`, c.`name_loc8`,
                   c.`subname_loc0`, c.`subname_loc2`, c.`subname_loc3`, c.`subname_loc4`, c.`subname_loc6`, c.`subname_loc8`
            FROM   ?_spawns s
            JOIN   ?_creature c ON c.`id` = s.`typeId`
            LEFT JOIN ?_factiontemplate ft ON ft.`id` = c.`faction`
            WHERE  s.`type` = ?d AND s.`areaId` > 0 AND (c.`npcflag` & ?d OR c.`subname_loc0` IN ("Barber", "Weapon Master"))',
            Type::NPC, $mask | self::NPC_QUESTGIVER | self::NPC_TRAINER | self::NPC_VENDOR | self::NPC_REPAIR
        );

        $objects = DB::Aowow()->select(
           'SELECT s.`areaId`, s.`floor`, s.`posX`, s.`posY`, o.`id`, o.`type`,
                   o.`name_loc0`, o.`name_loc2`, o.`name_loc3`, o.`name_loc4`, o.`name_loc6`, o.`name_loc8`
            FROM   ?_spawns s
            JOIN   ?_objects o ON o.`id` = s.`typeId`
            WHERE  s.`type` = ?d AND s.`areaId` > 0 AND o.`type` IN (?a)',
            Type::OBJECT, array_keys(self::OBJECT_TYPES)
        );

        CLI::write('[mappois] '.count($npcs ?: []).' npc spawns, '.count($objects ?: []).' object spawns, '.count($zones).' areas');

        $vendorCats = $this->vendorCategories(array_unique(array_column(array_filter($npcs ?: [], fn($n) => $n['npcflag'] & self::NPC_VENDOR), 'id')));

        // [mapZoneId => [poi, ..]], names are filled per locale
        $pois    = [];
        $givers  = [];                                      // zoneId => [[x, y, A, H], ..]

        foreach ($npcs ?: [] as $n)
        {
            if ($n['floor'])                                // multi-floor maps: skip
                continue;

            $zoneId = (int)$n['areaId'];
            if (($n['npcflag'] & self::NPC_QUESTGIVER) && ($n['A'] >= 0 || $n['H'] >= 0))   // not hostile to everyone
                $givers[$zoneId][] = [(float)$n['posX'], (float)$n['posY'], (int)$n['A'], (int)$n['H']];

            foreach ($this->npcTypes($n, $vendorCats[$n['id']] ?? []) as $t)
                $pois[$zoneId][] = ['t' => $t, 'x' => (float)$n['posX'], 'y' => (float)$n['posY'], 'id' => (int)$n['id'], 'r' => [(int)$n['A'], (int)$n['H']], '_src' => $n];
        }

        foreach ($objects ?: [] as $o)
            if (!$o['floor'])
                $pois[(int)$o['areaId']][] = ['t' => self::OBJECT_TYPES[$o['type']], 'x' => (float)$o['posX'], 'y' => (float)$o['posY'], '_src' => $o];

        // instance entrances
        $nInst  = 0;
        $parent = [];                                       // instance zoneId => zoneId of its entrance ("Back to" on the maps page)
        foreach ($zones as $z)
        {
            if (!isset(self::INSTANCE_TYPES[$z['type']]) || ($z['parentX'] == 0 && $z['parentY'] == 0))
                continue;

            // the entrance is stored in world coords of the parent map
            $pos = $this->entrancePos((int)$z['parentMapId'], (float)$z['parentX'], (float)$z['parentY']);
            if (!$pos)
                continue;

            [$zoneId, $x, $y] = $pos;
            $parent[(int)$z['id']] = $zoneId;
            $pois[$zoneId][] = ['t' => self::INSTANCE_TYPES[$z['type']], 'x' => $x, 'y' => $y, 'z' => (int)$z['id'], 'l' => [(int)$z['levelMin'], (int)$z['levelMax']], '_src' => $z];
            $nInst++;
        }

        // spirit healers: which faction resurrects at their graveyard
        $this->tagGraveyards($pois);

        // travel: boats / zeppelins (transport stops), map crossings (Dark Portal, ..) and portals
        $nTravel = 0;
        foreach ($this->travelPois() as [$zoneId, $p])
        {
            $pois[$zoneId][] = $p;
            $nTravel++;
        }
        CLI::write('[mappois] '.$nTravel.' docks / portals');

        // quest hubs + world pvp areas from the subzone outlines
        $nHubs = $nPvP = 0;
        foreach ($this->subzoneMaps() as $zoneId => $subs)
        {
            $byArea = [];
            foreach ($givers[$zoneId] ?? [] as $g)
                foreach ($subs as $areaId => $e)
                    if ($this->pointInRings($g[0], $g[1], $e['p']))
                    {
                        $byArea[$areaId][] = $g;
                        break;
                    }

            foreach ($byArea as $areaId => $gs)
            {
                $isTown = isset($zones[$areaId]) && ($zones[$areaId]['flags'] & self::AREA_FLAG_TOWN);
                if (count($gs) < ($isTown ? 1 : self::HUB_MIN_GIVERS))
                    continue;

                $x = array_sum(array_column($gs, 0)) / count($gs);
                $y = array_sum(array_column($gs, 1)) / count($gs);
                // reaction of the majority: friendly / hostile / neutral
                $react = function ($idx) use ($gs) {
                    $f = count(array_filter($gs, fn($g) => $g[$idx] > 0));
                    $h = count(array_filter($gs, fn($g) => $g[$idx] < 0));
                    return $f * 2 > count($gs) ? 1 : ($h * 2 > count($gs) ? -1 : 0);
                };
                $A = $react(2);
                $H = $react(3);
                $pois[$zoneId][] = ['t' => 'qh', 'x' => round($x, 1), 'y' => round($y, 1), 'c' => count($gs), 'r' => [$A, $H], 'q' => $zoneId, '_src' => $zones[$areaId] ?? ['name_loc0' => '']];
                $nHubs++;
            }

            foreach ($subs as $areaId => $e)
            {
                if (!isset($zones[$areaId]) || !($zones[$areaId]['flags'] & self::AREA_FLAG_OUTDOOR_PVP))
                    continue;

                [$x, $y] = $this->labelPoint($e['p']);
                $pois[$zoneId][] = ['t' => 'pvp', 'x' => $x, 'y' => $y, '_src' => $zones[$areaId]];
                $nPvP++;
            }
        }

        // continents: flight masters, instance entrances, territory shields
        foreach ($pois as $zoneId => $list)
        {
            if (!isset($this->rects[$zoneId]))
                continue;

            [$cont, $r] = $this->rects[$zoneId];
            foreach ($list as $p)
            {
                if (!in_array($p['t'], ['fm', 'dg', 'rd', 'boat', 'zep', 'gun', 'portal']))
                    continue;

                $p['x'] = round($r[0] + $p['x'] / 100 * ($r[2] - $r[0]), 2);
                $p['y'] = round($r[1] + $p['y'] / 100 * ($r[3] - $r[1]), 2);
                $pois[$cont][] = $p;
            }
        }

        $info = ['exp' => [], 'terr' => [], 'par' => $parent];
        foreach ($this->rects as $zoneId => [$cont, $r])
        {
            if (!isset($zones[$zoneId]))
                continue;

            $terr = (int)$zones[$zoneId]['faction'];
            $info['terr'][$zoneId] = $terr;

            if (($terr == 0 || $terr == 1) && !($zones[$zoneId]['flags'] & self::AREA_FLAG_CAPITAL))   // alliance / horde territory
            {
                [$x, $y] = $this->labelPoint($this->outlines[$cont][$zoneId]);
                $pois[$cont][] = ['t' => $terr ? 'th' : 'ta', 'x' => $x, 'y' => $y, 'z' => $zoneId, '_src' => $zones[$zoneId]];
            }
            else if ($terr == self::TERR_WORLD_PVP)         // whole-zone world pvp (Wintergrasp)
            {
                [$x, $y] = $this->labelPoint($this->outlines[$cont][$zoneId]);
                $pois[$cont][] = ['t' => 'pvp', 'x' => $x, 'y' => $y, 'z' => $zoneId, '_src' => $zones[$zoneId]];
            }
        }

        foreach ($zones as $z)
            if ($z['expansion'] > 0 && !$z['parentArea'])
                $info['exp'][$z['id']] = (int)$z['expansion'];

        foreach ($pois as $zoneId => &$list)
            $list = $this->merge($list);
        unset($list);

        CLI::write('[mappois] '.$nInst.' instance entrances, '.$nHubs.' quest hubs, '.$nPvP.' world pvp areas on '.count($pois).' maps');

        // neighbouring zones (always both ways)
        $nNb = 0;
        foreach ($this->buildNeighbours() as $zoneId => $list)
        {
            $nNb += count($list);
            if (!CLISetup::writeFile(sprintf(self::OUT_NB, $zoneId), json_encode($list, JSON_UNESCAPED_SLASHES)))
                $this->success = false;
        }
        CLI::write('[mappois] '.$nNb.' neighbour links');

        // transport paths
        $info['rt'] = [];
        foreach ($this->transportRoutes() as $zoneId => $list)
        {
            $info['rt'][] = $zoneId;
            if (!CLISetup::writeFile(sprintf(self::OUT_RT, $zoneId), json_encode($list, JSON_UNESCAPED_SLASHES)))
                $this->success = false;
        }
        CLI::write('[mappois] transport paths on '.count($info['rt']).' maps');

        if (!CLISetup::writeFile(self::OUT_INFO, "var g_map_info = ".json_encode($info).";\n"))
            $this->success = false;

        foreach (CLISetup::$locales as $loc)
        {
            Lang::load($loc);
            CLISetup::writeDir(sprintf(dirname(self::OUT_POIS), $loc->json()));

            foreach ($pois as $zoneId => $list)
            {
                $out = [];
                foreach ($list as $p)
                {
                    $src = $p['_src'];
                    unset($p['_src']);

                    $p['n'] = Util::localizedString($src, 'name');
                    if (isset($p['more']))
                        $p['n'] .= ' (+'.$p['more'].')';
                    unset($p['more']);

                    if (isset($src['subname_loc0']) && ($sub = Util::localizedString($src, 'subname')))
                        $p['s'] = $sub;

                    $out[] = $p;
                }

                if (!CLISetup::writeFile(sprintf(self::OUT_POIS, $loc->json(), $zoneId), json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)))
                    $this->success = false;
            }
        }

        return $this->success;
    }

    /*  boats & zeppelins: stops of the transport's taxi path (TaxiPathNode.dbc nodes with a delay), linked to the next stop
     *  map crossings: areatrigger_teleport between two continents (Dark Portal)
     *  portals: spellcaster gameobjects (Shattrath, Dalaran, ..) whose spell teleports to a continent
     *  @return array [[zoneId, poi], ..]
     */
    private function travelPois() : array
    {
        $out = [];

        // transports
        $stops = $this->taxiPathStops();
        foreach (DB::World()->select('SELECT t.`entry`, t.`name`, gt.`name` AS "goName", gt.`Data0` AS "pathId", gt.`Data1` AS "speed", gt.`Data2` AS "accel" FROM transports t JOIN gameobject_template gt ON gt.`entry` = t.`entry` WHERE gt.`type` = 15') ?: [] as $tr)
        {
            // timings: wait at each stop, travel time of each leg (accelerating to speed and braking again), round trip
            $speed = max(1, (float)$tr['speed'] ?: 30);
            $accel = max(0.1, (float)$tr['accel'] ?: 1);
            $legT  = function ($d) use ($speed, $accel) {
                $dAcc = $speed * $speed / $accel;           // accelerate + brake
                return $d >= $dAcc ? $d / $speed + $speed / $accel : 2 * sqrt($d / $accel);
            };

            $pos = $timing = [];
            $round = 0;
            foreach ($stops[$tr['pathId']] ?? [] as [$map, $x, $y, $wait, $leg])
            {
                $round += $wait + $legT($leg);
                if (in_array($map, [0, 1, 530, 571]) && ($zp = $this->entrancePos($map, $x, $y)))
                {
                    $pos[]    = $zp;
                    $timing[] = [$wait, $legT($leg)];
                }
            }

            $this->roundTrip[(int)$tr['pathId']] = (int)round($round);
            if (count($pos) < 2)
                continue;

            $desc = $tr['name'] ?: $tr['goName'];
            [$kind, $r, $label] = $this->transportKind($desc);
            $ship = preg_match('/\("([^"]+)"\)/', $desc, $m) ? $m[1] : $tr['goName'];

            for ($i = 0; $i < count($pos); $i++)
            {
                [$zoneId, $x, $y] = $pos[$i];
                $dest = $pos[($i + 1) % count($pos)];
                if ($dest[0] == $zoneId && count($pos) == 2)
                    continue;

                $p = ['t' => $kind, 'x' => round($x, 1), 'y' => round($y, 1), 'z' => $dest[0], 'r' => $r,
                      'w' => (int)$timing[$i][0], 'tt' => (int)round($timing[$i][1]), 'rt' => (int)round($round), '_src' => ['name_loc0' => $ship]];
                if ($label)
                    $p['k'] = $label;               // Turtle, ..: shown instead of Boat / Zeppelin
                $out[] = [$zoneId, $p];
            }
        }

        // map crossings (Dark Portal, ..) and teleports to another zone on the same map (Rut'theran Village <-> Darnassus)
        $tele = DB::World()->select('SELECT `ID` AS ARRAY_KEY, `Name`, `target_map`, `target_position_x` AS "tx", `target_position_y` AS "ty" FROM areatrigger_teleport WHERE `target_map` IN (?a)', [0, 1, 530, 571]);
        if ($tele && ($trig = DB::Aowow()->select('SELECT `id` AS ARRAY_KEY, `mapId`, `posX`, `posY` FROM dbc_areatrigger WHERE `id` IN (?a) AND `mapId` IN (?a)', array_keys($tele), [0, 1, 530, 571])))
        {
            foreach ($trig as $id => $t)
            {
                $tp = $tele[$id];
                if (stripos($tp['Name'], 'Leap of Faith') !== false)    // fall reset, not a way to travel
                    continue;

                $src = $this->entrancePos((int)$t['mapId'], (float)$t['posX'], (float)$t['posY']);
                $dst = $this->entrancePos((int)$tp['target_map'], (float)$tp['tx'], (float)$tp['ty']);
                if ($src && $dst && ($t['mapId'] != $tp['target_map'] || $src[0] != $dst[0]))
                    $out[] = [$src[0], ['t' => 'portal', 'x' => round($src[1], 1), 'y' => round($src[2], 1), 'z' => $dst[0], '_src' => ['name_loc0' => $tp['Name']]]];
            }
        }

        // pass-through maps (Deeprun Tram): entering at one end takes you out at the other
        foreach (self::PASS_MAPS as $passMap => $label)
        {
            $in  = DB::World()->select('SELECT `ID` AS ARRAY_KEY, `target_position_x` AS "tx", `target_position_y` AS "ty" FROM areatrigger_teleport WHERE `target_map` = ?d', $passMap);
            $out2 = DB::World()->select('SELECT `ID` AS ARRAY_KEY, `target_map`, `target_position_x` AS "tx", `target_position_y` AS "ty" FROM areatrigger_teleport WHERE `target_map` IN (?a)', [0, 1, 530, 571]);
            if (!$in || !$out2)
                continue;

            $pos   = DB::Aowow()->select('SELECT `id` AS ARRAY_KEY, `mapId`, `posX`, `posY` FROM dbc_areatrigger WHERE `id` IN (?a)', array_merge(array_keys($in), array_keys($out2)));
            $exits = [];                                    // exits inside the pass-through map: [x, y, destination zone]
            foreach ($out2 as $id => $o)
                if (isset($pos[$id]) && $pos[$id]['mapId'] == $passMap && ($dst = $this->entrancePos((int)$o['target_map'], (float)$o['tx'], (float)$o['ty'])))
                    $exits[] = [(float)$pos[$id]['posX'], (float)$pos[$id]['posY'], $dst[0]];

            if (count($exits) < 2)
                continue;

            foreach ($in as $id => $e)
            {
                if (!isset($pos[$id]) || !in_array($pos[$id]['mapId'], [0, 1, 530, 571]))
                    continue;

                // the exit next to where we arrive is the way back - the farthest one is where the ride ends
                usort($exits, fn($a, $b) => (($a[0] - $e['tx']) ** 2 + ($a[1] - $e['ty']) ** 2) <=> (($b[0] - $e['tx']) ** 2 + ($b[1] - $e['ty']) ** 2));
                $far = end($exits);
                $src = $this->entrancePos((int)$pos[$id]['mapId'], (float)$pos[$id]['posX'], (float)$pos[$id]['posY']);
                if ($src && $src[0] != $far[2])
                    $out[] = [$src[0], ['t' => 'portal', 'x' => round($src[1], 1), 'y' => round($src[2], 1), 'z' => $far[2], '_src' => ['name_loc0' => $label]]];
            }
        }

        // portal objects (spellcasters) and teleport orbs (goobers casting a spell, e.g. Orb of Translocation Silvermoon <-> Undercity)
        $gos = DB::World()->select(
            'SELECT g.`map`, g.`position_x` AS "x", g.`position_y` AS "y", gt.`name`, IF(gt.`type` = 22, gt.`Data0`, gt.`Data10`) AS "spell"
             FROM   gameobject g JOIN gameobject_template gt ON gt.`entry` = g.`id`
             WHERE  ((gt.`type` = 22 AND gt.`Data0` > 0) OR (gt.`type` = 10 AND gt.`Data10` > 0)) AND g.`map` IN (?a)',
            [0, 1, 530, 571]
        );
        if ($gos)
        {
            // the orbs cast a dummy that triggers the actual teleport: follow one step of triggered spells
            $spells = array_values(array_unique(array_map('intval', array_column($gos, 'spell'))));
            $trig   = DB::Aowow()->select('SELECT `id` AS ARRAY_KEY, `effect1TriggerSpell` AS "0", `effect2TriggerSpell` AS "1", `effect3TriggerSpell` AS "2" FROM ?_spell WHERE `id` IN (?a)', $spells) ?: [];
            $ids    = $spells;
            foreach ($trig as $t)
                foreach ($t as $ts)
                    if ($ts > 0)
                        $ids[] = (int)$ts;

            $dest = DB::World()->select('SELECT `ID` AS ARRAY_KEY, `MapID`, `PositionX`, `PositionY` FROM spell_target_position WHERE `ID` IN (?a) AND `MapID` IN (?a) GROUP BY `ID`', array_unique($ids), [0, 1, 530, 571]) ?: [];

            foreach ($gos as $g)
            {
                $d = $dest[$g['spell']] ?? null;
                foreach ($trig[$g['spell']] ?? [] as $ts)
                    $d ??= $dest[$ts] ?? null;
                if (!$d)
                    continue;

                $src = $this->entrancePos((int)$g['map'], (float)$g['x'], (float)$g['y']);
                $dst = $this->entrancePos((int)$d['MapID'], (float)$d['PositionX'], (float)$d['PositionY']);
                if ($src && $dst && $src[0] != $dst[0])
                    $out[] = [$src[0], ['t' => 'portal', 'x' => round($src[1], 1), 'y' => round($src[2], 1), 'z' => $dst[0], '_src' => ['name_loc0' => $g['name']]]];
            }
        }

        // the same way out twice (portal object on an area trigger): keep one
        $seen = [];
        foreach ($out as $i => [$zoneId, $p])
        {
            if ($p['t'] != 'portal')
                continue;
            foreach ($seen[$zoneId.'-'.$p['z']] ?? [] as [$x, $y])
                if (abs($x - $p['x']) < 1.5 && abs($y - $p['y']) < 1.5)
                {
                    unset($out[$i]);
                    continue 2;
                }
            $seen[$zoneId.'-'.$p['z']][] = [$p['x'], $p['y']];
        }

        return array_values($out);
    }

    // raw client dbc (for files aowow has no table definition for)
    private function clientDbc(string $name) : ?string
    {
        foreach (CLISetup::$locales as $loc)
            foreach ($loc->gameDirs() as $dir)
            {
                $f = CLISetup::$srcDir.($dir ? $dir.DIRECTORY_SEPARATOR : '').'DBFilesClient'.DIRECTORY_SEPARATOR.$name;
                if (CLISetup::fileExists($f) && ($d = file_get_contents($f)) && substr($d, 0, 4) == 'WDBC')
                    return $d;
            }

        return null;
    }

    /*  spirit healers: which faction is sent to their graveyard (WorldSafeLocs.dbc + graveyard_zone)
     *  graveyard_zone is per zone you die in (GhostZone): Faction 469 alliance, 67 horde, 0 both
     *    'f'  = factions for deaths in the zone whose map the healer is on: 1 alliance | 2 horde | 3 both
     *    'gz' = [[ghostZoneId, factions], ..] every zone that sends ghosts here (e.g. Eastvale: Elwynn both, Stormwind horde)
     */
    private function tagGraveyards(array &$pois) : void
    {
        if (!($d = $this->clientDbc('WorldSafeLocs.dbc')))
        {
            CLI::write('[mappois] WorldSafeLocs.dbc not found - spirit healers without faction', CLI::LOG_WARN);
            return;
        }

        $ghost = [];                                        // graveyardId => [ghostZoneId => factions]
        foreach (DB::World()->select('SELECT `ID`, `GhostZone`, `Faction` FROM graveyard_zone') ?: [] as $g)
        {
            $bits = $g['Faction'] == 469 ? 1 : ($g['Faction'] == 67 ? 2 : 3);
            $ghost[$g['ID']][$g['GhostZone']] = ($ghost[$g['ID']][$g['GhostZone']] ?? 0) | $bits;
        }

        // id, mapId, x, y, z, name..
        $h = unpack('Vn/Vf/Vrs', substr($d, 4, 12));
        $yards = [];                                        // zoneId => [[x, y, graveyardId], ..]
        for ($i = 0; $i < $h['n']; $i++)
        {
            $r = unpack('Vid/VmapId/gx/gy', substr($d, 20 + $i * $h['rs'], 16));
            if (!isset($ghost[$r['id']]) || !in_array($r['mapId'], [0, 1, 530, 571]))
                continue;

            foreach (Game::worldPosToZonePos($r['mapId'], $r['x'], $r['y']) as $p)
                if (!$p['multifloor'])
                    $yards[$p['areaId']][] = [(float)$p['posX'], (float)$p['posY'], $r['id']];
        }

        $n = 0;
        foreach ($pois as $zoneId => &$list)
            foreach ($list as &$p)
            {
                if ($p['t'] != 'sh' || empty($yards[$zoneId]))
                    continue;

                $best = null; $bd = 3.0 * 3.0;              // within 3% of the map
                foreach ($yards[$zoneId] as [$x, $y, $gyId])
                {
                    $dd = ($x - $p['x']) ** 2 + ($y - $p['y']) ** 2;
                    if ($dd < $bd)
                    {
                        $bd   = $dd;
                        $best = $gyId;
                    }
                }

                if (!$best)
                    continue;

                $zones = $ghost[$best];
                $p['f'] = $zones[$zoneId] ?? array_reduce($zones, fn($c, $f) => $c | $f, 0);
                $p['gz'] = [];
                foreach ($zones as $gz => $f)
                    $p['gz'][] = [(int)$gz, $f];
                $n++;
            }

        CLI::write('[mappois] '.$n.' spirit healers matched to a graveyard');
    }

    // "Grom'gol .. (Zeppelin, Horde ("The Purple Princess"))" => [poi type, [A, H], kind label if not plain boat / zeppelin]
    private function transportKind(string $desc) : array
    {
        $r = stripos($desc, 'alliance') !== false ? [1, -1] : (stripos($desc, 'horde') !== false ? [-1, 1] : [0, 0]);
        if (stripos($desc, 'gunship') !== false)
            return ['gun', $r, null];
        if (stripos($desc, 'zeppelin') !== false)
            return ['zep', $r, null];
        if (preg_match('/\((Turtle)\b/i', $desc, $m))
            return ['boat', $r, ucfirst(strtolower($m[1]))];
        return ['boat', $r, null];
    }

    // pathId => [nodeIdx => TaxiPathNode row]
    private $taxiNodes = null;
    private function taxiNodes() : array
    {
        if ($this->taxiNodes !== null)
            return $this->taxiNodes;

        $this->taxiNodes = [];
        if (!($d = $this->clientDbc('TaxiPathNode.dbc')))
        {
            CLI::write('[mappois] TaxiPathNode.dbc not found - no boats / zeppelins', CLI::LOG_WARN);
            return [];
        }

        // id, pathId, nodeIdx, mapId, x, y, z, flags, delay, arrivalEvent, departureEvent
        $h = unpack('Vn/Vf/Vrs', substr($d, 4, 12));
        for ($i = 0; $i < $h['n']; $i++)
        {
            $r = unpack('Vid/VpathId/VnodeIdx/VmapId/gx/gy/gz/Vflags/Vdelay', substr($d, 20 + $i * $h['rs'], 36));
            $this->taxiNodes[$r['pathId']][$r['nodeIdx']] = $r;
        }

        return $this->taxiNodes;
    }

    /*  transport paths drawn on the maps: every node of the transport's taxi path projected on each zone map it
     *  crosses (and its continent), split where the path leaves the map, changes maps or teleports
     *  @return array [mapZoneId => [{t, r, l: [[x, y, x, y, ..], ..]}, ..]]
     */
    private $roundTrip = [];                                // pathId => seconds for a full loop (set by travelPois)

    private function transportRoutes() : array
    {
        $nodes = $this->taxiNodes();
        $out   = [];
        foreach (DB::World()->select('SELECT t.`entry`, t.`name`, gt.`name` AS "goName", gt.`Data0` AS "pathId" FROM transports t JOIN gameobject_template gt ON gt.`entry` = t.`entry` WHERE gt.`type` = 15 ORDER BY t.`entry`') ?: [] as $tr)
        {
            if (empty($nodes[$tr['pathId']]))
                continue;

            $desc = $tr['name'] ?: $tr['goName'];
            [$kind, $r, $label] = $this->transportKind($desc);
            // "Orgrimmar and Grom'gol Base Camp (Zeppelin, Horde ("The Purple Princess"))" => route + ship for the hover tooltip
            $info = ['id' => (int)$tr['entry'], 'n' => preg_match('/\("([^"]+)"\)/', $desc, $m) ? $m[1] : $tr['goName']];
            if (preg_match('/^(.+?)\s*\(/', $desc, $m) && $m[1] != $info['n'])
                $info['w'] = $m[1];
            if ($label)
                $info['k'] = $label;
            if (!empty($this->roundTrip[(int)$tr['pathId']]))
                $info['rt'] = $this->roundTrip[(int)$tr['pathId']];
            $list = $nodes[$tr['pathId']];
            ksort($list);
            $list[] = reset($list);                         // the path loops

            $lines = [];                                    // mapZoneId => [[x, y, ..], ..]
            $open  = [];                                    // mapZoneId => index of the line the last node went to
            $prev  = null;
            foreach ($list as $n)
            {
                $broken = !$prev || $prev['mapId'] != $n['mapId'] || ($prev['flags'] & 0x1);
                $prev   = $n;
                if ($broken)
                    $open = [];

                if (!in_array($n['mapId'], [0, 1, 530, 571]))
                {
                    $open = [];
                    continue;
                }

                $seen = [];
                foreach (Game::worldPosToZonePos($n['mapId'], $n['x'], $n['y']) as $p)
                {
                    if ($p['multifloor'] || !isset($this->rects[$p['areaId']]))
                        continue;

                    $zid = (int)$p['areaId'];
                    [$cont, $rc] = $this->rects[$zid];
                    $pts = [$zid => [(float)$p['posX'], (float)$p['posY']]];
                    if (!isset($seen[$cont]))
                        $pts[$cont] = [$rc[0] + $p['posX'] / 100 * ($rc[2] - $rc[0]), $rc[1] + $p['posY'] / 100 * ($rc[3] - $rc[1])];

                    foreach ($pts as $mz => [$x, $y])
                    {
                        if (isset($seen[$mz]))
                            continue;
                        $seen[$mz] = true;

                        if (!isset($open[$mz]))
                        {
                            $lines[$mz][] = [];
                            $open[$mz] = count($lines[$mz]) - 1;
                        }
                        $lines[$mz][$open[$mz]][] = [$x, $y];
                    }
                }

                foreach (array_keys($open) as $mz)          // left this map: the next visit starts a new line
                    if (!isset($seen[$mz]))
                        unset($open[$mz]);
            }

            foreach ($lines as $mz => $ls)
            {
                $keep = [];
                foreach ($ls as $l)
                {
                    if (count($l) < 2)
                        continue;
                    $flat = [];
                    foreach ($this->simplifyLine($l, $mz < 0 ? 0.06 : 0.15) as [$x, $y])
                        array_push($flat, round($x, 2), round($y, 2));
                    $keep[] = $flat;
                }
                if ($keep)
                    $out[$mz][] = ['t' => $kind, 'r' => $r, 'l' => $keep] + $info;
            }
        }

        return $out;
    }

    // Douglas-Peucker on [[x, y], ..]
    private function simplifyLine(array $pts, float $eps) : array
    {
        if (count($pts) < 3)
            return $pts;

        [$ax, $ay] = $pts[0];
        [$bx, $by] = $pts[count($pts) - 1];
        $len = hypot($bx - $ax, $by - $ay);
        $max = 0; $idx = 0;
        for ($i = 1; $i < count($pts) - 1; $i++)
        {
            [$px, $py] = $pts[$i];
            $d = $len ? abs(($bx - $ax) * ($ay - $py) - ($ax - $px) * ($by - $ay)) / $len : hypot($px - $ax, $py - $ay);
            if ($d > $max)
            {
                $max = $d;
                $idx = $i;
            }
        }

        if ($max <= $eps)
            return [$pts[0], $pts[count($pts) - 1]];

        $a = $this->simplifyLine(array_slice($pts, 0, $idx + 1), $eps);
        $b = $this->simplifyLine(array_slice($pts, $idx), $eps);
        return array_merge(array_slice($a, 0, -1), $b);
    }

    // pathId => [[mapId, x, y, wait, distance to next], ..] of the nodes the transport waits at
    private function taxiPathStops() : array
    {
        $nodes = $this->taxiNodes();

        // [mapId, x, y, wait (s), distance to the next stop] per stop; the path loops, map changes and teleport nodes add no distance
        $out = [];
        foreach ($nodes as $pathId => $list)
        {
            ksort($list);
            $list = array_values($list);
            $n = count($list);
            $stopIdx = array_keys(array_filter($list, fn($r) => $r['delay'] > 0));
            if (count($stopIdx) < 2)
                continue;

            foreach ($stopIdx as $k => $si)
            {
                $next = $stopIdx[($k + 1) % count($stopIdx)];
                $dist = 0;
                for ($j = $si; $j != $next; $j = ($j + 1) % $n)
                {
                    $a = $list[$j];
                    $b = $list[($j + 1) % $n];
                    if ($a['mapId'] == $b['mapId'] && !($a['flags'] & 0x1))   // 0x1: the transport teleports to the next node
                        $dist += sqrt(($a['x'] - $b['x']) ** 2 + ($a['y'] - $b['y']) ** 2 + ($a['z'] - $b['z']) ** 2);
                }

                $out[$pathId][] = [$list[$si]['mapId'], $list[$si]['x'], $list[$si]['y'], $list[$si]['delay'], $dist];
            }
        }

        return $out;
    }

    // all poi types of a spawned npc
    private function npcTypes(array $n, array $vendorCats) : array
    {
        $types = [];
        foreach (self::NPC_TYPES as $m => $t)
            if ($n['npcflag'] & $m)
                $types[] = $t;

        if ($n['npcflag'] & self::NPC_REPAIR)
            $types[] = 'rep';

        if ($n['npcflag'] & self::NPC_TRAINER)
        {
            if ($n['trainerType'] == self::TRAINER_CLASS)
                $types[] = 'class';
            else if ($n['trainerType'] == self::TRAINER_MOUNTS)
                $types[] = 'ride';
            else if ($n['trainerType'] == self::TRAINER_TRADESKILL && isset(self::PROFESSIONS[$n['trainerRequirement']]))
                $types[] = self::PROFESSIONS[$n['trainerRequirement']];
        }

        if ($n['subname_loc0'] == 'Barber')
            $types[] = 'barber';
        else if ($n['subname_loc0'] == 'Weapon Master')
            $types[] = 'wm';

        return array_merge($types, $vendorCats);
    }

    // npc id => [vendor category, ..] from npc_vendor (world db) + ?_items
    private function vendorCategories(array $npcIds) : array
    {
        if (!$npcIds)
            return [];

        $stock = [];
        foreach (array_chunk($npcIds, 2000) as $chunk)
            foreach (DB::World()->select('SELECT `entry`, `item` FROM npc_vendor WHERE `entry` IN (?a) AND `item` > 0', $chunk) ?: [] as $r)
                $stock[(int)$r['entry']][] = (int)$r['item'];

        $itemIds = array_unique(array_merge(...array_values($stock ?: [[]])));
        $items   = [];
        foreach (array_chunk($itemIds, 2000) as $chunk)
            foreach (DB::Aowow()->select('SELECT `id` AS ARRAY_KEY, `class`, `subClass`, `spellCategory1`, `name_loc0` FROM ?_items WHERE `id` IN (?a)', $chunk) ?: [] as $id => $it)
                $items[$id] = $it;

        $out = [];
        foreach ($stock as $npcId => $list)
        {
            $cnt = [];
            foreach ($list as $itemId)
            {
                if (!($it = $items[$itemId] ?? null))
                    continue;

                $cat = null;
                if ($it['class'] == 6 && in_array($it['subClass'], [2, 3]))                 // arrows, bullets
                    $cat = 'v-ammo';
                else if ($it['class'] == 1 && $it['subClass'] == 0)                         // bags
                    $cat = 'v-bags';
                else if ($it['class'] == 0 && $it['subClass'] == 5)                         // food & drink
                    $cat = $it['spellCategory1'] == self::SPELL_CATEGORY_DRINK ? 'v-drink' : ($it['spellCategory1'] == self::SPELL_CATEGORY_FOOD ? 'v-food' : null);
                else if ($it['class'] == 0 && $it['subClass'] == 1)                         // potions
                    $cat = 'v-potion';
                else if ($it['class'] == 0 && stripos($it['name_loc0'], 'poison') !== false)
                    $cat = 'v-poison';
                else if ($it['class'] == 15 && $it['subClass'] == 1)                        // reagents
                    $cat = 'v-reagent';
                else if ($it['class'] == 7)                                                  // trade goods
                    $cat = 'v-trade';

                if ($cat)
                    $cnt[$cat] = ($cnt[$cat] ?? 0) + 1;
            }

            foreach ($cnt as $cat => $n)
                if ($n >= self::VENDOR_MIN_ITEMS)
                    $out[$npcId][] = $cat;
        }

        return $out;
    }

    private function loadShapes() : bool
    {
        if (!file_exists(self::SHAPES) || !preg_match('/g_zone_shapes = (.*?);\n/s', file_get_contents(self::SHAPES), $m))
            return false;

        $shapes = json_decode($m[1], true);
        foreach (self::CONTINENTS as $cont)
        {
            foreach ($shapes[$cont] ?? [] as $zoneId => $e)
            {
                if (!isset($e['r']))
                    return false;                           // zone rects were added later - zoneshapes needs a rebuild

                $this->rects[$zoneId]           = [$cont, $e['r']];
                $this->outlines[$cont][$zoneId] = $e['p'];
            }
        }

        return !!$this->rects;
    }

    /*  zone map X shows parts of the zones around it. Their continent outlines are projected into X's map, the part not
     *  covered by X itself (its continent outline + its subzones) becomes a clickable outline. Links are made symmetric:
     *  Y is a neighbour of X if it is visible on X's map, X is visible on Y's map, or their continent outlines touch.
     *  Neighbours without a visible area get an edge button pointing towards them.
     *  @return array [zoneId => [['z' => zoneId, 'p' => rings (%), 'lp' => [x, y]] | ['z' => zoneId, 'e' => [x, y], 'd' => side], ..]]
     */
    private function buildNeighbours() : array
    {
        $W = ZoneShapeTracer::MAP_W;
        $H = ZoneShapeTracer::MAP_H;

        $subs = [];
        foreach ($this->subzoneMaps() as $zoneId => $s)
            $subs[$zoneId] = $s;

        $visible = [];                                      // X => [Y => rings (%)]
        $tracer  = new ZoneShapeTracer();
        $tracer->smoothPasses = 1;

        foreach ($this->rects as $x => [$cont, $r])
        {
            ini_set('max_execution_time', 0);

            $sx = $W / ($r[2] - $r[0]);                     // continent % -> zone map px
            $sy = $H / ($r[3] - $r[1]);
            $toPx = function (array $rings, bool $fromZonePct = false) use ($r, $sx, $sy, $W, $H) {
                $out = [];
                foreach ($rings as $ring)
                {
                    $o = [];
                    for ($i = 0, $n = count($ring); $i < $n; $i += 2)
                    {
                        if ($fromZonePct)
                            array_push($o, $ring[$i] * $W / 100, $ring[$i + 1] * $H / 100);
                        else
                            array_push($o, ($ring[$i] - $r[0]) * $sx, ($ring[$i + 1] - $r[1]) * $sy);
                    }
                    $out[] = $o;
                }
                return $out;
            };

            // the zone itself
            $own = array_fill(0, $W * $H, false);
            $this->fillRings($own, $toPx($this->outlines[$cont][$x]), true);
            foreach ($subs[$x] ?? [] as $e)
                $this->fillRings($own, $toPx($e['p'], true), true);

            // everything else that reaches into the map
            $label = array_fill(0, $W * $H, -1);
            foreach ($this->outlines[$cont] as $y => $rings)
            {
                if ($y == $x || isset($subs[$x][$y]))      // cities inside this zone are subzone links already
                    continue;

                [, $ry] = $this->rects[$y];
                if ($ry[2] < $r[0] || $ry[0] > $r[2] || $ry[3] < $r[1] || $ry[1] > $r[3])
                    continue;

                $this->fillRings($label, $toPx($rings), $y, $own);
            }

            foreach ($tracer->vectorize($label, self::NB_MIN_PX) as $y => $rings)
            {
                foreach ($rings as &$ring)
                    foreach ($ring as $i => &$v)
                        $v = round($v * 100 / ($i % 2 ? $H : $W), 2);
                unset($ring, $v);

                $visible[$x][$y] = $rings;
            }
        }

        // symmetric neighbourhood
        $adj = [];
        foreach ($visible as $x => $ys)
            foreach ($ys as $y => $_)
            {
                $adj[$x][$y] = true;
                $adj[$y][$x] = true;
            }

        foreach ($this->outlines as $cont => $zones)
        {
            $ids = array_keys($zones);
            for ($i = 0; $i < count($ids); $i++)
                for ($j = $i + 1; $j < count($ids); $j++)
                    if ($this->outlinesTouch($zones[$ids[$i]], $zones[$ids[$j]]))
                    {
                        $adj[$ids[$i]][$ids[$j]] = true;
                        $adj[$ids[$j]][$ids[$i]] = true;
                    }
        }

        $out = [];
        foreach ($adj as $x => $ys)
        {
            if (!isset($this->rects[$x]))
                continue;

            [$cont, $r] = $this->rects[$x];
            foreach (array_keys($ys) as $y)
            {
                if (isset($subs[$x][$y]))                   // shown as subzone link
                    continue;

                if (isset($visible[$x][$y]))
                    $out[$x][] = ['z' => $y, 'p' => $visible[$x][$y], 'lp' => $this->labelPoint($visible[$x][$y])];
                else
                {
                    // edge button in the direction of the neighbour
                    [$cx, $cy] = $this->labelPoint($this->outlines[$cont][$y]);
                    $dx = ($cx - $r[0]) / ($r[2] - $r[0]) * 100 - 50;
                    $dy = ($cy - $r[1]) / ($r[3] - $r[1]) * 100 - 50;
                    $k  = min(44 / max(abs($dx), 1e-6), 42 / max(abs($dy), 1e-6));
                    $ex = round(50 + $dx * $k, 1);
                    $ey = round(50 + $dy * $k, 1);
                    $side = abs($dx) * 42 > abs($dy) * 44 ? ($dx > 0 ? 'e' : 'w') : ($dy > 0 ? 's' : 'n');
                    $out[$x][] = ['z' => $y, 'e' => [$ex, $ey], 'd' => $side];
                }
            }
        }

        return $out;
    }

    // even-odd scanline fill of multi-ring polygons (px) into a W x H array
    private function fillRings(array &$grid, array $rings, $value, ?array $skip = null) : void
    {
        $W = ZoneShapeTracer::MAP_W;
        $H = ZoneShapeTracer::MAP_H;

        $edges = [];
        $y0 = $H; $y1 = 0;
        foreach ($rings as $p)
            for ($i = 0, $n = count($p), $j = $n - 2; $i < $n; $j = $i, $i += 2)
            {
                if ($p[$i + 1] == $p[$j + 1])
                    continue;
                $edges[] = [$p[$j], $p[$j + 1], $p[$i], $p[$i + 1]];
                $y0 = min($y0, $p[$i + 1]);
                $y1 = max($y1, $p[$i + 1]);
            }

        for ($y = max(0, (int)floor($y0)); $y < min($H, (int)ceil($y1)); $y++)
        {
            $cy = $y + 0.5;
            $xs = [];
            foreach ($edges as [$ax, $ay, $bx, $by])
                if (($ay > $cy) != ($by > $cy))
                    $xs[] = $ax + ($cy - $ay) * ($bx - $ax) / ($by - $ay);

            sort($xs);
            for ($k = 0; $k + 1 < count($xs); $k += 2)
            {
                $from = max(0, (int)ceil($xs[$k] - 0.5));
                $to   = min($W - 1, (int)floor($xs[$k + 1] - 0.5));
                $row  = $y * $W;
                for ($px = $from; $px <= $to; $px++)
                    if (!$skip || !$skip[$row + $px])
                        $grid[$row + $px] = $value;
            }
        }
    }

    private function outlinesTouch(array $a, array $b) : bool
    {
        // bounding boxes first
        $box = function ($rings) {
            $x0 = $y0 = 100; $x1 = $y1 = 0;
            foreach ($rings as $p)
                for ($i = 0; $i < count($p); $i += 2)
                {
                    $x0 = min($x0, $p[$i]); $x1 = max($x1, $p[$i]);
                    $y0 = min($y0, $p[$i + 1]); $y1 = max($y1, $p[$i + 1]);
                }
            return [$x0, $y0, $x1, $y1];
        };
        $ba = $box($a);
        $bb = $box($b);
        $d  = self::NB_TOUCH_PCT;
        if ($ba[2] + $d < $bb[0] || $bb[2] + $d < $ba[0] || $ba[3] + $d < $bb[1] || $bb[3] + $d < $ba[1])
            return false;

        $d2 = $d * $d;
        foreach ($a as $p)
            for ($i = 0; $i < count($p); $i += 2)
                foreach ($b as $q)
                    for ($j = 0; $j < count($q); $j += 2)
                        if (($p[$i] - $q[$j]) ** 2 + ($p[$i + 1] - $q[$j + 1]) ** 2 < $d2)
                            return true;

        return false;
    }

    private function subzoneMaps() : Generator
    {
        foreach (glob(dirname(sprintf(self::SUBSHAPES, 0)).'/*.json') as $file)
            if ($subs = json_decode(file_get_contents($file), true))
                yield (int)basename($file, '.json') => $subs;
    }

    // world coords on a continent -> [zoneId, x%, y%]: the smallest outdoor zone whose continent outline contains the
    // point (so cities win over the zone around them), else the first zone map that shows it (e.g. a dock out at sea)
    private function entrancePos(int $mapId, float $posX, float $posY) : ?array
    {
        $first = $best = $city = null;
        $bestArea = INF;
        foreach (Game::worldPosToZonePos($mapId, $posX, $posY) as $p)
        {
            if (!isset($this->rects[$p['areaId']]) || $p['multifloor'])
                continue;

            $hit = [(int)$p['areaId'], (float)$p['posX'], (float)$p['posY']];
            $first ??= $hit;

            // capital cities: their continent outline is only a rough ellipse - anything on the city map belongs to the city
            if (isset($this->capitals[$p['areaId']]) && $p['posX'] > 3 && $p['posX'] < 97 && $p['posY'] > 3 && $p['posY'] < 97)
                $city ??= $hit;

            [$cont, $r] = $this->rects[$p['areaId']];
            $cx = $r[0] + $p['posX'] / 100 * ($r[2] - $r[0]);
            $cy = $r[1] + $p['posY'] / 100 * ($r[3] - $r[1]);
            $area = ($r[2] - $r[0]) * ($r[3] - $r[1]);
            if ($area < $bestArea && $this->pointInRings($cx, $cy, $this->outlines[$cont][$p['areaId']]))
            {
                $best = $hit;
                $bestArea = $area;
            }
        }

        return $city ?? $best ?? $first;
    }

    // merge markers of the same type that sit on top of each other
    private function merge(array $list) : array
    {
        $out = [];
        foreach ($list as $p)
        {
            foreach ($out as &$o)
            {
                if ($o['t'] != $p['t'] || abs($o['x'] - $p['x']) > self::MERGE_DIST || abs($o['y'] - $p['y']) > self::MERGE_DIST)
                    continue;

                if (($o['z'] ?? 0) != ($p['z'] ?? 0) || ($o['r'] ?? null) != ($p['r'] ?? null) || ($o['f'] ?? 0) != ($p['f'] ?? 0) || isset($p['gz']))   // different instances / zones / factions stay apart
                    continue;

                $o['more'] = ($o['more'] ?? 0) + 1;
                continue 2;
            }
            unset($o);

            $out[] = $p;
        }

        return $out;
    }

    // point inside the biggest ring, close to its centre
    private function labelPoint(array $rings) : array
    {
        $big = $rings[0];
        foreach ($rings as $r)
            if (count($r) > count($big))
                $big = $r;

        $x = $y = 0;
        $n = count($big) / 2;
        for ($i = 0; $i < count($big); $i += 2)
        {
            $x += $big[$i];
            $y += $big[$i + 1];
        }
        $x /= $n;
        $y /= $n;

        if ($this->pointInRings($x, $y, $rings))
            return [round($x, 2), round($y, 2)];

        // concave shape: nearest vertex pulled a bit towards the centre
        $best = null; $bd = INF;
        for ($i = 0; $i < count($big); $i += 2)
        {
            $px = $big[$i] + ($x - $big[$i]) * 0.15;
            $py = $big[$i + 1] + ($y - $big[$i + 1]) * 0.15;
            $d  = ($px - $x) ** 2 + ($py - $y) ** 2;
            if ($d < $bd && $this->pointInRings($px, $py, $rings))
            {
                $bd   = $d;
                $best = [round($px, 2), round($py, 2)];
            }
        }

        return $best ?? [round($x, 2), round($y, 2)];
    }

    private function pointInRings(float $x, float $y, array $rings) : bool
    {
        $in = false;
        foreach ($rings as $p)
            for ($i = 0, $n = count($p), $j = $n - 2; $i < $n; $j = $i, $i += 2)
                if ((($p[$i + 1] > $y) != ($p[$j + 1] > $y)) && ($x < ($p[$j] - $p[$i]) * ($y - $p[$i + 1]) / ($p[$j + 1] - $p[$i + 1]) + $p[$i]))
                    $in = !$in;

        return $in;
    }
});

?>
