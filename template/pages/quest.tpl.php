<?php $this->brick('header'); ?>

    <div class="main" id="main">
        <div class="main-precontents" id="main-precontents"></div>
        <div class="main-contents" id="main-contents">

<?php
    $this->brick('announcement');

    $this->brick('pageTemplate');

    $this->brick('infobox');
?>

            <div class="text">
<?php $this->brick('redButtons'); ?>

                <h1><?=$this->name; ?></h1>
<?php if ($this->unavailable): ?>
                <div class="pad"></div>
                <b style="color: red"><?=Lang::quest('unavailable'); ?></b>
                <div class="pad"></div>
<?php
endif;

if ($this->objectives):
    echo $this->objectives."\n";
elseif ($this->requestItems):
    echo '                <h3>'.Lang::quest('progress')."</h3>\n";
    echo $this->requestItems."\n";
elseif ($this->offerReward):
    echo '                <h3>'.Lang::quest('completion')."</h3>\n";
    echo $this->offerReward."\n";
endif;

if ($this->end || $this->objectiveList):
?>
                <table class="iconlist">
<?php
    if ($this->end):
        echo "                    <tr><th><p style=\"height: 26px; width: 30px;\">&nbsp;</p></th><td>".$this->end."</td></tr>\n";
    endif;

    if ($o = $this->objectiveList):
        foreach ($o as $i => $ol):
            if (isset($ol['text'])):
                echo '                    <tr><th><p style="height: 26px; width: 30px;">&nbsp;</p></th><td>'.$ol['text']."</td></tr>\n";
            elseif (!empty($ol['proxy'])):                      // this implies creatures
                echo '                    <tr><th><p style="height: 26px">&nbsp;</p></th><td><a href="javascript:;" onclick="g_disclose($WH.ge(\'npcgroup-'.$ol['id'].'\'), this)" class="disclosure-off">'.$ol['name'].$ol['extraText'].'</a>'.($ol['qty'] > 1 ? '&nbsp;('.$ol['qty'].')' : null).'<div id="npcgroup-'.$ol['id']."\" style=\"display: none\">\n";

                $block1 = array_slice($ol['proxy'], 0, ceil(count($ol['proxy']) / 2), true);
                $block2 = array_slice($ol['proxy'], ceil(count($ol['proxy']) / 2), null, true);

                echo "                        <div style=\"float: left\"><table class=\"iconlist\">\n";
                foreach ($block1 as $pId => $name):
                                echo '                            <tr><th><ul><li><var>&nbsp;</var></li></ul></th><td><a href="?npc='.$pId.'">'.$name."</a></td></tr>\n";
                endforeach;
                echo "                        </table></div>\n";

                if ($block2):                                   // may be empty
                    echo "                        <div style=\"float: left\"><table class=\"iconlist\">\n";
                    foreach ($block2 as $pId => $name):
                                    echo '                            <tr><th><ul><li><var>&nbsp;</var></li></ul></th><td><a href="?npc='.$pId.'">'.$name."</a></td></tr>\n";
                    endforeach;
                    echo "                        </table></div>\n";
                endif;

                echo "                    </div></td></tr>\n";
            elseif (isset($ol['typeStr'])):
                if (in_array($ol['typeStr'], ['item', 'spell'])):
                    echo '                    <tr><th align="right" id="iconlist-icon-'.$i.'"></th>';
                else /* if (in_array($ol['typeStr'], ['npc', 'object', 'faction'])) */:
                    echo '                    <tr><th><ul><li><var>&nbsp;</var></li></ul></th>';
                endif;

                echo '<td><span class="q'.(isset($ol['quality']) ? $ol['quality'] : null).'"><a href="?'.$ol['typeStr'].'='.$ol['id'].'">'.$ol['name'].'</a></span>'.($ol['extraText']).(!empty($ol['qty']) ? '&nbsp;('.$ol['qty'].')' : null)."</td></tr>\n";
            endif;
        endforeach;
    endif;

    if ($this->suggestedPl):
        echo '                    <tr><th><p style="height: 26px; width: 30px;">&nbsp;</p></th><td>'.Lang::quest('suggestedPl').Lang::main('colon').$this->suggestedPl."</td></tr>\n";
    endif;
?>
                </table>

                <script type="text/javascript">//<![CDATA[
<?php
    foreach ($o as $k => $i):
        if (isset($i['typeStr']) && ($i['typeStr'] == 'item' || $i['typeStr'] == 'spell')):
            echo "                    \$WH.ge('iconlist-icon-".$k."').appendChild(g_".$i['typeStr']."s.createIcon(".$i['id'].", 0, ".$i['qty']."));\n";
        endif;
    endforeach;
?>
                //]]></script>
<?php
    if ($p = $this->providedItem):
        echo "                <div class=\"pad\"></div>\n";
        echo '                '.Lang::quest('providedItem').Lang::main('colon')."\n";
        echo "                <table class=\"iconlist\">\n";
        echo '                    <tr><th align="right" id="iconlist-icon-'.count($this->objectiveList).'"></th>';
        echo '<td><span class="q'.$p['quality'].'"><a href="?item='.$p['id'].'">'.$p['name'].'</a></span>'.($p['qty'] ? '&nbsp;('.$ol['qty'].')' : null)."</td></tr>\n";
?>
                </table>

                <script type="text/javascript">//<![CDATA[
<?php
        echo "                    \$WH.ge('iconlist-icon-".count($this->objectiveList)."').appendChild(g_items.createIcon(".$p['id'].", 0, ".$p['qty']."));\n";
?>
                //]]></script>
<?php
    endif;
endif;

$this->brick('mapper');

if ($this->details):
    echo '                <h3>'.Lang::quest('description')."</h3>\n" . $this->details."\n";
endif;

if ($this->requestItems && $this->objectives):
?>
                <h3><a href="javascript:;" class="disclosure-off" onclick="return g_disclose($WH.ge('disclosure-progress'), this)"><?=Lang::quest('progress'); ?></a></h3>
                <div id="disclosure-progress" style="display: none"><?=$this->requestItems; ?></div>
<?php
endif;

if ($this->offerReward && ($this->requestItems || $this->objectives)):
?>
                <h3><a href="javascript:;" class="disclosure-off" onclick="return g_disclose($WH.ge('disclosure-completion'), this)"><?=Lang::quest('completion'); ?></a></h3>
                <div id="disclosure-completion" style="display: none"><?=$this->offerReward; ?></div>
<?php
endif;

$offset = 0;
if ($r = $this->rewards):
    echo '                <h3>'.Lang::main('rewards')."</h3>\n";

    if (!empty($r['choice'])):
        $this->brick('rewards', ['rewTitle' => Lang::quest('chooseItems'), 'rewards' => $r['choice'], 'offset' => $offset]);
        $offset += count($r['choice']);
    endif;

    if (!empty($r['spells'])):
        if (!empty($r['choice'])):
            echo "                        <div class=\"pad\"></div>\n";
        endif;

        if (!empty($r['spells']['learn'])):
            $this->brick('rewards', ['rewTitle' => Lang::quest('spellLearn'), 'rewards' => $r['spells']['learn'], 'offset' => $offset, 'extra' => $r['spells']['extra']]);
            $offset += count($r['spells']['learn']);
        elseif (!empty($r['spells']['cast'])):
            $this->brick('rewards', ['rewTitle' => Lang::quest('spellCast'), 'rewards' => $r['spells']['cast'], 'offset' => $offset, 'extra' => $r['spells']['extra']]);
            $offset += count($r['spells']['cast']);
        endif;
    endif;

    if (!empty($r['items']) || !empty($r['money'])):
        if (!empty($r['choice']) || !empty($r['spells'])):
            echo "                        <div class=\"pad\"></div>\n";
        endif;

        $addData = ['rewards' => !empty($r['items']) ? $r['items'] : null, 'offset' => $offset, 'extra' => !empty($r['money']) ? $r['money'] : null];
        $addData['rewTitle'] = empty($r['choice']) ? Lang::quest('receiveItems') : Lang::quest('receiveAlso');

        $this->brick('rewards', $addData);
    endif;

endif;

if ($g = $this->gains):
    echo '                    <h3>'.Lang::main('gains')."</h3>\n";
    echo '                    '.Lang::quest('gainsDesc').Lang::main('colon')."\n";
    echo "                    <ul>\n";

    if (!empty($g['xp'])):
        // aowow: XP by player level (QuestXP.dbc row x RewardXPDifficulty, scaled like the core's Quest::XPValue)
        $qxTbl  = @json_decode(@file_get_contents('static/js/quest-xp.json'), true) ?: [];
        $qxLvl  = (int)$this->subject->getField('level');
        $qxMin  = max(1, (int)$this->subject->getField('minLevel'));
        $qxDiff = null;
        if ($g['xp'] >= 1 && $g['xp'] <= 9)                 // not unpacked by the quests setup: still the difficulty index
            $qxDiff = (int)$g['xp'];
        else if ($qxLvl > 0 && isset($qxTbl[$qxLvl]) && ($i = array_search((int)$g['xp'], $qxTbl[$qxLvl])) !== false)
            $qxDiff = (int)$i;

        $qxRow  = $qxLvl > 0 ? $qxLvl : $qxMin;             // level -1: the quest scales with the player
        $qxFull = $qxDiff !== null && isset($qxTbl[$qxRow]) ? $qxTbl[$qxRow][$qxDiff] : (int)$g['xp'];
        echo '                        <li><div><span id="q-xp-val">'.Lang::nf($qxFull).'</span> '.Lang::quest('experience')."</div></li>\n";
    endif;

    if (!empty($g['rep'])):
        foreach ($g['rep'] as $r):
            if ($r['qty'][1] && User::isInGroup(U_GROUP_EMPLOYEE))
                $qty = $r['qty'][0] . sprintf(Util::$dfnString, Lang::faction('customRewRate'), ($r['qty'][1] > 0 ? '+' : '').$r['qty'][1]);
            else
                $qty = array_sum($r['qty']);

            echo '                        <li><div>'.($r['qty'][0] < 0 ? '<b class="q10">'.$qty.'</b>' : $qty).' '.Lang::npc('repWith').' <a href="?faction='.$r['id'].'">'.$r['name']."</a></div></li>\n";
        endforeach;
    endif;

    if (!empty($g['title'])):
        echo '                        <li><div>'.Lang::quest('theTitle', [$g['title']])."</div></li>\n";
    endif;

    if (!empty($g['tp'])):
        echo '                        <li><div>'.Lang::quest('bonusTalents', [$g['tp']])."</div></li>\n";
    endif;

    echo "                    </ul>\n";

    if (!empty($qxDiff) && $qxTbl):
        $qxMax = $qxLvl > 0 ? max($qxMin, min(MAX_LEVEL - 1, $qxLvl + 10)) : MAX_LEVEL - 1;
        $qxDef = $qxLvl > 0 ? min($qxMax, max($qxMin, $qxLvl)) : $qxMin;
        $qxRows = $qxLvl > 0 ? [$qxLvl => $qxTbl[$qxLvl]] : array_slice($qxTbl, 0, MAX_LEVEL, true);
?>
                    <div class="q-xpbar">
                        <div class="q-xpbar-head"><span>LEVEL<span class="q-xpbar-diff" id="q-xp-diff"></span></span><span><b id="q-xp-lvl"><?=$qxDef; ?></b> / <?=$qxMax; ?></span></div>
                        <input type="range" id="q-xp-range" min="<?=$qxMin; ?>" max="<?=$qxMax; ?>" value="<?=$qxDef; ?>" step="1" />
                    </div>
                    <style>
                        .q-xpbar { width: 375px; max-width: 100%; margin: 4px 0 6px; }
                        .q-xpbar-head { display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; letter-spacing: .08em; color: #aaa; margin-bottom: 4px; }
                        .q-xpbar-head b { color: #1eff00; }
                        #q-xp-range { -webkit-appearance: none; appearance: none; display: block; width: 100%; height: 10px; margin: 0; border-radius: 5px; cursor: pointer; background: #2b2b2b; box-shadow: inset 0 0 0 1px rgba(0,0,0,.6); }
                        #q-xp-range::-webkit-slider-thumb { -webkit-appearance: none; width: 8px; height: 18px; border-radius: 2px; background: #eee; border: 1px solid #000; box-shadow: 0 0 2px #000; }
                        #q-xp-range::-moz-range-thumb { width: 8px; height: 18px; border-radius: 2px; background: #eee; border: 1px solid #000; }
                        .q-xpbar-diff { margin-left: 8px; font-weight: normal; letter-spacing: 0; text-transform: none; }
                    </style>
                    <script type="text/javascript">
                        (function () {
                            var rows = <?=json_encode($qxRows); ?>, qLvl = <?=$qxLvl; ?>, diff = <?=$qxDiff; ?>;
                            var r = $WH.ge('q-xp-range'), lv = $WH.ge('q-xp-lvl'), out = $WH.ge('q-xp-val');
                            var xpAt = function (p) {
                                var q = qLvl > 0 ? qLvl : p, row = rows[q];
                                if (!row)
                                    return 0;
                                var f = Math.min(10, Math.max(1, 2 * (q - p) + 20));
                                var xp = Math.floor(f * row[diff] / 10);
                                if (xp <= 100)       xp = 5  * Math.floor((xp + 2)  / 5);
                                else if (xp <= 500)  xp = 10 * Math.floor((xp + 5)  / 10);
                                else if (xp <= 1000) xp = 25 * Math.floor((xp + 12) / 25);
                                else                 xp = 50 * Math.floor((xp + 25) / 50);
                                return xp;
                            };
                            // quest colour for a player level, as the core's Acore::XP::GetColorCode / the client's GetQuestDifficultyColor
                            var COLORS = { red: ['#ff1a1a', 'Red: very difficult'], orange: ['#ff8040', 'Orange: difficult'], yellow: ['#ffff00', 'Yellow: standard'],
                                           green: ['#40bf40', 'Green: easy'], grey: ['#808080', 'Grey: trivial'] };
                            var grayLevel = function (p) { return p <= 5 ? 0 : (p <= 39 ? p - 5 - Math.floor(p / 10) : (p <= 59 ? p - 1 - Math.floor(p / 5) : p - 9)); };
                            var colorAt = function (p) {
                                var q = qLvl > 0 ? qLvl : p;
                                return q >= p + 5 ? 'red' : (q >= p + 3 ? 'orange' : (q >= p - 2 ? 'yellow' : (q > grayLevel(p) ? 'green' : 'grey')));
                            };
                            var dif = $WH.ge('q-xp-diff');
                            var lo = parseInt(r.min), hi = parseInt(r.max), n = hi - lo + 1, stops = [];
                            for (var l = lo; l <= hi; l++)
                                stops.push(COLORS[colorAt(l)][0] + ' ' + ((l - lo) / n * 100).toFixed(2) + '% ' + ((l - lo + 1) / n * 100).toFixed(2) + '%');
                            r.style.background = 'linear-gradient(to right, ' + stops.join(', ') + ')';

                            var upd = function () {
                                var p = parseInt(r.value), c = COLORS[colorAt(p)];
                                lv.textContent  = p;
                                lv.style.color  = c[0];
                                dif.textContent = c[1];
                                dif.style.color = c[0];
                                out.textContent = $WH.number_format(xpAt(p));
                            };
                            r.oninput = upd;
                            upd();
                        })();
                    </script>
<?php
    endif;
endif;

// aowow: completion check (3.3.5 client macro + GM command), click to copy
$qId    = (int)$this->typeId;
$qMacro = '/run local q='.$qId.' local f=CreateFrame("Frame")f:RegisterEvent("QUEST_QUERY_COMPLETE")f:SetScript("OnEvent",function(s)s:UnregisterAllEvents()print("Quest "..q..(GetQuestsCompleted()[q] and " complete" or " incomplete"))end)QueryQuestsCompleted()';
$qGm    = '.quest status '.$qId;
?>
                    <div class="pad"></div>
                    <div class="q-status-check">
                        Check the quest's status with the command (click to copy):
                        <code class="q-copy" title="Click to copy" data-copy="<?=htmlspecialchars($qGm); ?>"><?=htmlspecialchars($qGm); ?></code>
                        or by typing in game:
                        <code class="q-copy q-macro" title="Click to copy" data-copy="<?=htmlspecialchars($qMacro); ?>" data-short="/run local q=<?=$qId; ?> ..."><span>/run local q=<?=$qId; ?> ...</span></code>
                        <a href="javascript:;" class="q-expand">Expand</a>
                    </div>
                    <style>
                        .q-status-check { margin-top: 6px; line-height: 1.6; }
                        .q-status-check .q-copy { display: block; width: fit-content; max-width: min(100%, 460px); margin: 3px 0 8px; padding: 0; font: bold 13px/1.5 Consolas, "Courier New", monospace; color: #fff; background: none; border-bottom: 1px dotted #888; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                        .q-status-check .q-copy:hover { color: #ffd100; border-bottom-color: #ffd100; }
                        .q-status-check .q-copy.q-copied { color: #1eff00; border-bottom-color: #1eff00; }
                        .q-status-check .q-macro { margin-bottom: 2px; }
                        .q-status-check .q-macro.q-open { white-space: normal; word-break: break-all; max-width: min(100%, 720px); }
                        .q-status-check .q-expand { display: inline-block; font-size: 11px; margin-bottom: 8px; }
                    </style>
                    <script type="text/javascript">
                        $('.q-status-check .q-expand').on('click', function () {
                            var m = $('.q-status-check .q-macro'), open = !m.hasClass('q-open');
                            m.toggleClass('q-open', open).children('span').text(open ? m.attr('data-copy') : m.attr('data-short'));
                            $(this).text(open ? 'Collapse' : 'Expand');
                        });
                        $('.q-status-check .q-copy').on('click', function () {
                            var el = this, txt = el.getAttribute('data-copy');
                            var done = function () { $(el).addClass('q-copied'); setTimeout(function () { $(el).removeClass('q-copied'); }, 1500); };
                            var legacy = function () {
                                var ta = document.createElement('textarea');
                                ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
                                document.body.appendChild(ta); ta.select();
                                try { if (document.execCommand('copy')) done(); } catch (e) {}
                                document.body.removeChild(ta);
                            };
                            if (navigator.clipboard && window.isSecureContext)
                                navigator.clipboard.writeText(txt).then(done, legacy);
                            else
                                legacy();
                        });
                    </script>
<?php
$this->brick('mail', ['offset' => ++$offset]);

if (!empty($this->transfer)):
    echo "    <div style=\"clear: left\"></div>";
    echo "    <div class=\"pad\"></div>\n    ".$this->transfer."\n";
endif;

?>
                <h2 class="clear"><?=Lang::main('related'); ?></h2>
            </div>

<?php
$this->brick('lvTabs', ['relTabs' => true]);

$this->brick('contribute');
?>

            <div class="clear"></div>
        </div><!-- main-contents -->
    </div><!-- main -->

<?php $this->brick('footer'); ?>
