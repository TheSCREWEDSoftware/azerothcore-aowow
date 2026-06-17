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

                <h1<?=($this->expansion ? ' class="h1-icon">' : '>'); ?><?=($this->expansion ? '<span class="icon-'.$this->expansion.'-right">' : ''); ?><?=$this->name.($this->subname ? ' &lt;'.$this->subname.'&gt;' : null); ?><?=($this->expansion ? '</span>' : ''); ?></h1>

<?php
    $this->brick('article');

if ($this->accessory):
    echo '                <div>'.Lang::npc('accessoryFor').' ';
    echo Lang::concat($this->accessory, true, function ($v, $k) { return '<a href="?npc='.$v[0].'">'.$v[1].'</a>'; });
    echo ".</div>\n";
endif;

if ($this->placeholder):
?>
                <div class="pad"></div>
<?php
elseif (!empty($this->map)):
    $this->brick('mapper');
else:
    echo '                '.Lang::npc('unkPosition')."\n";
endif;

if ($this->quotes[0]):
?>
                <h3><a class="disclosure-off" onclick="return g_disclose($WH.ge('quotes-generic'), this)"><?=Lang::npc('quotes').'&nbsp;('.$this->quotes[1]; ?>)</a></h3>
                <div id="quotes-generic" style="display: none"><ul>
<?php
    foreach ($this->quotes[0] as $group):
        foreach ($group as $itr):
            echo '<li>'.sprintf(sprintf($itr['text'], $itr['prefix']), $this->name)."</li>\n";
        endforeach;
    endforeach;
?>
                </ul></div>
<?php
endif;

if ($this->reputation):
?>
                <h3><?=Lang::main('gains'); ?></h3>
<?php
    echo Lang::npc('gainsDesc').Lang::main('colon');

    foreach ($this->reputation as $set):
        if (count($this->reputation) > 1):
            echo '<ul><li><span class="rep-difficulty">'.$set[0].'</span></li>';
        endif;

        echo '<ul>';

        foreach ($set[1] as $itr):
            if ($itr['qty'][1] && User::isInGroup(U_GROUP_EMPLOYEE))
                $qty = intVal($itr['qty'][0]) . sprintf(Util::$dfnString, Lang::faction('customRewRate'), ($itr['qty'][1] > 0 ? '+' : '').intVal($itr['qty'][1]));
            else
                $qty = intVal(array_sum($itr['qty']));

            echo '<li><div'.($itr['qty'][0] < 0 ? ' class="reputation-negative-amount"' : null).'><span>'.$qty.'</span> '.Lang::npc('repWith') .
                ' <a href="?faction='.$itr['id'].'">'.$itr['name'].'</a>'.($itr['cap'] && $itr['qty'][0] > 0 ? '&nbsp;('.sprintf(Lang::npc('stopsAt'), $itr['cap']).')' : null).'</div></li>';
        endforeach;

        echo '</ul>';

        if (count($this->reputation) > 1):
            echo '</ul>';
        endif;
    endforeach;
endif;

if (isset($this->smartAI)):
?>
    <div id="text-generic" class="left"></div>
    <script type="text/javascript">//<![CDATA[
        Markup.printHtml("<?=$this->smartAI; ?>", "text-generic", {
            allow: Markup.CLASS_ADMIN,
            dbpage: true
        });
    //]]></script>

    <div class="pad2"></div>
<?php
endif;

if (isset($this->gossipMenu) && PageCfg::can('npc.gossip', U_GROUP_EVERYONE)):
?>
    <div id="text-gossip" class="left"></div>
    <script type="text/javascript">//<![CDATA[
        Markup.printHtml(<?=json_encode($this->gossipMenu); ?>, "text-gossip", {
            allow: Markup.CLASS_ADMIN,
            dbpage: true
        });
<?php if (!empty($this->gossipCndResult)): ?>
        (function() {
            var cndData = <?=Util::toJSON($this->gossipCndResult); ?>;
            for (var srcType in cndData) {
                for (var grpKey in cndData[srcType]) {
                    var parts  = grpKey.split(':');
                    var spanId = 'cnd-' + srcType + '-' + parts[0] + '-' + parts[1];
                    var el     = document.getElementById(spanId);
                    if (!el) continue;
                    var subset = {};
                    subset[srcType] = {};
                    subset[srcType][grpKey] = cndData[srcType][grpKey];
                    var markup = ConditionList.createCell(subset);
                    if (markup) Markup.printHtml(markup, spanId, { allow: Markup.CLASS_ADMIN, dbpage: true });
                }
            }
        })();
<?php endif; ?>
    //]]></script>

    <div class="pad2"></div>
<?php
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
