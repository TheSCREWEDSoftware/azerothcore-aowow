<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');

if (!CLI)
    die('not in cli mode');


/*********************************/
/* automaticly apply sql-updates */
/*********************************/

CLISetup::registerUtility(new class extends UtilityScript
{
    public $argvOpts    = ['u'];
    public $optGroup    = CLISetup::OPT_GRP_SETUP;
    public $followupFn  = 'sync';

    public const COMMAND     = 'update';
    public const DESCRIPTION = 'Apply new sql updates fetched from Github and run --sync as needed.';

    public const REQUIRED_DB = [DB_AOWOW];

    public const SITE_LOCK   = CLISetup::LOCK_RESTORE;

    public function __construct()
    {
        if (!DB::isConnected(DB_AOWOW))
            return;

        // ensure updates tracking table exists
        DB::Aowow()->query(
            'CREATE TABLE IF NOT EXISTS `aowow_updates` (
                `name`      VARCHAR(200) NOT NULL COMMENT \'filename with extension of the update.\',
                `hash`      CHAR(40)     NULL DEFAULT \'\' COMMENT \'sha1 hash of the sql file.\',
                `timestamp` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT \'timestamp when the query was applied.\',
                `speed`     INT UNSIGNED NOT NULL DEFAULT 0 COMMENT \'time the query takes to apply in ms.\',
                PRIMARY KEY (`name`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT=\'List of all applied updates in this database.\''
        );

        // one-time migration: bootstrap from old dbversion table if updates is still empty
        if (!DB::Aowow()->selectCell('SELECT COUNT(*) FROM ?_updates'))
            $this->bootstrapFromDbversion();
    }

    // populate updates table from dbversion tracking on first run after migration
    private function bootstrapFromDbversion() : void
    {
        $row = DB::Aowow()->selectRow('SELECT `date`, `part` FROM ?_dbversion LIMIT 1');
        if (!$row || !$row['date'])
            return;

        [$lastDate, $lastPart] = [$row['date'], $row['part']];

        $files = glob('setup/updates/*.sql');
        sort($files);
        $count = 0;

        foreach ($files as $file)
        {
            $pi = pathinfo($file);

            if (preg_match('/^(\d{10})_(\d{2})$/', $pi['filename'], $m))
            {
                $fDate = intVal($m[1]);
                $fPart = intVal($m[2]);
            }
            else if (preg_match('/^(\d{4})_(\d{2})_(\d{2})_(\d{2})$/', $pi['filename'], $m))
            {
                $fDate = (int)strtotime($m[1].'-'.$m[2].'-'.$m[3].' 00:00:00 UTC');
                $fPart = intVal($m[4]);
                if (!$fDate)
                    continue;
            }
            else
                continue;

            // only files already applied according to the old dbversion record
            if ($fDate > $lastDate)
                continue;
            if ($fDate == $lastDate && $fPart > $lastPart)
                continue;

            DB::Aowow()->query(
                'INSERT IGNORE INTO ?_updates (`name`, `hash`) VALUES (?, ?)',
                basename($file), sha1_file($file)
            );
            $count++;
        }

        if ($count)
            CLI::write('[update] bootstrapped '.$count.' record(s) from dbversion', CLI::LOG_INFO);
    }

    // args: null, null, sqlToDo, buildToDo // nnoo
    public function run(&$args) : bool
    {
        $sql   = &$args['doSql'];
        $build = &$args['doBuild'];

        CLI::write('[update] checking for sql updates...');

        // load currently tracked updates: filename => hash
        $applied = [];
        foreach (DB::Aowow()->select('SELECT `name`, `hash` FROM ?_updates') as $row)
            $applied[$row['name']] = $row['hash'];

        // sort lexicographically — both old (1717...) and new (2026_...) names order correctly
        $files = glob('setup/updates/*.sql');
        sort($files);

        $nFiles = 0;
        foreach ($files as $file)
        {
            $filename = basename($file);

            if (!preg_match('/^(?:\d{10}|\d{4}_\d{2}_\d{2})_\d{2}\.sql$/', $filename))
                continue;

            $hash      = sha1_file($file);
            $isReapply = isset($applied[$filename]);

            // skip if already applied and file is unchanged
            if ($isReapply && $applied[$filename] === $hash)
                continue;

            $nFiles++;
            $start    = microtime(true);
            $updQuery = '';
            $nQuerys  = 0;

            foreach (file($file) as $line)
            {
                // skip comments and blank lines
                if (substr($line, 0, 2) == '--' || $line == '')
                    continue;

                $updQuery .= $line;

                // semicolon at end of line -> end of query
                if (substr(trim($line), -1, 1) == ';')
                {
                    if (DB::Aowow()->query($updQuery))
                        $nQuerys++;

                    $updQuery = '';
                }
            }

            $speed = (int)((microtime(true) - $start) * 1000);

            if ($isReapply)
            {
                DB::Aowow()->query(
                    'UPDATE ?_updates SET `hash` = ?, `timestamp` = NOW(), `speed` = ?d WHERE `name` = ?',
                    $hash, $speed, $filename
                );
                CLI::write(' -> '.$filename.' (re-applied, file changed): '.$nQuerys.' quer'.($nQuerys == 1 ? 'y' : 'ies').' in '.$speed.'ms', CLI::LOG_WARN);
            }
            else
            {
                DB::Aowow()->query(
                    'INSERT INTO ?_updates (`name`, `hash`, `speed`) VALUES (?, ?, ?d)',
                    $filename, $hash, $speed
                );
                CLI::write(' -> '.$filename.': '.$nQuerys.' quer'.($nQuerys == 1 ? 'y' : 'ies').' in '.$speed.'ms', CLI::LOG_OK);
            }
        }

        CLI::write('[update] ' . ($nFiles ? 'applied '.$nFiles.' update(s)' : 'db is already up to date'), CLI::LOG_OK);

        // fetch pending sync/build tasks (may be set by update files via UPDATE ?_dbversion)
        $dbv = DB::Aowow()->selectRow('SELECT `sql` AS "0", `build` AS "1" FROM ?_dbversion');
        [$sql, $build] = $dbv ?: ['', ''];

        $sql   = trim($sql)   ? array_unique(explode(' ', trim(preg_replace('/[^a-z_\-]+/i', ' ', $sql))))   : [];
        $build = trim($build) ? array_unique(explode(' ', trim(preg_replace('/[^a-z_\-]+/i', ' ', $build)))) : [];

        sleep(1);

        if ($sql)
            CLI::write('[update] The following sql scripts have been scheduled: '.implode(', ', $sql));

        if ($build)
            CLI::write('[update] The following build scripts have been scheduled: '.implode(', ', $build));

        return true;
    }

    public function writeCLIHelp() : bool
    {
        CLI::write('  usage: php aowow --update', -1, false);
        CLI::write();
        CLI::write('  Checks /setup/updates for new *.sql files and applies them. If a file\'s content has changed since it was last applied, it is automatically re-applied.', -1, false);
        CLI::write('  Use this after fetching the latest rev. from Github.', -1, false);
        CLI::write();

        if (DB::isConnected(DB_AOWOW))
        {
            $recent = DB::Aowow()->select('SELECT `name`, `timestamp`, `speed` FROM ?_updates ORDER BY `timestamp` DESC, `name` DESC LIMIT 5');
            if ($recent)
            {
                CLI::write('  Recent updates:', -1, false);
                foreach ($recent as $row)
                    CLI::write('    ['.$row['timestamp'].']  '.$row['name'].'  ('.$row['speed'].'ms)', -1, false);
                CLI::write();
            }
        }

        CLI::write();

        return true;
    }
});

?>
