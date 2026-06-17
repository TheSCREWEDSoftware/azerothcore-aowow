<?php $this->brick('header'); ?>

    <script type="text/javascript">
    function pcfg_ajax(name, val, onSuccess)
    {
        var statuses = document.querySelectorAll('[data-pcfg-status="' + name + '"]');
        statuses.forEach(function(st) { while (st.firstChild) $WH.de(st.firstChild); $WH.ae(st, CreateAjaxLoader()); });

        new Ajax("?admin=pagecfg&action=update&key=" + encodeURIComponent(name) + "&val=" + encodeURIComponent(val), {
            method: "get",
            onSuccess: function(xhr) {
                statuses.forEach(function(st) {
                    while (st.firstChild) $WH.de(st.firstChild);
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

    function pcfg_updateHeader(sel, val) {
        var header = sel.querySelector('option.pcfg-header');
        if (!header) return;
        var groups = JSON.parse(sel.getAttribute('data-pcfg-groups') || '{}');
        var intVal = parseInt(val);
        var label = groups[intVal] !== undefined ? groups[intVal] : ('Custom [' + intVal + ']');
        header.textContent = label + ' [' + intVal + ']';
        // un-hide all real options, then hide the new active one
        sel.querySelectorAll('option[value]').forEach(function(o) { o.hidden = false; });
        var activeOpt = sel.querySelector('option[value="' + intVal + '"]');
        if (activeOpt) activeOpt.hidden = true;
    }

    function pcfg_save(elemId, name)
    {
        var sel = $WH.ge("pcfg_" + elemId);
        if (!sel) return;
        var val = sel.options[sel.selectedIndex].value;
        pcfg_ajax(name, val, function() {
            document.querySelectorAll('[data-pcfg-name="' + name + '"]').forEach(function(s) {
                s.value = val;
                pcfg_updateHeader(s, val);
            });
        });
    }

    function pcfg_reset(elemId, name)
    {
        if (!confirm('Are you sure you want to reset this to its default value?'))
            return;

        pcfg_ajax(name, '', function() {
            document.querySelectorAll('[data-pcfg-name="' + name + '"]').forEach(function(s) {
                var def = s.getAttribute('data-pcfg-default');
                s.value = def;
                pcfg_updateHeader(s, def);
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
            <script type="text/javascript">
            // push "Role Builder" tab to the far right
            (function() {
                var lis = document.querySelectorAll('#tabs-generic .tabs li');
                if (lis.length < 1) return;
                var roleBuilder = lis[lis.length - 1];
                roleBuilder.style.cssFloat    = 'right';
                roleBuilder.style.marginRight = '0';
                roleBuilder.style.marginLeft  = '3px';
                roleBuilder.style.borderLeft  = '1px solid #555';
                roleBuilder.style.paddingLeft = '6px';
            })();
            </script>
            <div class="clear"></div>
        </div><!-- main-contents -->
    </div><!-- main -->

<?php $this->brick('footer'); ?>
