<?php $this->brick('header'); ?>

    <div class="main" id="main">
        <div class="main-precontents" id="main-precontents"></div>
        <div class="main-contents" id="main-contents">

<?php
    $this->brick('announcement');

    $this->brick('pageTemplate');
?>

            <nav id="maps-nav-wrapper">
                <ul id="maps-nav">
                    <li><a href="javascript:;" onclick="ma_SelectZone(-4); return false"><?=Lang::maps('CosmicMap'); ?></a></li>
                    <li><a href="javascript:;" onclick="ma_SelectZone(-1); return false"><?=Lang::maps('Azeroth'); ?></a></li>
                    <li class="maps-nav-group">
                        <a class="maps-nav-head" href="javascript:;" onclick="ma_SelectZone(-3); return false"><?=Lang::maps('EasternKingdoms'); ?></a>
                        <ul class="maps-nav-dropdown" id="maps-ek"></ul>
                    </li>
                    <li class="maps-nav-group">
                        <a class="maps-nav-head" href="javascript:;" onclick="ma_SelectZone(-6); return false"><?=Lang::maps('Kalimdor'); ?></a>
                        <ul class="maps-nav-dropdown" id="maps-kalimdor"></ul>
                    </li>
                    <li class="maps-nav-group">
                        <a class="maps-nav-head" href="javascript:;" onclick="ma_SelectZone(-2); return false"><?=Lang::maps('Outland'); ?></a>
                        <ul class="maps-nav-dropdown" id="maps-outland"></ul>
                    </li>
                    <li class="maps-nav-group">
                        <a class="maps-nav-head" href="javascript:;" onclick="ma_SelectZone(-5); return false"><?=Lang::maps('Northrend'); ?></a>
                        <ul class="maps-nav-dropdown" id="maps-northrend"></ul>
                    </li>
                    <li class="maps-nav-group">
                        <span class="maps-nav-head"><?=Lang::maps('Raids'); ?></span>
                        <ul class="maps-nav-dropdown" id="maps-raids"></ul>
                    </li>
                    <li class="maps-nav-group">
                        <span class="maps-nav-head"><?=Lang::maps('Dungeons'); ?></span>
                        <ul class="maps-nav-dropdown" id="maps-dungeons"></ul>
                    </li>
                    <li class="maps-nav-group">
                        <span class="maps-nav-head"><?=Lang::maps('Battlegrounds'); ?></span>
                        <ul class="maps-nav-dropdown" id="maps-battlegrounds"></ul>
                    </li>
                </ul>
            </nav>

            <div class="text">
                <div id="mapper-wrap" style="display: none">
                    <div id="mapper-controls">
                        <label class="mapper-ctrl-check">
                            <span>Scroll to map</span>
                            <input type="checkbox" id="centre-on-change" checked>
                        </label>
                        <a href="javascript:;" id="link-to-this-map" class="mapper-ctrl-link">
                            <?=Lang::maps('linkToThisMap'); ?>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                        </a>
                        <a href="javascript:;" class="mapper-ctrl-link" onclick="myMapper.setCoords([])" onmousedown="return false">
                            <?=Lang::maps('clear'); ?>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </a>
                    </div>
                    <div id="mapper">
                        <div id="mapper-generic"></div>
                    </div>
                </div>
                <script type="text/javascript">ma_Init();</script>
            </div>

        </div><!-- main-contents -->
    </div><!-- main -->

<?php $this->brick('footer'); ?>
