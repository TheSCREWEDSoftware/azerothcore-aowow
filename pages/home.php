<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');


class HomePage extends GenericPage
{
    protected $tpl      = 'home';
    protected $scripts  = array(
        [SC_JS_FILE,    'js/home.js'],
        [SC_CSS_FILE,   'css/home.css'],
        [SC_CSS_STRING, '.announcement { margin: auto; max-width: 1200px; padding: 0px 15px 15px 15px }']
    );

    protected $featuredBox = [];
    protected $oneliner    = '';
    protected $homeTitle   = '';
    protected $acRev       = '';
    protected $dbTimes     = [];

    public function __construct()
    {
        parent::__construct('home');
    }

    protected function generateContent()
    {
        // load AzerothCore revision from most recent uptime entry
        if (DB::isConnected(DB_AUTH))
        {
            $rev = DB::Auth()->selectCell(
                "SELECT TRIM(TRAILING '+' FROM SUBSTRING_INDEX(SUBSTRING_INDEX(revision, 'rev. ', -1), ' ', 1))
                 FROM uptime ORDER BY starttime DESC LIMIT 1"
            );
            $this->acRev = ($rev && $rev !== 'unknown') ? $rev : 'Custom build';
        }

        // DB modification times
        if (DB::isConnected(DB_AUTH))
            $this->dbTimes['auth'] = DB::Auth()->selectCell(
                "SELECT DATE_FORMAT(FROM_UNIXTIME(MAX(starttime)), '%Y-%m-%d %H:%i') FROM uptime"
            ) ?: 'N/A';

        if (DB::isConnected(DB_WORLD))
            $this->dbTimes['world'] = DB::World()->selectCell(
                "SELECT DATE_FORMAT(MAX(UPDATE_TIME), '%Y-%m-%d %H:%i') FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND UPDATE_TIME IS NOT NULL"
            ) ?: 'N/A';

        if (DB::isConnected(DB_AOWOW))
            $this->dbTimes['aowow_db'] = DB::Aowow()->selectCell(
                "SELECT DATE_FORMAT(MAX(UPDATE_TIME), '%Y-%m-%d %H:%i') FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND UPDATE_TIME IS NOT NULL"
            ) ?: 'N/A';

        for ($r = 1; $r <= 20; $r++)
        {
            if (DB::isConnected(DB_CHARACTERS . $r))
            {
                $this->dbTimes['chars'] = DB::Characters($r)->selectCell(
                    "SELECT DATE_FORMAT(MAX(UPDATE_TIME), '%Y-%m-%d %H:%i') FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND UPDATE_TIME IS NOT NULL"
                ) ?: 'N/A';
                break;
            }
        }

        $appMtime = 0;
        foreach (['pages', 'includes', 'template'] as $dir)
            if (is_dir($dir))
                foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS)) as $f)
                    if ($f->isFile() && $f->getExtension() === 'php')
                        $appMtime = max($appMtime, $f->getMTime());
        $this->dbTimes['app'] = $appMtime ? date('Y-m-d H:i', $appMtime) : 'N/A';

        // load oneliner
        if ($_ = DB::Aowow()->selectRow('SELECT * FROM ?_home_oneliner WHERE active = 1 LIMIT 1'))
            $this->oneliner = Util::jsEscape(Util::localizedString($_, 'text'));

        // load featuredBox (user web server time)
        $this->featuredBox = DB::Aowow()->selectRow('SELECT id as ARRAY_KEY, n.* FROM ?_home_featuredbox n WHERE ?d BETWEEN startDate AND endDate ORDER BY id DESC LIMIT 1', time());
        if (!$this->featuredBox)
            return;

        $this->featuredBox = Util::defStatic($this->featuredBox);

        $this->featuredBox['text'] = Util::localizedString($this->featuredBox, 'text', true);

        if ($_ = (new Markup($this->featuredBox['text']))->parseGlobalsFromText())
            $this->extendGlobalData($_);

        if (empty($this->featuredBox['boxBG']))
            $this->featuredBox['boxBG'] = Cfg::get('STATIC_URL').'/images/'.Lang::getLocale()->json().'/mainpage-bg-news.jpg';

        // load overlay links
        $this->featuredBox['overlays'] = DB::Aowow()->select('SELECT * FROM ?_home_featuredbox_overlay WHERE featureId = ?d', $this->featuredBox['id']);
        foreach ($this->featuredBox['overlays'] as &$o)
        {
            $o['title'] = Util::localizedString($o, 'title', true);
            $o['title'] = Util::defStatic($o['title']);
        }
    }

    protected function generateTitle()
    {
        if ($_ = DB::Aowow()->selectCell('SELECT title FROM ?_home_titles WHERE active = 1 AND locale = ?d ORDER BY RAND() LIMIT 1', Lang::getLocale()->value))
            $this->homeTitle = Cfg::get('NAME').Lang::main('colon').$_;
    }

    protected function generatePath() {}
}

?>
