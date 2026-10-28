<?php $this->brick('header'); ?>

    <div class="main" id="main">
        <div class="main-precontents" id="main-precontents"></div>
        <div class="main-contents" id="main-contents">

<?php
    $this->brick('announcement');

    $this->brick('pageTemplate');

    if ($this->notFound):
?>
            <div class="pad3"></div>
            <div class="inputbox">
                <h1><?=$this->notFound['title']; ?></h1>
                <div id="inputbox-error"><?=$this->notFound['msg']; ?></div>
                <div class="clear"></div>
            </div>
<?php
    else:
?>
            <div class="text">
                <h1><?=$this->name; ?></h1>
                <div id="outfit-view" class="outfit-view"></div>
                <script type="text/javascript">//<![CDATA[
                    AoDressing.outfit(document.getElementById('outfit-view'), <?=json_encode($this->info, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE); ?>);
                //]]></script>

                <h2 class="clear"><?=Lang::outfit('similar'); ?></h2>
                <?=$this->similar; ?>
            </div>
<?php
    endif;
?>
        </div><!-- main-contents -->
    </div><!-- main -->

<?php $this->brick('footer'); ?>
