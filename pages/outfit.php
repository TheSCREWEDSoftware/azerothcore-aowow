<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');


// menuId 23: Outfits g_initPath()
//  tabId 0: Database g_initHeader()
class OutfitPage extends GenericPage
{
    protected $tpl     = 'outfit';
    protected $tabId   = 0;
    protected $path    = [0, 23];
    protected $mode    = CACHE_TYPE_NONE;
    protected $scripts = array(
        [SC_CSS_FILE, 'css/dressingroom.css'],
        [SC_JS_FILE,  'js/modelviewer/dressingroom.js']
    );

    protected $outfit  = [];
    protected $items   = [];
    protected $similar = '';
    protected $info    = [];

    public function __construct($pageCall, $pageParam)
    {
        parent::__construct($pageCall, $pageParam);

        $this->outfit = Outfit::get((int)$pageParam);
        if (!$this->outfit || (!$this->outfit['public'] && !Outfit::canEdit($this->outfit)))
            $this->notFound(Lang::outfit('outfit'), Lang::outfit('notFound'));

        $this->name = Util::htmlEscape($this->outfit['name']);
    }

    protected function generateContent()
    {
        $o = $this->outfit;
        $ids = array_map('intval', explode(',', $o['items']));
        $this->items = array_values(Outfit::pickSlots(AjaxDressingroom::itemRows($ids), $ids));

        // keep the paper doll order
        $order = ['head', 'shoulder', 'back', 'chest', 'shirt', 'tabard', 'wrist', 'hands', 'waist', 'legs', 'feet', 'mainhand', 'offhand', 'ranged'];
        usort($this->items, fn($a, $b) => array_search(Outfit::slotGroup($a['slot']), $order) <=> array_search(Outfit::slotGroup($b['slot']), $order));

        $look = array_map('intval', explode(':', $o['look']));
        $this->info = array(
            'id'      => (int)$o['id'],
            'name'    => $o['name'],
            'classId' => (int)$o['classId'],
            'race'    => (int)$o['race'],
            'gender'  => (int)$o['gender'],
            'look'    => $look,
            'items'   => $this->items,
            'mine'    => Outfit::canEdit($o),
            'author'  => $o['author'],
            'created' => date(Lang::main('dateFmtShort'), $o['created']),
            'updated' => $o['updated'] != $o['created'] ? date(Lang::main('dateFmtShort'), $o['updated']) : ''
        );

        $this->similar = Outfit::cards(Outfit::similar((int)$o['id']), Lang::outfit('noSimilar'));

        if (!User::$id || $o['userId'] != User::$id)
            DB::Aowow()->query('UPDATE ?_outfits SET `views` = `views` + 1 WHERE `id` = ?d', $o['id']);
    }

    protected function generateTitle()
    {
        array_unshift($this->title, $this->outfit['name'] ?? '', Lang::outfit('outfits'));
    }

    protected function generatePath()
    {
        if (!empty($this->outfit['classId']))
            $this->path[] = (int)$this->outfit['classId'];
    }
}

?>
