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
                    <summary style="cursor:pointer;user-select:none;list-style:none;">&#9660; Pools Legend <button id="pool-uncheck-all" onclick="aowowToggleAllPools(this);event.stopPropagation();" style="font-size:11px;margin-left:8px;cursor:pointer;">Uncheck all</button></summary>
                    <div style="margin-top:4px;">
<?php       foreach ($this->poolLegend as $p): ?>
                        <span class="mapper-pin-<?=$p['type']; ?> pool-c-<?=$p['type']; ?> pool-toggle" data-pin-type="<?=$p['type']; ?>" data-pool="<?=$p['pool']; ?>" data-areas="<?=implode(',', $p['areas']); ?>" onclick="aowowTogglePool(this)" style="cursor:pointer;margin-right:10px;user-select:none;">Pool <?=$p['pool']; ?> [<?=$p['max']; ?> out of <?=$p['total']; ?> can be active]</span>
<?php       endforeach; ?>
                    </div>
                </details>
                <div id="pool-other-maps-tip" style="display:none;"></div>
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
                        var elsewhere = [];
                        for (var i = 0; i < entries.length; i++) {
                            var raw = entries[i].getAttribute('data-areas');
                            var areas = raw ? raw.split(',').map(Number) : [];
                            var onThisMap = (areas.length === 0 || areas.indexOf(zone) !== -1);
                            entries[i].style.display = onThisMap ? '' : 'none';
                            if (!onThisMap)
                                elsewhere.push('<span class="pool-c-' + entries[i].getAttribute('data-pin-type') +
                                    '">' + entries[i].getAttribute('data-pool') + '</span>');
                        }
                        // tip: name the pools whose nodes are only on other maps (kept in pool colour)
                        var tip = document.getElementById('pool-other-maps-tip');
                        if (tip) {
                            if (elsewhere.length) {
                                tip.innerHTML = 'Pool' + (elsewhere.length > 1 ? 's' : '') + ' ' +
                                    elsewhere.join(', ') + ' ' + (elsewhere.length > 1 ? 'are' : 'is') +
                                    ' on another map.';
                                tip.style.display = '';
                            } else {
                                tip.style.display = 'none';
                            }
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

                    // pool map: scroll to zoom, centred on the cursor (like a product-image
                    // zoom). Only the map image + pins scale; the buttons and tips live in the
                    // parent, so they stay put and always visible. Image upscales past native.
                    (function() {
                        if (typeof myMapper === 'undefined' || !myMapper.span || !myMapper.parent)
                            return;
                        var box   = myMapper.parent;        // #mapper-generic (position: relative)
                        var layer = myMapper.span;          // map background + pins
                        if (box.classList.contains('pool-zoom-on'))
                            return;
                        box.classList.add('pool-zoom-on');

                        // pull the native zoom tip out of the scaled layer so it stays fixed too
                        if (myMapper.sZoom)
                            box.appendChild(myMapper.sZoom);

                        var hint = document.createElement('div');
                        hint.className = 'pool-zoom-hint';
                        hint.textContent = 'Tip: Scroll to zoom (double-click resets)';
                        box.appendChild(hint);

                        var scale = 1, MIN = 1, MAX = 6;
                        // keep an explicit scale() at all times (never 'none') so the GPU layer
                        // isn't torn down and rebuilt on the way back to 1 — that caused a flash
                        layer.style.transform = 'scale(1)';
                        function apply() {
                            layer.style.transform = 'scale(' + scale + ')';
                            box.style.overflow    = scale > 1 ? 'hidden' : '';
                            hint.style.display    = scale > 1 ? 'none' : '';
                        }
                        // keep the point under the cursor fixed while zooming/panning
                        function originAt(e) {
                            var r = box.getBoundingClientRect();
                            if (!r.width || !r.height) return;
                            layer.style.transformOrigin =
                                ((e.clientX - r.left) / r.width  * 100) + '% ' +
                                ((e.clientY - r.top)  / r.height * 100) + '%';
                        }
                        box.addEventListener('mousemove', originAt);
                        box.addEventListener('wheel', function(e) {
                            e.preventDefault();
                            originAt(e);
                            scale = Math.max(MIN, Math.min(MAX, scale + (e.deltaY < 0 ? 0.5 : -0.5)));
                            apply();
                        }, { passive: false });
                        box.addEventListener('dblclick', function() { scale = 1; apply(); });
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
                <h3><a class="disclosure-off" onclick="return g_disclose($WH.ge('text-generic'), this)">Smart AI</a></h3>
                <div id="text-generic" class="left" style="display: none"></div>
    <script type="text/javascript">//<![CDATA[
        Markup.printHtml("<?=$this->smartAI; ?>", "text-generic", {
            allow: Markup.CLASS_ADMIN,
            dbpage: true
        });
    //]]></script>
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
