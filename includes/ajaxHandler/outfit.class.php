<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');

// outfits made in the dressing room
//   ?outfit=save    POST id (0 = new), name, classId, race, gender, look (skin:face:hair:hairColor:facial), items (ids), shot (png data url)
//   ?outfit=delete  POST id
//   ?outfit=item    GET id (item): outfit cards for the item page tab
class AjaxOutfit extends AjaxHandler
{
    public const IMG_DIR = 'static/uploads/outfits/';

    protected $_post = array(
        'id'          => ['filter' => FILTER_CALLBACK, 'options' => 'AjaxHandler::checkInt'           ],
        'name'        => ['filter' => FILTER_CALLBACK, 'options' => 'AjaxHandler::checkTextLine'      ],
        'description' => ['filter' => FILTER_CALLBACK, 'options' => 'AjaxHandler::checkTextLine'      ],
        'classId'     => ['filter' => FILTER_CALLBACK, 'options' => 'AjaxHandler::checkInt'           ],
        'race'        => ['filter' => FILTER_CALLBACK, 'options' => 'AjaxHandler::checkInt'           ],
        'gender'      => ['filter' => FILTER_CALLBACK, 'options' => 'AjaxHandler::checkInt'           ],
        'look'        => ['filter' => FILTER_CALLBACK, 'options' => 'AjaxHandler::checkIntArray'      ],
        'items'       => ['filter' => FILTER_CALLBACK, 'options' => 'AjaxHandler::checkIdListUnsigned'],
        'shot'        => ['filter' => FILTER_UNSAFE_RAW                                               ]
    );
    protected $_get  = array(
        'id'          => ['filter' => FILTER_CALLBACK, 'options' => 'AjaxHandler::checkInt'           ]
    );

    public function __construct(array $params)
    {
        parent::__construct($params);

        if (!$this->params || count($this->params) != 1)
            return;

        if ($this->params[0] == 'save')
            $this->handler = 'save';
        else if ($this->params[0] == 'delete')
            $this->handler = 'remove';
        else if ($this->params[0] == 'item')                // ?outfit=item&id=<itemId>: the outfits tab of an item page (not page cached)
        {
            $this->handler     = 'forItem';
            $this->contentType = MIME_TYPE_TEXT;
        }
    }

    private function fail(int $code, string $msg) : string
    {
        http_response_code($code);
        return Util::toJSON(['error' => $msg]);
    }

    protected function save() : string
    {
        if (!User::$id)
            return $this->fail(403, 'not signed in');
        if (!Outfit::sameOrigin())
            return $this->fail(403, 'bad origin');

        $p     = $this->_post;
        $name  = mb_substr(trim((string)$p['name']), 0, 64);
        $desc  = mb_substr(trim((string)$p['description']), 0, 255);
        $race  = (int)$p['race'];
        $sex   = (int)$p['gender'] ? 1 : 0;
        $class = (int)$p['classId'];

        if ($name === '')
            return $this->fail(400, 'name missing');
        if (!in_array($race, [1, 2, 3, 4, 5, 6, 7, 8, 10, 11]))
            return $this->fail(400, 'bad race');
        if (!in_array($class, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11]))
            $class = 0;

        // wearable items only, one per slot
        $posted = $p['items'] ?: [];
        $items  = array_values(array_map(fn($it) => $it['id'], Outfit::pickSlots(AjaxDressingroom::itemRows($posted), $posted)));

        $look = array_slice(array_map('intval', $p['look'] ?: []), 0, 5);
        $look = implode(':', array_pad($look, 5, 0));
        $now  = time();

        if ($id = (int)$p['id'])
        {
            $o = Outfit::get($id);
            if (!$o)
                return $this->fail(404, 'no such outfit');
            if (!Outfit::canEdit($o))
                return $this->fail(403, 'not yours');

            DB::Aowow()->query('UPDATE ?_outfits SET `name` = ?, `description` = ?, `classId` = ?d, `race` = ?d, `gender` = ?d, `look` = ?, `items` = ?, `updated` = ?d WHERE `id` = ?d',
                $name, $desc, $class, $race, $sex, $look, implode(',', $items), $now, $id);
            DB::Aowow()->query('DELETE FROM ?_outfits_items WHERE `outfitId` = ?d', $id);
        }
        else
        {
            if (DB::Aowow()->selectCell('SELECT COUNT(*) FROM ?_outfits WHERE `userId` = ?d', User::$id) >= 500)
                return $this->fail(403, 'too many outfits');

            $id = DB::Aowow()->query('INSERT INTO ?_outfits (`userId`, `name`, `description`, `classId`, `race`, `gender`, `look`, `items`, `created`, `updated`) VALUES (?d, ?, ?, ?d, ?d, ?d, ?, ?, ?d, ?d)',
                User::$id, $name, $desc, $class, $race, $sex, $look, implode(',', $items), $now, $now);
            if (!$id)
                return $this->fail(500, 'could not save');
        }

        foreach ($items as $itemId)
            DB::Aowow()->query('INSERT IGNORE INTO ?_outfits_items (`outfitId`, `itemId`) VALUES (?d, ?d)', $id, $itemId);

        $this->saveShot($id, (string)$p['shot']);

        return Util::toJSON(['id' => (int)$id]);
    }

    // the picture taken in the dressing room: png only, sane size
    private function saveShot(int $id, string $dataUrl) : void
    {
        if (strpos($dataUrl, 'data:image/png;base64,') !== 0)
            return;

        $png = base64_decode(substr($dataUrl, 22), true);
        if (!$png || strlen($png) > 2 * 1024 * 1024 || substr($png, 0, 8) != "\x89PNG\r\n\x1a\n")
            return;

        $info = @getimagesizefromstring($png);
        if (!$info || $info[0] < 32 || $info[1] < 32 || $info[0] > 1024 || $info[1] > 1024)
            return;

        if (Util::writeDir(self::IMG_DIR))
            file_put_contents(self::IMG_DIR.$id.'.png', $png);
    }

    protected function forItem() : string
    {
        return Outfit::cards(Outfit::withItem((int)$this->_get['id']), Lang::outfit('noneForItem'));
    }

    protected function remove() : string
    {
        $id = (int)$this->_post['id'];
        if (!User::$id || !$id || !Outfit::sameOrigin())
            return $this->fail(403, 'not signed in');

        $o = Outfit::get($id);
        if (!$o)
            return $this->fail(404, 'no such outfit');
        if (!Outfit::canEdit($o))
            return $this->fail(403, 'not yours');

        DB::Aowow()->query('DELETE FROM ?_outfits WHERE `id` = ?d', $id);
        DB::Aowow()->query('DELETE FROM ?_outfits_items WHERE `outfitId` = ?d', $id);
        if (file_exists(self::IMG_DIR.$id.'.png'))
            unlink(self::IMG_DIR.$id.'.png');

        return Util::toJSON(['ok' => 1]);
    }
}

?>
