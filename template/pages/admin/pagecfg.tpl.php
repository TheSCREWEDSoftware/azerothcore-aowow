<?php $this->brick('header'); ?>

    <script type="text/javascript">
    function pcfg_save(elemId, name)
    {
        var sel    = $WH.ge("pcfg_" + elemId);
        var status = $WH.ge("pcfg_status_" + elemId);
        if (!sel || !status) return;

        var val = sel.options[sel.selectedIndex].value;

        $(status).empty().append(CreateAjaxLoader());

        new Ajax("?admin=pagecfg&action=update&key=" + encodeURIComponent(name) + "&val=" + val, {
            method: "get",
            onSuccess: function(xhr) {
                // sync value and status across all tab instances of this key
                document.querySelectorAll('[data-pcfg-name="' + name + '"]').forEach(function(s) {
                    s.value = val;
                });
                document.querySelectorAll('[data-pcfg-status="' + name + '"]').forEach(function(st) {
                    $(st).empty();
                    var a = $WH.ce("a");
                    a.className = xhr.responseText ? "icon-report" : "icon-tick";
                    g_addTooltip(a, xhr.responseText || "Saved", "q");
                    a.onclick = function() { $WH.de(this); };
                    setTimeout(function() { $WH.de(a); }, 8000);
                    $WH.ae(st, a);
                });
            }
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
