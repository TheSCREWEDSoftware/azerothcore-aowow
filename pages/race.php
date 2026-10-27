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
        array_unshift($this->title, $this->subject->getField('name', true), Util::ucFirst(Lang::game('race')));
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

        // Race ID (below Starting zone)
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
            foreach ($classes->iterate() as $k => $row)
                $classDataForArticle[] = ['id' => $k, 'name' => Util::localizedString($row, 'name'), 'roles' => (int)($row['roles'] ?? 0)];
        }

        // Racials — by the race's own racial skill line (SkillLine.dbc): the race masks of some racials also
        // include other races (e.g. Draenei racials showed up on Humans)
        $racialSkill = [1 => 754, 2 => 125, 3 => 101, 4 => 126, 5 => 220, 6 => 124, 7 => 753, 8 => 733, 10 => 756, 11 => 760];
        $conditions = isset($racialSkill[$this->typeId]) ? array(
            ['typeCat', -4],                               // racial traits
            ['skillLine1', $racialSkill[$this->typeId]]
        ) : array(
            ['typeCat', -4],
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

        // Quests — only quests exclusive to this race (reqRaceMask == this race's mask exactly)
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

        // Build racial name→ID map while generating the Racials section
        $racialIdByName = [];
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
                $racialIdByName[$name] = $racials->id;  // capture ID by localized name

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

        // Per-race Benefits blurbs — spell IDs resolved from racials already in DB, plus any extra lookups
        // Shared shorthands used by all race branches below
        $S = function(string $name) use ($racialIdByName): string {
            $id = $racialIdByName[$name] ?? 0;
            return $id ? '[spell='.$id.']' : $name;
        };
        $C = function(int $id): string { return '[class='.$id.']'; };
        $R = function(int $id): string { return '[race='.$id.']'; };

        if ($this->typeId == 1) // Human
        {
            // Spiritual Guidance rank 1 (priest talent, not a racial) — load so [spell=14901] renders correctly
            $this->extendGlobalIds(Type::SPELL, 14901);
            // Druid (class 11) is not Human-playable and thus absent from $classes globals — load for [class=11]
            $this->extendGlobalIds(Type::CHR_CLASS, 11);

            $articleText .=
                '[h2]Benefits[/h2][ul]' .
                '[li]'.$R(1).' '.$C(5).' are a popular choice due to '.$S('The Human Spirit').' having good synergy with [spell=14901] and providing additional mana regeneration.[/li]' .
                '[li]'.$R(1).' '.$C(4).' are a popular choice due to '.$S('Mace Specialization').' and '.$S('Sword Specialization').' increasing your melee damage potential. These racials also benefit Protection and Retribution '.$C(2).'.[/li]' .
                '[li]'.$R(1).' '.$C(1).' are also a popular choice due to '.$S('Mace Specialization').' and '.$S('Sword Specialization').' as the extra weapon damage from the racials will improve their threat generation.[/li]' .
                '[li]'.$S('Perception').' is a solid racial for PvP in detecting '.$C(11).' and '.$C(4).'.[/li]' .
                '[li]'.$S('Diplomacy').' helps you hit Exalted faster on those reputation grinds--great if you are a collector interested in rewards like mounts.[/li]' .
                '[/ul]';
        }
        elseif ($this->typeId == 2) // Orc
        {
            $articleText .=
                '[h2]Benefits[/h2][ul]' .
                '[li]'.$R(2).' '.$C(1).' are one of the strongest choices due to '.$S('Axe Specialization').' providing free expertise with axes and fist weapons, and '.$S('Blood Fury').' offering a powerful on-use attack power cooldown.[/li]' .
                '[li]'.$R(2).' '.$C(3).' benefit greatly from '.$S('Command').' increasing pet damage and '.$S('Blood Fury').' boosting attack power during burn phases.[/li]' .
                '[li]'.$R(2).' '.$C(9).' enjoy '.$S('Command').' for improved pet damage and the spell power version of '.$S('Blood Fury').' for additional burst.[/li]' .
                '[li]'.$S('Hardiness').' reduces stun duration by 15%, making it one of the strongest PvP racials in the game and beneficial for all '.$R(2).' classes.[/li]' .
                '[/ul]';
        }
        elseif ($this->typeId == 3) // Dwarf
        {
            $articleText .=
                '[h2]Benefits[/h2][ul]' .
                '[li]'.$R(3).' '.$C(3).' are the top Alliance Hunter choice -- '.$S('Gun Specialization').' provides free expertise with guns, reducing the gear investment needed to reach the expertise cap.[/li]' .
                '[li]'.$R(3).' '.$C(1).' and '.$C(2).' benefit from '.$S('Mace Specialization').' providing free expertise with maces, reducing the gear investment needed to reach the expertise cap.[/li]' .
                '[li]'.$S('Stoneform').' is one of the best defensive PvP racials, removing bleeds, poisons, and diseases while granting a 10% armor bonus -- making '.$R(3).' '.$C(5).' and '.$C(4).' particularly resilient in arena.[/li]' .
                '[li]'.$S('Find Treasure').' is a handy quality-of-life perk that highlights nearby chests on the minimap, useful for treasure hunters and collectors.[/li]' .
                '[/ul]';
        }
        elseif ($this->typeId == 4) // Night Elf
        {
            $articleText .=
                '[h2]Benefits[/h2][ul]' .
                '[li]'.$R(4).' '.$C(11).' are a popular raiding choice for '.$S('Shadowmeld').' which can be used mid-combat to drop threat, giving healers a critical window during progression encounters.[/li]' .
                '[li]'.$R(4).' '.$C(4).' can combine '.$S('Shadowmeld').' with Stealth for powerful PvP openers and escapes, and benefit from '.$S('Quickness').' adding a passive 2% dodge.[/li]' .
                '[li]'.$R(4).' '.$C(3).' appreciate '.$S('Quickness').' for passive survivability and '.$S('Shadowmeld').' as an emergency threat drop or repositioning tool.[/li]' .
                '[li]'.$S('Wisp Spirit').' makes Night Elves the fastest corpse-running race -- a meaningful quality-of-life bonus during extended dungeon and raid progression.[/li]' .
                '[/ul]';
        }
        elseif ($this->typeId == 5) // Undead
        {
            $articleText .=
                '[h2]Benefits[/h2][ul]' .
                '[li]'.$S('Will of the Forsaken').' is one of the most powerful PvP racials available, breaking fear, charm, and sleep effects -- making '.$R(5).' '.$C(9).' and '.$C(5).' exceptionally resilient against CC-heavy arena compositions.[/li]' .
                '[li]'.$R(5).' '.$C(5).' are highly competitive for Shadow Priest play, as '.$S('Will of the Forsaken').' provides critical fear immunity that frees up the trinket slot for other options.[/li]' .
                '[li]'.$R(5).' '.$C(4).' are a classic PvP combination, pairing '.$S('Will of the Forsaken').' with the Rogue toolkit for exceptional control and survivability.[/li]' .
                '[li]'.$S('Cannibalize').' provides free out-of-combat healing by consuming nearby humanoid or undead corpses, saving on food consumables while leveling or soloing.[/li]' .
                '[li]'.$S('Underwater Breathing').' allows '.$R(5).' to remain submerged far longer than other races, a handy edge for underwater quests and exploration.[/li]' .
                '[/ul]';
        }
        elseif ($this->typeId == 6) // Tauren
        {
            $articleText .=
                '[h2]Benefits[/h2][ul]' .
                '[li]'.$R(6).' '.$C(1).' benefit from '.$S('Endurance').' increasing base health, giving Warriors a larger health pool that directly improves survivability for both tanking and PvP.[/li]' .
                '[li]'.$R(6).' '.$C(11).' are a popular PvP choice -- '.$S('War Stomp').' provides an on-demand AoE stun useful for creating distance or interrupting casts, while '.$S('Endurance').' adds to the Druid\'s already considerable survivability.[/li]' .
                '[li]'.$R(6).' '.$C(7).' benefit from '.$S('War Stomp').' as a PvP interrupt and from '.$S('Endurance').' for increased health in both PvP and PvE.[/li]' .
                '[li]'.$S('Cultivation').' grants '.$R(6).' a bonus to Herbalism skill, making it easier to level the profession and gather herbs at a higher speed.[/li]' .
                '[/ul]';
        }
        elseif ($this->typeId == 7) // Gnome
        {
            $articleText .=
                '[h2]Benefits[/h2][ul]' .
                '[li]'.$R(7).' '.$C(8).' benefit from '.$S('Expansive Mind').' granting +5% Intellect, directly increasing the mana pool and scaling with every piece of gear -- one of the few passives that gets stronger the more you progress.[/li]' .
                '[li]'.$R(7).' '.$C(9).' also enjoy '.$S('Expansive Mind').' for a larger mana pool and more consistent output through long encounters.[/li]' .
                '[li]'.$S('Escape Artist').' is a strong PvP racial for all '.$R(7).' classes, breaking roots and snares -- making '.$R(7).' '.$C(4).' and '.$C(8).' particularly elusive in arena.[/li]' .
                '[li]'.$S('Engineering Specialization').' grants '.$R(7).' a bonus to Engineering skill, reducing the investment needed to level the profession and unlock powerful Engineering items earlier.[/li]' .
                '[/ul]';
        }
        elseif ($this->typeId == 8) // Troll
        {
            $articleText .=
                '[h2]Benefits[/h2][ul]' .
                '[li]'.$R(8).' '.$C(3).' are considered one of the best Horde Hunter options: '.$S('Bow Specialization').' provides free expertise with bows, '.$S('Berserking').' is a strong on-use haste cooldown, and '.$S('Beast Slaying').' adds bonus damage against the many beast-type raid and dungeon bosses.[/li]' .
                '[li]'.$R(8).' '.$C(7).' make strong use of '.$S('Berserking').' as a haste cooldown that can be timed with Bloodlust or aligned with key rotation windows.[/li]' .
                '[li]'.$R(8).' '.$C(5).' benefit from '.$S('Berserking').' to increase casting speed, and '.$S('Da Voodoo Shuffle').' reduces movement impairing effects -- a meaningful edge in PvP.[/li]' .
                '[li]'.$S('Regeneration').' allows '.$R(8).' to regenerate a portion of their health even while in combat, saving on food and consumables while leveling or soloing content.[/li]' .
                '[/ul]';
        }
        elseif ($this->typeId == 10) // Blood Elf
        {
            $articleText .=
                '[h2]Benefits[/h2][ul]' .
                '[li]'.$R(10).' '.$C(2).' are the only Horde Paladin option, and '.$S('Arcane Torrent').' provides a unique AoE silence useful for disrupting casters in PvP, plus mana restoration -- making '.$R(10).' '.$C(2).' strong in both arena and PvE.[/li]' .
                '[li]'.$R(10).' '.$C(9).' and '.$C(8).' appreciate '.$S('Arcane Torrent').' for the on-demand mana restoration and AoE silence utility in PvP situations.[/li]' .
                '[li]'.$R(10).' '.$C(4).' can use '.$S('Arcane Torrent').' as an additional interrupt in arena, with the energy restoration providing a small but useful combat boost.[/li]' .
                '[li]'.$S('Magic Resistance').' reduces the chance to be hit by spells by 2%, providing passive magical durability for all '.$R(10).' classes.[/li]' .
                '[li]'.$S('Arcane Affinity').' grants a bonus to Enchanting skill, reducing the investment needed to level the profession and access powerful enchants sooner.[/li]' .
                '[/ul]';
        }
        elseif ($this->typeId == 11) // Draenei
        {
            $articleText .=
                '[h2]Benefits[/h2][ul]' .
                '[li]'.$S('Heroic Presence').' grants increased Hit Chance to all party members, making '.$R(11).' among the most sought-after races for group composition -- melee DPS, casters, and healers all benefit from having a '.$R(11).' in the group.[/li]' .
                '[li]'.$R(11).' '.$C(2).' and '.$C(7).' are particularly strong for raiding -- '.$S('Heroic Presence').' reduces the hit rating needed from gear while both classes bring powerful raid buffs of their own.[/li]' .
                '[li]'.$R(11).' '.$C(3).' benefit from '.$S('Heroic Presence').' freeing up hit rating from gear to invest in agility, crit, or other secondary stats.[/li]' .
                '[li]'.$S('Gift of the Naaru').' provides a heal-over-time that scales with attack power or spell power, offering a small but meaningful survival tool for all classes.[/li]' .
                '[li]'.$S('Gemcutting').' grants a bonus to Jewelcrafting skill, reducing the investment to level the profession and unlocking powerful gems sooner.[/li]' .
                '[/ul]';
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
