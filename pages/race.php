<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');


// menuId 13: Race     g_initPath()
//  tabId  0: Database g_initHeader()
class RacePage extends GenericPage
{
    use TrDetailPage;

    protected $type          = Type::CHR_RACE;
    protected $typeId        = 0;
    protected $tpl           = 'detail-page-generic';
    protected $path          = [0, 13];
    protected $tabId         = 0;
    protected $mode          = CACHE_TYPE_PAGE;
    protected $scripts       = [[SC_JS_FILE, 'js/swfobject.js']];

    public function __construct($pageCall, $id)
    {
        parent::__construct($pageCall, $id);

        $this->typeId = intVal($id);

        $this->subject = new CharRaceList(array(['id', $this->typeId]));
        if ($this->subject->error)
            $this->notFound(Lang::game('race'), Lang::race('notFound'));

        $this->name = $this->subject->getField('name', true);
    }

    protected function generatePath()
    {
        $this->path[] = $this->typeId;
    }

    protected function generateTitle()
    {
        array_unshift($this->title, $this->subject->getField('name', true), Util::ucFirst(Lang::game('class')));
    }

    protected function generateContent()
    {
        $infobox      = [];
        $ra           = ChrRace::from($this->typeId);
        $mountVendors = array(                              // race => [starter NPCs..., argent tournament NPC]
            null,
            [384,  1460, 12783, 33307],  // Human:     Katie Hunter, Unger Statforth, Lt. Karter (Black War), Corporal Arthur Flew (AT)
            [3362,         33553],       // Orc
            [1261,         33310],       // Dwarf
            [4730,         33653],       // Night Elf  (NB: 33653 sells NE saber AT mounts in local DB)
            [4731,         33555],       // Undead
            [3685,         33556],       // Tauren
            [7955,         33650],       // Gnome      (NB: 33650 sells Gnome AT mounts in local DB)
            [7952,         33554],       // Troll
            null,
            [16264,        33557],       // Blood Elf  (NB: 33557 sells BE hawkstrider AT mounts in local DB)
            [17584,        33657],       // Draenei
        );

        /***********/
        /* Infobox */
        /***********/

        $infobox = Lang::getInfoBoxForFlags($this->subject->getField('cuFlags'));

        // side
        if ($_ = $this->subject->getField('side'))
            $infobox[] = Lang::main('side').Lang::main('colon').'[span class=icon-'.($_ == SIDE_HORDE ? 'horde' : 'alliance').']'.Lang::game('si', $_).'[/span]';

        // faction
        if ($_ = $this->subject->getField('factionId'))
        {
            $fac = new FactionList(array(['f.id', $_]));
            $this->extendGlobalData($fac->getJSGlobals());
            $infobox[] = Util::ucFirst(Lang::game('faction')).Lang::main('colon').'[faction='.$fac->id.']';
        }

        // leader
        if ($_ = $this->subject->getField('leader'))
        {
            $this->extendGlobalIds(Type::NPC, $_);
            $infobox[] = Lang::race('racialLeader').Lang::main('colon').'[npc='.$_.']';
        }

        // start area
        if ($_ = $this->subject->getField('startAreaId'))
        {
            $this->extendGlobalIds(Type::ZONE, $_);
            $infobox[] = Lang::race('startZone').Lang::main('colon').'[zone='.$_.']';
        }

        // Race ID (like Wowhead — below Starting zone)
        $infobox[] = 'Race ID' . Lang::main('colon') . $this->typeId;

        /****************/
        /* Main Content */
        /****************/

        $this->infobox    = '[ul][li]'.implode('[/li][li]', $infobox).'[/li][/ul]';
        $this->expansion  = Util::$expansionString[$this->subject->getField('expansion')];
        $this->headIcons  = ['race_'.$ra->json().'_male', 'race_'.$ra->json().'_female'];
        $this->redButtons = array(
            BUTTON_WOWHEAD => true,
            BUTTON_LINKS   => ['type' => $this->type, 'typeId' => $this->typeId]
        );


        /**************/
        /* Extra Tabs */
        /**************/

        // Classes
        $classes = new CharClassList(array(['racemask', $ra->toMask(), '&']));
        if (!$classes->error)
        {
            $this->extendGlobalData($classes->getJSGlobals());
            $this->lvTabs[] = [CharClassList::$brickFile, ['data' => array_values($classes->getListviewData())]];

            // Cache class data for the article section
            $classDataForArticle = [];
            foreach ($classes->iterate() as $__)
                $classDataForArticle[] = ['id' => $classes->id, 'name' => $classes->getField('name', true), 'roles' => (int)$classes->getField('roles')];
        }

        // Racials
        $conditions = array(
            ['typeCat', -4],                               // racial traits
            ['reqRaceMask', $ra->toMask(), '&']
        );

        $racials = new SpellList($conditions);
        if (!$racials->error)
        {
            $this->extendGlobalData($racials->getJSGlobals());
            $this->lvTabs[] = [SpellList::$brickFile, array(
                'data'       => array_values($racials->getListviewData()),
                'id'         => 'racial-traits',
                'name'       => '$LANG.tab_racialtraits',
                'hiddenCols' => ['reagents'],
                'sort'       => ['name']
            )];

        }

        // Tongues
        $conditions = array(
            ['typeCat', -11],                               // proficiencies
            ['reqRaceMask', $ra->toMask(), '&']             // only languages are race-restricted
        );

        $tongues = new SpellList($conditions);
        if (!$tongues->error)
        {
            $this->extendGlobalData($tongues->getJSGlobals());
            $this->lvTabs[] = [SpellList::$brickFile, array(
                'data'       => array_values($tongues->getListviewData()),
                'id'         => 'languages',
                'name'       => '$LANG.tab_languages',
                'hiddenCols' => ['reagents']
            )];
        }

        // Mounts
        $items = isset($mountVendors[$this->typeId]) ? DB::World()->selectCol('SELECT `item` FROM npc_vendor WHERE `entry` IN (?a)', $mountVendors[$this->typeId]) : 0;

        $conditions = array(
            ['i.id', $items],
            ['i.class', ITEM_CLASS_MISC],
            ['i.subClass', 5],                              // mounts
        );

        $mounts = new ItemList($conditions);
        if (!$mounts->error)
        {
            $this->extendGlobalData($mounts->getJSGlobals());
            $this->lvTabs[] = [ItemList::$brickFile, array(
                'data'       => array_values($mounts->getListviewData()),
                'id'         => 'mounts',
                'name'       => '$LANG.tab_mounts',
                'hiddenCols' => ['slot', 'type'],
                'sort'       => ['reqlevel', 'name']
            )];
        }

        // Quests — only quests exclusive to this race (reqRaceMask == this race's mask exactly, like Wowhead)
        $conditions = array(
            ['reqRaceMask', $ra->toMask()]
        );

        $quests = new QuestList($conditions);
        if (!$quests->error)
        {
            $this->extendGlobalData($quests->getJSGlobals());
            $allQuestData = array_values($quests->getListviewData());

            // Split active vs disabled (cuFlags → wflags QUEST_CU_REPEATABLE 0x01, or QUEST_FLAG_UNAVAILABLE → 'historical')
            $activeData   = [];
            $disabledCount = 0;
            foreach ($allQuestData as $q)
            {
                if (($q['wflags'] & QUEST_CU_REPEATABLE) || !empty($q['historical']))
                    $disabledCount++;
                else
                    $activeData[] = $q;
            }
            $activeCount = count($activeData);

            $tabName = $disabledCount > 0
                ? 'Quests (' . $activeCount . ' / ' . $disabledCount . ')'
                : '$LANG.tab_quests';

            $this->lvTabs[] = [QuestList::$brickFile, ['data' => $allQuestData, 'name' => $tabName, 'sort' => ['reqlevel', 'name']]];
        }

        // Sounds
        if ($vo = DB::Aowow()->selectCol('SELECT `soundId` AS ARRAY_KEY, `gender` FROM ?_races_sounds WHERE `raceId` = ?d', $this->typeId))
        {
            $sounds = new SoundList(array(['id', array_keys($vo)]));
            if (!$sounds->error)
            {
                $this->extendGlobalData($sounds->getJSGlobals(GLOBALINFO_SELF));
                $data = $sounds->getListviewData();
                foreach ($data as $id => &$d)
                    $d['gender'] = $vo[$id];

                $this->lvTabs[] = [SoundList::$brickFile, array(
                    'data' => array_values($data),
                    'extraCols' => ['$Listview.templates.title.columns[1]']
                )];
            }
        }

        // tab: condition-for
        $cnd = new Conditions();
        $cnd->getByCondition(Type::CHR_RACE, $this->typeId)->prepare();
        if ($tab = $cnd->toListviewTab('condition-for', '$LANG.tab_condition_for'))
        {
            $this->extendGlobalData($cnd->getJsGlobals());
            $this->lvTabs[] = $tab;
        }

        /**********************/
        /* Article / Overview */
        /**********************/

        $lore = array(
            1  => 'Versatile and resilient, the humans of Stormwind are one of the most important members of the Grand Alliance. Though their lifespans are shorter than those of other races, humans make up for it with their ambition and ingenuity. Master traders, diplomats, and warriors, they have spread across Azeroth and helped hold the Alliance together through countless wars.',
            2  => 'The orcs of the Horde are a proud warrior people with a tradition of honor that predates their corruption by the Burning Legion. Under the leadership of Thrall, the orcs have reclaimed their spiritual heritage and built a new homeland in the harsh sands of Durotar, forging the Horde into a powerful force on Kalimdor.',
            3  => 'The stout and stalwart dwarves of Ironforge are renowned throughout Azeroth for their fierce fighting spirit and masterful craftsmanship. Descended from the earthen, ancient stone constructs of the titans, the dwarves have long been loyal allies of the Alliance, defending the peaks of Khaz Modan with hammer and cannon.',
            4  => 'Ancient and wise, the night elves were among the first mortals to awaken on Azeroth and have guarded its natural order for millennia. Once immortal, they sacrificed their immortality to defeat the Burning Legion. Now allied with the Grand Alliance, they use their mastery of nature and shadow to defend their beloved forests.',
            5  => 'The Forsaken are undead who have broken free from the Lich King\'s iron will, united under the Banshee Queen Sylvanas Windrunner. Shunned by the living and hunted by their former Scourge brethren, they have allied with the Horde to carve out a dark existence in the ruins of Lordaeron, driven by a fierce will to survive.',
            6  => 'The tauren are a proud and spiritual people deeply connected to the earth and the natural world. For generations they roamed the plains of Kalimdor, besieged by centaur, until Thrall and the Horde came to their aid. In gratitude they joined the Horde, offering their strength and shamanistic wisdom to its cause.',
            7  => 'Brilliant inventors and relentless tinkerers, the gnomes of Gnomeregan are among the most intelligent beings on Azeroth. Exiled from their irradiated city by a trogg invasion and a catastrophic accident, the gnomes have found refuge in Ironforge and throw their considerable intellect behind the Alliance\'s war efforts.',
            8  => 'The Darkspear trolls were a beleaguered tribe before Warchief Thrall saved them from both murlocs and kul tiras marines. Pledging their loyalty to the Horde, the Darkspear followed the orcs to Kalimdor and settled in the jungles near Durotar. They are fierce warriors and gifted practitioners of voodoo and shadow magic.',
            10 => 'The blood elves are all that remain of the once-proud high elven civilization shattered by Arthas and the Scourge. Renaming themselves in honor of their fallen kin, they have struggled with a magical addiction born from the destruction of the Sunwell. Joining the Horde, the blood elves bring powerful arcane mastery and fierce ambition to its cause.',
            11 => 'The draenei are a noble and ancient people who fled their homeworld of Argus to escape corruption by the Burning Legion. Gifted wielders of the Holy Light and staunch enemies of the Legion, they crash-landed on Azeroth and allied with the Grand Alliance, determined to stand against their ancient demonic pursuers.',
        );

        $articleText = '';

        if (isset($lore[$this->typeId]))
            $articleText .= $lore[$this->typeId] . '[br][br]';

        if (!$racials->error)
        {
            $articleRacials = '';
            $seen = [];
            foreach ($racials->iterate() as $__)
            {
                $name = $racials->getField('name', true);
                if (isset($seen[$name]))
                    continue;
                $seen[$name] = true;

                $parsed = $racials->parseText('description');
                $desc   = !empty($parsed[0]) ? strip_tags($parsed[0]) : '';
                $articleRacials .= '[spell=' . $racials->id . ']';
                if ($desc)
                    $articleRacials .= ' - ' . $desc;
                $articleRacials .= '[br]';
            }

            if ($articleRacials)
                $articleText .= '[h2]' . Lang::spell('cat', -4) . '[/h2]' . $articleRacials;
        }

        // Available Classes section
        if (!empty($classDataForArticle))
        {
            usort($classDataForArticle, function($a, $b) { return strcmp($a['name'], $b['name']); });
            $articleClasses = '';
            foreach ($classDataForArticle as $c)
            {
                $roles = $c['roles'];
                $roleNames = [];
                if ($roles & 8) $roleNames[] = 'Tank';
                if ($roles & 1) $roleNames[] = 'Healer';
                if ($roles & 2) $roleNames[] = 'Melee DPS';
                if ($roles & 4) $roleNames[] = 'Ranged DPS';
                $articleClasses .= '[class=' . $c['id'] . ']';
                if ($roleNames)
                    $articleClasses .= ' - ' . implode(', ', $roleNames);
                $articleClasses .= '[br]';
            }
            $articleText .= '[h2]Available Classes[/h2]' . $articleClasses;
        }

        if ($articleText)
            $this->article = ['text' => Util::jsEscape(preg_replace('/(\[br\])+$/', '', $articleText)), 'params' => []];
    }
}

?>
