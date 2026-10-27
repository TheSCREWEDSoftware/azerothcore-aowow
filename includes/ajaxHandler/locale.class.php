<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');

class AjaxLocale extends AjaxHandler
{
    protected $_get = array(
        'locale' => ['filter' => FILTER_CALLBACK, 'options' => 'Locale::tryFrom']
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

        if (!isset($_SERVER['HTTP_REFERER']))
            return '.';

        // readable links carry the locale in the path (/aowow/ru/item=123/..): swap it, or the old one stays in charge
        $ref  = $_SERVER['HTTP_REFERER'];
        $base = rtrim(Cfg::get('HOST_URL'), '/').'/';
        if ($this->_get['locale']?->validate() && strpos($ref, $base) === 0)
        {
            $rest = preg_replace('#^(en|fr|de|es|ru|cn)(/|$)#', '', substr($ref, strlen($base)));
            $loc  = $this->_get['locale'] == Locale::EN ? '' : $this->_get['locale']->domain().'/';
            $ref  = $base.($rest === '' || $rest[0] == '?' ? ($loc ?: '').$rest : $loc.$rest);
        }

        return $ref;
    }
}

?>
