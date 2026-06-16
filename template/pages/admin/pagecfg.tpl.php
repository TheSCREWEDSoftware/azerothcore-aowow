<?php $this->brick('header'); ?>

    <script type="text/javascript">
    function pcfg_ajax(name, val, onSuccess)
    {
        var statuses = document.querySelectorAll('[data-pcfg-status="' + name + '"]');
        statuses.forEach(function(st) { $(st).empty().append(CreateAjaxLoader()); });

        new Ajax("?admin=pagecfg&action=update&key=" + encodeURIComponent(name) + "&val=" + encodeURIComponent(val), {
            method: "get",
            onSuccess: function(xhr) {
                statuses.forEach(function(st) {
                    $(st).empty();
                    var a = $WH.ce("a");
                    a.className = xhr.responseText ? "icon-report" : "icon-tick";
                    g_addTooltip(a, xhr.responseText || "Saved", "q");
                    a.onclick = function() { $WH.de(this); };
                    setTimeout(function() { $WH.de(a); }, 8000);
                    $WH.ae(st, a);
                });
                if (!xhr.responseText && onSuccess) onSuccess();
            }
        });
    }

    function pcfg_save(elemId, name)
    {
        var sel = $WH.ge("pcfg_" + elemId);
        if (!sel) return;
        var val = sel.options[sel.selectedIndex].value;
        pcfg_ajax(name, val, function() {
            // sync dropdown across all tabs
            document.querySelectorAll('[data-pcfg-name="' + name + '"]').forEach(function(s) { s.value = val; });
        });
    }

    function pcfg_reset(elemId, name)
    {
        pcfg_ajax(name, '', function() {
            // snap all selects back to data-pcfg-default
            document.querySelectorAll('[data-pcfg-name="' + name + '"]').forEach(function(s) {
                s.value = s.getAttribute('data-pcfg-default');
            });
        });
    }
    </script>

    <div class="main" id="main">
        <div class="main-precontents" id="main-precontents"></div>
        <div class="main-contents" id="main-contents">

<?php
    $this->brick('announcement');
    $this->brick('pageTemplate');
    $this->brick('lvTabs');
?>
            <div class="clear"></div>
        </div><!-- main-contents -->
    </div><!-- main -->

<?php $this->brick('footer'); ?>
