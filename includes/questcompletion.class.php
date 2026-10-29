<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');


// quest progress of the characters on the game account linked to the logged in user
//   the game account is aowow_account.extId: set by the AC / realm auth modes, or by linking it on the quest tracker
//   status codes per character: 0 not started, 1 in progress, 2 ready to turn in, 3 completed, 4 failed
class QuestCompletion
{
    public const NONE      = 0;
    public const PROGRESS  = 1;
    public const READY     = 2;
    public const COMPLETED = 3;
    public const FAILED    = 4;

    private static ?int   $account = null;
    private static ?array $chars   = null;
    private static ?array $status  = null;

    // game account id of the logged in user, 0 when there is none
    public static function account() : int
    {
        if (self::$account !== null)
            return self::$account;

        self::$account = 0;
        if (User::$id && Cfg::get('ACC_AUTH_MODE') != AUTH_MODE_EXTERNAL)
            self::$account = (int)DB::Aowow()->selectCell('SELECT IFNULL(`extId`, 0) FROM ?_account WHERE `id` = ?d', User::$id);

        return self::$account;
    }

    public static function canLink() : bool
    {
        return User::$id && Cfg::get('ACC_AUTH_MODE') == AUTH_MODE_SELF && DB::isConnectable(DB_AUTH);
    }

    // check the game login once and remember the account; returns '' or an error message
    public static function link(string $name, string $pass) : string
    {
        if (!self::canLink())
            return 'Linking is not available.';

        $name = trim($name);
        if ($name === '' || $pass === '')
            return 'Enter the game account name and password.';

        $acc = DB::Auth()->selectRow('SELECT `id`, `salt`, `verifier` FROM account WHERE `username` = ? LIMIT 1', $name);
        if (!$acc || !User::verifySRP6($name, $pass, $acc['salt'], $acc['verifier']))
            return 'Wrong account name or password.';

        if ($other = DB::Aowow()->selectCell('SELECT `id` FROM ?_account WHERE `extId` = ?d AND `id` <> ?d', $acc['id'], User::$id))
            return 'This game account is already linked to another site account.';

        DB::Aowow()->query('UPDATE ?_account SET `extId` = ?d WHERE `id` = ?d', $acc['id'], User::$id);
        self::$account = (int)$acc['id'];
        return '';
    }

    public static function unlink() : void
    {
        if (self::canLink())
            DB::Aowow()->query('UPDATE ?_account SET `extId` = NULL WHERE `id` = ?d', User::$id);

        self::$account = 0;
    }

    // [[realmId, guid, name, race, class, level, realmName], ..] sorted by name
    public static function characters() : array
    {
        if (self::$chars !== null)
            return self::$chars;

        self::$chars = [];
        if (!($acc = self::account()))
            return self::$chars;

        // every realm of this game build with a characters database configured (the profiler's list hides dev realms from non-admins)
        $realms = DB::isConnectable(DB_AUTH) ? (DB::Auth()->select('SELECT `id` AS ARRAY_KEY, `name` FROM realmlist WHERE `gamebuild` = ?d', WOW_BUILD) ?: []) : [];
        foreach ($realms as $realmId => $realm)
        {
            if (!DB::isConnectable(DB_CHARACTERS . $realmId))
                continue;

            $rows = DB::Characters($realmId)->select('SELECT `guid`, `name`, `race`, `class`, `level` FROM characters WHERE `account` = ?d AND `deleteInfos_Account` IS NULL', $acc) ?: [];
            foreach ($rows as $r)
                self::$chars[] = [(int)$realmId, (int)$r['guid'], $r['name'], (int)$r['race'], (int)$r['class'], (int)$r['level'], $realm['name']];
        }

        usort(self::$chars, fn($a, $b) => strcasecmp($a[2], $b[2]) ?: strcmp($a[6], $b[6]));
        return self::$chars;
    }

    // questId => status code per character, in the order of characters()
    public static function status() : array
    {
        if (self::$status !== null)
            return self::$status;

        self::$status = [];
        $chars = self::characters();
        $n     = count($chars);
        foreach ($chars as $idx => [$realmId, $guid])
        {
            $set = function (array $quests, int $code) use ($idx, $n) {
                foreach ($quests as $q)
                {
                    self::$status[$q] ??= array_fill(0, $n, self::NONE);
                    if (self::$status[$q][$idx] != self::COMPLETED)
                        self::$status[$q][$idx] = $code;
                }
            };

            $db = DB::Characters($realmId);
            $set(($db->selectCol('SELECT `quest` FROM character_queststatus_rewarded WHERE `guid` = ?d', $guid) ?: []), self::COMPLETED);
            $set(($db->selectCol('SELECT `quest` FROM character_queststatus_daily WHERE `guid` = ?d', $guid) ?: []), self::COMPLETED);
            $set(($db->selectCol('SELECT `quest` FROM character_queststatus_weekly WHERE `guid` = ?d', $guid) ?: []), self::COMPLETED);
            foreach (($db->select('SELECT `quest`, `status` FROM character_queststatus WHERE `guid` = ?d', $guid) ?: []) as $r)
            {
                $code = match ((int)$r['status']) { 1 => self::READY, 3 => self::PROGRESS, 5 => self::FAILED, default => self::NONE };
                if ($code)
                    $set([(int)$r['quest']], $code);
            }
        }

        return self::$status;
    }

    // g_questStatus for the page scripts: {c: characters, q: {questId: "-prc"}}, one letter per character: - none, p in progress, r ready, c completed, f failed
    public static function toJS() : string
    {
        $q = [];
        foreach (self::status() as $id => $codes)
            $q[$id] = strtr(implode('', $codes), '01234', '-prcf');   // letters, so the JSON encoder keeps them strings

        return 'var g_questStatus = '.Util::toJSON(['c' => self::characters(), 'q' => $q ?: new stdClass()]).";\n";
    }

    // script and style tags for the page head when there is a linked account with characters
    public static function headTags() : string
    {
        if (!self::account() || !self::characters())
            return '';

        $s = Cfg::get('STATIC_URL');
        return '    <link rel="stylesheet" type="text/css" href="'.$s.'/css/questcompletion.css?'.@filemtime('static/css/questcompletion.css')."\" />\n"
             . '    <script type="text/javascript" src="'.Cfg::get('HOST_URL').'/?quest-tracker=status&amp;v='.intdiv(time(), 30)."\"></script>\n"
             . '    <script type="text/javascript" src="'.$s.'/js/questcompletion.js?'.@filemtime('static/js/questcompletion.js')."\"></script>\n";
    }
}

?>
