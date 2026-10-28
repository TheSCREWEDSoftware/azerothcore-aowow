<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');


// tabId 1: Tools g_initHeader()
// tick off the quests of a zone (or class, profession, dungeon ..); progress is kept in the browser
//   ?quest-tracker=zone.<zoneOrSort>   the quests of one category as JSON
class QuesttrackerPage extends GenericPage
{
    protected $tpl      = 'tool';
    protected $tabId    = 1;
    protected $path     = [1, 14];
    protected $mode     = CACHE_TYPE_NONE;
    protected $scripts  = array(
        [SC_JS_FILE,  'js/questtracker.js'],
        [SC_CSS_FILE, 'css/tools.css']
    );

    protected $toolId   = 'questtracker';
    protected $toolInit = 'AoQuestTracker.init';
    protected $config   = [];

    public function __construct($pageCall, $pageParam)
    {
        parent::__construct($pageCall, $pageParam);

        if (preg_match('/^zone\.(-?\d+)$/', (string)$pageParam, $m))
        {
            header('Content-Type: application/json; charset=utf-8');
            exit(Util::toJSON(self::quests((int)$m[1])));
        }

        $this->name   = Lang::main('questTracker');
        $this->config = ['host' => Cfg::get('HOST_URL')];
    }

    // id, name, level, required level, side (1 alliance, 2 horde, 3 both), flags: 1 daily, 2 weekly, 4 repeatable, 8 unavailable
    private static function quests(int $zoneOrSort) : array
    {
        $conditions = [['zoneOrSort', $zoneOrSort], Cfg::get('SQL_LIMIT_NONE')];
        if (!User::isInGroup(U_GROUP_EMPLOYEE))
            $conditions[] = [['cuFlags', CUSTOM_EXCLUDE_FOR_LISTVIEW, '&'], 0];

        $out    = [];
        $quests = new QuestList($conditions);
        foreach ($quests->iterate() as $id => $q)
        {
            $flags = ($quests->isDaily() ? 1 : 0)
                   | ($q['flags'] & QUEST_FLAG_WEEKLY ? 2 : 0)
                   | ($quests->isRepeatable() ? 4 : 0)
                   | ($q['cuFlags'] & (CUSTOM_UNAVAILABLE | CUSTOM_DISABLED) ? 8 : 0);

            $out[] = array(
                $id,
                Lang::unescapeUISequences($quests->getField('name', true), Lang::FMT_RAW),
                (int)$q['level'],
                (int)$q['minLevel'],
                ChrRace::sideFromMask($q['reqRaceMask']),
                $flags
            );
        }

        usort($out, fn($a, $b) => ($a[2] <=> $b[2]) ?: strcmp($a[1], $b[1]));
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
