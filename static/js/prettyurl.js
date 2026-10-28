/*
 * aowow: readable links in the address bar
 *
 *   ?item=35797                  ->  item=35797/drakurus-elixir
 *   ?item=35797 (Russian page)   ->  ru/item=35797/эликсир-дракуру
 *
 * Only detail pages (type=id with a name) are rewritten, and only when nothing else is in the query.
 * The server side is in .htaccess (rewrite to index.php?type=id&urlloc=xx) and includes/kernel.php (urlloc).
 */
(function () {
    var run = function () {
        if (typeof g_host == 'undefined' || !window.history || !history.replaceState)
            return;

        var base = g_host.replace(/^[a-z]+:\/\/[^\/]+/i, '').replace(/\/?$/, '/');   // "/aowow/"
        if (location.pathname.indexOf(base) !== 0)
            return;

        // language of the page as path prefix (en, fr, de, es, ru, cn - English has none)
        var dom    = (typeof Locale != 'undefined' && Locale.current && Locale.current.domain) || 'en';
        var prefix = dom != 'en' ? dom + '/' : '';

        // the logo goes home in the same language
        var logo = document.querySelector('a.header-logo');
        if (logo)
            logo.setAttribute('href', base + prefix);

        // what is shown: ?item=123 (legacy) or item=123[/name] in the path
        var path = location.pathname.substr(base.length).replace(/^(en|fr|de|es|ru|cn|ko|tw|mx)(\/|$)/, '');
        var call = location.search ? location.search.substr(1) : path.split('/')[0];
        var m    = /^([a-z-]+)=(-?\d+)$/.exec(call);
        if (!m)
            return;

        // detail pages only: the page knows its own id and name
        var info = window.g_pageInfo;
        if (!info || !info.name || info.typeId != m[2])
            return;

        var slug = String(info.name).toLocaleLowerCase()
            .replace(/['’`]/g, '')
            .replace(/[^0-9a-zÀ-ɏͰ-ϿЀ-ӿ぀-ヿ㐀-鿿가-힯]+/g, '-')
            .replace(/^-+|-+$/g, '');

        var url = base + prefix + m[1] + '=' + m[2] + (slug ? '/' + encodeURIComponent(slug) : '') + location.hash;
        if (url != location.pathname + location.search + location.hash)
            history.replaceState(history.state, '', url);
    };

    if (document.readyState == 'loading')
        document.addEventListener('DOMContentLoaded', run);
    else
        run();
})();
