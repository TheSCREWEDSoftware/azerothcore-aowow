<?php
// aowow: spawn pool legend under the map (objects + NPCs), see static/js/pools.js and includes/components/PoolMap
if (!empty($this->poolInfo)):
    $v = fn($f) => @filemtime($f) ?: 0;
?>
                <link rel="stylesheet" type="text/css" href="<?=Cfg::get('STATIC_URL'); ?>/css/pools.css?<?=$v('static/css/pools.css'); ?>" />
                <div id="pool-panel"></div>
                <script type="text/javascript" src="<?=Cfg::get('STATIC_URL'); ?>/js/pools.js?<?=$v('static/js/pools.js'); ?>"></script>
                <script type="text/javascript">//<![CDATA[
                    PoolLegend.init(<?=Util::toJSON($this->poolInfo); ?>);
                //]]></script>
<?php
endif;
?>
