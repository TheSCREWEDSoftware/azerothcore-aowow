<?php $this->brick('header'); ?>

    <div class="main" id="main">
        <div class="main-precontents" id="main-precontents"></div>
        <div class="main-contents" id="main-contents">

<?php
    $this->brick('announcement');

    $this->brick('pageTemplate');
?>

        <div id="<?=$this->tcType; ?>-classes">
                <div id="<?=$this->tcType; ?>-classes-outer">
                    <div id="<?=$this->tcType; ?>-classes-inner"><p><?=($this->tcType == 'tc' ? Lang::main('chooseClass') : Lang::main('chooseFamily')) . Lang::main('colon'); ?></p></div>
                </div>
            </div>
                <div id="<?=$this->tcType; ?>-navbar" style="display:none;"></div>
            <div id="<?=$this->tcType; ?>-banner" style="display:none;"></div>
            <div id="<?=$this->tcType; ?>-itself"></div>
            <div id="<?=$this->tcType; ?>-sections" style="display:none;"></div>
            <script type="text/javascript">
                <?=$this->tcType; ?>_init();
            </script>

            <div class="clear"></div>
        </div><!-- main-contents -->
    </div><!-- main -->

<?php $this->brick('footer'); ?>
