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

<?php
$this->brick('article');

if ($this->relBoss):
    echo "                <div>".sprintf(Lang::gameObject('npcLootPH'), $this->name, $this->relBoss[0], $this->relBoss[1])."</div>\n";
    echo '                <div class="pad"></div>';
endif;

if (!empty($this->map)):
    $this->brick('mapper');
    if (!empty($this->poolLegend)):
?>
                <details id="pool-legend" open style="margin:4px 0 8px;font-size:12px;">
                    <summary style="cursor:pointer;user-select:none;list-style:none;"><button id="pool-uncheck-all" onclick="aowowToggleAllPools(this);event.stopPropagation();" style="font-size:11px;margin-right:6px;cursor:pointer;">Uncheck all</button>&#9660; Pools Legend</summary>
                    <div style="margin-top:4px;">
<?php       foreach ($this->poolLegend as $p): ?>
                        <span class="mapper-pin-<?=$p['type']; ?> pool-toggle" data-pin-type="<?=$p['type']; ?>" data-areas="<?=implode(',', $p['areas']); ?>" onclick="aowowTogglePool(this)" style="cursor:pointer;margin-right:10px;user-select:none;">Pool <?=$p['pool']; ?> [<?=$p['max']; ?> out of <?=$p['total']; ?> can be active]</span>
<?php       endforeach; ?>
                    </div>
                </details>
                <script type="text/javascript">//<![CDATA[
                    function aowowToggleAllPools(btn) {
                        // only act on entries currently visible in this zone (not hidden by zone filter)
                        var entries = Array.prototype.filter.call(
                            document.querySelectorAll('#pool-legend .pool-toggle'),
                            function(e) { return e.style.display !== 'none'; }
                        );
                        var allOff = entries.every(function(e) { return e.classList.contains('pool-toggle-off'); });
                        entries.forEach(function(e) {
                            var n = e.getAttribute('data-pin-type');
                            var pins = document.querySelectorAll('#mapper-generic .pin-' + n);
                            if (allOff) {
                                e.classList.remove('pool-toggle-off');
                                for (var i = 0; i < pins.length; i++) pins[i].style.display = '';
                            } else {
                                e.classList.add('pool-toggle-off');
                                for (var i = 0; i < pins.length; i++) pins[i].style.display = 'none';
                            }
                        });
                        btn.textContent = allOff ? 'Uncheck all' : 'Check all';
                    }

                    function aowowTogglePool(el) {
                        var n = el.getAttribute('data-pin-type');
                        var hidden = el.classList.toggle('pool-toggle-off');
                        var pins = document.querySelectorAll('#mapper-generic .pin-' + n);
                        for (var i = 0; i < pins.length; i++)
                            pins[i].style.display = hidden ? 'none' : '';
                        aowowSyncBtn();
                    }

                    function aowowReapplyPinVisibility() {
                        var entries = document.querySelectorAll('#pool-legend .pool-toggle');
                        for (var i = 0; i < entries.length; i++) {
                            var n = entries[i].getAttribute('data-pin-type');
                            var hidden = entries[i].classList.contains('pool-toggle-off');
                            var pins = document.querySelectorAll('#mapper-generic .pin-' + n);
                            for (var j = 0; j < pins.length; j++)
                                pins[j].style.display = hidden ? 'none' : '';
                        }
                    }

                    function aowowSyncBtn() {
                        var btn = document.getElementById('pool-uncheck-all');
                        if (!btn) return;
                        var visible = Array.prototype.filter.call(
                            document.querySelectorAll('#pool-legend .pool-toggle'),
                            function(e) { return e.style.display !== 'none'; }
                        );
                        var allOff = visible.length > 0 && visible.every(function(e) { return e.classList.contains('pool-toggle-off'); });
                        btn.textContent = allOff ? 'Check all' : 'Uncheck all';
                    }

                    function aowowFilterPoolLegend(zone) {
                        var entries = document.querySelectorAll('#pool-legend .pool-toggle');
                        for (var i = 0; i < entries.length; i++) {
                            var raw = entries[i].getAttribute('data-areas');
                            var areas = raw ? raw.split(',').map(Number) : [];
                            entries[i].style.display = (areas.length === 0 || areas.indexOf(zone) !== -1) ? '' : 'none';
                        }
                        // pins are re-rendered on zone change — re-apply any active toggle states
                        aowowReapplyPinVisibility();
                        aowowSyncBtn();
                    }

                    // hook into mapper zone changes
                    (function() {
                        var _upd = myMapper.update.bind(myMapper);
                        myMapper.update = function(opts) {
                            _upd(opts);
                            if (opts && opts.zone) aowowFilterPoolLegend(opts.zone);
                        };
                        // apply to the zone that was already selected on page load
                        if (myMapper.zone) aowowFilterPoolLegend(myMapper.zone);
                    })();
                //]]></script>
<?php
    endif;
else:
    echo Lang::gameObject('unkPosition');
endif;

$this->brick('book');

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
