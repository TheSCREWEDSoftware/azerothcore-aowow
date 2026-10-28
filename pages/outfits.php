<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');


// menuId 23: Outfits g_initPath()
//  tabId 0: Database g_initHeader()
//  ?outfits, ?outfits=<classId>, ?outfits=mine
class OutfitsPage extends GenericPage
{
    protected $tpl     = 'list-page-generic';
    protected $tabId   = 0;
    protected $path    = [0, 23];
    protected $mode    = CACHE_TYPE_NONE;
    protected $scripts = [[SC_CSS_FILE, 'css/dressingroom.css']];

    protected $extraHTML = '';
    private   $classId   = 0;
    private   $mine      = false;

    public function __construct($pageCall, $pageParam)
    {
        parent::__construct($pageCall, $pageParam);

        if ($pageParam == 'mine')
            $this->mine = true;
        else if (in_array((int)$pageParam, Outfit::CLASSES))
            $this->classId = (int)$pageParam;

        $this->name = $this->classId ? Lang::outfit('classOutfits', [Lang::game('cl', $this->classId)]) : ($this->mine ? Lang::outfit('myOutfits') : Lang::outfit('outfits'));
    }

    protected function generateContent()
    {
        // class filter
        $nav = '<div class="outfit-nav"><a href="?outfits"'.(!$this->classId && !$this->mine ? ' class="selected"' : '').'>'.Lang::outfit('all').'</a>';
        foreach (Outfit::CLASSES as $c)
            $nav .= '<a href="?outfits='.$c.'" class="c'.$c.($this->classId == $c ? ' selected' : '').'"><ins style="background-image:url('.Cfg::get('STATIC_URL').'/images/wow/icons/tiny/'.Outfit::classIcon($c).'.gif)"></ins>'.Lang::game('cl', $c).'</a>';
        if (User::$id)
            $nav .= '<a href="?outfits=mine"'.($this->mine ? ' class="selected"' : '').'>'.Lang::outfit('myOutfits').'</a>';
        $nav .= '<a class="outfit-new" href="?dressing-room">'.Lang::outfit('create').'</a></div>';

        $rows = $this->mine ? Outfit::byUser(User::$id) : Outfit::getList($this->classId);

        $this->extraHTML = $nav.Outfit::cards($rows, Lang::outfit('noneYet'));
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
