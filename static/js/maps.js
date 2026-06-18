var myMapper;

// exp-0 (Classic) has no dedicated icon in aowow
var MA_EXP = [
    { src: null },
    { src: '/images/icons/bc.gif'    },
    { src: '/images/icons/wotlk.gif' }
];

function ma_Init() {
    // Prepend static base so relative URLs resolve correctly
    MA_EXP[1].src = g_staticUrl + MA_EXP[1].src;
    MA_EXP[2].src = g_staticUrl + MA_EXP[2].src;

    // Continents — plain alphabetical list, no icons
    ma_AddOptions($WH.ge('maps-ek'), [
        1, 3, 4, 8, 10, 11, 12, 28, 33, 36, 38, 40, 41, 44, 45, 46, 47, 51,
        85, 130, 139, 267, 1497, 1519, 1537, 3430, 3433, 3487, 4080, 4298
    ]);
    ma_AddOptions($WH.ge('maps-kalimdor'), [
        14, 15, 16, 17, 141, 148, 215, 331, 357, 361, 400, 405, 406, 440, 490,
        493, 618, 1377, 1637, 1638, 1657, 3524, 3525, 3557
    ]);

    // Outland — all TBC
    ma_AddOptions($WH.ge('maps-outland'), [
        3483, 3518, 3519, 3520, 3521, 3522, 3523, 3703
    ], 1);

    // Northrend — all WotLK
    ma_AddOptions($WH.ge('maps-northrend'), [
        65, 66, 67, 210, 394, 495, 2817, 3537, 3711, 4197, 4395, 4742
    ], 2);

    // Raids — 3 columns (Classic | TBC | WotLK)
    ma_AddGroupedOptions($WH.ge('maps-raids'), [
        [0, [1977, 2677, 2717, 3428, 3429]],
        [1, [3457, 3606, 3607, 3805, 3836, 3845, 3923, 3959, 4075]],
        [2, [2159, 3456, 4273, 4493, 4500, 4603, 4722, 4812, 4987]]
    ]);

    // Dungeons — 3 columns (Classic | TBC | WotLK)
    ma_AddGroupedOptions($WH.ge('maps-dungeons'), [
        [0, [209, 491, 717, 718, 719, 721, 722, 796, 1176, 1337,
             1477, 1581, 1583, 1584, 2017, 2057, 2100, 2437, 2557]],
        [1, [2366, 2367, 3562, 3713, 3714, 3715, 3716, 3717, 3789,
             3790, 3791, 3792, 3847, 3848, 3849, 4131]],
        [2, [206, 1196, 4100, 4196, 4228, 4264, 4265, 4272, 4277,
             4415, 4416, 4494, 4723, 4809, 4813, 4820]]
    ]);

    // Battlegrounds — 3 columns (Classic | TBC | WotLK)
    ma_AddGroupedOptions($WH.ge('maps-battlegrounds'), [
        [0, [2597, 3277, 3358]],
        [1, [3820]],
        [2, [4384, 4710]]
    ]);

    myMapper = new Mapper({
        parent:      'mapper-generic',
        editable:    true,
        zoom:        1,
        onPinUpdate: ma_UpdateLink,
        onMapUpdate: ma_UpdateLink
    });

    var _ = location.href.indexOf('maps=');
    if (_ != -1) {
        _ = location.href.substr(_ + 5);
        if (myMapper.setLink(_))
            $WH.ge('mapper-wrap').style.display = '';
    }

    // JS-driven hover with delay so wide dropdowns don't flicker when
    // the cursor crosses from the nav header into a far column
    var groups = document.querySelectorAll('#maps-nav .maps-nav-group');
    var closeTimer = null;

    function openGroup(li) {
        clearTimeout(closeTimer);
        groups.forEach(function(g) { g.classList.remove('open'); });
        li.classList.add('open');
    }

    function scheduleClose(li) {
        closeTimer = setTimeout(function() { li.classList.remove('open'); }, 150);
    }

    groups.forEach(function(li) {
        li.addEventListener('mouseenter', function() {
            openGroup(li);
            // Flip dropdown left/right if it overflows the viewport
            var drop = li.querySelector('.maps-nav-dropdown');
            if (drop) {
                drop.style.left  = '0';
                drop.style.right = 'auto';
                var rect = drop.getBoundingClientRect();
                if (rect.right > window.innerWidth) {
                    drop.style.left  = 'auto';
                    drop.style.right = '0';
                }
            }
        });
        li.addEventListener('mouseleave', function() { scheduleClose(li); });

        var drop = li.querySelector('.maps-nav-dropdown');
        if (drop) {
            drop.addEventListener('mouseenter', function() { clearTimeout(closeTimer); });
            drop.addEventListener('mouseleave', function() { scheduleClose(li); });
        }
    });
}

// Build an expansion icon img, or null for Classic
function ma_ExpIcon(expIdx) {
    var src = MA_EXP[expIdx] && MA_EXP[expIdx].src;
    if (!src)
        return null;

    var img    = document.createElement('img');
    img.src    = src;
    img.className = 'maps-exp-img';
    img.alt    = '';
    return img;
}

// Flat list; pass expIdx to prepend the expansion icon
function ma_AddOptions(container, ids, expIdx) {
    ids.slice().sort(ma_Sort).forEach(function (id) {
        var name = g_zones[typeof id == 'string' ? parseInt(id) : id];
        if (!name)
            return;

        var li  = document.createElement('li');
        var a   = document.createElement('a');
        a.href  = 'javascript:;';

        a.appendChild(document.createTextNode(name));

        if (expIdx !== undefined) {
            var icon = ma_ExpIcon(expIdx);
            if (icon)
                a.appendChild(icon);
        }
        a.onclick = (function (zoneId) {
            return function () { ma_SelectZone(zoneId); return false; };
        })(id);
        li.appendChild(a);
        container.appendChild(li);
    });
}

// 3-column grouped layout — no section headers, exp icon per row
function ma_AddGroupedOptions(container, groups) {
    container.classList.add('maps-exp-grouped');

    groups.forEach(function (group) {
        var expIdx = group[0];
        var ids    = group[1].slice().sort(ma_Sort).filter(function (id) {
            return !!g_zones[typeof id == 'string' ? parseInt(id) : id];
        });

        if (!ids.length)
            return;

        var col = document.createElement('li');
        col.className = 'maps-exp-col';

        var ul = document.createElement('ul');
        ids.forEach(function (id) {
            var name = g_zones[typeof id == 'string' ? parseInt(id) : id];
            var li   = document.createElement('li');
            var a    = document.createElement('a');
            a.href   = 'javascript:;';

            a.appendChild(document.createTextNode(name));

            var icon = ma_ExpIcon(expIdx);
            if (icon)
                a.appendChild(icon);
            a.onclick = (function (zoneId) {
                return function () { ma_SelectZone(zoneId); return false; };
            })(id);
            li.appendChild(a);
            ul.appendChild(li);
        });
        col.appendChild(ul);
        container.appendChild(col);
    });
}

function ma_Sort(a, b) {
    if (typeof a == 'string') a = parseInt(a);
    if (typeof b == 'string') b = parseInt(b);
    return $WH.strcmp(g_zones[a], g_zones[b]);
}

function ma_SelectZone(id) {
    var wrap = $WH.ge('mapper-wrap');
    if (wrap.style.display == 'none')
        wrap.style.display = '';

    var centre = document.getElementById('centre-on-change').checked;
    myMapper.setZone(id, 0, !centre); // 3rd arg = noScroll

    if (centre)
        wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function ma_UpdateLink(_) {
    var b = '?maps';
    var l = _.getLink();
    if (l)
        b += '=' + l;

    $WH.ge('link-to-this-map').href = b;
}
