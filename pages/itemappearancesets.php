<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');


// menuId 21: Item Appearance Sets g_initPath()
//  tabId 0: Database g_initHeader()
// item sets grouped by how they look (recoloured / reissued sets share one card): ?item-appearance-sets=<1 cloth .. 4 plate, 0 other>
class ItemappearancesetsPage extends GenericPage
{
    protected $tpl       = 'list-page-generic';
    protected $tabId     = 0;
    protected $path      = [0, 21];
    protected $mode      = CACHE_TYPE_NONE;
    protected $scripts   = [[SC_CSS_FILE, 'css/dressingroom.css']];

    protected $extraHTML = '';
    private   $material  = 4;

    public function __construct($pageCall, $pageParam)
    {
        parent::__construct($pageCall, $pageParam);

        if ($pageParam !== '' && in_array((int)$pageParam, [0, 1, 2, 3, 4]))
            $this->material = (int)$pageParam;

        $this->name = Lang::outfit('appearanceSets');
    }

    protected function generateContent()
    {
        $nav = '<div class="outfit-nav">';
        foreach ([4, 3, 2, 1, 0] as $m)
            $nav .= '<a href="?item-appearance-sets='.$m.'"'.($m == $this->material ? ' class="selected"' : '').'>'.Lang::outfit('materials', $m).'</a>';
        $nav .= '</div>';

        // sets with exactly the same pieces' looks become one card
        $looks = [];
        foreach (Outfit::itemSets() as $set)
        {
            if (count($set['pieces']) < 2 || Outfit::material($set) != $this->material)
                continue;
            $looks[Outfit::lookKey($set)][] = $set;
        }

        $html = '';
        foreach ($looks as $sets)
        {
            $first = array_shift($sets);
            $html .= Outfit::setCard($first, $sets, Outfit::raceFor($first['classMask']));
        }

        $this->extraHTML = $nav.'<p class="q0">'.Lang::outfit('looksInfo', [count($looks)]).'</p>'.
            ($html ? '<div class="set-grid">'.$html.'</div>' : '<div class="outfit-empty">'.Lang::outfit('none').'</div>');
    }

    protected function generateTitle()
    {
        array_unshift($this->title, Lang::outfit('materials', $this->material), $this->name);
    }

    protected function generatePath() { }
}

?>
