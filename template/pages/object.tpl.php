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
    if (!empty($this->poolInfo)):
        $this->brick('poolLegend');
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
