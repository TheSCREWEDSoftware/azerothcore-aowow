<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');


// menuId 12: Class    g_initPath()
//  tabId  0: Database g_initHeader()
class ClassPage extends GenericPage
{
    use TrDetailPage;

    protected $type          = Type::CHR_CLASS;
    protected $typeId        = 0;
    protected $tpl           = 'detail-page-generic';
    protected $path          = [0, 12];
    protected $tabId         = 0;
    protected $mode          = CACHE_TYPE_PAGE;
    protected $scripts       = [[SC_JS_FILE, 'js/swfobject.js']];

    public function __construct($pageCall, $id)
    {
        parent::__construct($pageCall, $id);

        $this->typeId = intVal($id);

        $this->subject = new CharClassList(array(['id', $this->typeId]));
        if ($this->subject->error)
            $this->notFound(Lang::game('class'), Lang::chrClass('notFound'));

        $this->name = $this->subject->getField('name', true);
    }

    protected function generatePath()
    {
        $this->path[] = $this->typeId;
    }

    protected function generateTitle()
    {
        array_unshift($this->title, $this->name, Util::ucFirst(Lang::game('class')));
    }

    protected function generateContent()
    {
        $this->addScript([SC_JS_FILE, '?data=zones']);

        $infobox   = Lang::getInfoBoxForFlags($this->subject->getField('cuFlags'));
        $cl        = ChrClass::from($this->typeId);
        $tcClassId = [null, 8, 3, 1, 5, 4, 9, 6, 2, 7, null, 0]; // see TalentCalc.js


        /***********/
        /* Infobox */
        /***********/

        // hero class (flag — always first)
        if ($this->subject->getField('flags') & 0x40)
            $infobox[] = '[tooltip=tooltip_heroclass]'.Lang::game('heroClass').'[/tooltip]';

        // 1. Resource
        if ($cl == ChrClass::DRUID)                         // special Druid case
            $infobox[] = Lang::game('resources').Lang::main('colon').
            '[tooltip name=powertype1]'.Lang::game('st', 0).', '.Lang::game('st', 31).', '.Lang::game('st', 2).'[/tooltip][span class=tip tooltip=powertype1]'.Util::ucFirst(Lang::spell('powerTypes', 0)).'[/span], '.
            '[tooltip name=powertype2]'.Lang::game('st', 5).', '.Lang::game('st', 8).'[/tooltip][span class=tip tooltip=powertype2]'.Util::ucFirst(Lang::spell('powerTypes', 1)).'[/span], '.
            '[tooltip name=powertype8]'.Lang::game('st', 1).'[/tooltip][span class=tip tooltip=powertype8]'.Util::ucFirst(Lang::spell('powerTypes', 3)).'[/span]';
        else if ($cl == ChrClass::DEATHKNIGHT)              // special DK case
            $infobox[] = Lang::game('resources').Lang::main('colon').'[span]'.Util::ucFirst(Lang::spell('powerTypes', 5)).', '.Util::ucFirst(Lang::spell('powerTypes', $this->subject->getField('powerType'))).'[/span]';
        else                                                // regular case
            $infobox[] = Lang::game('resource').Lang::main('colon').'[span]'.Util::ucFirst(Lang::spell('powerTypes', $this->subject->getField('powerType'))).'[/span]';

        // 2. Specializations
        $specList = [];
        $specData = [];
        $skills = new SkillList(array(['id', $this->subject->getField('skills')]));
        // skill line names differ from the talent tree names in a few cases (Shadow Magic, Elemental Combat)
        $specRename = ['shadowmagic' => 'Shadow', 'elementalcombat' => 'Elemental'];
        foreach ($skills->iterate() as $k => $__)
        {
            $sName = $skills->getField('name', true);
            $sNorm = strtolower(preg_replace('/[^a-zA-Z]/', '', $sName));
            if (isset($specRename[$sNorm]))
            {
                $sName = $specRename[$sNorm];
                $sNorm = strtolower($sName);
            }
            $specList[$k] = '[icon name='.$skills->getField('iconString').' size=tiny][url=?spells=7.'.$this->typeId.'.'.$k.']'.$sName.'[/url][/icon]';
            $specData[$k] = [
                'icon'     => $skills->getField('iconString'),
                'name'     => $sName,
                'nameNorm' => $sNorm,
            ];
        }

        // alphabetical, in talent tree order (Arms, Fury, Protection)
        uasort($specData, fn($a, $b) => strcmp($a['name'], $b['name']));
        $specList = array_replace(array_flip(array_keys($specData)), $specList);

        if ($specList)
            $infobox[] = Lang::game('specs').Lang::main('colon').'[ul][li]'.implode('[/li][li]', $specList).'[/li][/ul]';

        // 3. Class ID
        $infobox[] = 'Class ID'.Lang::main('colon').$this->typeId;

        // 4. Icon
        // fileString may be "classicon_paladin" or just "paladin" — normalise to base name
        $fileStr      = strtolower($this->subject->getField('fileString'));
        $clBaseName   = strpos($fileStr, 'classicon_') === 0 ? substr($fileStr, 10) : $fileStr;
        $clIconName   = 'class_' . $clBaseName;      // e.g. class_paladin  (matches /icons/small/*.jpg)
        $clIconText   = 'classicon_' . $clBaseName;  // e.g. classicon_paladin (display label)
        $clIconId     = DB::Aowow()->SelectCell('SELECT `id` FROM ?_icons WHERE LOWER(`name`) = ?s', $clIconText);
        $clIconUrl    = $clIconId ? '?icon=' . $clIconId : '?icons';
        $infobox[] = 'Icon'.Lang::main('colon').'[icon name='.$clIconName.' size=tiny][url='.$clIconUrl.']'.$clIconText.'[/url][/icon]';

        // 5. Roles — display order: Tank, Healer, Melee DPS, Ranged DPS
        // _roles array: 0=Healer, 1=Melee DPS, 2=Ranged DPS, 3=Tank
        $roles = [];
        foreach ([3, 0, 1, 2] as $i)
            if ($this->subject->getField('roles') & (1 << $i))
                $roles[] = Lang::game('_roles', $i);

        if ($roles)
            $infobox[] = (count($roles) > 1 ? Lang::game('roles') : Lang::game('role')).Lang::main('colon').'[ul][li]'.implode('[/li][li]', $roles).'[/li][/ul]';


        /****************/
        /* Main Content */
        /****************/

        $lore = array(
            1  => 'For as long as war has raged, heroes from every race have aimed to master the art of battle. Warriors combine strength, leadership, and a vast knowledge of arms and armor to wreak havoc in glorious combat. Some protect from the front lines with shields, locking down enemies while allies support the warrior from behind with spell and bow. Others forgo the shield and unleash their rage at the closest threat with a variety of deadly weapons.',
            2  => 'This is the call of the Paladin: to protect the weak, to bring justice to the unjust, and to vanquish evil from the darkest corners of the world. These holy warriors are equipped with plate armor so they can confront the toughest of foes, and the blessing of the Light allows them to heal wounds and, in some cases, even restore life to the dead.',
            3  => 'From an early age, the call of the wild draws some adventurers from the comfort of their homes into the unforgiving primal world outside. Those who endure become Hunters. Masters of their environment, they are able to slip like ghosts through the trees and lay traps in the paths of their enemies.',
            4  => 'For Rogues, the only code is the contract, and their honor is purchased in gold. Free from the constraints of a conscience, these mercenaries rely on brutal and efficient tactics. Lethal assassins and masters of stealth, they will approach their marks from behind, piercing a vital organ and vanishing into the shadows before the victim hits the ground.',
            5  => 'Priests are devoted to the spiritual, and express their unwavering faith by serving the people. For millennia they have left behind the confines of their temples and the comfort of their shrines so they can support their allies in war-torn lands. In the midst of terrible conflict, no hero questions the value of the priestly orders.',
            6  => 'Introduced in the Wrath of the Lich King expansion, Death Knights are World of Warcraft\'s first hero class. When the Lich King\'s control of his death knights was broken, his former champions sought revenge for the horrors committed under his command. After their vengeance was won, the death knights found themselves without a cause and without a home. One by one they trickled into the land of the living in search of a new purpose.',
            7  => 'Shamans are spiritual guides and practitioners, not of the divine, but of the very elements. Unlike some other mystics, shaman commune with forces that are not strictly benevolent. The elements are chaotic, and left to their own devices, they rage against one another in unending primal fury. It is the call of the shaman to bring balance to this chaos. Acting as moderators among earth, fire, water, and air, shaman summon totems that focus the elements to support the shaman\'s allies or punish those who threaten them.',
            8  => 'Students gifted with a keen intellect and unwavering discipline may walk the path of the Mage. The arcane magic available to magi is both great and dangerous, and thus is revealed only to the most devoted practitioners. To avoid interference with their spellcasting, magi wear only cloth armor, but arcane shields and enchantments give them additional protection. To keep enemies at bay, magi can summon bursts of fire to incinerate distant targets and cause entire areas to erupt, setting groups of foes ablaze.',
            9  => 'In the face of demonic power, most heroes see death. Warlocks see only opportunity. Dominance is their aim, and they have found a path to it in the dark arts. These voracious spellcasters summon demonic minions to fight beside them. At first, they command only the service of imps, but as a warlock\'s knowledge grows, seductive succubi, loyal voidwalkers, and horrific felhunters join the dark sorcerer\'s ranks to wreak havoc on anyone who stands in their master\'s way.',
            11 => 'Druids harness the vast powers of nature to preserve balance and protect life. With experience, druids can unleash nature\'s raw energy against their enemies, raining celestial fury on them from a great distance, binding them with enchanted vines, or ensnaring them in unrelenting cyclones.',
        );

        // Spec descriptions keyed by normalized spec name (lowercase, letters only)
        $specDescriptions = array(
            1 => array( // Warrior
                'arms'       => 'A battle-hardened master of two-handed weapons, using mobility and overpowering attacks to strike enemies down.',
                'fury'       => 'A furious berserker unleashing a flurry of attacks to carve a bloody path through the battlefield.',
                'protection' => 'An iron-walled defender who uses a shield to protect allies and taunt enemies.',
            ),
            2 => array( // Paladin
                'holy'        => 'Invokes the power of the Light to heal and protect allies through holy blessings.',
                'protection'  => 'Uses Holy magic to shield allies from harm, empowered by the Paladin\'s devotion to justice.',
                'retribution' => 'A righteous crusader who calls upon the power of the Light to smite enemies with holy fury.',
            ),
            3 => array( // Hunter
                'beastmastery'  => 'A master of the wild who can tame a wide variety of beasts to assist in combat.',
                'marksmanship'  => 'A master archer or sharpshooter who excels in ranged combat and keeping enemies at bay.',
                'survival'      => 'A rugged outdoorsman who uses traps, explosives, and cunning to defeat enemies.',
            ),
            4 => array( // Rogue
                'assassination' => 'A deadly master of poisons who dispatches victims swiftly and mercilessly.',
                'combat'        => 'A swashbuckling fighter who uses agility and a flurry of strikes to overwhelm opponents.',
                'subtlety'      => 'A dark stalker who leaps from the shadows to ambush enemies and vanishes before they can react.',
            ),
            5 => array( // Priest
                'discipline' => 'A versatile healer who shields allies from harm and empowers them with sacred energy.',
                'holy'       => 'A healer who calls upon the power of the Light to mend allies\' wounds with potent healing spells.',
                'shadow'     => 'Uses sinister Shadow magic, especially damage-over-time spells, to drain and destroy enemies.',
            ),
            6 => array( // Death Knight
                'blood'  => 'A dark guardian who manipulates and corrupts life energy to sustain their own power.',
                'frost'  => 'An icy presence who slows everything around them, striking hard and applying powerful debuffs.',
                'unholy' => 'A master of death and decay who spreads disease and empowers undead minions.',
            ),
            7 => array( // Shaman
                'elemental'   => 'A spellcaster who harnesses the destructive forces of nature and the elements.',
                'enhancement' => 'Transforms into a melee fighter who uses weapon attacks and short-range spells to overwhelm enemies.',
                'restoration' => 'A healer who calls upon ancestral spirits and the cleansing power of water to mend allies\' wounds.',
            ),
            8 => array( // Mage
                'arcane' => 'Manipulates raw Arcane magic to overwhelm enemies with increasingly powerful blasts.',
                'fire'   => 'Unleashes a torrent of flame, turning enemies to ash with explosive spells and critical strikes.',
                'frost'  => 'Freezes enemies in their tracks with frigid blasts of ice, slowing and shattering them.',
            ),
            9 => array( // Warlock
                'affliction'  => 'A master of Shadow magic who wields curses and disease to weaken and slowly consume enemies.',
                'demonology'  => 'A commander of demons who draws on demonic power to enhance their own might and that of their minions.',
                'destruction' => 'A master of chaos who rains down searing fire and shadow, incinerating enemies with overwhelming force.',
            ),
            11 => array( // Druid
                'balance'      => 'A versatile caster who harnesses the fury of the heavens, calling down lightning and raining stars on enemies.',
                'feralcombat'  => 'Harnesses the raw power of nature to shift between the form of a mighty bear or a savage cat.',
                'restoration'  => 'A healer who calls upon the restorative energies of nature to mend allies\' wounds and bolster their spirits.',
            ),
        );

        // Key abilities per class, keyed by normalized spec name, each entry is an array of spell IDs
        $keyAbilities = array(
            1 => array( // Warrior
                'arms'       => array(12294, 46924, 12328, 772, 5308),     // Mortal Strike, Bladestorm, Sweeping Strikes, Rend, Execute
                'fury'       => array(23881, 1680, 18499, 29801, 78),      // Bloodthirst, Whirlwind, Berserker Rage, Rampage, Heroic Strike
                'protection' => array(8242, 20243, 46968, 50720, 12975),   // Shield Slam, Devastate, Shockwave, Vigilance, Last Stand
            ),
            2 => array( // Paladin
                'holy'        => array(635, 19750, 53563, 20473, 31842),   // Holy Light, Flash of Light, Beacon of Light, Holy Shock, Divine Illumination
                'protection'  => array(31935, 53595, 20925, 31850, 53530), // Avenger's Shield, Hammer of the Righteous, Holy Shield, Ardent Defender, Divine Guardian
                'retribution' => array(35395, 53385, 20185, 53486, 20066), // Crusader Strike, Divine Storm, Judgement of Light, The Art of War, Repentance
            ),
            3 => array( // Hunter
                'beastmastery'  => array(34026, 19574, 1978, 3044, 2643),  // Kill Command, Bestial Wrath, Serpent Sting, Arcane Shot, Multi-Shot
                'marksmanship'  => array(19434, 53209, 34490, 56641, 19503),// Aimed Shot, Chimera Shot, Silencing Shot, Steady Shot, Scatter Shot
                'survival'      => array(53301, 56342, 3674, 1978, 19306), // Explosive Shot, Lock and Load, Black Arrow, Serpent Sting, Counterattack
            ),
            4 => array( // Rogue
                'assassination' => array(1329, 32645, 14177, 51662, 58426), // Mutilate, Envenom, Cold Blood, Hunger For Blood, Overkill
                'combat'        => array(1752, 13750, 13877, 51690, 14251), // Sinister Strike, Adrenaline Rush, Blade Flurry, Killing Spree, Riposte
                'subtlety'      => array(16511, 36554, 51713, 14183, 14185),// Hemorrhage, Shadowstep, Shadow Dance, Premeditation, Preparation
            ),
            5 => array( // Priest
                'discipline' => array(17, 47540, 10060, 33206, 47515),     // Power Word: Shield, Penance, Power Infusion, Pain Suppression, Borrowed Time
                'holy'       => array(34861, 47788, 724, 15237, 596),      // Circle of Healing, Guardian Spirit, Lightwell, Holy Nova, Prayer of Healing
                'shadow'     => array(15407, 589, 34914, 2944, 8092),      // Mind Flay, Shadow Word: Pain, Vampiric Touch, Devouring Plague, Mind Blast
            ),
            6 => array( // Death Knight
                'blood'  => array(49998, 55233, 49005, 49016, 48982),      // Death Strike, Vampiric Blood, Mark of Blood, Hysteria, Rune Tap
                'frost'  => array(49184, 49143, 49020, 51124, 45477),      // Howling Blast, Frost Strike, Obliterate, Killing Machine, Icy Touch
                'unholy' => array(55090, 49194, 49206, 49222, 50842),      // Scourge Strike, Unholy Blight, Summon Gargoyle, Bone Shield, Pestilence
            ),
            7 => array( // Shaman
                'elemental'   => array(403, 421, 51505, 51490, 30706),     // Lightning Bolt, Chain Lightning, Lava Burst, Thunderstorm, Totem of Wrath
                'enhancement' => array(17364, 60103, 51528, 51533, 30823), // Stormstrike, Lava Lash, Maelstrom Weapon, Feral Spirit, Shamanistic Rage
                'restoration' => array(1064, 61295, 974, 51562, 16190),    // Chain Heal, Riptide, Earth Shield, Tidal Waves, Mana Tide Totem
            ),
            8 => array( // Mage
                'arcane' => array(30451, 5143, 12042, 12043, 54646),       // Arcane Blast, Arcane Missiles, Arcane Power, Presence of Mind, Focus Magic
                'fire'   => array(133, 11366, 55360, 48108, 11129),        // Fireball, Pyroblast, Living Bomb, Hot Streak, Combustion
                'frost'  => array(116, 30455, 44572, 44543, 44549),        // Frostbolt, Ice Lance, Deep Freeze, Fingers of Frost, Brain Freeze
            ),
            9 => array( // Warlock
                'affliction'  => array(48181, 30108, 172, 980, 1120),      // Haunt, Unstable Affliction, Corruption, Curse of Agony, Drain Soul
                'demonology'  => array(59672, 50589, 25228, 47193, 63156), // Metamorphosis, Immolation Aura, Soul Link, Demonic Empowerment, Decimation
                'destruction' => array(17962, 50796, 30283, 348, 29722),   // Conflagrate, Chaos Bolt, Shadowfury, Immolate, Incinerate
            ),
            11 => array( // Druid
                'balance'     => array(8921, 5176, 2912, 5570, 48525),     // Moonfire, Wrath, Starfire, Insect Swarm, Eclipse
                'feralcombat' => array(33878, 33745, 1079, 1822, 50334),   // Mangle (Bear), Lacerate, Rip, Rake, Berserk
                'restoration' => array(8936, 774, 33763, 50464, 48438),    // Regrowth, Rejuvenation, Lifebloom, Nourish, Wild Growth
            ),
        );

        // Build article text
        $articleParts = [];

        // (the official-site quote in $lore is no longer shown)

        if ($specData && isset($specDescriptions[$this->typeId]))
        {
            $specItems = [];
            foreach ($specData as $spec)
            {
                if (isset($specDescriptions[$this->typeId][$spec['nameNorm']]))
                    $specItems[] = '[icon name='.$spec['icon'].' size=tiny][b]'.$spec['name'].':[/b][/icon] '.$specDescriptions[$this->typeId][$spec['nameNorm']];
            }
            if ($specItems)
                $articleParts[] = '[h2]Specializations[/h2][ul][li]'.implode('[/li][li]', $specItems).'[/li][/ul]';
        }

        if ($specData && isset($keyAbilities[$this->typeId]))
        {
            $abilityItems = [];
            $allSpellIds  = [];
            foreach ($specData as $spec)
            {
                if (isset($keyAbilities[$this->typeId][$spec['nameNorm']]))
                {
                    $ids   = $keyAbilities[$this->typeId][$spec['nameNorm']];
                    $allSpellIds = array_merge($allSpellIds, $ids);
                    $links = array_map(function($id) { return '[spell='.$id.']'; }, $ids);
                    $abilityItems[] = '[icon name='.$spec['icon'].' size=tiny][b]'.$spec['name'].':[/b][/icon] '.implode(', ', $links);
                }
            }
            if ($abilityItems)
            {
                if ($allSpellIds)
                    $this->extendGlobalIds(Type::SPELL, ...$allSpellIds);
                $articleParts[] = '[h2]Key Abilities[/h2][ul][li]'.implode('[/li][li]', $abilityItems).'[/li][/ul]';
            }
        }

        // the stored class article (?_articles) opens the page, followed by the sections above
        $dbArticle = DB::Aowow()->selectCell('SELECT `article` FROM ?_articles WHERE `type` = ?d AND `typeId` = ?d AND `locale` IN (?a) ORDER BY `locale` DESC, `rev` DESC LIMIT 1',
            $this->type, $this->typeId, [Lang::getLocale()->value, Locale::EN->value]);
        if ($dbArticle)
        {
            foreach ((new Markup($dbArticle))->parseGlobalsFromText() as $jsgType => $jsgIds)
                if ($jsgIds)
                    $this->extendGlobalIds($jsgType, ...array_values($jsgIds));

            array_unshift($articleParts, trim(Util::defStatic($dbArticle)));
        }

        if ($articleParts)
        {
            $this->articleText = implode("\n\n", $articleParts);
            // set the article ourselves: otherwise GenericPage shows only the stored article and the sections above never appear
            $this->article = ['text' => Util::jsEscape($this->articleText), 'params' => ['dbpage' => true]];
        }

        $this->infobox = '[ul][li]'.implode('[/li][li]', $infobox).'[/li][/ul]';
        $this->expansion = Util::$expansionString[$this->subject->getField('expansion')];
        $this->headIcons = [$clIconName];
        $this->redButtons = array(
            BUTTON_LINKS   => ['type' => $this->type, 'typeId' => $this->typeId],
            BUTTON_WOWHEAD => true,
            BUTTON_TALENT  => ['href' => '?talent#'.Util::$tcEncoding[$tcClassId[$this->typeId] * 3], 'pet' => false],
            BUTTON_FORUM   => false                         // todo (low): Cfg::get('BOARD_URL') + X
        );


        /**************/
        /* Extra Tabs */
        /**************/

        // Tab: Spells (grouped)
        //     '$LANG.tab_armorproficiencies',
        //     '$LANG.tab_weaponskills',
        //     '$LANG.tab_glyphs',
        //     '$LANG.tab_abilities',
        //     '$LANG.tab_talents',
        $conditions = array(
            ['s.typeCat', [-13, -11, -2, 7]],
            [['s.cuFlags', (SPELL_CU_TRIGGERED | CUSTOM_EXCLUDE_FOR_LISTVIEW), '&'], 0],
            [
                'OR',
                ['s.reqClassMask', $cl->toMask(), '&'],     // Glyphs, Proficiencies
                ['s.skillLine1', $this->subject->getField('skills')],      // Abilities / Talents
                ['AND', ['s.skillLine1', 0, '>'], ['s.skillLine2OrMask', $this->subject->getField('skills')]]
            ],
            [                                               // last rank or unranked
                'OR',
                ['s.cuFlags', SPELL_CU_LAST_RANK, '&'],
                ['s.rankNo', 0]
            ],
            Cfg::get('SQL_LIMIT_NONE')
        );

        $genSpells = new SpellList($conditions);
        if (!$genSpells->error)
        {
            $this->extendGlobalData($genSpells->getJSGlobals(GLOBALINFO_SELF | GLOBALINFO_RELATED));

            $this->lvTabs[] = [SpellList::$brickFile, array(
                'data'            => array_values($genSpells->getListviewData()),
                'id'              => 'spells',
                'name'            => '$LANG.tab_spells',
                'visibleCols'     => ['level', 'schools', 'type', 'classes'],
                'hiddenCols'      => ['reagents', 'skill'],
                'sort'            => ['-level', 'type', 'name'],
                'computeDataFunc' => '$Listview.funcBox.initSpellFilter',
                'onAfterCreate'   => '$Listview.funcBox.addSpellIndicator'
            )];
        }

        // Tab: Races
        $races = new CharRaceList(array(['classMask', $cl->toMask(), '&']));
        if (!$races->error)
            $this->lvTabs[] = [CharRaceList::$brickFile, ['data' => array_values($races->getListviewData())]];

        // Tab: Skills (weapon/armor proficiencies linked to this class)
        $skillIds = DB::Aowow()->SelectCol(
            'SELECT DISTINCT srci.skillLine
             FROM   dbc_skillraceclassinfo srci
             JOIN   ?_skillline sl ON sl.id = srci.skillLine
             WHERE  (srci.classMask & ?d) > 0
               AND  sl.typeCat IN (-11, -13)',
            $cl->toMask()
        );

        if ($skillIds)
        {
            $profSkills = new SkillList(array(['id', $skillIds]));
            if (!$profSkills->error)
            {
                $this->extendGlobalData($profSkills->getJSGlobals());

                $this->lvTabs[] = [SkillList::$brickFile, array(
                    'data' => array_values($profSkills->getListviewData()),
                    'id'   => 'skills',
                    'name' => '$LANG.tab_skills'
                )];
            }
        }

        // Tab: Trainers
        $conditions = array(
            ['npcflag', 0x30, '&'],                             // is trainer
            ['trainerType', 0],                                 // trains class spells
            ['trainerRequirement', $this->typeId]
        );

        $trainer = new CreatureList($conditions);
        if (!$trainer->error)
        {
            $this->lvTabs[] = [CreatureList::$brickFile, array(
                'data' => array_values($trainer->getListviewData()),
                'id'   => 'trainers',
                'name' => '$LANG.tab_trainers'
            )];
        }

        // Tab: Items (grouped)
        $conditions = array(
            ['requiredClass', 0, '>'],
            ['requiredClass', $cl->toMask(), '&'],
            [['requiredClass', ChrClass::MASK_ALL, '&'], ChrClass::MASK_ALL, '!'],
            ['itemset', 0],                                 // hmm, do or dont..?
            Cfg::get('SQL_LIMIT_NONE')
        );

        $items = new ItemList($conditions);
        if (!$items->error)
        {
            $this->extendGlobalData($items->getJSGlobals());

            $hiddenCols = null;
            if ($items->hasDiffFields('requiredRace'))
                $hiddenCols = ['side'];

            $this->lvTabs[] = [ItemList::$brickFile, array(
                'data'            => array_values($items->getListviewData()),
                'id'              => 'items',
                'name'            => '$LANG.tab_items',
                'visibleCols'     => ['dps', 'armor', 'slot'],
                'hiddenCols'      => $hiddenCols,
                'computeDataFunc' => '$Listview.funcBox.initSubclassFilter',
                'onAfterCreate'   => '$Listview.funcBox.addSubclassIndicator',
                'note'            => sprintf(Util::$filterResultString, '?items&filter=cr=152;crs='.$this->typeId.';crv=0'),
                '_truncated'      => 1
            )];
        }

        // Tab: Item Sets
        $sets = new ItemsetList(array(['classMask', $cl->toMask(), '&']));
        if (!$sets->error)
        {
            $this->extendGlobalData($sets->getJSGlobals(GLOBALINFO_SELF));

            $this->lvTabs[] = [ItemsetList::$brickFile, array(
                'data'       => array_values($sets->getListviewData()),
                'note'       => sprintf(Util::$filterResultString, '?itemsets&filter=cl='.$this->typeId),
                'hiddenCols' => ['classes'],
                'sort'       => ['-level', 'name']
            )];
        }

        // Tab: Quests
        $conditions = array(
            ['reqClassMask', $cl->toMask(), '&'],
            [['reqClassMask', ChrClass::MASK_ALL, '&'], ChrClass::MASK_ALL, '!']
        );

        $quests = new QuestList($conditions);
        if (!$quests->error)
        {
            $this->extendGlobalData($quests->getJSGlobals());

            $this->lvTabs[] = [QuestList::$brickFile, array(
                'data' => array_values($quests->getListviewData()),
                'sort' => ['reqlevel', 'name']
            )];
        }

        // Tab: Conditions for
        $cnd = new Conditions();
        $cnd->getByCondition(Type::CHR_CLASS, $this->typeId)->prepare();
        if ($tab = $cnd->toListviewTab('condition-for', '$LANG.tab_condition_for'))
        {
            $this->extendGlobalData($cnd->getJsGlobals());
            $this->lvTabs[] = $tab;
        }

        // Note: Comments and Screenshots are appended automatically via $contribute (CONTRIBUTE_ANY)
    }
}

?>
