<?php $this->brick('header'); ?>

    <div class="main" id="main">
        <div class="main-precontents" id="main-precontents"></div>
        <div class="main-contents" id="main-contents">

<?php
    $this->brick('announcement');

    $this->brick('pageTemplate');
?>
            <div class="text">
                <h1><?=$this->name; ?></h1>
                <div id="tool" class="tool-<?=$this->toolId; ?>"></div>
                <script type="text/javascript">//<![CDATA[
                    <?=$this->toolInit; ?>(document.getElementById('tool'), <?=json_encode($this->config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE); ?>);
                //]]></script>
            </div>

        </div><!-- main-contents -->
    </div><!-- main -->

<?php $this->brick('footer'); ?>
