<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');


// tabId 1: Tools g_initHeader()
// dress up any race in any wearable item; ?dressing-room=<outfitId> edits a saved outfit
class DressingroomPage extends GenericPage
{
    protected $tpl     = 'dressing-room';
    protected $tabId   = 1;
    protected $path    = [1, 4];
    protected $mode    = CACHE_TYPE_NONE;
    protected $scripts = array(
        [SC_CSS_FILE, 'css/dressingroom.css'],
        [SC_JS_FILE,  'js/modelviewer/dressingroom.js']
    );

    protected $config  = [];

    public function __construct($pageCall, $pageParam)
    {
        parent::__construct($pageCall, $pageParam);

        $this->name = Lang::outfit('dressingRoom');

        $this->config = array(
            'signedIn' => User::$id > 0,
            'classes'  => array_map(fn($c) => [$c, Lang::game('cl', $c)], Outfit::CLASSES),
            'races'    => array_map(fn($r) => [$r, Lang::game('ra', $r)], Outfit::RACES),
            'outfit'   => null
        );

        if (is_numeric($pageParam) && ($o = Outfit::get((int)$pageParam)) && ($o['public'] || Outfit::canEdit($o)))
        {
            $this->config['outfit'] = array(
                'id'      => (int)$o['id'],
                'name'    => $o['name'],
                'desc'    => $o['description'],
                'classId' => (int)$o['classId'],
                'race'    => (int)$o['race'],
                'gender'  => (int)$o['gender'],
                'look'    => array_map('intval', explode(':', $o['look'])),
                'items'   => array_values(Outfit::pickSlots(AjaxDressingroom::itemRows($ids = array_map('intval', explode(',', $o['items']))), $ids)),
                'mine'    => Outfit::canEdit($o)
            );
        }
    }

    protected function generateContent() { }

    protected function generateTitle()
    {
        array_unshift($this->title, $this->name);
    }

    protected function generatePath() { }
}

?>
