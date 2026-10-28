<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');

// model thumbnails are drawn in the browser (static/js/modelviewer/thumbs.js); staff browsers store them here
//   ?modelviewer-thumb=save   POST type (item|npc|object|itemset), id, png (data url)
class AjaxModelviewerthumb extends AjaxHandler
{
    public const DIR   = 'static/modelviewer/thumbs/';
    public const TYPES = ['item', 'npc', 'object', 'itemset'];

    protected $_post = array(
        'type' => ['filter' => FILTER_CALLBACK, 'options' => 'AjaxHandler::checkTextLine'],
        'id'   => ['filter' => FILTER_CALLBACK, 'options' => 'AjaxHandler::checkInt'     ],
        'png'  => ['filter' => FILTER_UNSAFE_RAW                                         ]
    );

    public function __construct(array $params)
    {
        parent::__construct($params);

        if ($this->params && $this->params[0] == 'save')
            $this->handler = 'save';
    }

    protected function save() : string
    {
        if (!User::isInGroup(U_GROUP_STAFF) || !Outfit::sameOrigin())
        {
            http_response_code(403);
            return '{"error":"staff only"}';
        }

        $type = (string)$this->_post['type'];
        $id   = (int)$this->_post['id'];
        $url  = (string)$this->_post['png'];
        if (!in_array($type, self::TYPES) || !$id || ($id < 0 && $type != 'itemset') || strpos($url, 'data:image/png;base64,') !== 0)
        {
            http_response_code(400);
            return '{"error":"bad request"}';
        }

        $png  = base64_decode(substr($url, 22), true);
        $info = $png && substr($png, 0, 8) == "\x89PNG\r\n\x1a\n" ? @getimagesizefromstring($png) : null;
        if (!$info || $info[0] < 32 || $info[0] > 512 || $info[1] < 32 || $info[1] > 512 || strlen($png) > 1024 * 1024)
        {
            http_response_code(400);
            return '{"error":"not a thumbnail"}';
        }

        if (!Util::writeDir(self::DIR.$type))
        {
            http_response_code(500);
            return '{"error":"cannot write"}';
        }

        file_put_contents(self::DIR.$type.'/'.$id.'.png', $png);
        return '{"ok":1}';
    }
}

?>
