<!DOCTYPE html>
<html>
<head>
<?php $this->brick('head'); ?>

</head>
<body class="home<?=(User::isPremium() ? ' premium-logo' : null); ?>">
    <div id="layers"></div>
<?php
if ($this->homeTitle):
    echo "    <script>document.title = '".$this->homeTitle."';</script>\n";
endif;

if (!empty($this->featuredBox['altHomeLogo'])):
?>
    <style type="text/css">
    .home-logo {
           background: url(<?=$this->featuredBox['altHomeLogo'];?>) no-repeat center 0 !important;
           margin-bottom: 1px !important;
    }
    </style>
<?php endif; ?>
    <div class="home-wrapper">
        <h1>Aowow</h1>
        <div class="home-logo" id="home-logo"></div>

<?php $this->brick('announcement'); ?>

        <div class="home-search" id="home-search">
            <form method="get">
                <input type="text" name="search" />
            </form>
        </div>

        <div class="home-menu" id="home-menu"></div>

<?php if ($this->oneliner): ?>
<p class="home-oneliner text" id="home-oneliner"></p>

<script type="text/javascript">//<![CDATA[
Markup.printHtml('<?=$this->oneliner;?>', 'home-oneliner');
//]]></script>
<?php elseif ($this->featuredBox): ?>
       <div class="pad"></div>
<?php
endif;

if ($this->featuredBox):
?>
        <div class="home-featuredbox<?=(empty($this->featuredBox['extraWide']) ? null : ' home-featuredbox-extended'); ?>" id="home-featuredbox">
<?php if ($this->featuredBox['overlays']): ?>
            <div class="home-featuredbox-links">
<?php
        foreach ($this->featuredBox['overlays'] as $o):
                echo '                <a href="'.$o['url'].'" title="'.$o['title'].'" style="left: '.$o['left'].'px; top: 18px; width:'.$o['width'].'px; height: 160px"></a>'."\n";
                echo '                <var style="left: '.$o['left'].'px; top: 18px; width:'.$o['width'].'px; height: 160px"></var>'."\n";
        endforeach;
?>
            </div>
<?php endif; ?>
            <div class="home-featuredbox-inner text" id="news-generic"></div>
        </div>

<?php
endif;
?>
        <script type="text/javascript">//<![CDATA[
<?php
if (Lang::getLocale()->value):
    echo "            Locale.set(".Lang::getLocale()->value.");\n";
endif;
echo $this->writeGlobalVars();

if ($this->featuredBox):
    echo "            Markup.printHtml(".Util::toJSON($this->featuredBox['text']).", 'news-generic', { allow: Markup.CLASS_ADMIN });\n";
endif;
?>
        //]]></script>
    </div>

    <div class="toplinks linklist"><?php $this->brick('headerMenu'); ?></div>

    <div class="footer">
        <div class="footer-links linklist">
            <a href="?aboutus"><?=Lang::main('aboutUs'); ?></a>|<a href="https://github.com/azerothcore/aowow" target="_blank">Github</a>
        </div>
        <div class="footer-copy">
            <?=date('Y'); ?> AoWoW fork from <a href="https://github.com/Sarjuuk">Sarjuuk</a>'s <a href="https://github.com/Sarjuuk/aowow">AoWoW</a><br />
            AzerothCore rev: <?php if ($this->acRev && $this->acRev !== 'Custom build'): ?><a href="https://github.com/azerothcore/azerothcore-wotlk/commit/<?=$this->acRev; ?>"><?=$this->acRev; ?></a><?php else: ?><?=$this->acRev ?: 'Custom build'; ?><?php endif; ?>
        </div>
<?php if ($this->dbTimes): ?>
        <div class="footer-dbtimes">
            <table>
<?php if (isset($this->dbTimes['app'])): ?>
                <tr><td class="label">Last modification of AoWoW:</td><td class="value"><?=$this->dbTimes['app']; ?></td></tr>
<?php endif; ?>
<?php if (isset($this->dbTimes['aowow_db'])): ?>
                <tr><td class="label">Last modification of AoWoW DB:</td><td class="value"><?=$this->dbTimes['aowow_db']; ?></td></tr>
<?php endif; ?>
<?php if (isset($this->dbTimes['world'])): ?>
                <tr><td class="label">Last modification of World DB:</td><td class="value"><?=$this->dbTimes['world']; ?></td></tr>
<?php endif; ?>
<?php if (isset($this->dbTimes['chars'])): ?>
                <tr><td class="label">Last modification of Characters DB:</td><td class="value"><?=$this->dbTimes['chars']; ?></td></tr>
<?php endif; ?>
<?php if (isset($this->dbTimes['auth'])): ?>
                <tr><td class="label">Last modification of Auth DB:</td><td class="value"><?=$this->dbTimes['auth']; ?></td></tr>
<?php endif; ?>
            </table>
        </div>
<?php endif; ?>
    </div>

<?php $this->brick('pageTemplate'); ?>

    <noscript><div id="noscript-bg"></div><div id="noscript-text"><b><?=Lang::main('jsError'); ?></b></div></noscript>
</body>
</html>
