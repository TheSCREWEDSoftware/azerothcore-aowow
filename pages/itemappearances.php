<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');


// menuId 22: Item Appearances g_initPath()
//  tabId 0: Database g_initHeader()
// every distinct look an item can have, per slot: ?item-appearances=<slot>
class ItemappearancesPage extends GenericPage
{
    public const GROUPS = array(                            // url name => inventory types
        'head'     => [1],
        'shoulder' => [3],
        'back'     => [16],
        'chest'    => [5, 20],
        'shirt'    => [4],
        'tabard'   => [19],
        'wrist'    => [9],
        'hands'    => [10],
        'waist'    => [6],
        'legs'     => [7],
        'feet'     => [8],
        'mainhand' => [13, 17, 21],
        'offhand'  => [14, 22, 23],
        'ranged'   => [15, 25, 26]
    );

    protected $tpl       = 'list-page-generic';
    protected $tabId     = 0;
    protected $path      = [0, 22];
    protected $mode      = CACHE_TYPE_NONE;
    protected $scripts   = [[SC_CSS_FILE, 'css/dressingroom.css']];

    protected $extraHTML = '';
    private   $group     = 'head';

    public function __construct($pageCall, $pageParam)
    {
        parent::__construct($pageCall, $pageParam);

        if (isset(self::GROUPS[$pageParam]))
            $this->group = $pageParam;

        $this->name = Lang::outfit('itemAppearances');
    }

    protected function generateContent()
    {
        $nav = '<div class="outfit-nav">';
        foreach (self::GROUPS as $g => $_)
            $nav .= '<a href="?item-appearances='.$g.'"'.($g == $this->group ? ' class="selected"' : '').'>'.Lang::outfit('slots', $g).'</a>';
        $nav .= '</div>';

        // one row per display id, shown with its best item
        $rows = DB::Aowow()->select(
           'SELECT   i.`displayId`, COUNT(*) AS "n", SUBSTRING_INDEX(GROUP_CONCAT(i.`id` ORDER BY i.`quality` DESC, i.`itemLevel` DESC, i.`id`), ",", 1) AS "rep"
            FROM     ?_items i
            WHERE    i.`slot` IN (?a) AND i.`displayId` > 0 AND (i.`cuFlags` & ?d) = 0
            GROUP BY i.`displayId`',
            self::GROUPS[$this->group], CUSTOM_EXCLUDE_FOR_LISTVIEW
        );

        $data = [];
        if ($rows)
        {
            $reps  = array_map(fn($r) => (int)$r['rep'], $rows);
            $loc   = Lang::getLocale()->value;
            $items = DB::Aowow()->select('SELECT `id` AS ARRAY_KEY, IF(`name_loc'.$loc.'` <> "", `name_loc'.$loc.'`, `name_loc0`) AS "name", `quality`, `slot` FROM ?_items WHERE `id` IN (?a)', $reps);

            foreach ($rows as $r)
            {
                if (!($it = $items[$r['rep']] ?? null))
                    continue;

                $data[] = array(
                    'id'        => (int)$r['rep'],
                    'name'      => (7 - $it['quality']).$it['name'].($r['n'] > 1 ? ' (+'.($r['n'] - 1).')' : ''),
                    'displayid' => (int)$r['displayId'],
                    'slot'      => (int)$it['slot']
                );
            }
            usort($data, fn($a, $b) => strcmp(substr($a['name'], 1), substr($b['name'], 1)));

            $this->extendGlobalIds(Type::ITEM, ...array_column($data, 'id'));
        }

        $tools = '';
        if (User::isInGroup(U_GROUP_STAFF))
            $tools = '<div class="outfit-staff"><a class="button-red" href="javascript:;" onclick="AoThumbs.generateList(\'appearances\', this)"><em><b><i>'.Lang::outfit('makeThumbs').'</i></b><span>'.Lang::outfit('makeThumbs').'</span></em></a></div>';

        $this->extraHTML = $nav.'<p class="q0">'.Lang::outfit('appearancesInfo', [count($data)]).'</p>'.$tools;

        $this->lvTabs[] = ['genericmodel', array(
            'data'            => $data,
            'id'              => 'appearances',
            'name'            => '$LANG.tab_items',
            'genericlinktype' => 'item',
            'nItemsPerRow'    => 5
        )];
    }

    protected function generateTitle()
    {
        array_unshift($this->title, Lang::outfit('slots', $this->group), $this->name);
    }

    protected function generatePath()
    {
        $this->path[] = $this->group;
    }
}

?>
