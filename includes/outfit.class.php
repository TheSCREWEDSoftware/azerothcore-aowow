<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');

// outfits (dressing room saves): lookups and the card grid used by the outfit pages and the item page tab
class Outfit
{
    public const CLASSES = [6, 11, 3, 8, 2, 5, 4, 7, 9, 1];          // menu order
    public const RACES   = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11];

    // one item per group: robes and chests share the chest, two-handers and one-handers the main hand, ..
    public static function slotGroup(int $invType) : string
    {
        switch ($invType)
        {
            case 1:  return 'head';
            case 2:  return 'neck';
            case 11: return 'finger1';
            case 12: return 'trinket1';
            case 24: return 'ammo';
            case 3:  return 'shoulder';
            case 4:  return 'shirt';
            case 5:
            case 20: return 'chest';
            case 6:  return 'waist';
            case 7:  return 'legs';
            case 8:  return 'feet';
            case 9:  return 'wrist';
            case 10: return 'hands';
            case 16: return 'back';
            case 19: return 'tabard';
            case 13:
            case 17:
            case 21: return 'mainhand';
            case 14:
            case 22:
            case 23: return 'offhand';
            default: return 'ranged';
        }
    }

    // owner, admins and moderators
    public static function canEdit(array $o) : bool
    {
        return User::$id && ($o['userId'] == User::$id || User::isInGroup(U_GROUP_ADMIN | U_GROUP_MOD));
    }

    // posted from this site (no cross-site form posts)
    public static function sameOrigin() : bool
    {
        $src = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
        $own = parse_url(Cfg::get('HOST_URL'));
        $got = parse_url($src);
        return $src && !empty($got['host']) && strcasecmp($got['host'], $own['host'] ?? '') == 0 && ($got['port'] ?? null) == ($own['port'] ?? null);
    }

    // item rows -> one per paper doll slot, in the given order: a second one-hander goes to the off hand,
    // a two-hander keeps the off hand empty
    public static function pickSlots(array $rows, array $order) : array
    {
        $pos = array_flip($order);
        usort($rows, fn($a, $b) => ($pos[$a['id']] ?? 99) <=> ($pos[$b['id']] ?? 99));

        $taken = [];
        foreach ($rows as $it)
        {
            $g = self::slotGroup($it['slot']);
            if (($g == 'finger1' || $g == 'trinket1') && isset($taken[$g]))      // second ring / trinket
                $g = substr($g, 0, -1).'2';
            if ($g == 'mainhand' && $it['slot'] == 13 && isset($taken['mainhand']) && !isset($taken['offhand']))
                $g = 'offhand';
            if ($g == 'offhand' && isset($taken['mainhand']) && $taken['mainhand']['slot'] == 17)
                continue;
            if ($g == 'mainhand' && $it['slot'] == 17 && isset($taken['offhand']))
                continue;
            if (!isset($taken[$g]))
                $taken[$g] = $it;
        }
        return $taken;
    }

    public static function get(int $id) : array
    {
        $row = DB::Aowow()->selectRow('SELECT o.*, a.`displayName` AS "author" FROM ?_outfits o LEFT JOIN ?_account a ON a.`id` = o.`userId` WHERE o.`id` = ?d', $id);
        return $row ?: [];
    }

    // newest first; $classId 0 = all classes
    public static function getList(int $classId = 0, int $limit = 200) : array
    {
        return DB::Aowow()->select(
           'SELECT o.*, a.`displayName` AS "author"
            FROM   ?_outfits o
            LEFT   JOIN ?_account a ON a.`id` = o.`userId`
            WHERE  o.`public` = 1 { AND o.`classId` = ?d }
            ORDER  BY o.`updated` DESC
            LIMIT  ?d',
            $classId ?: DBSIMPLE_SKIP, $limit
        );
    }

    public static function byUser(int $userId) : array
    {
        return DB::Aowow()->select('SELECT o.*, a.`displayName` AS "author" FROM ?_outfits o LEFT JOIN ?_account a ON a.`id` = o.`userId` WHERE o.`userId` = ?d ORDER BY o.`updated` DESC', $userId);
    }

    public static function withItem(int $itemId, int $limit = 60) : array
    {
        return DB::Aowow()->select(
           'SELECT o.*, a.`displayName` AS "author"
            FROM   ?_outfits_items oi
            JOIN   ?_outfits o ON o.`id` = oi.`outfitId`
            LEFT   JOIN ?_account a ON a.`id` = o.`userId`
            WHERE  oi.`itemId` = ?d AND o.`public` = 1
            ORDER  BY o.`updated` DESC
            LIMIT  ?d',
            $itemId, $limit
        );
    }

    // outfits sharing at least two items with this one, most shared first
    public static function similar(int $id, int $limit = 12) : array
    {
        return DB::Aowow()->select(
           'SELECT o.*, a.`displayName` AS "author", COUNT(*) AS "shared"
            FROM   ?_outfits_items mine
            JOIN   ?_outfits_items oi ON oi.`itemId` = mine.`itemId` AND oi.`outfitId` <> mine.`outfitId`
            JOIN   ?_outfits o ON o.`id` = oi.`outfitId`
            LEFT   JOIN ?_account a ON a.`id` = o.`userId`
            WHERE  mine.`outfitId` = ?d AND o.`public` = 1
            GROUP  BY o.`id`
            HAVING COUNT(*) >= 2
            ORDER  BY COUNT(*) DESC, o.`updated` DESC
            LIMIT  ?d',
            $id, $limit
        );
    }

    // absolute link: these cards also show on item pages, whose address is item=123/name
    public static function url(string $query) : string
    {
        return rtrim(Cfg::get('HOST_URL'), '/').'/?'.$query;
    }

    public static function image(int $id) : string
    {
        return file_exists(AjaxOutfit::IMG_DIR.$id.'.png') ? Cfg::get('STATIC_URL').'/uploads/outfits/'.$id.'.png?'.filemtime(AjaxOutfit::IMG_DIR.$id.'.png') : '';
    }

    public static function classIcon(int $classId) : string
    {
        $names = [1 => 'warrior', 'paladin', 'hunter', 'rogue', 'priest', 'deathknight', 'shaman', 'mage', 'warlock', 11 => 'druid'];
        return isset($names[$classId]) ? 'class_'.$names[$classId] : 'inv_misc_questionmark';
    }

    // ------------------------------------------------------------ item sets as looks (gear sets, appearance sets)

    // item sets with their wearable pieces; $classId limits to sets for that class
    public static function itemSets(int $classId = 0) : array
    {
        $loc  = Lang::getLocale()->value;
        $sets = DB::Aowow()->select(
           'SELECT `id` AS ARRAY_KEY, `id`, IF(`name_loc'.$loc.'` <> "", `name_loc'.$loc.'`, `name_loc0`) AS "name", `quality`, `classMask`, `minLevel`, `maxLevel`,
                   `item1`, `item2`, `item3`, `item4`, `item5`, `item6`, `item7`, `item8`, `item9`, `item10`
            FROM   ?_itemset
            WHERE  (`cuFlags` & ?d) = 0 { AND (`classMask` & ?d) }
            ORDER  BY `maxLevel` DESC, `quality` DESC, `id` DESC',
            CUSTOM_EXCLUDE_FOR_LISTVIEW, $classId ? 1 << ($classId - 1) : DBSIMPLE_SKIP
        );
        if (!$sets)
            return [];

        $ids = [];
        foreach ($sets as $s)
            for ($i = 1; $i <= 10; $i++)
                if ($s['item'.$i])
                    $ids[] = (int)$s['item'.$i];

        $items = DB::Aowow()->select(
           'SELECT i.`id` AS ARRAY_KEY, i.`id`, IF(i.`name_loc'.$loc.'` <> "", i.`name_loc'.$loc.'`, i.`name_loc0`) AS "name", i.`quality`, i.`displayId`, i.`slot`, i.`class`, i.`subClass`, ic.`name` AS "icon"
            FROM   ?_items i
            LEFT   JOIN ?_icons ic ON ic.`id` = i.`iconId`
            WHERE  i.`id` IN (?a)',
            array_unique($ids)
        );

        $out = [];
        foreach ($sets as $s)
        {
            $pieces = [];
            for ($i = 1; $i <= 10; $i++)
                if (($it = $items[$s['item'.$i]] ?? null) && $it['displayId'] && in_array((int)$it['slot'], AjaxDressingroom::VISIBLE_SLOTS))
                    $pieces[] = array(
                        'id'        => (int)$it['id'],
                        'name'      => $it['name'],
                        'quality'   => (int)$it['quality'],
                        'icon'      => strtolower($it['icon'] ?: 'inv_misc_questionmark'),
                        'displayId' => (int)$it['displayId'],
                        'slot'      => (int)$it['slot'],
                        'class'     => (int)$it['class'],
                        'subClass'  => (int)$it['subClass']
                    );
            if (!$pieces)
                continue;

            $out[] = array(
                'id'        => (int)$s['id'],
                'name'      => $s['name'],
                'quality'   => (int)$s['quality'],
                'classMask' => (int)$s['classMask'],
                'level'     => (int)$s['maxLevel'],
                'pieces'    => $pieces
            );
        }
        return $out;
    }

    // who models a set: a race every class of the set can be
    public static function raceFor(int $classMask) : int
    {
        if ($classMask && !($classMask & ~(1 << 6)))         // shaman only
            return 11;
        if ($classMask && !($classMask & ~(1 << 10)))        // druid only
            return 4;
        return 1;
    }

    // what the pieces look like, independent of which items they are
    public static function lookKey(array $set) : string
    {
        $k = [];
        foreach ($set['pieces'] as $p)
            $k[self::slotGroup($p['slot'])] = $p['displayId'];
        ksort($k);
        return implode(',', array_map(fn($g, $d) => $g.':'.$d, array_keys($k), $k));
    }

    // armour material of a set: 1 cloth .. 4 plate, 0 anything else
    public static function material(array $set) : int
    {
        $count = [];
        foreach ($set['pieces'] as $p)
            if ($p['class'] == ITEM_CLASS_ARMOR && $p['subClass'] >= 1 && $p['subClass'] <= 4)
                $count[$p['subClass']] = ($count[$p['subClass']] ?? 0) + 1;
        arsort($count);
        return (int)(array_key_first($count) ?? 0);
    }

    public static function equipList(array $set) : array
    {
        return array_map(fn($p) => [$p['slot'], $p['displayId']], $set['pieces']);
    }

    // one card per set (or per look: $more = other sets with the same look)
    public static function setCard(array $set, array $more = [], int $race = 1, int $gender = 0) : string
    {
        $static = Cfg::get('STATIC_URL');
        $view3d = Util::htmlEscape(Util::toJSON(['type' => 4, 'typeId' => $set['id'], 'equipList' => self::equipList($set)]));

        $h  = '<div class="set-card">';
        $h .= '<a class="set-pic" href="javascript:;" onclick="ModelViewer.show(JSON.parse(this.dataset.mv))" data-mv="'.$view3d.'" title="'.Lang::main('view3D').'">';
        $h .= '<img loading="lazy" src="'.$static.'/modelviewer/thumbs/itemset/'.$set['id'].'.png" data-race="'.$race.'" data-sex="'.$gender.'" alt=""></a>';
        $h .= '<div class="set-body"><a class="q'.$set['quality'].' set-name" href="'.self::url('itemset='.$set['id']).'">'.Util::htmlEscape($set['name']).'</a>';

        $cls = [];
        foreach (self::CLASSES as $c)
            if ($set['classMask'] & (1 << ($c - 1)))
                $cls[] = '<a class="c'.$c.'" href="'.self::url('gear-sets='.$c).'">'.Lang::game('cl', $c).'</a>';
        $h .= '<small>'.($set['level'] ? Lang::game('level').' '.$set['level'] : '').($cls ? ($set['level'] ? ' &middot; ' : '').implode(', ', $cls) : '').'</small>';

        $h .= '<div class="set-pieces">';
        foreach ($set['pieces'] as $p)
            $h .= '<a href="'.self::url('item='.$p['id']).'" class="q'.$p['quality'].'"><ins style="background-image:url('.$static.'/images/wow/icons/small/'.$p['icon'].'.jpg)"></ins></a>';
        $h .= '</div>';

        if ($more)
        {
            $h .= '<div class="set-more">'.Lang::outfit('sameLook').' ';
            $l  = [];
            foreach ($more as $m)
                $l[] = '<a class="q'.$m['quality'].'" href="'.self::url('itemset='.$m['id']).'">'.Util::htmlEscape($m['name']).'</a>';
            $h .= implode(', ', $l).'</div>';
        }

        $h .= '<div class="set-links"><a href="javascript:;" onclick="ModelViewer.show(JSON.parse(this.parentNode.parentNode.parentNode.firstChild.dataset.mv))">'.Lang::main('view3D').'</a>';
        $h .= '<a href="'.self::url('dressing-room').'#'.$race.'-'.$gender.':s'.$set['id'].'">'.Lang::outfit('dressingRoom').'</a></div>';
        return $h.'</div></div>';
    }

    // card grid
    public static function cards(array $rows, string $empty = '') : string
    {
        if (!$rows)
            return '<div class="outfit-empty">'.($empty ?: Lang::outfit('none')).'</div>';

        $h = '<div class="outfit-grid">';
        foreach ($rows as $o)
        {
            $id   = (int)$o['id'];
            $img  = self::image($id);
            $cls  = (int)$o['classId'];
            $sub  = [];
            if ($cls)
                $sub[] = '<span class="c'.$cls.'">'.Lang::game('cl', $cls).'</span>';
            $sub[] = Lang::game('ra', (int)$o['race']).' '.Lang::main('sex', (int)$o['gender'] + 1);

            $h .= '<a class="outfit-card" href="'.self::url('outfit='.$id).'">';
            $h .= $img ? '<span class="outfit-pic" style="background-image:url('.$img.')"></span>'
                       : '<span class="outfit-pic outfit-nopic"><ins style="background-image:url('.Cfg::get('STATIC_URL').'/images/wow/icons/large/'.self::classIcon($cls).'.jpg)"></ins></span>';
            $h .= '<b>'.Util::htmlEscape($o['name']).'</b>';
            $h .= '<small>'.implode(' &middot; ', $sub).'</small>';
            $h .= '<small class="q0">'.Lang::outfit('by', [Util::htmlEscape($o['author'] ?: '?')]).(isset($o['shared']) ? ' &middot; '.Lang::outfit('shared', [(int)$o['shared']]) : '').'</small>';
            $h .= '</a>';
        }
        return $h.'</div>';
    }
}

?>
