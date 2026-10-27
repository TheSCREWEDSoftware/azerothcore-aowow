/*
 * aowow: theme picker + modern header
 *
 * The chosen theme is kept in the cookie "aowow_theme" ("<theme>.<mode>") so the server can print it on <html>
 * (no flash of the wrong colours) and in localStorage as a fallback.
 */

var Theme = new function () {
    var self = this;

    // [id, short label, colour, group, full name (menu), expansion icon (static/images/icons/expansions/)]   group: 'wow' | 'game' (menu column)
    this.list = [
        ['aowow',        'Classic AoWoW', '#d33a2c', 'wow',  'Classic AoWoW',          null        ],
        ['vanilla',      'Vanilla',       '#d2a64b', 'wow',  'Vanilla (Classic)',      null        ],
        ['tbc',          'TBC',           '#4cc23a', 'wow',  'The Burning Crusade',    'bc.gif'    ],
        ['wotlk',        'WotLK',         '#3ba7e3', 'wow',  'Wrath of the Lich King', 'wotlk.gif' ],
        ['cata',         'Cata',          '#e8622c', 'wow',  'Cataclysm',              'cata.gif'  ],
        ['mop',          'MoP',           '#2fb37b', 'wow',  'Mists of Pandaria',      'mop.png'   ],
        ['wod',          'WoD',           '#b5763e', 'wow',  'Warlords of Draenor',    'wod.png'   ],
        ['legion',       'Legion',        '#8fd82b', 'wow',  'Legion',                 'legion.png'],
        ['bfa',          'BfA',           '#2f6fd6', 'wow',  'Battle for Azeroth',     'bfa.png'   ],
        ['shadowlands',  'Shadowlands',   '#9fb6d8', 'wow',  'Shadowlands',            'sl.png'    ],
        ['dragonflight', 'Dragonflight',  '#d64a5a', 'wow',  'Dragonflight',           'df.png'    ],
        ['tww',          'The War Within','#e0a640', 'wow',  'The War Within',         'tww.png'   ],
        ['midnight',     'Midnight',      '#8a5cf0', 'wow',  'Midnight',               'midnight.png'],
        ['diablo',       'Diablo',        '#c8301e', 'game', 'Diablo',                 null        ],
        ['starcraft',    'StarCraft',     '#1fc6e0', 'game', 'StarCraft',              null        ],
        ['hearthstone',  'Hearthstone',   '#f0a12a', 'game', 'Hearthstone',            null        ],
        ['overwatch',    'Overwatch',     '#f99e1a', 'game', 'Overwatch',              null        ]
    ];
    this.def = 'wotlk';

    var COOKIE = 'aowow_theme';

    function byId(id) {
        for (var i = 0; i < self.list.length; i++)
            if (self.list[i][0] == id)
                return self.list[i];
        return null;
    }

    this.get = function () {
        var h = document.documentElement;
        return { theme: h.getAttribute('data-ui') == 'classic' ? 'aowow' : (h.getAttribute('data-theme') || self.def), mode: h.getAttribute('data-mode') || 'dark' };
    };

    function store(theme, mode) {
        var v = theme + '.' + mode;
        document.cookie = COOKIE + '=' + v + '; path=/; max-age=31536000; SameSite=Lax';
        try { window.localStorage.setItem(COOKIE, v); } catch (e) {}
    }

    function apply(theme, mode) {
        var h = document.documentElement;
        h.setAttribute('data-ui', theme == 'aowow' ? 'classic' : 'modern');
        h.setAttribute('data-theme', theme == 'aowow' ? self.def : theme);
        h.setAttribute('data-mode', mode);
    }

    this.set = function (theme, mode) {
        var cur = self.get();
        theme = byId(theme) ? theme : cur.theme;
        mode  = mode == 'light' ? 'light' : (mode == 'dark' ? 'dark' : cur.mode);
        store(theme, mode);

        // switching between the classic and the modern layout rebuilds the header: reload
        if ((theme == 'aowow') != (cur.theme == 'aowow')) {
            location.reload();
            return;
        }

        apply(theme, mode);
        renderControls();
    };

    // no server value yet (first visit after an update, or cookie blocked): take localStorage
    this.boot = function () {
        var h = document.documentElement;
        if (h.getAttribute('data-ui'))
            return;

        var v = null;
        try { v = window.localStorage.getItem(COOKIE); } catch (e) {}
        var p = (v || '').split('.');
        if (p[0] == 'classic')
            p[0] = 'vanilla';
        apply(byId(p[0]) ? p[0] : self.def, p[1] == 'light' ? 'light' : 'dark');
    };

    // one column per group; hovering an entry previews it, leaving the menu goes back to the saved theme
    function themeMenu() {
        var cur = self.get(), menu = [];
        var groups = [['wow', 'World of Warcraft'], ['game', 'Other games']];
        groups.forEach(function (g, gi) {
            menu.push([, g[1], null, null, gi ? { colBreak: true } : {}]);
            self.list.forEach(function (t) {
                if (t[3] != g[0])
                    return;
                var item = [t[0], t[4] || t[1], function () { previewing = null; self.set(t[0]); }, null, { className: 'th-pick th-pick-' + t[0] }];
                if (t[0] == cur.theme)
                    item.checked = true;
                menu.push(item);
            });
        });
        return menu;
    }

    var previewing = null;                                  // saved theme while a preview is shown

    function preview(id) {
        var t = byId(id);
        if (!t || id == 'aowow')                            // the classic layout needs a reload: no live preview
            return unpreview();
        if (!previewing)
            previewing = self.get();
        if (previewing.theme == 'aowow')
            return;
        document.documentElement.setAttribute('data-theme', id);
    }

    function unpreview() {
        if (!previewing)
            return;
        if (previewing.theme != 'aowow')
            document.documentElement.setAttribute('data-theme', previewing.theme);
        previewing = null;
    }

    if (typeof $ != 'undefined') {
        $(document)
            .on('mouseenter', '.menu a.th-pick', function () {
                var m = /th-pick-(\w+)/.exec(this.className);
                if (m)
                    preview(m[1]);
            })
            .on('mouseleave', '.menu', function () { setTimeout(function () { if (!$('.menu a.th-pick:hover').length) unpreview(); }, 50); });
    }

    // menu entries: name in the theme's colour, expansion icon on the right
    function menuStyles() {
        if (document.getElementById('th-menu-style'))
            return;
        var css = '';
        self.list.forEach(function (t) {
            css += '.menu a.th-pick-' + t[0] + ' span { color: ' + t[2] + '; }\n';
            if (t[5])
                css += '.menu a.th-pick-' + t[0] + ' span { padding-right: 84px; background: url(' + g_staticUrl + '/images/icons/expansions/' + t[5] + ') right center no-repeat !important; }\n';
        });
        css += '.menu a.th-pick:hover span, .menu a.th-pick.checked span { filter: brightness(1.25); }\n';
        var st = document.createElement('style');
        st.id = 'th-menu-style';
        st.textContent = css;
        document.head.appendChild(st);
    }

    // header controls: "Theme" menu + light / dark switch (next to the account links)
    function renderControls() {
        menuStyles();
        var cur = self.get();

        var box = document.getElementById('th-tools');
        if (!box) {
            var header = document.getElementById('header');
            if (!header)
                return;
            box = document.createElement('div');
            box.id = 'th-tools';
            header.insertBefore(box, document.getElementById('th-links-slot'));
        }
        box.innerHTML = '';

        var active = byId(cur.theme);
        var pick = document.createElement('a');
        pick.href = 'javascript:;';
        pick.className = 'th-btn hassubmenu';
        // current theme: its short name, then the expansion logo (or a colour dot)
        pick.innerHTML = '<span>' + (active ? active[1] : 'Theme') + '</span>' + (active && active[5]
            ? '<img src="' + g_staticUrl + '/images/icons/expansions/' + active[5] + '" alt="" />'
            : '<i style="background:' + (active ? active[2] : '#888') + '"></i>');
        if (typeof Menu != 'undefined')
            Menu.add($(pick), themeMenu());
        box.appendChild(pick);

        var mode = document.createElement('a');
        mode.href = 'javascript:;';
        mode.className = 'th-btn th-mode';
        mode.title = cur.mode == 'light' ? 'Dark mode' : 'Light mode';
        mode.textContent = cur.mode == 'light' ? '☾' : '☀';
        mode.onclick = function () { self.set(null, cur.mode == 'light' ? 'dark' : 'light'); };
        box.appendChild(mode);

        var cp = document.getElementById('th-classic-picker');
        if (cp && typeof Menu != 'undefined' && !cp._th) {
            cp._th = true;
            Menu.add($(cp), themeMenu());
        }
    }

    // modern layout: search and account links move into the header row (same elements, handlers stay attached)
    function arrangeHeader() {
        if (document.documentElement.getAttribute('data-ui') != 'modern')
            return;

        var search = document.querySelector('#topbar .topbar-search');
        var sSlot  = document.getElementById('th-search-slot');
        if (search && sSlot)
            sSlot.appendChild(search);

        var links  = document.querySelector('#wrapper > .toplinks');
        var lSlot  = document.getElementById('th-links-slot');
        if (links && lSlot)
            lSlot.appendChild(links);
    }

    // the accent line under the page title is as wide as the title text
    function fitTitleAccent() {
        var h1 = document.querySelector('.text h1');
        if (!h1 || !document.createRange)
            return;

        var fit = function () {
            var w = 0, left = h1.getBoundingClientRect().left;
            Array.prototype.forEach.call(h1.childNodes, function (n) {   // text only: not the star / buttons inside
                if (n.nodeType != 3 || !n.textContent.trim())
                    return;
                var r = document.createRange();
                r.selectNodeContents(n);
                w = Math.max(w, Math.ceil(r.getBoundingClientRect().right - left));
            });
            h1.style.backgroundSize = (w > 0 ? w : 64) + 'px 2px';
        };
        fit();
        if (document.fonts && document.fonts.ready)         // web fonts change the width once loaded
            document.fonts.ready.then(fit);
        window.addEventListener('resize', fit);
    }

    this.init = function () {
        arrangeHeader();
        renderControls();
        fitTitleAccent();
    };
};

Theme.boot();
if (typeof $ != 'undefined')
    $(document).ready(Theme.init);
else
    document.addEventListener('DOMContentLoaded', Theme.init);
