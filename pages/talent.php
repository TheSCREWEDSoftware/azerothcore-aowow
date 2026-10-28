<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');


// tabId 1: Tools g_initHeader()
class TalentPage extends GenericPage
{
    protected $tpl           = 'talent';
    protected $tabId         = 1;
    protected $path          = [1];
    protected $mode          = CACHE_TYPE_NONE;
    protected $gDataKey      = true;
    protected $scripts       = array(
        [SC_JS_FILE,  'js/TalentCalc.js'],
        [SC_CSS_FILE, 'css/talentcalc.css'],
        [SC_CSS_FILE, 'css/talent.css']
    );

    protected $tcType        = 'tc';                        // tc: TalentCalculator; pc: PetCalculator
    private   $isPetCalc     = false;

    public function __construct($pageCall, $__)
    {
        parent::__construct($pageCall, $__);

        $this->isPetCalc = $pageCall == 'petcalc';
        $this->name      = $this->isPetCalc ? Lang::main('petCalc') : Lang::main('talentCalc');
    }

    protected function generateContent()
    {
        // add conditional js & css
        if ($this->isPetCalc)
        {
            $this->addScript(
                [SC_JS_FILE,  '?data=pet-talents.pets'],
                [SC_JS_FILE,  'js/petcalc.js'],
                [SC_CSS_FILE, 'css/petcalc.css']
            );

            // per family: talent tree (0 ferocity, 1 tenacity, 2 cunning), exotic (needs Beast Mastery) and its abilities
            $info   = [];
            $spells = [];
            $pets   = new PetList([Cfg::get('SQL_LIMIT_NONE')]);
            foreach ($pets->iterate() as $id => $__)
            {
                $abilities = array_values(array_filter([$pets->getField('spellId1'), $pets->getField('spellId2'), $pets->getField('spellId3'), $pets->getField('spellId4')]));
                $info[$id] = ['type' => (int)$pets->getField('type'), 'exotic' => (int)$pets->getField('exotic'), 'abilities' => $abilities];
                $spells    = array_merge($spells, $abilities);
            }

            if ($spells)
            {
                $abilities = new SpellList([['id', array_values(array_unique($spells))]]);
                $this->extendGlobalData($abilities->getJSGlobals(GLOBALINFO_SELF));
            }

            // pet talents: names and icons for the list of chosen talents
            $talents = new SpellList([['s.typeCat', -7], Cfg::get('SQL_LIMIT_NONE')]);
            $this->extendGlobalData($talents->getJSGlobals(GLOBALINFO_SELF));

            // beasts spawn in sub zones and areas g_zones does not name (starting areas ...)
            $loc   = Lang::getLocale()->value;
            $zones = DB::Aowow()->selectCol('SELECT `id` AS ARRAY_KEY, IF(`name_loc'.$loc.'` <> "", `name_loc'.$loc.'`, `name_loc0`) FROM ?_zones');

            $this->addScript([SC_JS_STRING, 'var g_pet_info = '.Util::toJSON($info).', g_pet_zones = '.Util::toJSON($zones).';']);
        }
        else
            $this->addScript(
                [SC_JS_FILE, '?data=glyphs'],
                [SC_JS_FILE, 'js/talent.js']
            );

        $this->tcType  = $this->isPetCalc ? 'pc' : 'tc';
    }

    protected function generateTitle()
    {
        array_unshift($this->title, $this->name);
    }

    protected function generatePath()
    {
        $this->path[] = $this->isPetCalc ? 2 : 0;
    }
}

?>
