<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');


// menuId 4: NPC      g_initPath()
//  tabId 0: Database g_initHeader()
class NpcPage extends GenericPage
{
    use TrDetailPage;

    protected $placeholder  = [];
    protected $accessory    = [];
    protected $quotes       = [];
    protected $reputation   = [];
    protected $gossipMenu   = null;
    protected $subname      = '';

    protected $type          = Type::NPC;
    protected $typeId        = 0;
    protected $tpl           = 'npc';
    protected $path          = [0, 4];
    protected $tabId         = 0;
    protected $mode          = CACHE_TYPE_PAGE;
    protected $scripts       = [[SC_JS_FILE, 'js/swfobject.js'], [SC_CSS_FILE, 'css/Profiler.css']];

    protected $_get          = ['domain' => ['filter' => FILTER_CALLBACK, 'options' => 'Locale::tryFromDomain']];

    private   $soundIds      = [];
    private   $powerTpl      = '$WowheadPower.registerNpc(%d, %d, %s);';

    public function __construct($pageCall, $id)
    {
        parent::__construct($pageCall, $id);

        // temp locale
        if ($this->mode == CACHE_TYPE_TOOLTIP && $this->_get['domain'])
            Lang::load($this->_get['domain']);

        $this->typeId = intVal($id);

        $this->subject = new CreatureList(array(['id', $this->typeId]));
        if ($this->subject->error)
            $this->notFound(Lang::game('npc'), Lang::npc('notFound'));

        $this->name    = Util::htmlEscape($this->subject->getField('name', true));
        $this->subname = Util::htmlEscape($this->subject->getField('subname', true));
    }

    protected function generatePath()
    {
        $this->path[] = $this->subject->getField('type');

        if ($_ = $this->subject->getField('family'))
            $this->path[] = $_;
    }

    protected function generateTitle()
    {
        array_unshift($this->title, $this->subject->getField('name', true), Util::ucFirst(Lang::game('npc')));
    }

    protected function generateContent()
    {
        $this->addScript([SC_JS_FILE, '?data=zones']);

        $_typeFlags  = $this->subject->getField('typeFlags');
        $_altIds     = [];
        $_altNPCs    = null;
        $placeholder = [];
        $accessory   = [];

        // difficulty entries of self
        if ($this->subject->getField('cuFlags') & NPC_CU_DIFFICULTY_DUMMY)
            $placeholder = [$this->subject->getField('parentId'), $this->subject->getField('parent', true)];
        else
        {
            for ($i = 1; $i < 4; $i++)
                if ($_ = $this->subject->getField('difficultyEntry'.$i))
                    $_altIds[$_] = $i;

            if ($_altIds)
                $_altNPCs = new CreatureList(array(['id', array_keys($_altIds)]));
        }

        if ($_ = DB::World()->selectCol('SELECT DISTINCT `entry` FROM vehicle_template_accessory WHERE `accessory_entry` = ?d', $this->typeId))
        {
            $vehicles = new CreatureList(array(['id', $_]));
            foreach ($vehicles->iterate() as $id => $__)
                $accessory[] = [$id, $vehicles->getField('name', true)];
        }

        // try to determine, if it's spawned in a dungeon or raid (shaky at best, if spawned by script)
        $mapType = 0;
        if ($maps = DB::Aowow()->selectCol('SELECT DISTINCT `areaId` FROM ?_spawns WHERE `type` = ?d AND `typeId` = ?d', Type::NPC, $this->typeId))
        {
            if (count($maps) == 1)                          // should only exist in one instance
            {
                switch (DB::Aowow()->selectCell('SELECT `type` FROM ?_zones WHERE `id` = ?d', $maps[0]))
                {
                 // case MAP_TYPE_DUNGEON:
                    case MAP_TYPE_DUNGEON_HC:
                        $mapType = 1; break;
                 // case MAP_TYPE_RAID:
                    case MAP_TYPE_MMODE_RAID:
                    case MAP_TYPE_MMODE_RAID_HC:
                        $mapType = 2; break;
                }
            }
        }
        // npc is difficulty dummy: get max difficulty from parent npc
        if ($placeholder && ($mt = DB::Aowow()->selectCell('SELECT IF(`difficultyEntry1` = ?d, 1, 2) FROM ?_creature WHERE `difficultyEntry1` = ?d OR `difficultyEntry2` = ?d OR `difficultyEntry3` = ?d', $this->typeId, $this->typeId, $this->typeId, $this->typeId)))
            $mapType = max($mapType, $mt);
        // npc has difficulty dummys: 2+ dummies -> definitely raid (10/25 + hc); 1 dummy -> may be heroic (used here), but may also be 10/25-raid
        if ($_altIds)
            $mapType = max($mapType, count($_altIds) > 1 ? 2 : 1);
        // for event encounters a single npc may be reused over multiple difficulties but have different chests assigned
        if ($d = DB::Aowow()->selectCell('SELECT MAX(`difficulty`) FROM ?_loot_link WHERE `npcId` IN (?a)', array_merge($_altIds, [$this->typeId])))
            $mapType = max($mapType, $d > 2 ? 2 : 1);


        /***********/
        /* Infobox */
        /***********/

        $infobox = Lang::getInfoBoxForFlags($this->subject->getField('cuFlags'));

        // Expansion
        $_expVal   = (int)$this->subject->getField('exp');
        $_expIcons = [1 => 'bc', 2 => 'wotlk'];
        $_expNames = [0 => 'Classic', 1 => 'The Burning Crusade', 2 => 'Wrath of the Lich King'];
        if ($_expVal && isset($_expIcons[$_expVal]))
            $this->expansion = $_expIcons[$_expVal];

        // Event (ignore events, where the object only gets removed)
        if ($_ = DB::World()->selectCol('SELECT DISTINCT ge.`eventEntry` FROM game_event ge, game_event_creature gec, creature c WHERE ge.`eventEntry` = gec.`eventEntry` AND c.`guid` = gec.`guid` AND c.`id1` = ?d', $this->typeId))
        {
            $this->extendGlobalIds(Type::WORLDEVENT, ...$_);
            $ev = [];
            foreach ($_ as $i => $e)
                $ev[] = ($i % 2 ? '[br]' : ' ') . '[event='.$e.']';

            $infobox[] = Util::ucFirst(Lang::game('eventShort')).Lang::main('colon').implode(',', $ev);
        }

        // Level
        if ($this->subject->getField('rank') != NPC_RANK_BOSS)
        {
            $level  = $this->subject->getField('minLevel');
            $maxLvl = $this->subject->getField('maxLevel');
            if ($level < $maxLvl)
                $level .= ' - '.$maxLvl;
        }
        else                                                // Boss Level
            $level = '??';

        $infobox[] = Lang::game('level').Lang::main('colon').$level;

        // Classification
        if ($_ = $this->subject->getField('rank'))          //  != NPC_RANK_NORMAL
        {
            $str = Lang::npc('rank', $_).' ['.$_.']';
            if ($this->subject->isBoss())
                $str = '[span class=icon-boss]'.$str.'[/span]';
            $infobox[] = '[tooltip name=tt_rank_label]'.Lang::npc('classification').'[/tooltip][span class=tip tooltip=tt_rank_label]Rank[/span]'.Lang::main('colon').$str;
        }

        // Reaction
        $_reactColor = fn(int $r) : string => $r > 0 ? 'q2' : ($r < 0 ? 'q10' : '');
        $_reactLabel = fn(int $r) : string => $r > 0 ? 'Friendly' : ($r < 0 ? 'Hostile' : 'Neutral');
        $_mkReact    = function(int $val, string $letter, string $ttId, string $faction) use ($_reactColor, $_reactLabel) : string
        {
            $col   = $_reactColor($val);
            $class = 'tip'.($col ? ' '.$col : '');
            $style = $col ? '' : ' style="color:#e5cc80"';
            return '[tooltip name='.$ttId.']'.$faction.': '.$_reactLabel($val).'[/tooltip]'.
                   '[span class="'.$class.'" tooltip='.$ttId.$style.']'.$letter.'[/span]';
        };
        $infobox[] = '[tooltip name=tt_react_label]'.Lang::npc('react').'[/tooltip][span class=tip tooltip=tt_react_label]Relation[/span]'.Lang::main('colon').
            $_mkReact((int)$this->subject->getField('A'), 'A', 'react_a', 'Alliance').' '.
            $_mkReact((int)$this->subject->getField('H'), 'H', 'react_h', 'Horde');

        // Faction
        $this->extendGlobalIds(Type::FACTION, $this->subject->getField('factionId'));
        $infobox[] = Util::ucFirst(Lang::game('faction')).Lang::main('colon').'[faction='.$this->subject->getField('factionId').']';

        // Type
        if ($npcType = (int)$this->subject->getField('type'))
            $infobox[] = Lang::game('type').Lang::main('colon').Lang::game('ct', $npcType).' ['.$npcType.']';

        // Tameable
        if ($_typeFlags & 0x1)
            if ($_ = $this->subject->getField('family'))
                $infobox[] = Lang::npc('tameable', ['[url=pet='.$_.']'.Lang::game('fa', $_).'[/url]']);

        // Wealth
        if ($_ = intVal(($this->subject->getField('minGold') + $this->subject->getField('maxGold')) / 2))
            $infobox[] = Lang::npc('worth').Lang::main('colon').'[tooltip=tooltip_avgmoneydropped][money='.$_.'][/tooltip]';

        // is Vehicle
        if ($this->subject->getField('vehicleId'))
            $infobox[] = Lang::npc('vehicle');

        // is visible as ghost
        if ($this->subject->getField('npcflag') & (NPC_FLAG_SPIRIT_HEALER | NPC_FLAG_SPIRIT_GUIDE))
            $infobox[] = Lang::npc('spirit');

        if (User::isInGroup(U_GROUP_EMPLOYEE))
        {
            // AI
            if ($_ = $this->subject->getField('scriptName'))
                $infobox[] = 'Script'.Lang::main('colon').$_;
            else if ($_ = $this->subject->getField('aiName'))
                $infobox[] = 'AI'.Lang::main('colon').$_;

            // Mechanic immune
            if ($immuneMask = $this->subject->getField('mechanicImmuneMask'))
            {
                $buff = [];
                for ($i = 0; $i < 31; $i++)
                    if ($immuneMask & (1 << $i))
                        $buff[] = (!fMod(count($buff), 3) ? "\n" : null).'[url=?spells&filter=me='.($i + 1).']'.Lang::game('me', $i + 1).'[/url]';

                $infobox[] = 'Not affected by mechanic'.Lang::main('colon').implode(', ', $buff);
            }

            // helper: build tooltip markup inline
            $_tt = function(string $name, string $label, string $tip) : string {
                return '[tooltip name='.$name.']'.$tip.'[/tooltip][span class=tip tooltip='.$name.']'.$label.'[/span]';
            };
            // helper: append a named flag group to the $flagGroups collector
            $_flagGroup = function(string $groupName, array $bits) use (&$flagGroups) : void {
                if ($bits)
                    $flagGroups[] = $groupName.Lang::main('colon').'[ul][li]'.implode('[/li][li]', $bits).'[/li][/ul]';
            };
            $flagGroups = [];

            // npc flags (raw)
            if ($npcflag = $this->subject->getField('npcflag'))
            {
                $buff = [];
                if ($npcflag & NPC_FLAG_GOSSIP)          $buff[] = $_tt('nf-gossip',     'Gossip',          'Can be interacted with for gossip dialogue');
                if ($npcflag & NPC_FLAG_QUEST_GIVER)     $buff[] = $_tt('nf-quest',      'Quest Giver',     'Offers or completes quests');
                if ($npcflag & NPC_FLAG_TRAINER)         $buff[] = $_tt('nf-trainer',    'Trainer',         'Teaches skills or abilities');
                if ($npcflag & NPC_FLAG_CLASS_TRAINER)   $buff[] = $_tt('nf-clstrainer', 'Class Trainer',   'Teaches class-specific talents');
                if ($npcflag & NPC_FLAG_VENDOR)          $buff[] = $_tt('nf-vendor',     'Vendor',          'Sells items');
                if ($npcflag & NPC_FLAG_VENDOR_AMMO)     $buff[] = $_tt('nf-ammo',       'Ammo Vendor',     'Sells ammunition');
                if ($npcflag & NPC_FLAG_VENDOR_FOOD)     $buff[] = $_tt('nf-food',       'Food Vendor',     'Sells food and drink');
                if ($npcflag & NPC_FLAG_VENDOR_POISON)   $buff[] = $_tt('nf-poison',     'Poison Vendor',   'Sells poisons (Rogue only)');
                if ($npcflag & NPC_FLAG_VENDOR_REAGENT)  $buff[] = $_tt('nf-reagent',    'Reagent Vendor',  'Sells spell reagents');
                if ($npcflag & NPC_FLAG_REPAIRER)        $buff[] = $_tt('nf-repair',     'Repairer',        'Can repair damaged equipment');
                if ($npcflag & NPC_FLAG_FLIGHT_MASTER)   $buff[] = $_tt('nf-flight',     'Flight Master',   'Provides flight path transport');
                if ($npcflag & NPC_FLAG_SPIRIT_HEALER)   $buff[] = $_tt('nf-sphealer',   'Spirit Healer',   'Resurrects players at graveyards');
                if ($npcflag & NPC_FLAG_SPIRIT_GUIDE)    $buff[] = $_tt('nf-spguide',    'Spirit Guide',    'Guides players in battlegrounds');
                if ($npcflag & NPC_FLAG_INNKEEPER)       $buff[] = $_tt('nf-innkeeper',  'Innkeeper',       'Allows players to set their hearthstone location');
                if ($npcflag & NPC_FLAG_BANKER)          $buff[] = $_tt('nf-banker',     'Banker',          'Provides access to the bank');
                if ($npcflag & NPC_FLAG_PETITIONER)      $buff[] = $_tt('nf-petition',   'Petitioner',      'Handles guild and arena team charters');
                if ($npcflag & NPC_FLAG_GUILD_MASTER)    $buff[] = $_tt('nf-guildmstr',  'Guild Master',    'Manages guild creation');
                if ($npcflag & NPC_FLAG_BATTLEMASTER)    $buff[] = $_tt('nf-bmaster',    'Battlemaster',    'Registers players for battlegrounds');
                if ($npcflag & NPC_FLAG_AUCTIONEER)      $buff[] = $_tt('nf-auctioneer', 'Auctioneer',      'Provides access to the Auction House');
                if ($npcflag & NPC_FLAG_STABLE_MASTER)   $buff[] = $_tt('nf-stable',     'Stable Master',   'Manages hunter pet stabling');
                if ($npcflag & NPC_FLAG_GUILD_BANK)      $buff[] = $_tt('nf-guildbank',  'Guild Bank',      'Provides access to the guild bank');
                if ($npcflag & NPC_FLAG_SPELLCLICK)      $buff[] = $_tt('nf-spellclick', 'SpellClick',      'Clicking triggers a spell (UNIT_NPC_FLAG_SPELLCLICK)');
                if ($npcflag & NPC_FLAG_MAILBOX)         $buff[] = $_tt('nf-mailbox',    'Mailbox',         'Provides access to the mailbox');
                $_flagGroup('NPC Flags', $buff);
            }

            // unit flags
            if ($unitFlags = $this->subject->getField('unitFlags'))
            {
                $buff = [];
                if ($unitFlags & UNIT_FLAG_SERVER_CONTROLLED)     $buff[] = $_tt('uf-svctrl',    'Server Controlled',   'Movement and actions are controlled server-side');
                if ($unitFlags & UNIT_FLAG_NON_ATTACKABLE)        $buff[] = $_tt('uf-noatk',     'Non-Attackable',      'Cannot be attacked by anyone');
                if ($unitFlags & UNIT_FLAG_REMOVE_CLIENT_CONTROL) $buff[] = $_tt('uf-rmctrl',    'Remove Client Control','Prevents the client from controlling this unit');
                if ($unitFlags & UNIT_FLAG_PVP_ATTACKABLE)        $buff[] = $_tt('uf-pvpatk',    'PvP Attackable',      'Can be attacked under PvP rules in addition to faction rules');
                if ($unitFlags & UNIT_FLAG_RENAME)                $buff[] = $_tt('uf-rename',    'Rename',              'Unit can be renamed');
                if ($unitFlags & UNIT_FLAG_PREPARATION)           $buff[] = $_tt('uf-prep',      'Preparation',         'No reagent cost for spells with SPELL_ATTR5_NO_REAGENT_WHILE_PREP');
                if ($unitFlags & UNIT_FLAG_NOT_ATTACKABLE_1)      $buff[] = $_tt('uf-nopvpatk',  'Non-PvP Attackable',  'Cannot be attacked in PvP (combined with PVP_ATTACKABLE flag)');
                if ($unitFlags & UNIT_FLAG_IMMUNE_TO_PC)          $buff[] = $_tt('uf-immpc',     'Immune to PC',        'Ignores combat and assistance from player characters');
                if ($unitFlags & UNIT_FLAG_IMMUNE_TO_NPC)         $buff[] = $_tt('uf-immnpc',    'Immune to NPC',       'Ignores combat and assistance from non-player characters');
                if ($unitFlags & UNIT_FLAG_PVP)                   $buff[] = $_tt('uf-pvp',       'PvP',                 'Flagged for PvP combat');
                if ($unitFlags & UNIT_FLAG_SILENCED)              $buff[] = $_tt('uf-silence',   'Silenced',            'Cannot cast spells');
                if ($unitFlags & UNIT_FLAG_CANNOT_SWIM)           $buff[] = $_tt('uf-noswim',    'Cannot Swim',         'Cannot enter water');
                if ($unitFlags & UNIT_FLAG_PACIFIED)              $buff[] = $_tt('uf-pacified',  'Pacified',            'Will not initiate or engage in combat');
                if ($unitFlags & UNIT_FLAG_STUNNED)               $buff[] = $_tt('uf-stunned',   'Stunned',             'Currently stunned');
                if ($unitFlags & UNIT_FLAG_IN_COMBAT)             $buff[] = $_tt('uf-combat',    'In Combat',           'Currently engaged in combat');
                if ($unitFlags & UNIT_FLAG_TAXI_FLIGHT)           $buff[] = $_tt('uf-taxi',      'Taxi Flight',         'On a taxi flight path; certain spells are disabled');
                if ($unitFlags & UNIT_FLAG_DISARMED)              $buff[] = $_tt('uf-disarm',    'Disarmed',            'Melee weapon is disabled');
                if ($unitFlags & UNIT_FLAG_CONFUSED)              $buff[] = $_tt('uf-confused',  'Confused',            'Wandering randomly, cannot act normally');
                if ($unitFlags & UNIT_FLAG_FLEEING)               $buff[] = $_tt('uf-fleeing',   'Fleeing',             'Running away in fear');
                if ($unitFlags & UNIT_FLAG_PLAYER_CONTROLLED)     $buff[] = $_tt('uf-plrctrl',   'Player Controlled',   'Under player or vehicle control');
                if ($unitFlags & UNIT_FLAG_NOT_SELECTABLE)        $buff[] = $_tt('uf-nosel',     'Not Selectable',      'Cannot be selected by mouse or /target command');
                if ($unitFlags & UNIT_FLAG_SKINNABLE)             $buff[] = $_tt('uf-skin',      'Skinnable',           'Can be skinned after death');
                if ($unitFlags & UNIT_FLAG_MOUNT)                 $buff[] = $_tt('uf-mount',     'Mount',               'Treated as a mount by the client');
                if ($unitFlags & UNIT_FLAG_SHEATHE)               $buff[] = $_tt('uf-sheathe',   'Sheathe',             'Weapon is sheathed');
                $_flagGroup('Unit Flags', $buff);
            }

            // unit flags 2
            if ($unitFlags2 = $this->subject->getField('unitFlags2'))
            {
                $buff = [];
                if ($unitFlags2 & UNIT_FLAG2_FEIGN_DEATH)                $buff[] = $_tt('uf2-feign',    'Feign Death',              'Unit appears dead to the client');
                if ($unitFlags2 & UNIT_FLAG2_UNK1)                       $buff[] = $_tt('uf2-hidemdl',  'Hide Model',               'Unit model is hidden; only player equipment is shown');
                if ($unitFlags2 & UNIT_FLAG2_IGNORE_REPUTATION)          $buff[] = $_tt('uf2-ignrep',   'Ignore Reputation',        'Reputation does not affect interaction with this unit');
                if ($unitFlags2 & UNIT_FLAG2_COMPREHEND_LANG)            $buff[] = $_tt('uf2-complang', 'Comprehend Language',      'Can understand all player languages');
                if ($unitFlags2 & UNIT_FLAG2_MIRROR_IMAGE)               $buff[] = $_tt('uf2-mirror',   'Mirror Image',             'A mirror image copy of another unit');
                if ($unitFlags2 & UNIT_FLAG2_INSTANTLY_APPEAR_MODEL)     $buff[] = $_tt('uf2-instant',  'Instantly Appear Model',   'Model appears immediately when summoned with no fade-in');
                if ($unitFlags2 & UNIT_FLAG2_FORCE_MOVEMENT)             $buff[] = $_tt('uf2-forcemov', 'Force Movement',           'Forced movement is applied to this unit');
                if ($unitFlags2 & UNIT_FLAG2_DISARM_OFFHAND)             $buff[] = $_tt('uf2-disarmoh', 'Disarm Off-hand',          'Off-hand weapon is disabled');
                if ($unitFlags2 & UNIT_FLAG2_DISABLE_PRED_STATS)         $buff[] = $_tt('uf2-predstat', 'Disable Predicted Stats',  'Predicted stats disabled (used by raid frames)');
                if ($unitFlags2 & UNIT_FLAG2_DISARM_RANGED)              $buff[] = $_tt('uf2-disarmrng','Disarm Ranged',            'Ranged weapon is disabled');
                if ($unitFlags2 & UNIT_FLAG2_REGENERATE_POWER)           $buff[] = $_tt('uf2-regen',    'Regenerate Power',         'Unit regenerates mana, energy or other power');
                if ($unitFlags2 & UNIT_FLAG2_RESTRICT_PARTY_INTERACTION) $buff[] = $_tt('uf2-partyonly','Restrict Party Interact',  'Interaction is restricted to party or raid members only');
                if ($unitFlags2 & UNIT_FLAG2_PREVENT_SPELL_CLICK)        $buff[] = $_tt('uf2-nospclck', 'Prevent SpellClick',       'SpellClick cannot be used on this unit');
                if ($unitFlags2 & UNIT_FLAG2_ALLOW_ENEMY_INTERACT)       $buff[] = $_tt('uf2-enemyint', 'Allow Enemy Interact',     'Enemy players can interact with this unit');
                if ($unitFlags2 & UNIT_FLAG2_DISABLE_TURN)               $buff[] = $_tt('uf2-noturn',   'Disable Turn',             'Unit cannot turn');
                if ($unitFlags2 & UNIT_FLAG2_PLAY_DEATH_ANIM)            $buff[] = $_tt('uf2-deathanim','Play Death Animation',     'Plays a special death animation instead of the default');
                if ($unitFlags2 & UNIT_FLAG2_ALLOW_CHEAT_SPELLS)         $buff[] = $_tt('uf2-cheat',    'Allow Cheat Spells',       'Can be targeted by spells with SPELL_ATTR7_IS_CHEAT_SPELL');
                $_flagGroup('Unit Flags 2', $buff);
            }

            // dynamic flags
            if ($dynamicFlags = $this->subject->getField('dynamicFlags'))
            {
                $buff = [];
                if ($dynamicFlags & 0x001) $buff[] = $_tt('df-loot',      'Lootable',             'Has loot available for players');
                if ($dynamicFlags & 0x002) $buff[] = $_tt('df-track',     'Track Unit',           'Tracked on the minimap');
                if ($dynamicFlags & 0x004) $buff[] = $_tt('df-tapped',    'Tapped',               'Has been tagged (name appears grey to others)');
                if ($dynamicFlags & 0x008) $buff[] = $_tt('df-tapplr',    'Tapped by Player',     'Tagged by a player character');
                if ($dynamicFlags & 0x010) $buff[] = $_tt('df-specinfo',  'Special Info',         'Shows special interaction information');
                if ($dynamicFlags & 0x020) $buff[] = $_tt('df-dead',      'Dead',                 'Unit is currently dead');
                if ($dynamicFlags & 0x040) $buff[] = $_tt('df-raf',       'Refer-a-Friend',       'Linked to the Refer-a-Friend bonus system');
                if ($dynamicFlags & 0x100) $buff[] = $_tt('df-taplist',   'Tapped by Threat List','Tagged by all units currently on its threat list');
                $_flagGroup('Dynamic Flags', $buff);
            }

            // type flags
            if ($_typeFlags)
            {
                $buff = [];
                if ($_typeFlags & 0x000001)  $buff[] = $_tt('tf-tame',      'Tameable',                  'Can be tamed as a Hunter pet');
                if ($_typeFlags & 0x000002)  $buff[] = $_tt('tf-ghost',     'Visible to Ghosts',         'Visible and interactable to dead (ghost) players');
                if ($_typeFlags & 0x000004)  $buff[] = $_tt('tf-boss',      'Boss',                      'Boss-level creature; nameplate shown in purple');
                if ($_typeFlags & 0x000008)  $buff[] = $_tt('tf-nowound',   'No Wound Animation',        'Does not play wound/hit flinch animations');
                if ($_typeFlags & 0x000010)  $buff[] = $_tt('tf-nofaction', 'No Faction Tooltip',        'Faction name is not shown in the unit tooltip');
                if ($_typeFlags & 0x000020)  $buff[] = $_tt('tf-audible',   'More Audible',              'Plays sounds more frequently than usual');
                if ($_typeFlags & 0x000040)  $buff[] = $_tt('tf-spellatk',  'Spell Attackable',          'Can only be targeted via spells, not melee');
                if ($_typeFlags & 0x000080)  $buff[] = $_tt('tf-intdead',   'Interact While Dead',       'Players can gossip or loot while the creature is dead');
                if ($_typeFlags & 0x000100)  $buff[] = $_tt('tf-herb',      'Skin with Herbalism',       'Can be looted using the Herbalism skill');
                if ($_typeFlags & 0x000200)  $buff[] = $_tt('tf-mine',      'Skin with Mining',          'Can be looted using the Mining skill');
                if ($_typeFlags & 0x000400)  $buff[] = $_tt('tf-nodeathlog','No Death Log',              'Death of this creature is not written to the combat log');
                if ($_typeFlags & 0x000800)  $buff[] = $_tt('tf-mntcombat', 'Mounted Combat',            'Creature can remain mounted when entering combat');
                if ($_typeFlags & 0x001000)  $buff[] = $_tt('tf-assist',    'Can Assist',                'Will assist friendly units in nearby combat');
                if ($_typeFlags & 0x002000)  $buff[] = $_tt('tf-nopetbar',  'No Pet Bar',                'Pet action bar is not shown when controlling this creature');
                if ($_typeFlags & 0x004000)  $buff[] = $_tt('tf-maskuid',   'Mask UID',                  'Unit ID is masked in network packets');
                if ($_typeFlags & 0x008000)  $buff[] = $_tt('tf-eng',       'Skin with Engineering',     'Can be looted using the Engineering skill');
                if ($_typeFlags & 0x010000)  $buff[] = $_tt('tf-exotic',    'Exotic Pet',                'Can be tamed as an exotic Hunter pet (requires Beast Mastery)');
                if ($_typeFlags & 0x020000)  $buff[] = $_tt('tf-defcoll',   'Default Collision Box',     'Uses the default collision box instead of a fitted one');
                if ($_typeFlags & 0x040000)  $buff[] = $_tt('tf-siege',     'Siege Weapon',              'Treated as a siege weapon for combat purposes');
                if ($_typeFlags & 0x080000)  $buff[] = $_tt('tf-missile',   'Collides with Missiles',    'Projectiles and missiles can collide with this creature');
                if ($_typeFlags & 0x100000)  $buff[] = $_tt('tf-hideplate', 'Hide Nameplate',            'Nameplate is hidden above the creature');
                if ($_typeFlags & 0x200000)  $buff[] = $_tt('tf-nomntanim', 'No Mounted Animations',     'Does not play mounted movement animations');
                if ($_typeFlags & 0x400000)  $buff[] = $_tt('tf-linkall',   'Link All',                  'Shares aggro with all nearby creatures of the same entry');
                if ($_typeFlags & 0x800000)  $buff[] = $_tt('tf-creatonly', 'Creator Only',              'Can only be interacted with by the unit that created it');
                if ($_typeFlags & 0x1000000) $buff[] = $_tt('tf-noevtsnd',  'No Unit Event Sounds',      'Does not play unit event sounds (aggro, death, etc.)');
                if ($_typeFlags & 0x2000000) $buff[] = $_tt('tf-noshadow',  'No Shadow Blob',            'No circular shadow blob is rendered under the creature');
                if ($_typeFlags & 0x4000000) $buff[] = $_tt('tf-raidheal',  'Raid Unit (Helpful)',       'Covered by AoE healing spells cast by friendly units');
                if ($_typeFlags & 0x8000000) $buff[] = $_tt('tf-largeaoi',  'Large AOI',                 'Has an extended area of influence for AI and events');
                if ($_typeFlags & 0x10000000) $buff[] = $_tt('tf-gigaoi',   'Gigantic AOI',              'Has a very large area of influence (used by world bosses)');
                if ($_typeFlags & 0x20000000) $buff[] = $_tt('tf-nomelee',  'No Melee Approach',         'Will not physically approach targets to engage in melee');
                if ($_typeFlags & 0x40000000) $buff[] = $_tt('tf-raidharm', 'Raid Unit (Harmful)',       'Treated as a raid unit for harmful AoE spells');
                if ($_typeFlags & 0x80000000) $buff[] = $_tt('tf-missile2', 'Collide with Missiles (2)', 'Secondary missile collision flag');
                $_flagGroup('Type Flags', $buff);
            }

            // extra flags
            if ($flagsExtra = $this->subject->getField('flagsExtra'))
            {
                $buff = [];
                if ($flagsExtra & 0x000001) $buff[] = $_tt('ef-instance',  'Instance Bind',             'Attacker is bound to the instance when this creature dies');
                if ($flagsExtra & 0x000002) $buff[] = $_tt('ef-civilian',  'Civilian',                  "Does not aggro\nDeath costs the attacker Honor points");
                if ($flagsExtra & 0x000004) $buff[] = $_tt('ef-noparry',   'No Parry',                  'Cannot parry incoming melee attacks');
                if ($flagsExtra & 0x000008) $buff[] = $_tt('ef-nophaste',  'No Parry Haste',            'Parrying does not accelerate the next attack');
                if ($flagsExtra & 0x000010) $buff[] = $_tt('ef-noblock',   'No Block',                  'Cannot block incoming attacks with a shield');
                if ($flagsExtra & 0x000020) $buff[] = $_tt('ef-nocrush',   'No Crushing Blows',         'Cannot deal crushing blows regardless of level difference');
                if ($flagsExtra & 0x000040) $buff[] = $_tt('ef-noexp',     'No Experience',             'Killing this creature rewards no experience points');
                if ($flagsExtra & 0x000080) $buff[] = $_tt('ef-trigger',   'Trigger Creature',          'Invisible trigger used to fire events; not a real combat unit');
                if ($flagsExtra & 0x000100) $buff[] = $_tt('ef-notaunt',   'Immune to Taunt',           'Cannot be taunted by players or pets');
                if ($flagsExtra & 0x008000) $buff[] = $_tt('ef-guard',     'Guard',                     "Engages attackers flagged for PvP\nIgnores enemy stealth, invisibility and Feign Death");
                if ($flagsExtra & 0x020000) $buff[] = $_tt('ef-nocrit',    'No Critical Hits',          'Cannot deal critical strikes');
                if ($flagsExtra & 0x040000) $buff[] = $_tt('ef-noskill',   'No Weapon Skill',           'Attacking this creature does not grant weapon skill increases');
                if ($flagsExtra & 0x080000) $buff[] = $_tt('ef-tauntdr',   'Taunt Diminishing Returns', 'Successive taunts have reduced duration (diminishing returns)');
                if ($flagsExtra & 0x100000) $buff[] = $_tt('ef-selfdr',    'Self Diminishing Returns',  'This creature is subject to crowd-control diminishing returns');
                $_flagGroup('Extra Flags', $buff);
            }

            if ($flagGroups)
                $infobox[] = 'Flags'.Lang::main('colon').'[ul][li]'.implode('[/li][li]', $flagGroups).'[/li][/ul]';

        }

        // Version links (appended inside h1 after the fav-star, via JS for all users)
        if ($_altNPCs)
        {
            $this->extendGlobalData($_altNPCs->getJSGlobals());

            // Base entry
            $_verBase  = Lang::npc('modes', $mapType, 0) ?: 'Normal';
            $_baseName = $this->subject->getField('name', true);
            $_versions = [['id' => $this->typeId, 'label' => $_verBase, 'name' => $_baseName]];

            // Alt entries — iterate to pick up each NPC's name
            foreach ($_altNPCs->iterate() as $_vId => $__)
            {
                $_vMode  = $_altIds[$_vId];
                $_vLabel = Lang::npc('modes', $mapType, $_vMode) ?: 'Mode '.$_vMode;
                $_vName  = $_altNPCs->getField('name', true);
                $_versions[] = ['id' => $_vId, 'label' => $_vLabel, 'name' => $_vName];
            }

            $_verJson = Util::toJSON($_versions);
            $_curId   = $this->typeId;

            $this->addScript([SC_JS_STRING, "
DomContentLoaded.addEvent(function() {
    var versions = {$_verJson};
    var curId    = {$_curId};
    var isAltPage = (curId != versions[0].id);
    var wrap = document.createElement('span');
    wrap.id = 'npc-versions';
    wrap.style.cssText = 'display:block;font-size:12px;font-weight:normal;color:#aaa;white-space:nowrap;';
    for (var i = 0; i < versions.length; i++) {
        if (i > 0) {
            var dot = document.createElement('span');
            dot.style.color = '#555';
            dot.textContent = ' · ';
            wrap.appendChild(dot);
        }
        var v = versions[i];
        var ttText = v.label + ' - ' + v.name + ' (#' + v.id + ')';
        var linkText = (isAltPage && i === 0) ? v.name : v.label;
        if (v.id == curId) {
            var cur = document.createElement('span');
            cur.textContent = linkText;
            cur.style.color = '#e8d47b';
            cur.title = ttText;
            wrap.appendChild(cur);
        } else {
            var lnk = document.createElement('span');
            lnk.textContent = linkText;
            lnk.title = ttText;
            lnk.style.cssText = 'color:#aaa;cursor:pointer;';
            lnk.onclick = (function(id) { return function() { location.href = '?npc=' + id; }; })(v.id);
            wrap.appendChild(lnk);
        }
    }
    var h1 = document.querySelector('.text h1');
    if (h1) h1.appendChild(wrap);
});
"]);
        }

        // Placeholder message (appended inside h1 via JS, replaces the template <div>)
        if ($placeholder)
        {
            $_phId   = (int)$placeholder[0];
            $_phName = Util::toJSON($placeholder[1]);

            $this->addScript([SC_JS_STRING, "
DomContentLoaded.addEvent(function() {
    var phName = {$_phName};
    var wrap = document.createElement('span');
    wrap.style.cssText = 'display:block;font-size:12px;font-weight:normal;color:#aaa;white-space:nowrap;';
    wrap.innerHTML = 'This NPC is a placeholder for a different mode of <a href=\"?npc={$_phId}\" style=\"color:#a6c3e5\">' + phName + '<\\/a>.';
    var h1 = document.querySelector('.text h1');
    if (h1) h1.appendChild(wrap);
});
"]);
        }

        // > Stats
        $stats   = [];
        $modes   = [];                                      // get difficulty versions if set
        $hint    = '[tooltip name=%3$s][table cellspacing=10][tr]%1s[/tr][/table][/tooltip][span class=tip tooltip=%3$s]%2s[/span]';
        $modeRow = '[tr][td]%s&nbsp;&nbsp;[/td][td]%s[/td][/tr]';
        // Health
        $health = $this->subject->getBaseStats('health');
        $stats['health'] = Util::ucFirst(Lang::spell('powerTypes', -2)).Lang::main('colon').($health[0] < $health[1] ? Lang::nf($health[0]).' - '.Lang::nf($health[1]) : Lang::nf($health[0]));
        $maxHealthVal = max($health[0], $health[1]);

        // Mana (may be 0)
        $mana = $this->subject->getBaseStats('power');
        $stats['mana'] = $mana[0] ? Lang::spell('powerTypes', 0).Lang::main('colon').($mana[0] < $mana[1] ? Lang::nf($mana[0]).' - '.Lang::nf($mana[1]) : Lang::nf($mana[0])) : null;
        $maxManaVal = $mana[0] ? max($mana[0], $mana[1]) : 0;

        // Armor
        $armor = $this->subject->getBaseStats('armor');
        $stats['armor'] = Lang::npc('armor').Lang::main('colon').($armor[0] < $armor[1] ? Lang::nf($armor[0]).' - '.Lang::nf($armor[1]) : Lang::nf($armor[0]));

        // Resistances
        $resNames = [null, 'hol', 'fir', 'nat', 'fro', 'sha', 'arc'];
        $tmpRes   = [];
        $stats['resistance'] = '';
        foreach ($this->subject->getBaseStats('resistance') as $sc => $amt)
            if ($amt)
                $tmpRes[] = '[span class="moneyschool'.$resNames[$sc].'"]'.$amt.'[/span]';

        if ($tmpRes)
        {
            $stats['resistance'] = Lang::npc('resistances').Lang::main('colon');
            if (count($tmpRes) > 3)
                $stats['resistance'] .= implode('&nbsp;', array_slice($tmpRes, 0, 3)).'[br]'.implode('&nbsp;', array_slice($tmpRes, 3));
            else
                $stats['resistance'] .= implode('&nbsp;', $tmpRes);
        }

        // Melee Damage
        $melee = $this->subject->getBaseStats('melee');
        if ($_ = $this->subject->getField('dmgSchool'))     // magic damage
            $stats['melee'] = Lang::npc('melee').Lang::main('colon').Lang::nf($melee[0]).' - '.Lang::nf($melee[1]).' ('.Lang::game('sc', $_).')';
        else                                                // phys. damage
            $stats['melee'] = Lang::npc('melee').Lang::main('colon').Lang::nf($melee[0]).' - '.Lang::nf($melee[1]);

        // Ranged Damage
        $ranged = $this->subject->getBaseStats('ranged');
        $stats['ranged'] = Lang::npc('ranged').Lang::main('colon').Lang::nf($ranged[0]).' - '.Lang::nf($ranged[1]);

        if (in_array($mapType, [1, 2]))                     // Dungeon or Raid
        {
            foreach ($_altIds as $id => $mode)
            {
                foreach ($_altNPCs->iterate() as $dId => $__)
                {
                    if ($dId != $id)
                        continue;

                    $m = Lang::npc('modes', $mapType, $mode);

                    // Health
                    $health = $_altNPCs->getBaseStats('health');
                    $_hMax = max($health[0], $health[1]);
                    if ($_hMax > $maxHealthVal) $maxHealthVal = $_hMax;
                    $modes['health'][] = sprintf($modeRow, $m, $health[0] < $health[1] ? Lang::nf($health[0]).' - '.Lang::nf($health[1]) : Lang::nf($health[0]));

                    // Mana (may be 0)
                    $mana = $_altNPCs->getBaseStats('power');
                    if ($mana[0]) {
                        $_mMax = max($mana[0], $mana[1]);
                        if ($_mMax > $maxManaVal) $maxManaVal = $_mMax;
                    }
                    $modes['mana'][] = $mana[0] ? sprintf($modeRow, $m, $mana[0] < $mana[1] ? Lang::nf($mana[0]).' - '.Lang::nf($mana[1]) : Lang::nf($mana[0])) : null;

                    // Armor
                    $armor = $_altNPCs->getBaseStats('armor');
                    $modes['armor'][] = sprintf($modeRow, $m, $armor[0] < $armor[1] ? Lang::nf($armor[0]).' - '.Lang::nf($armor[1]) : Lang::nf($armor[0]));

                    // Resistances
                    $tmpRes = '';
                    foreach ($_altNPCs->getBaseStats('resistance') as $sc => $amt)
                        $tmpRes .= '[td]'.$amt.'[/td]';

                    if ($tmpRes)
                    {
                        if (!isset($modes['resistance']))   // init table head
                            $modes['resistance'][] = '[td][/td][td][span class="moneyschoolhol"]&nbsp;&nbsp;&nbsp;&nbsp;[/span][/td][td][span class="moneyschoolfir"]&nbsp;&nbsp;&nbsp;&nbsp;[/span][/td][td][span class="moneyschoolnat"]&nbsp;&nbsp;&nbsp;&nbsp;[/span][/td][td][span class="moneyschoolfro"]&nbsp;&nbsp;&nbsp;&nbsp;[/span][/td][td][span class="moneyschoolsha"]&nbsp;&nbsp;&nbsp;&nbsp;[/span][/td][td][span class="moneyschoolarc"][/span][/td]';

                        if (!$stats['resistance'])          // base creature has no resistance. -> display list item.
                            $stats['resistance'] = Lang::npc('resistances').Lang::main('colon').'…';

                        $modes['resistance'][] = '[td]'.$m.'&nbsp;&nbsp;&nbsp;&nbsp;[/td]'.$tmpRes;
                    }

                    // Melee Damage
                    $melee = $_altNPCs->getBaseStats('melee');
                    if ($_ = $_altNPCs->getField('dmgSchool'))  // magic damage
                        $modes['melee'][] = sprintf($modeRow, $m, Lang::nf($melee[0]).' - '.Lang::nf($melee[1]).' ('.Lang::game('sc', $_).')');
                    else                                        // phys. damage
                        $modes['melee'][] = sprintf($modeRow, $m, Lang::nf($melee[0]).' - '.Lang::nf($melee[1]));

                    // Ranged Damage
                    $ranged = $_altNPCs->getBaseStats('ranged');
                    $modes['ranged'][] = sprintf($modeRow, $m, Lang::nf($ranged[0]).' - '.Lang::nf($ranged[1]));
                }
            }
        }

        if ($modes)
        {
            // Show highest value across all difficulties as the main label
            if (!empty($modes['health']))
                $stats['health'] = Util::ucFirst(Lang::spell('powerTypes', -2)).Lang::main('colon').Lang::nf($maxHealthVal);
            if (!empty($modes['mana']) && $maxManaVal > 0)
                $stats['mana'] = Lang::spell('powerTypes', 0).Lang::main('colon').Lang::nf($maxManaVal);

            foreach ($stats as $k => $v)
                if ($v && !empty($modes[$k]))
                    $stats[$k] = sprintf($hint, implode('[/tr][tr]', $modes[$k]), $v, $k);
        }

        // < Stats
        if ($stats)
            $infobox[] = Lang::npc('stats').($modes ? ' ('.Lang::npc('modes', $mapType, 0).')' : null).Lang::main('colon').'[ul][li]'.implode('[/li][li]', $stats).'[/li][/ul]';


        /****************/
        /* Main Content */
        /****************/

        // get spawns and path
        $map = null;
        if ($spawns = $this->subject->getSpawns(SPAWNINFO_FULL))
        {
            $map = ['data' => ['parent' => 'mapper-generic'], 'mapperData' => &$spawns];
            foreach ($spawns as $areaId => &$areaData)
                $map['extra'][$areaId] = ZoneList::getName($areaId);
        }

        // smart AI
        $sai = null;
        if ($this->subject->getField('aiName') == 'SmartAI')
        {
            $sai = new SmartAI(SmartAI::SRC_TYPE_CREATURE, $this->typeId);
            if (!$sai->prepare())                           // no smartAI found .. check per guid
            {
                // at least one of many
                $guids = DB::World()->selectCol('SELECT `guid` FROM creature WHERE `id1` = ?d', $this->typeId);
                while ($_ = array_pop($guids))
                {
                    $sai = new SmartAI(SmartAI::SRC_TYPE_CREATURE, -$_, ['baseEntry' => $this->typeId, 'title' => ' [small](for GUID: '.$_.')[/small]']);
                    if ($sai->prepare())
                        break;
                }
            }

            if ($sai->prepare())
                $this->extendGlobalData($sai->getJSGlobals());
            else
                trigger_error('Creature has SmartAI set in template but no SmartAI defined.');
        }

        // consider pooled spawns
        $this->map          = $map;
        $this->infobox      = '[ul][li]'.implode('[/li][li]', $infobox).'[/li][/ul]';
        $this->placeholder  = $placeholder;
        $this->accessory    = $accessory;
        $this->quotes       = $this->getQuotes();
        $this->reputation   = $this->getOnKillRep($_altIds, $mapType);
        $this->smartAI      = $sai ? $sai->getMarkdown() : null;

        // Gossip Menu — try creature_template first, then fall back to SmartAI scripts
        $_gmId = (int)DB::World()->selectCell('SELECT `gossip_menu_id` FROM creature_template WHERE `entry` = ?d', $this->typeId);

        if (!$_gmId)
            $_gmId = (int)DB::World()->selectCell(
                'SELECT `action_param1` FROM smart_scripts
                  WHERE `source_type` = 0 AND `entryorguid` = ?d AND `action_type` IN (98, 240)
                  ORDER BY `action_type` ASC LIMIT 1',
                $this->typeId
            );

        if ($_gmId)
        {
            $_optTypes = [
                0  => 'None',          1  => 'Gossip',          2  => 'Quest Giver',
                3  => 'Vendor',        4  => 'Flight Master',   5  => 'Trainer',
                6  => 'Spirit Healer', 7  => 'Spirit Guide',    8  => 'Innkeeper',
                9  => 'Banker',        10 => 'Petitioner',      11 => 'Tabard Designer',
                12 => 'Battlemaster',  13 => 'Auctioneer',      14 => 'Stable Master',
                15 => 'Armorer',       16 => 'Unlearn Talents', 17 => 'Unlearn Pet Skills',
                18 => 'Dual Spec',     19 => 'Outdoor PvP',
            ];

            // Markup.js text pipeline: _rawText → str.replace(/\\\[/g,'[') → _safeHtml(&<>") → \n→<br>
            // So: escape [ as \[ (prevents Markup tag parsing), leave " & < > for _safeHtml to handle.
            // WoW text tokens replaced with [span tooltip=X] using pre-defined [tooltip name=X] entries.
            $_tokSpans = [
                '$N' => '[span tooltip=tok-N][b]$N[/b][/span]',
                '$n' => '[span tooltip=tok-n][b]$n[/b][/span]',
                '$R' => '[span tooltip=tok-R][b]$R[/b][/span]',
                '$r' => '[span tooltip=tok-r][b]$r[/b][/span]',
                '$C' => '[span tooltip=tok-C][b]$C[/b][/span]',
                '$c' => '[span tooltip=tok-c][b]$c[/b][/span]',
            ];

            $_formatText = function(string $s) use ($_tokSpans) : string {
                // Escape [ so Markup parser doesn't treat user text as tags
                $s = str_replace('[', '\\[', $s);
                // $B/$b = paragraph break (_preText converts \n to <br/>)
                $s = str_replace(['$B', '$b'], "\n", $s);
                // $G male:female; — show both gender forms inline
                $s = preg_replace('/\$[Gg]([^:]+):([^;]+);/', '[b]$1[/b][small](or "$2")[/small]', $s);
                // Named character tokens → hoverable spans
                foreach ($_tokSpans as $tok => $repl)
                    if (str_contains($s, $tok))
                        $s = str_replace($tok, $repl, $s);
                return $s;
            };

            // BFS: collect all menus reachable via option ActionMenuIDs
            $visited = [];
            $queue   = [$_gmId];
            $menus   = [];

            while ($queue && count($visited) < 64)
            {
                $menuId = array_shift($queue);
                if (isset($visited[$menuId])) continue;
                $visited[$menuId] = true;

                $textRows = DB::World()->select(
                    'SELECT gm.`TextID`, nt.`text0_0`, nt.`text0_1`
                     FROM gossip_menu gm
                     LEFT JOIN npc_text nt ON nt.`ID` = gm.`TextID`
                     WHERE gm.`MenuID` = ?d ORDER BY gm.`TextID`',
                    $menuId
                );
                $opts = DB::World()->select(
                    'SELECT `OptionID`, `OptionIcon`, `OptionText`, `OptionType`, `ActionMenuID`, `BoxText`, `BoxMoney`
                     FROM gossip_menu_option WHERE `MenuID` = ?d ORDER BY `OptionID`',
                    $menuId
                );

                $menus[$menuId] = [
                    'textRows' => $textRows ?: [],
                    'opts'     => $opts     ?: [],
                ];

                foreach ($opts ?: [] as $opt)
                    if ($opt['ActionMenuID'] && !isset($visited[$opt['ActionMenuID']]))
                        $queue[] = (int)$opt['ActionMenuID'];
            }

            // No sort needed — options tree renders in BFS/traversal order from the root menu

            // Map OptionIcon byte → GossipFrame PNG filename (wowdev.wiki/SMSG_GOSSIP_MESSAGE)
            $_staticUrl  = Cfg::get('STATIC_URL');
            $_iconBase   = $_staticUrl . '/images/wow/Interface/GossipFrame/';
            $_gossipIcons = [
                0  => 'GossipGossipIcon',
                1  => 'VendorGossipIcon',
                2  => 'TaxiGossipIcon',
                3  => 'TrainerGossipIcon',
                4  => 'HealerGossipIcon',
                5  => 'BinderGossipIcon',
                6  => 'BankerGossipIcon',
                7  => 'PetitionGossipIcon',
                8  => 'TabardGossipIcon',
                9  => 'BattleMasterGossipIcon',
                10 => 'UnlearnGossipIcon',
            ];
            $_gossipIconMarkup = function(int $iconId) use ($_iconBase, $_gossipIcons) : string {
                $file = $_gossipIcons[$iconId] ?? 'GossipGossipIcon';
                return '[img src=' . $_iconBase . $file . '.png width=16 height=16 border=0]';
            };

            // Load conditions for all gossip menus via AoWoW's Conditions class
            $cndObj = new Conditions();
            foreach (array_keys($menus) as $mid)
                $cndObj->getBySourceGroup($mid, Conditions::SRC_GOSSIP_MENU, Conditions::SRC_GOSSIP_MENU_OPTION);
            $cndObj->prepare();
            $this->extendGlobalData($cndObj->getJsGlobals());
            $gossipCndResult = $cndObj->getResult();

            // Build quick lookup: $cndHas[srcType][menuId][entryId] = true
            $cndHas = [];
            foreach ($gossipCndResult as $srcType => $groups)
                foreach ($groups as $grpKey => $_)
                {
                    [$grp, $entry] = explode(':', $grpKey);
                    $cndHas[$srcType][(int)$grp][(int)$entry] = true;
                }

            $this->gossipCndResult = $gossipCndResult;

            // Pre-define tooltips for WoW character tokens (invisible; referenced by [span tooltip=X])
            $tokenDefs =
                '[tooltip name=tok-N label="Uses the player\'s name"][b]$N[/b][/tooltip]' .
                '[tooltip name=tok-n label="Uses the player\'s name"][b]$n[/b][/tooltip]' .
                '[tooltip name=tok-R label="Uses the character\'s race"][b]$R[/b][/tooltip]' .
                '[tooltip name=tok-r label="Uses the character\'s race"][b]$r[/b][/tooltip]' .
                '[tooltip name=tok-C label="Uses the character\'s class"][b]$C[/b][/tooltip]' .
                '[tooltip name=tok-c label="Uses the character\'s class"][b]$c[/b][/tooltip]';

            // Tab 1 — Greeting: only the starting menu's text entries
            $menuTab  = '[tr][td header]Text ID[/td][td header]Text[/td][td header]Conditions[/td][/tr]';
            $rootRows = $menus[$_gmId]['textRows'] ?? [];
            if ($rootRows)
            {
                foreach ($rootRows as $row)
                {
                    $greeting = trim($row['text0_0'] ?? '') ?: trim($row['text0_1'] ?? '');
                    $hasCnd   = !empty($cndHas[Conditions::SRC_GOSSIP_MENU][$_gmId][$row['TextID']]);
                    $cndCell  = $hasCnd
                        ? '[span id=cnd-14-' . $_gmId . '-' . $row['TextID'] . '][/span]'
                        : '-';
                    $menuTab .= '[tr][td]' . $row['TextID'] . '[/td][td]' .
                        ($greeting ? '[i]"' . $_formatText($greeting) . '"[/i]' : '-') .
                        '[/td][td]' . $cndCell . '[/td][/tr]';
                }
            }
            else
            {
                $menuTab .= '[tr][td colspan=3][i]No greeting text defined.[/i][/td][/tr]';
            }

            // Tab 2 — Options: recursive tree rooted at the starting menu
            // Each option shows its text; if it opens a sub-menu we show that menu's
            // response text inline, and if that sub-menu has further options we show
            // those recursively under a sub-section header.
            $optsTab     = '[tr][td header]#[/td][td header]Option Text[/td][td header]Type[/td][td header]Opens Menu[/td][td header]Conditions[/td][/tr]';
            $_treeVisit  = [];

            $_renderTree = function(int $menuId) use (
                &$_renderTree, &$_treeVisit,
                $menus, $_formatText, $_optTypes, $_gossipIconMarkup, $cndHas
            ) : string
            {
                if (isset($_treeVisit[$menuId]) || !isset($menus[$menuId])) return '';
                $_treeVisit[$menuId] = true;

                $out  = '';
                $opts = $menus[$menuId]['opts'];
                if (!$opts) return '';

                foreach ($opts as $opt)
                {
                    $subId   = (int)$opt['ActionMenuID'];
                    $icon    = $_gossipIconMarkup((int)$opt['OptionIcon']);
                    $text    = $icon . ' ' . $_formatText($opt['OptionText'] ?: '');
                    $type    = $_optTypes[$opt['OptionType']] ?? 'Type ' . $opt['OptionType'];
                    $hasCnd  = !empty($cndHas[Conditions::SRC_GOSSIP_MENU_OPTION][$menuId][$opt['OptionID']]);
                    $cndCell = $hasCnd
                        ? '[span id=cnd-15-' . $menuId . '-' . $opt['OptionID'] . '][/span]'
                        : '-';
                    $notes   = [];
                    if ($opt['BoxText'])  $notes[] = 'confirms: ' . $_formatText($opt['BoxText']);
                    if ($opt['BoxMoney']) $notes[] = 'costs: [money=' . $opt['BoxMoney'] . ']';
                    if ($notes) $text .= ' [small](' . implode(', ', $notes) . ')[/small]';

                    $out .= '[tr][td]' . $opt['OptionID'] . '[/td][td]' . $text .
                        '[/td][td]' . $type . '[/td][td]' .
                        ($subId ? '[b]' . $subId . '[/b]' : '-') .
                        '[/td][td]' . $cndCell . '[/td][/tr]';

                    // Inline: show response text(s) from the sub-menu
                    if ($subId && isset($menus[$subId]) && !isset($_treeVisit[$subId]))
                    {
                        foreach ($menus[$subId]['textRows'] as $row)
                        {
                            $resp = trim($row['text0_0'] ?? '') ?: trim($row['text0_1'] ?? '');
                            if (!$resp) continue;
                            $hasCndT  = !empty($cndHas[Conditions::SRC_GOSSIP_MENU][$subId][$row['TextID']]);
                            $cndResp  = $hasCndT
                                ? ' [span id=cnd-14-' . $subId . '-' . $row['TextID'] . '][/span]'
                                : '';
                            $out .= '[tr][td][/td][td colspan=4][i]"' .
                                $_formatText($resp) . '"[/i]' . $cndResp . '[/td][/tr]';
                        }

                        // If the sub-menu itself has options, recurse under a sub-header
                        if ($menus[$subId]['opts'])
                        {
                            $out .= '[tr][td header colspan=5]Menu ' . $subId . '[/td][/tr]';
                            $out .= $_renderTree($subId);
                        }
                    }
                }
                return $out;
            };

            $optsTab .= $_renderTree($_gmId);
            if ($optsTab === '[tr][td header]#[/td][td header]Option Text[/td][td header]Type[/td][td header]Opens Menu[/td][td header]Conditions[/td][/tr]')
                $optsTab .= '[tr][td colspan=5][i]No options defined.[/i][/td][/tr]';

            $tabs = '[tab name=Gossip_Menu][table class=grid width=940px]' . $menuTab . '[/table][/tab]' .
                    '[tab name=Gossip_Options][table class=grid width=940px]' . $optsTab . '[/table][/tab]';

            $this->gossipMenu = $tokenDefs .
                '[style]#text-gossip .grid { clear:left; } #text-gossip .tabbed-contents { padding:0px; clear:left; }[/style][pad]' .
                '[h3][toggler id=gm]Gossip[/toggler][/h3]' .
                '[div id=gm clear=left][tabs name=npc-gossip width=942px]' . $tabs . '[/tabs][/div]';
        }
        $this->redButtons   = array(
            BUTTON_WOWHEAD => true,
            BUTTON_LINKS   => ['type' => $this->type, 'typeId' => $this->typeId],
            BUTTON_VIEW3D  => ['type' => Type::NPC, 'typeId' => $this->typeId, 'displayId' => $this->subject->getRandomModelId()]
        );

        if ($this->subject->getField('humanoid'))
            $this->redButtons[BUTTON_VIEW3D]['humanoid'] = 1;


        /**************/
        /* Extra Tabs */
        /**************/

        // tab: abilities / tab_controlledabilities (dep: VehicleId)
        $tplSpells  = [];
        $genSpells  = [];
        $conditions = ['OR'];

        for ($i = 1; $i < 9; $i++)
            if ($_ = $this->subject->getField('spell'.$i))
                $tplSpells[] = $_;

        if ($tplSpells)
            $conditions[] = ['id', $tplSpells];

        if ($smartSpells = SmartAI::getSpellCastsForOwner($this->typeId, SmartAI::SRC_TYPE_CREATURE))
            $genSpells = $smartSpells;

        if ($auras = DB::World()->selectCell('SELECT auras FROM creature_template_addon WHERE entry = ?d', $this->typeId))
        {
            $auras = preg_replace('/[^\d ]/', ' ', $auras);  // remove erronous chars from string
            $genSpells = array_merge($genSpells, array_filter(explode(' ', $auras)));
        }

        if ($genSpells)
            $conditions[] = ['id', $genSpells];

        // Pet-Abilities
        if ($_typeFlags & 0x1 && ($_ = $this->subject->getField('family')))
        {
            $skill = 0;
            $mask  = 0x0;
            foreach (Game::$skillLineMask[-1] as $idx => $pair)
            {
                if ($pair[0] != $_)
                    continue;

                $skill = $pair[1];
                $mask  = 1 << $idx;
                break;
            }
            $conditions[] = [
                'AND',
                ['s.typeCat', -3],
                [
                    'OR',
                    ['skillLine1', $skill],
                    ['AND', ['skillLine1', 0, '>'], ['skillLine2OrMask', $skill]],
                    ['AND', ['skillLine1', -1], ['skillLine2OrMask', $mask, '&']]
                ]
            ];
        }

        if (count($conditions) > 1)
        {
            $abilities = new SpellList($conditions);
            if (!$abilities->error)
            {
                $this->extendGlobalData($abilities->getJSGlobals(GLOBALINFO_SELF | GLOBALINFO_RELATED));
                $controled = $abilities->getListviewData();
                $normal    = [];

                foreach ($controled as $id => $values)
                {
                    if (in_array($id, $genSpells))
                    {
                        $normal[$id] = $values;
                        if (!in_array($id, $tplSpells))
                            unset($controled[$id]);
                    }
                }

                $cnd = new Conditions();
                $cnd->getBySourceGroup($this->typeId, Conditions::SRC_VEHICLE_SPELL)->prepare();
                if ($cnd->toListviewColumn($controled, $extraCols, $this->typeId, 'id'))
                    $this->extendGlobalData($cnd->getJsGlobals());

                if ($normal)
                    $this->lvTabs[] = [SpellList::$brickFile, array(
                        'data' => array_values($normal),
                        'name' => '$LANG.tab_abilities',
                        'id'   => 'abilities'
                    )];

                if ($controled)
                {
                    $lvTab = array(
                        'data' => array_values($controled),
                        'name' => '$LANG.tab_controlledabilities',
                        'id'   => 'controlled-abilities'
                    );
                    if ($extraCols)
                        $lvTab['extraCols'] = $extraCols;

                    $this->lvTabs[] = [SpellList::$brickFile, $lvTab];
                }
            }
        }

        // tab: summoned by [spell]
        $conditions = array(
            'OR',
            ['AND', ['effect1Id', [SPELL_EFFECT_SUMMON, SPELL_EFFECT_SUMMON_PET, SPELL_EFFECT_SUMMON_DEMON]], ['effect1MiscValue', $this->typeId]],
            ['AND', ['effect2Id', [SPELL_EFFECT_SUMMON, SPELL_EFFECT_SUMMON_PET, SPELL_EFFECT_SUMMON_DEMON]], ['effect2MiscValue', $this->typeId]],
            ['AND', ['effect3Id', [SPELL_EFFECT_SUMMON, SPELL_EFFECT_SUMMON_PET, SPELL_EFFECT_SUMMON_DEMON]], ['effect3MiscValue', $this->typeId]]
        );

        $sbSpell = new SpellList($conditions);
        if (!$sbSpell->error)
        {
            $this->extendGlobalData($sbSpell->getJSGlobals());

            $this->lvTabs[] = [SpellList::$brickFile, array(
                'data' => array_values($sbSpell->getListviewData()),
                'name' => '$LANG.tab_summonedby',
                'id'   => 'summoned-by-spell'
            )];
        }

        // tab: summoned by [NPC]
        $sb = SmartAI::getOwnerOfNPCSummon($this->typeId);
        if (!empty($sb[Type::NPC]))
        {
            $sbNPC = new CreatureList(array(['id', $sb[Type::NPC]]));
            if (!$sbNPC->error)
            {
                $this->extendGlobalData($sbNPC->getJSGlobals());

                $this->lvTabs[] = [CreatureList::$brickFile, array(
                    'data' => array_values($sbNPC->getListviewData()),
                    'name' => '$LANG.tab_summonedby',
                    'id'   => 'summoned-by-npc'
                )];
            }
        }

        // tab: summoned by [Object]
        if (!empty($sb[Type::OBJECT]))
        {
            $sbGO = new GameObjectList(array(['id', $sb[Type::OBJECT]]));
            if (!$sbGO->error)
            {
                $this->extendGlobalData($sbGO->getJSGlobals());

                $this->lvTabs[] = [GameObjectList::$brickFile, array(
                    'data' => array_values($sbGO->getListviewData()),
                    'name' => '$LANG.tab_summonedby',
                    'id'   => 'summoned-by-object'
                )];
            }
        }

        // tab: teaches
        if ($this->subject->getField('npcflag') & NPC_FLAG_TRAINER)
        {
            $teachQuery = '
                SELECT  ts.SpellId AS ARRAY_KEY, ts.MoneyCost AS cost, ts.ReqSkillLine AS reqSkillId, ts.ReqSkillRank AS reqSkillValue, ts.ReqLevel AS reqLevel, ts.ReqAbility1 AS reqSpellId1, ts.reqAbility2 AS reqSpellId2
                FROM    trainer_spell ts
                JOIN    creature_default_trainer cdt ON cdt.TrainerId = ts.TrainerId
                WHERE   cdt.Creatureid = ?d
            ';

            if ($tSpells = DB::World()->select($teachQuery, $this->typeId))
            {
                $teaches = new SpellList(array(['id', array_keys($tSpells)]));
                if (!$teaches->error)
                {
                    $this->extendGlobalData($teaches->getJSGlobals(GLOBALINFO_SELF | GLOBALINFO_RELATED));
                    $data = $teaches->getListviewData();

                    $extraCols = [];
                    $cnd = new Conditions();
                    foreach ($tSpells as $sId => $train)
                    {
                        if (empty($data[$sId]))
                            continue;

                        if ($_ = $train['reqSkillId'])
                            if (count($data[$sId]['skill']) == 1 && $_ != $data[$sId]['skill'][0])
                                $cnd->addExternalCondition(Conditions::SRC_NONE, $sId, [Conditions::SKILL, $_, $train['reqSkillValue']]);

                        for ($i = 1; $i < 3; $i++)
                            if ($_ = $train['reqSpellId'.$i])
                                $cnd->addExternalCondition(Conditions::SRC_NONE, $sId, [Conditions::SPELL, $_]);

                        if ($_ = $train['reqLevel'])
                        {
                            if (!isset($extraCols[1]))
                                $extraCols[1] = "\$Listview.funcBox.createSimpleCol('reqLevel', LANG.tooltip_reqlevel, '7%', 'reqLevel')";

                            $data[$sId]['reqLevel'] = $_;
                        }

                        if ($_ = $train['cost'])
                            $data[$sId]['trainingcost'] = $_;
                    }

                    if ($cnd->toListviewColumn($data, $extraCols))
                        $this->extendGlobalData($cnd->getJsGlobals());

                    $tabData = array(
                        'data'        => array_values($data),
                        'name'        => '$LANG.tab_teaches',
                        'id'          => 'teaches',
                        'visibleCols' => ['trainingcost']
                    );

                    if ($extraCols)
                        $tabData['extraCols'] = array_values($extraCols);

                    $this->lvTabs[] = [SpellList::$brickFile, $tabData];
                }
            }
            else
                trigger_error('NPC '.$this->typeId.' is flagged as trainer, but doesn\'t have any spells set', E_USER_WARNING);
        }

        // tab: sells
        if ($sells = DB::World()->selectCol('SELECT item FROM npc_vendor nv WHERE entry = ?d UNION SELECT item FROM game_event_npc_vendor genv JOIN creature c ON genv.guid = c.guid WHERE c.id1 = ?d', $this->typeId, $this->typeId))
        {
            $soldItems = new ItemList(array(['id', $sells]));
            if (!$soldItems->error)
            {
                $colAddIn  = null;
                $extraCols = ["\$Listview.funcBox.createSimpleCol('stack', 'stack', '10%', 'stack')", '$Listview.extraCols.cost'];

                $lvData = $soldItems->getListviewData(ITEMINFO_VENDOR, [Type::NPC => [$this->typeId]]);

                if (array_column($lvData, 'condition'))
                    $extraCols[] = '$Listview.extraCols.condition';

                if (array_filter(array_column($lvData, 'restock')))
                {
                    $extraCols[] = '$_';
                    $colAddIn = 'vendorRestockCol';
                }

                $cnd = new Conditions();
                if ($cnd->getBySourceGroup($this->typeId, Conditions::SRC_NPC_VENDOR)->prepare())
                {
                    $this->extendGlobalData($cnd->getJsGlobals());
                    $cnd->toListviewColumn($lvData, $extraCols, $this->typeId, 'id');
                }

                $this->lvTabs[] = [ItemList::$brickFile, array(
                    'data'      => array_values($lvData),
                    'name'      => '$LANG.tab_sells',
                    'id'        => 'currency-for',
                    'extraCols' => array_unique($extraCols)
                ), $colAddIn];

                $this->extendGlobalData($soldItems->getJSGlobals(GLOBALINFO_SELF | GLOBALINFO_RELATED));
            }
        }

        // tabs: this creature contains..
        $skinTab = ['tab_skinning', 'skinning', SKILL_SKINNING];
        if ($_typeFlags & NPC_TYPEFLAG_HERBLOOT)
            $skinTab = ['tab_herbalism', 'herbalism', SKILL_HERBALISM];
        else if ($_typeFlags & NPC_TYPEFLAG_MININGLOOT)
            $skinTab = ['tab_mining', 'mining', SKILL_MINING];
        else if ($_typeFlags & NPC_TYPEFLAG_ENGINEERLOOT)
            $skinTab = ['tab_engineering', 'engineering', SKILL_ENGINEERING];

    /*
            extraCols: [Listview.extraCols.count, Listview.extraCols.percent, Listview.extraCols.mode],
            _totalCount: 22531,
            computeDataFunc: Listview.funcBox.initLootTable,
            onAfterCreate: Listview.funcBox.addModeIndicator,

            modes:{"mode":1,"1":{"count":4408,"outof":16013},"4":{"count":4408,"outof":22531}}
    */

        $sourceFor = array(
            0 => [LOOT_CREATURE,   $this->subject->getField('lootId'),           '$LANG.tab_drops',         'drops',         [                          ], ''],
            8 => [LOOT_PICKPOCKET, $this->subject->getField('pickpocketLootId'), '$LANG.tab_pickpocketing', 'pickpocketing', ['side', 'slot', 'reqlevel'], ''],
            9 => [LOOT_SKINNING,   $this->subject->getField('skinLootId'),       '$LANG.'.$skinTab[0],      $skinTab[1],     ['side', 'slot', 'reqlevel'], '']
        );

        // temp: manually add loot for difficulty-versions
        $langref = array(
            "-2" => '$LANG.tab_heroic',
            "-1" => '$LANG.tab_normal',
               1 => '$$WH.sprintf(LANG.tab_normalX, 10)',
               2 => '$$WH.sprintf(LANG.tab_normalX, 25)',
               3 => '$$WH.sprintf(LANG.tab_heroicX, 10)',
               4 => '$$WH.sprintf(LANG.tab_heroicX, 25)'
        );

        if ($_altIds)
        {
            $sourceFor[0][2] = $mapType == 1 ? $langref[-1] : $langref[1];
            foreach ($_altNPCs->iterate() as $id => $__)
            {
                $mode = ($_altIds[$id] + 1) * ($mapType == 1 ? -1 : 1);
                foreach (DB::Aowow()->select('SELECT o.`id`, o.`lootId`, o.`name_loc0`, o.`name_loc2`, o.`name_loc3`, o.`name_loc4`, o.`name_loc6`, o.`name_loc8`, l.`difficulty` FROM ?_loot_link l JOIN ?_objects o ON o.`id` = l.`objectId` WHERE l.`npcId` = ?d', $id) as $l)
                    $sourceFor[(($l['difficulty'] - 1) * 2) + 1] = [LOOT_GAMEOBJECT, $l['lootId'], $langref[$l['difficulty'] * ($mapType == 1 ? -1 : 1)], 'drops-object-'.$l['difficulty'], [], '$$WH.sprintf(LANG.lvnote_npcobjectsource, '.$l['id'].', "'.Util::localizedString($l, 'name').'")'];
                if ($lootId = $_altNPCs->getField('lootId'))
                    $sourceFor[($mode - 1) * 2] =                  [LOOT_CREATURE,   $lootId,      $langref[$mode],                                       'drops-'.abs($mode),              [], ''];
            }
        }

        foreach (DB::Aowow()->select('SELECT l.`difficulty` AS ARRAY_KEY, o.`id`, o.`lootId`, o.`name_loc0`, o.`name_loc2`, o.`name_loc3`, o.`name_loc4`, o.`name_loc6`, o.`name_loc8` FROM ?_loot_link l JOIN ?_objects o ON o.`id` = l.`objectId` WHERE l.`npcId` = ?d', $this->typeId) as $difficulty => $lgo)
            $sourceFor[(($difficulty - 1) * 2) + 1] = [LOOT_GAMEOBJECT, $lgo['lootId'], $mapType ? $langref[$difficulty * ($mapType == 1 ? -1 : 1)] : '$LANG.tab_drops', 'drops-object-'.$difficulty, [], '$$WH.sprintf(LANG.lvnote_npcobjectsource, '.$lgo['id'].', "'.Util::localizedString($lgo, 'name').'")'];

        ksort($sourceFor);

        foreach ($sourceFor as [$lootTpl, $lootId, $tabName, $tabId, $hiddenCols, $note])
        {
            $creatureLoot = new Loot();
            if ($creatureLoot->getByContainer($lootTpl, $lootId))
            {
                $extraCols   = $creatureLoot->extraCols;
                $extraCols[] = '$Listview.extraCols.percent';

                $this->extendGlobalData($creatureLoot->jsGlobals);

                $tabData = array(
                    'data'      => array_values($creatureLoot->getResult()),
                    'name'      => $tabName,
                    'id'        => $tabId,
                    'extraCols' => array_values(array_unique($extraCols)),
                    'sort'      => ['-percent', 'name']
                );

                if ($note)
                    $tabData['note'] = $note;
                else if ($lootTpl == LOOT_SKINNING)
                    $tabData['note'] = '<b>'.Lang::formatSkillBreakpoints(Game::getBreakpointsForSkill($skinTab[2], $this->subject->getField('maxLevel') * 5), Lang::FMT_HTML).'</b>';

                if ($hiddenCols)
                    $tabData['hiddenCols'] = $hiddenCols;

                $this->lvTabs[] = [ItemList::$brickFile, $tabData];
            }
        }

        // tab: starts quest
        // tab: ends quest
        $startEnd = new QuestList(array(['qse.type', Type::NPC], ['qse.typeId', $this->typeId]));
        if (!$startEnd->error)
        {
            $this->extendGlobalData($startEnd->getJSGlobals());
            $lvData = $startEnd->getListviewData();
            $_ = [[], []];

            foreach ($startEnd->iterate() as $id => $__)
            {
                $m = $startEnd->getField('method');
                if ($m & 0x1)
                    $_[0][] = $lvData[$id];
                if ($m & 0x2)
                    $_[1][] = $lvData[$id];
            }

            if ($_[0])
                $this->lvTabs[] = [QuestList::$brickFile, array(
                    'data' => array_values($_[0]),
                    'name' => '$LANG.tab_starts',
                    'id'   => 'starts'
                )];

            if ($_[1])
                $this->lvTabs[] = [QuestList::$brickFile, array(
                    'data' => array_values($_[1]),
                    'name' => '$LANG.tab_ends',
                    'id'   => 'ends'
                )];
        }

        // tab: objective of quest
        $conditions = array(
            'OR',
            ['AND', ['reqNpcOrGo1', $this->typeId], ['reqNpcOrGoCount1', 0, '>']],
            ['AND', ['reqNpcOrGo2', $this->typeId], ['reqNpcOrGoCount2', 0, '>']],
            ['AND', ['reqNpcOrGo3', $this->typeId], ['reqNpcOrGoCount3', 0, '>']],
            ['AND', ['reqNpcOrGo4', $this->typeId], ['reqNpcOrGoCount4', 0, '>']],
        );

        $objectiveOf = new QuestList($conditions);
        if (!$objectiveOf->error)
        {
            $this->extendGlobalData($objectiveOf->getJSGlobals());

            $this->lvTabs[] = [QuestList::$brickFile, array(
                'data' => array_values($objectiveOf->getListviewData()),
                'name' => '$LANG.tab_objectiveof',
                'id'   => 'objective-of'
            )];
        }

        // tab: criteria of [ACHIEVEMENT_CRITERIA_TYPE_KILL_CREATURE_TYPE have no data set to check for]
        $conditions = array(
            ['ac.type', [ACHIEVEMENT_CRITERIA_TYPE_KILL_CREATURE, ACHIEVEMENT_CRITERIA_TYPE_KILLED_BY_CREATURE]],
            ['ac.value1', $this->typeId]
        );

        $crtOf = new AchievementList($conditions);
        if (!$crtOf->error)
        {
            $this->extendGlobalData($crtOf->getJSGlobals());

            $this->lvTabs[] = [AchievementList::$brickFile, array(
                'data' => array_values($crtOf->getListviewData()),
                'name' => '$LANG.tab_criteriaof',
                'id'   => 'criteria-of'
            )];
        }

        // tab: passengers
        if ($_ = DB::World()->selectCol('SELECT `accessory_entry` AS ARRAY_KEY, GROUP_CONCAT(`seat_id`) FROM vehicle_template_accessory WHERE `entry` = ?d GROUP BY `accessory_entry`', $this->typeId))
        {
            $passengers = new CreatureList(array(['id', array_keys($_)]));
            if (!$passengers->error)
            {
                $data = $passengers->getListviewData();

                if (User::isInGroup(U_GROUP_STAFF))
                    foreach ($data as $id => &$d)
                        $d['seat'] = str_replace(',', ', ', $_[$id]);

                $this->extendGlobalData($passengers->getJSGlobals(GLOBALINFO_SELF));

                $tabData = array(
                    'data' => array_values($data),
                    'name' => Lang::npc('accessory'),
                    'id'   => 'accessory'
                );

                if (User::isInGroup(U_GROUP_STAFF))
                    $tabData['extraCols'] = ["\$Listview.funcBox.createSimpleCol('seat', '".Lang::npc('seat')."', '10%', 'seat')"];

                $this->lvTabs[] = [CreatureList::$brickFile, $tabData];
            }
        }

        /* tab sounds:
            * activity sounds => CreatureDisplayInfo.dbc => (CreatureModelData.dbc => ) CreatureSoundData.dbc
            * AI => smart_scripts
            * Dialogue VO => creature_text
            * onClick VO => CreatureDisplayInfo.dbc => NPCSounds.dbc
        */
        $this->soundIds = array_merge($this->soundIds, SmartAI::getSoundsPlayedForOwner($this->typeId, SmartAI::SRC_TYPE_CREATURE));

        // up to 4 possible displayIds .. for the love of things betwixt, just use the first!
        $activitySounds = DB::Aowow()->selectRow('SELECT * FROM ?_creature_sounds WHERE `id` = ?d', $this->subject->getField('displayId1'));
        array_shift($activitySounds);                       // remove id-column
        $this->soundIds = array_merge($this->soundIds, array_values($activitySounds));

        if ($this->soundIds)
        {
            $sounds = new SoundList(array(['id', $this->soundIds]));
            if (!$sounds->error)
            {
                $data = $sounds->getListviewData();
                foreach ($activitySounds as $activity => $id)
                    if (isset($data[$id]))
                        $data[$id]['activity'] = $activity; // no index, js wants a string :(

                $tabData = ['data' => array_values($data)];
                if ($activitySounds)
                    $tabData['visibleCols'] = ['activity'];

                $this->extendGlobalData($sounds->getJSGlobals(GLOBALINFO_SELF));
                $this->lvTabs[] = [SoundList::$brickFile, $tabData];
            }
        }

        // tab: conditions
        $cnd = new Conditions();
        $cnd->getBySourceEntry($this->typeId, Conditions::SRC_CREATURE_TEMPLATE_VEHICLE)
            ->getBySourceGroup($this->typeId, Conditions::SRC_SPELL_CLICK_EVENT)
            ->getByCondition(Type::NPC, $this->typeId)
            ->prepare();
        if ($tab = $cnd->toListviewTab())
        {
            $this->extendGlobalData($cnd->getJsGlobals());
            $this->lvTabs[] = $tab;
        }
    }

    protected function generateTooltip()
    {
        $power = new StdClass();
        if (!$this->subject->error)
        {
            $power->{'name_'.Lang::getLocale()->json()}    = $this->subject->getField('name', true);
            $power->{'tooltip_'.Lang::getLocale()->json()} = $this->subject->renderTooltip();
            $power->map                                    = $this->subject->getSpawns(SPAWNINFO_SHORT);
        }

        return sprintf($this->powerTpl, $this->typeId, Lang::getLocale()->value, Util::toJSON($power, JSON_AOWOW_POWER));
    }

    private function getRepForId(array $entries, array &$spillover) : array
    {
        $rows  = DB::World()->select(
           'SELECT `creature_id` AS "npc", `RewOnKillRepFaction1` AS "faction", `RewOnKillRepValue1` AS "qty", `MaxStanding1` AS "maxRank", `isTeamAward1` AS "spillover"
            FROM   creature_onkill_reputation WHERE `creature_id` IN (?a) AND `RewOnKillRepFaction1` > 0 UNION
            SELECT `creature_id` AS "npc", `RewOnKillRepFaction2` AS "faction", `RewOnKillRepValue2` AS "qty", `MaxStanding2` AS "maxRank", `isTeamAward2` AS "spillover"
            FROM   creature_onkill_reputation WHERE `creature_id` IN (?a) AND `RewOnKillRepFaction2` > 0',
            $entries, $entries
        );

        $factions = new FactionList(array(['id', array_column($rows, 'faction')]));
        $result   = [];

        foreach ($rows as $row)
        {
            if (!$factions->getEntry($row['faction']))
                continue;

            $set = array(
                'id'   => $row['faction'],
                'qty'  => [$row['qty'], 0],
                'name' => $factions->getField('name', true),
                'npc'  => $row['npc'],
                'cap'  => $row['maxRank'] && $row['maxRank'] < REP_EXALTED ? Lang::game('rep', $row['maxRank']) : null
            );

            $cuRate = DB::World()->selectCell('SELECT `creature_rate` FROM reputation_reward_rate WHERE `creature_rate` <> 1 AND `faction` = ?d', $row['faction']);
            if ($cuRate !== null)
                $set['qty'][1] = $set['qty'][0] * ($cuRate - 1);

            if ($row['spillover'])
            {
                $spillover[$factions->getField('cat')] = array(
                    [ $set['qty'][0] / 2, $set['qty'][1] / 2 ],
                    $row['maxRank']
                );
                $set['spillover'] = $factions->getField('cat');
            }

            $result[] = $set;
        }

        return $result;
    }

    private function getOnKillRep(array $dummyIds, int $mapType) : array
    {
        $spilledParents = [];
        $reputation     = [];

        // base NPC
        if ($base = $this->getRepForId([$this->typeId], $spilledParents))
            $reputation[] = [Lang::npc('modes', 1, 0), $base];

        // difficulty dummys
        if ($dummyIds && ($mapType == 1 || $mapType == 2))
        {
            $alt = [];
            $rep = $this->getRepForId(array_keys($dummyIds), $spilledParents);

            // order by difficulty
            foreach ($rep as $r)
                $alt[$dummyIds[$r['npc']]][] = $r;

            // apply by difficulty
            foreach ($alt as $mode => $dat)
                $reputation[] = [Lang::npc('modes', $mapType, $mode), $dat];
        }

        // get spillover factions and apply
        if ($spilledParents)
        {
            $spilled = new FactionList(array(['parentFactionId', array_keys($spilledParents)]));

            foreach ($reputation as &$sets)
            {
                foreach ($sets[1] as &$row)
                {
                    if (empty($row['spillover']))
                        continue;

                    foreach ($spilled->iterate() as $spId => $__)
                    {
                        // find parent
                        if ($spilled->getField('parentFactionId') != $row['spillover'])
                            continue;

                        // don't readd parent
                        if ($row['id'] == $spId)
                            continue;

                        $spMax = $spilledParents[$row['spillover']][1];

                        $sets[1][] = array(
                            'id'   => $spId,
                            'qty'  => $spilledParents[$row['spillover']][0],
                            'name' => $spilled->getField('name', true),
                            'cap'  => $spMax && $spMax < REP_EXALTED ? Lang::game('rep', $spMax) : null
                        );
                    }
                }
            }
        }

        return $reputation;
    }

    private function getQuotes() : array
    {
        [$quotes, $nQuotes, $soundIds] = Game::getQuotesForCreature($this->typeId, true, $this->subject->getField('name', true));

        if ($soundIds)
            $this->soundIds = array_merge($this->soundIds, $soundIds);

        return [$quotes, $nQuotes];
    }
}


?>
