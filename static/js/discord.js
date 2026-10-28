/*
 * Discord Webhook page (?discord-webhook): what the site posts to Discord; staff can send a test message
 */
var AoDiscord = {
    init: function (el, cfg) {
        var html = '<div class="tf-step"><div class="tf-head">Status</div>'
            + (cfg.enabled ? '<p><span class="q2">On.</span> The site posts to a Discord channel through its webhook.</p>'
                           : cfg.set ? '<p><span class="q10">Off:</span> the webhook address in the site configuration is not a Discord webhook URL.</p>'
                                     : '<p><span class="q0">Off.</span> No webhook is set up.</p>')
            + '</div><div class="tf-step"><div class="tf-head">What is posted</div><ul class="dc-events">'
            + cfg.events.map(function (e) { return '<li class="' + (e[1] ? 'on' : '') + '"><b>' + (e[1] ? '&#10003;' : '&ndash;') + '</b> ' + e[0] + '</li>'; }).join('')
            + '</ul></div><div class="tf-step"><div class="tf-head">Setting it up</div><ol class="dc-steps">'
            + '<li>In Discord, open the channel settings, then <b>Integrations &gt; Webhooks &gt; New Webhook</b>, and copy its URL.</li>'
            + '<li>Put it in the site configuration as <code>discord_webhook</code>' + (cfg.admin ? ' (<a href="?admin=siteconfig">Site configuration</a>)' : '')
            + ', or run <code>php aowow --siteconfig</code>.</li>'
            + '<li>Choose what is posted with <code>discord_events</code>.</li></ol></div>';

        if (cfg.staff && cfg.enabled)
            html += '<div class="tf-step dc-teststep"><a href="javascript:;" class="tf-find dc-test">Send a test message</a> <span class="dc-result"></span></div>';

        el.innerHTML = html;

        var btn = el.querySelector('.dc-test');
        if (btn)
            btn.onclick = function () {
                var out = el.querySelector('.dc-result');
                out.textContent = 'Sending...';
                fetch(g_host.replace(/\/?$/, '/') + '?discord-webhook=test', { method: 'POST', credentials: 'same-origin' })
                    .then(function (r) { return r.json(); })
                    .then(function (r) { out.innerHTML = r.ok ? '<span class="q2">Sent, check the channel.</span>' : '<span class="q10">' + $WH.htmlentities(r.error || 'Failed') + '</span>'; },
                          function () { out.innerHTML = '<span class="q10">Failed.</span>'; });
            };
    }
};
