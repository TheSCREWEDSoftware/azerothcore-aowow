<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');

// data for the dressing room (static/js/modelviewer/dressingroom.js)
//   ?dressing-room=search&slot=1,5,20&q=helm   wearable items for a slot, by name
//   ?dressing-room=items&ids=30987,30991        items by id (shared links, outfits)
//   ?dressing-room=set&id=627                   the pieces of an item set
class AjaxDressingroom extends AjaxHandler
{
    // inventory types that show on a character
    public const VISIBLE_SLOTS = [1, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 25, 26];

    protected $_get = array(
        'q'    => ['filter' => FILTER_CALLBACK, 'options' => 'AjaxHandler::checkTextLine'       ],
        'slot' => ['filter' => FILTER_CALLBACK, 'options' => 'AjaxHandler::checkIdListUnsigned'],
        'ids'  => ['filter' => FILTER_CALLBACK, 'options' => 'AjaxHandler::checkIdListUnsigned'],
        'id'   => ['filter' => FILTER_CALLBACK, 'options' => 'AjaxHandler::checkInt'           ]
    );

    public function __construct(array $params)
    {
        parent::__construct($params);

        if (!$this->params || count($this->params) != 1)
            return;

        switch ($this->params[0])
        {
            case 'search': $this->handler = 'search';   break;
            case 'items':  $this->handler = 'byId';     break;
            case 'set':    $this->handler = 'itemset';  break;
        }
    }

    // id, name, quality, icon, displayId, slot (inventory type), level
    public static function itemRows(array $ids) : array
    {
        $ids = array_slice(array_unique(array_filter($ids)), 0, 40);
        if (!$ids)
            return [];

        $loc  = Lang::getLocale()->value;
        $rows = DB::Aowow()->select(
           'SELECT i.`id`, IF(i.`name_loc'.$loc.'` <> "", i.`name_loc'.$loc.'`, i.`name_loc0`) AS "name", i.`quality`, i.`displayId`, i.`slot`, i.`itemLevel` AS "level", ic.`name` AS "icon"
            FROM   ?_items i
            LEFT   JOIN ?_icons ic ON ic.`id` = i.`iconId`
            WHERE  i.`id` IN (?a) AND i.`slot` IN (?a) AND i.`displayId` > 0',
            $ids, self::VISIBLE_SLOTS
        );

        return array_map([self::class, 'castRow'], $rows);
    }

    private static function castRow(array $r) : array
    {
        return array(
            'id'        => (int)$r['id'],
            'name'      => $r['name'],
            'quality'   => (int)$r['quality'],
            'icon'      => $r['icon'] ? strtolower($r['icon']) : 'inv_misc_questionmark',
            'displayId' => (int)$r['displayId'],
            'slot'      => (int)$r['slot'],
            'level'     => (int)$r['level']
        );
    }

    protected function search() : string
    {
        $slots = array_values(array_intersect($this->_get['slot'] ?: [], self::VISIBLE_SLOTS));
        $q     = trim((string)$this->_get['q']);
        if (!$slots)
            return '[]';

        $loc   = Lang::getLocale()->value;
        $like  = $q !== '' ? '%'.strtr($q, ['\\' => '\\\\', '%' => '\\%', '_' => '\\_']).'%' : DBSIMPLE_SKIP;
        $rows  = DB::Aowow()->select(
           'SELECT i.`id`, IF(i.`name_loc'.$loc.'` <> "", i.`name_loc'.$loc.'`, i.`name_loc0`) AS "name", i.`quality`, i.`displayId`, i.`slot`, i.`itemLevel` AS "level", ic.`name` AS "icon"
            FROM   ?_items i
            LEFT   JOIN ?_icons ic ON ic.`id` = i.`iconId`
            WHERE  i.`slot` IN (?a) AND i.`displayId` > 0 AND (i.`cuFlags` & ?d) = 0
            { AND (i.`name_loc0` LIKE ? OR i.`name_loc'.$loc.'` LIKE ?) }
            ORDER  BY i.`quality` DESC, i.`itemLevel` DESC, i.`id` DESC
            LIMIT  60',
            $slots, CUSTOM_EXCLUDE_FOR_LISTVIEW, $like, $like
        );

        return Util::toJSON(array_map([self::class, 'castRow'], $rows));
    }

    protected function byId() : string
    {
        return Util::toJSON(self::itemRows($this->_get['ids'] ?: []));
    }

    protected function itemset() : string
    {
        if (!$this->_get['id'])
            return '[]';

        $set = DB::Aowow()->selectRow('SELECT `item1`, `item2`, `item3`, `item4`, `item5`, `item6`, `item7`, `item8`, `item9`, `item10` FROM ?_itemset WHERE `id` = ?d', $this->_get['id']);
        return Util::toJSON($set ? self::itemRows(array_values($set)) : []);
    }
}

?>
