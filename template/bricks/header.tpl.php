<!DOCTYPE html>
<?php
// aowow: theme from the picker (cookie "aowow_theme" = "<theme>.<mode>"), printed here so the page never flashes the wrong look
$thList = ['vanilla', 'tbc', 'wotlk', 'cata', 'mop', 'wod', 'legion', 'bfa', 'shadowlands', 'dragonflight', 'tww', 'midnight', 'diablo', 'starcraft', 'hearthstone', 'overwatch', 'aowow'];
[$thName, $thMode] = array_pad(explode('.', (string)($_COOKIE['aowow_theme'] ?? '')), 2, '');
$thName = $thName == 'classic' ? 'vanilla' : $thName;
$thName = in_array($thName, $thList) ? $thName : 'wotlk';
$thMode = $thMode == 'light' ? 'light' : 'dark';
?>
<html data-ui="<?=$thName == 'aowow' ? 'classic' : 'modern'; ?>" data-theme="<?=$thName == 'aowow' ? 'wotlk' : $thName; ?>" data-mode="<?=$thMode; ?>">
<head>
<?php $this->brick('head'); ?>
</head>

<body<?=(User::isPremium() ? ' class="premium-logo"' : null); ?>>
<div id="layers"></div>
<div id="th-strip"></div>
<?php if ($this->headerLogo):  ?>
<style type="text/css">
    .header-logo {
       background: url(<?=$this->headerLogo; ?>) no-repeat center 0 !important;
       margin-bottom: 1px !important;
    }
</style>
<?php endif; ?>
<div class="layout nosidebar" id="layout">
    <div class="layout-inner" id="layout-inner">
    <div class="header" id="header">
        <div id="header-logo">
            <a class="header-logo" href="."></a>
            <h1><?=Util::htmlEscape($this->name); ?></h1>
        </div>
        <div id="th-search-slot"></div>
        <div id="th-links-slot"></div>
        <a id="th-classic-picker" href="javascript:;" class="hassubmenu">Theme</a>
    </div>
    <div id="wrapper" class="wrapper">
        <div class="toplinks linklist"><?php $this->brick('headerMenu'); ?></div>
        <div class="toptabs" id="toptabs"></div>
        <div class="topbar" id="topbar">
            <div class="topbar-search"><form action="."><a href="javascript:;"></a><input name="search" size="35" id="livesearch-generic" value="<?=Util::htmlEscape($this->search ?? ''); ?>" /></form></div>
            <div class="topbar-browse" id="topbar-browse"></div>
            <div class="topbar-buttons" id="topbar-buttons"></div>
        </div>

        <script type="text/javascript">
<?=$this->writeGlobalVars(); ?>
        </script>
