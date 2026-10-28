<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');


// tabId 1: Tools g_initHeader()
// pick a class, spec, slot and level: the best items by the spec's stat weights (opens the item list with those filters)
class ItemfinderPage extends GenericPage
{
    protected $tpl      = 'tool';
    protected $tabId    = 1;
    protected $path     = [1, 10];
    protected $mode     = CACHE_TYPE_NONE;
    protected $scripts  = array(
        [SC_JS_FILE,  '?data=weight-presets'],
        [SC_JS_FILE,  'js/filters.js'],
        [SC_JS_FILE,  'js/itemfinder.js'],
        [SC_CSS_FILE, 'css/tools.css']
    );

    protected $toolId   = 'itemfinder';
    protected $toolInit = 'AoItemFinder.init';
    protected $config   = [];

    public function __construct($pageCall, $pageParam)
    {
        parent::__construct($pageCall, $pageParam);

        $this->name   = Lang::main('itemFinder');
        $this->config = ['maxLevel' => MAX_LEVEL];
    }

    protected function generateContent() { }

    protected function generateTitle()
    {
        array_unshift($this->title, $this->name);
    }

    protected function generatePath() { }
}

?>
