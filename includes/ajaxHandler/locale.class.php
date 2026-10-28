<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');

class AjaxLocale extends AjaxHandler
{
    protected $_get = array(
        'locale' => ['filter' => FILTER_CALLBACK, 'options' => 'Locale::tryFrom'],
        'to'     => ['filter' => FILTER_UNSAFE_RAW]
    );

    public function __construct(array $params)
    {
        parent::__construct($params);

        // always this one
        $this->handler    = 'handleLocale';
        $this->doRedirect = true;
    }

    /* responses
        header()
    */
    protected function handleLocale() : string
    {
        if ($this->_get['locale']?->validate())
        {
            User::$preferedLoc = $this->_get['locale'];
            User::save(true);
        }

        $base = rtrim(Cfg::get('HOST_URL'), '/').'/';
        $loc  = $this->_get['locale']?->validate();

        // the page to go back to, below the site root: "item=123/name", "petcalc#0m", "?npcs&filter=.." (sent by the language menu,
        // so the #fragment survives), else the referer
        $to = (string)$this->_get['to'];
        if ($to === '' || preg_match('#^[/\\\\]|^[a-z][a-z0-9+.-]*:|[\x00-\x1f]#i', $to))
        {
            $to = '';
            if (isset($_SERVER['HTTP_REFERER']) && strpos($_SERVER['HTTP_REFERER'], $base) === 0)
                $to = substr($_SERVER['HTTP_REFERER'], strlen($base));
        }

        // readable links carry the locale in the path (/aowow/ru/item=123/..): swap it, or the old one stays in charge
        $rest = preg_replace('#^(en|fr|de|es|ru|cn|ko|tw|mx)(/|$)#', '', $to);
        $pre  = $loc && $loc != Locale::EN ? $loc->domain().'/' : '';
        $ref  = $base.$pre.$rest;

        return $ref;
    }
}

?>
