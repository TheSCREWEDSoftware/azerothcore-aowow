<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');


// tabId 1: Tools g_initHeader()
// put a 10 or 25 player raid together and see which buffs and debuffs it brings (the raid is kept in the #link)
class RaidcompositionPage extends GenericPage
{
    protected $tpl      = 'tool';
    protected $tabId    = 1;
    protected $path     = [1, 11];
    protected $mode     = CACHE_TYPE_NONE;
    protected $scripts  = array(
        [SC_JS_FILE,  'js/raidcomp.js'],
        [SC_CSS_FILE, 'css/tools.css']
    );

    protected $toolId   = 'raidcomp';
    protected $toolInit = 'AoRaidComp.init';
    protected $config   = [];

    public function __construct($pageCall, $pageParam)
    {
        parent::__construct($pageCall, $pageParam);

        $this->name = Lang::main('raidComp');
    }

    protected function generateContent() { }

    protected function generateTitle()
    {
        array_unshift($this->title, $this->name);
    }

    protected function generatePath() { }
}

?>
