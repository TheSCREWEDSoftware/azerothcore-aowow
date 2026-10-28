<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');


// posts site events to a Discord channel through a webhook (config: discord_webhook, discord_events)
class Discord
{
    public const EV_COMMENT    = 0x1;                       // a new comment or reply
    public const EV_SCREENSHOT = 0x2;                       // a screenshot was uploaded
    public const EV_GUIDE      = 0x4;                       // a guide was approved

    public static function url() : string
    {
        $url = trim((string)Cfg::get('DISCORD_WEBHOOK'));
        return preg_match('#^https://(?:ptb\.|canary\.)?discord(?:app)?\.com/api/webhooks/\d+/[\w-]+$#', $url) ? $url : '';
    }

    public static function enabled(int $event = 0) : bool
    {
        return self::url() && (!$event || ((int)Cfg::get('DISCORD_EVENTS') & $event));
    }

    // a link to a database entry, and its name when it has one
    public static function entry(int $type, int $typeId) : array
    {
        $url  = rtrim(Cfg::get('HOST_URL'), '/').'/?'.Type::getFileString($type).'='.$typeId;
        $name = Type::getFileString($type).' #'.$typeId;
        try
        {
            if (($list = Type::newList($type, [['id', $typeId]])) && !$list->error)
                $name = $list->getField('name', true) ?: ($list->getField('title') ?: $name);
        }
        catch (\Throwable $e) { }

        return [$url, $name];
    }

    // one embed; true when Discord accepted it. Never throws: a failed post must not break the page that triggered it
    public static function post(int $event, string $title, string $text = '', string $url = '', int $color = 0xFFD100) : bool
    {
        if (!self::enabled($event))
            return false;

        $embed = array_filter(array(
            'title'       => mb_substr($title, 0, 256),
            'description' => mb_substr($text, 0, 1000),
            'url'         => $url,
            'color'       => $color,
            'timestamp'   => date('c')
        ));

        return self::send(['username' => mb_substr((string)Cfg::get('NAME_SHORT') ?: 'AoWoW', 0, 80), 'embeds' => [$embed]]);
    }

    public static function send(array $payload) : bool
    {
        $url  = self::url();
        $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!$url || $body === false)
            return false;

        try
        {
            if (function_exists('curl_init'))
            {
                $ch = curl_init($url);
                curl_setopt_array($ch, array(
                    CURLOPT_POST           => true,
                    CURLOPT_POSTFIELDS     => $body,
                    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_CONNECTTIMEOUT => 3,
                    CURLOPT_TIMEOUT        => 5
                ));
                curl_exec($ch);
                $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
                curl_close($ch);
                return $code >= 200 && $code < 300;
            }

            $ctx = stream_context_create(['http' => ['method' => 'POST', 'header' => "Content-Type: application/json\r\n", 'content' => $body, 'timeout' => 5, 'ignore_errors' => true]]);
            @file_get_contents($url, false, $ctx);
            return isset($http_response_header[0]) && preg_match('#\s2\d\d\s#', $http_response_header[0]);
        }
        catch (\Throwable $e)
        {
            return false;
        }
    }
}

?>
