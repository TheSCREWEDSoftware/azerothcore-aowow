<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');


// tabId 1: Tools g_initHeader()
// quest completion tracker: the quests of a zone (or class, profession, dungeon ..) and how far your characters got with them
//   with a linked game account the status comes from the characters database, otherwise quests are ticked off in the browser
//   ?quest-tracker=zone.<zoneOrSort>   quests of one category, their quest givers and map pins (JSON)
//   ?quest-tracker=quest.<id>          objectives and description of one quest (JSON)
//   ?quest-tracker=status              g_questStatus for the linked account (JS)
//   ?quest-tracker=link / unlink       POST: link the game account (name, pass) or drop the link (JSON)
class QuesttrackerPage extends GenericPage
{
    protected $tpl      = 'tool';
    protected $tabId    = 1;
    protected $path     = [1, 14];
    protected $mode     = CACHE_TYPE_NONE;
    protected $scripts  = array(
        [SC_JS_FILE,  '?data=zones'],
        [SC_JS_FILE,  'js/questtracker.js'],
        [SC_CSS_FILE, 'css/tools.css'],
        [SC_CSS_FILE, 'css/questcompletion.css']
    );

    protected $toolId   = 'questtracker';
    protected $toolInit = 'AoQuestTracker.init';
    protected $config   = [];

    public function __construct($pageCall, $pageParam)
    {
        parent::__construct($pageCall, $pageParam);

        $param = (string)$pageParam;
        if ($param == 'status')
        {
            header('Content-Type: application/javascript; charset=utf-8');
            header('Cache-Control: private, max-age=30');
            exit(QuestCompletion::toJS());
        }

        if ($param == 'link' || $param == 'unlink')
        {
            header('Content-Type: application/json; charset=utf-8');
            if ($_SERVER['REQUEST_METHOD'] != 'POST')
                exit(Util::toJSON(['error' => 'POST only']));

            if ($param == 'unlink')
            {
                QuestCompletion::unlink();
                exit(Util::toJSON(['error' => '']));
            }

            exit(Util::toJSON(['error' => QuestCompletion::link((string)($_POST['name'] ?? ''), (string)($_POST['pass'] ?? ''))]));
        }

        $json = null;
        if (preg_match('/^zone\.(-?\d+)$/', $param, $m))
            $json = self::zone((int)$m[1]);
        else if (preg_match('/^quest\.(\d+)$/', $param, $m))
            $json = self::quest((int)$m[1]);

        if ($json !== null)
        {
            header('Content-Type: application/json; charset=utf-8');
            exit(Util::toJSON($json));
        }

        $this->name   = Lang::main('questTracker');
        $this->config = array(
            'host'     => Cfg::get('HOST_URL'),
            'loggedIn' => (bool)User::$id,
            'canLink'  => QuestCompletion::canLink(),
            'linked'   => (bool)QuestCompletion::account()
        );
    }

    // quests: [id, name, level, required level, side (1 alliance, 2 horde, 3 both), flags (1 daily, 2 weekly, 4 repeatable, 8 unavailable), giver key]
    // givers: {key: [name, type]}, pins: {floor: [[x, y, giver key]]}, map: zone has a map image
    private static function zone(int $zoneOrSort) : array
    {
        $conditions = [['zoneOrSort', $zoneOrSort], Cfg::get('SQL_LIMIT_NONE')];
        if (!User::isInGroup(U_GROUP_EMPLOYEE))
            $conditions[] = [['cuFlags', CUSTOM_EXCLUDE_FOR_LISTVIEW, '&'], 0];

        $out    = ['quests' => [], 'givers' => new stdClass(), 'pins' => new stdClass(), 'map' => false];
        $quests = new QuestList($conditions);
        if ($quests->error)
            return $out;

        // who starts them: creatures and objects first, items otherwise
        $start = [];
        foreach (DB::Aowow()->select('SELECT `questId`, `type`, `typeId` FROM ?_quests_startend WHERE `questId` IN (?a) AND (`method` & 1) ORDER BY `type`', $quests->getFoundIDs()) ?: [] as $r)
            $start[$r['questId']] ??= [(int)$r['type'], (int)$r['typeId']];

        $givers = [];
        foreach ($start as [$type, $id])
            $givers[$type][$id] = 1;

        $names = [];
        foreach ([Type::NPC => 'CreatureList', Type::OBJECT => 'GameObjectList', Type::ITEM => 'ItemList'] as $type => $cls)
        {
            if (empty($givers[$type]))
                continue;

            $list = new $cls([['id', array_keys($givers[$type])], Cfg::get('SQL_LIMIT_NONE')]);
            foreach ($list->iterate() as $id => $__)
                $names[$type.':'.$id] = [Lang::unescapeUISequences($list->getField('name', true), Lang::FMT_RAW), $type];
        }

        foreach ($quests->iterate() as $id => $q)
        {
            $flags = ($quests->isDaily() ? 1 : 0)
                   | ($q['flags'] & QUEST_FLAG_WEEKLY ? 2 : 0)
                   | ($quests->isRepeatable() ? 4 : 0)
                   | ($q['cuFlags'] & (CUSTOM_UNAVAILABLE | CUSTOM_DISABLED) ? 8 : 0);

            $key = isset($start[$id]) ? $start[$id][0].':'.$start[$id][1] : '';
            $out['quests'][] = array(
                $id,
                Lang::unescapeUISequences($quests->getField('name', true), Lang::FMT_RAW),
                (int)$q['level'],
                (int)$q['minLevel'],
                ChrRace::sideFromMask($q['reqRaceMask']),
                $flags,
                isset($names[$key]) ? $key : ''
            );
        }

        usort($out['quests'], fn($a, $b) => ($a[2] <=> $b[2]) ?: strcmp($a[1], $b[1]));
        if ($names)
            $out['givers'] = $names;

        // map pins for the quest givers spawned in this zone
        if ($zoneOrSort > 0)
        {
            $out['map'] = file_exists('static/images/wow/maps/enus/normal/'.$zoneOrSort.'.jpg') || file_exists('static/images/wow/maps/enus/normal/'.$zoneOrSort.'-1.jpg');

            $pins = [];
            foreach ([Type::NPC, Type::OBJECT] as $type)
            {
                if (empty($givers[$type]))
                    continue;

                $spawns = DB::Aowow()->select('SELECT `typeId`, `floor`, `posX`, `posY` FROM ?_spawns WHERE `type` = ?d AND `typeId` IN (?a) AND `areaId` = ?d AND `posX` > 0 AND `posY` > 0', $type, array_keys($givers[$type]), $zoneOrSort) ?: [];
                $seen   = [];
                foreach ($spawns as $s)
                {
                    $key = $type.':'.$s['typeId'];
                    if (isset($seen[$key]) || !isset($names[$key]))     // one pin per giver
                        continue;

                    $seen[$key] = 1;
                    $pins[(int)$s['floor']][] = [round($s['posX'], 1), round($s['posY'], 1), $key];
                }
            }

            if ($pins)
                $out['pins'] = $pins;
        }

        return $out;
    }

    private static function quest(int $id) : array
    {
        $quest = new QuestList([['id', $id]]);
        if ($quest->error)
            return [];

        return array(
            'id'         => $id,
            'name'       => Lang::unescapeUISequences($quest->getField('name', true), Lang::FMT_RAW),
            'level'      => (int)$quest->getField('level'),
            'objectives' => $quest->parseText('objectives', false),
            'details'    => $quest->parseText('details', false)
        );
    }

    protected function generateContent() { }

    protected function generateTitle()
    {
        array_unshift($this->title, $this->name);
    }

    protected function generatePath() { }
}

?>
