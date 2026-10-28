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
                <div id="dressing-room" class="dr"></div>
                <script type="text/javascript">//<![CDATA[
                    AoDressing.init(document.getElementById('dressing-room'), <?=json_encode($this->config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE); ?>);
                //]]></script>
            </div>

        </div><!-- main-contents -->
    </div><!-- main -->

<?php $this->brick('footer'); ?>
