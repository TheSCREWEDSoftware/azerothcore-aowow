<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');


// tabId 1: Tools g_initHeader()
// what the site posts to Discord (config: discord_webhook, discord_events); staff can send a test message
//   ?discord-webhook=test   POST, staff: one test embed
class DiscordwebhookPage extends GenericPage
{
    protected $tpl      = 'tool';
    protected $tabId    = 1;
    protected $path     = [1, 13];
    protected $mode     = CACHE_TYPE_NONE;
    protected $scripts  = array(
        [SC_JS_FILE,  'js/discord.js'],
        [SC_CSS_FILE, 'css/tools.css']
    );

    protected $toolId   = 'discord';
    protected $toolInit = 'AoDiscord.init';
    protected $config   = [];

    public function __construct($pageCall, $pageParam)
    {
        parent::__construct($pageCall, $pageParam);

        if ($pageParam == 'test')
        {
            header('Content-Type: application/json; charset=utf-8');
            if ($_SERVER['REQUEST_METHOD'] != 'POST' || !User::isInGroup(U_GROUP_STAFF) || !Outfit::sameOrigin())
                exit('{"error":"staff only"}');
            if (!Discord::url())
                exit('{"error":"no webhook set"}');

            $ok = Discord::send(['username' => Cfg::get('NAME_SHORT') ?: 'AoWoW', 'embeds' => [[
                'title'       => 'Test message',
                'description' => 'The webhook of '.Cfg::get('NAME').' works. Sent by '.User::$displayName.'.',
                'url'         => Cfg::get('HOST_URL'),
                'color'       => 0xFFD100,
                'timestamp'   => date('c')
            ]]]);
            exit($ok ? '{"ok":1}' : '{"error":"Discord did not accept the message (check the webhook URL)"}');
        }

        $this->name   = Lang::main('discordWebhook');
        $events       = (int)Cfg::get('DISCORD_EVENTS');
        $this->config = array(
            'enabled' => Discord::url() !== '',
            'set'     => trim((string)Cfg::get('DISCORD_WEBHOOK')) !== '',
            'events'  => array(
                ['New comments and replies', (bool)($events & Discord::EV_COMMENT)],
                ['New screenshots (when uploaded, before approval)', (bool)($events & Discord::EV_SCREENSHOT)],
                ['Guides when they are approved', (bool)($events & Discord::EV_GUIDE)]
            ),
            'staff'   => User::isInGroup(U_GROUP_STAFF),
            'admin'   => User::isInGroup(U_GROUP_ADMIN | U_GROUP_DEV)
        );
    }

    protected function generateContent() { }

    protected function generateTitle()
    {
        array_unshift($this->title, $this->name);
    }

    protected function generatePath() { }
}

?>
