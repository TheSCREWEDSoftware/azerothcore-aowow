<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');


// menuId 20: Gear Sets g_initPath()
//  tabId 0: Database g_initHeader()
// the armour sets of a class, shown worn: ?gear-sets=<classId>
class GearsetsPage extends GenericPage
{
    protected $tpl       = 'list-page-generic';
    protected $tabId     = 0;
    protected $path      = [0, 20];
    protected $mode      = CACHE_TYPE_NONE;
    protected $scripts   = [[SC_CSS_FILE, 'css/dressingroom.css']];

    protected $extraHTML = '';
    private   $classId   = 0;

    public function __construct($pageCall, $pageParam)
    {
        parent::__construct($pageCall, $pageParam);

        if (in_array((int)$pageParam, Outfit::CLASSES))
            $this->classId = (int)$pageParam;

        $this->name = $this->classId ? Lang::outfit('classGearSets', [Lang::game('cl', $this->classId)]) : Lang::outfit('gearSets');
    }

    protected function generateContent()
    {
        $static = Cfg::get('STATIC_URL');

        $nav = '<div class="outfit-nav">';
        foreach (Outfit::CLASSES as $c)
            $nav .= '<a href="?gear-sets='.$c.'" class="c'.$c.($this->classId == $c ? ' selected' : '').'"><ins style="background-image:url('.$static.'/images/wow/icons/tiny/'.Outfit::classIcon($c).'.gif)"></ins>'.Lang::game('cl', $c).'</a>';
        $nav .= '</div>';

        if (!$this->classId)
        {
            $this->extraHTML = $nav.'<p>'.Lang::outfit('pickClass').'</p>';
            return;
        }

        $race = Outfit::raceFor(1 << ($this->classId - 1));
        $html = '';
        foreach (Outfit::itemSets($this->classId) as $set)
            if (count($set['pieces']) >= 2)
                $html .= Outfit::setCard($set, [], $race);

        $this->extraHTML = $nav.($html ? '<div class="set-grid">'.$html.'</div>' : '<div class="outfit-empty">'.Lang::outfit('none').'</div>');
    }

    protected function generateTitle()
    {
        array_unshift($this->title, $this->name);
    }

    protected function generatePath()
    {
        if ($this->classId)
            $this->path[] = $this->classId;
    }
}

?>
