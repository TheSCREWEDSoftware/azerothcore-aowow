var myMapper;

// exp-0 (Classic) has no dedicated icon in aowow
var MA_EXP = [
    { src: null },
    { src: '/images/icons/bc.gif'    },
    { src: '/images/icons/wotlk.gif' }
];

function ma_Init() {
    ma_ReadHashOptions();

    // Prepend static base so relative URLs resolve correctly
    MA_EXP[1].src = g_staticUrl + MA_EXP[1].src;
    MA_EXP[2].src = g_staticUrl + MA_EXP[2].src;

    // Continents — alphabetical, expansion icon on the newer zones (g_map_info.exp)
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
        onMapUpdate: ma_OnMapUpdate
    });

    ma_InitZoneShapes();

    var _ = location.href.split('#')[0].indexOf('maps=');
    if (_ != -1) {
        _ = location.href.split('#')[0].substr(_ + 5);
        if (myMapper.setLink(_))
            $WH.ge('mapper-wrap').style.display = '';
    }

    ma_InitChooseHint();
    ma_InitPois();
    ma_InitZoom();
    ma_InitUrlSync();
    ma_InitGoCommand();

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

        // continents mix old and new zones (Silvermoon, The Exodar, ..): fall back to the zone's own expansion
        var exp = expIdx !== undefined ? expIdx : ((typeof g_map_info != 'undefined' && g_map_info.exp[id]) || 0);
        var icon = ma_ExpIcon(exp);
        if (icon)
            a.appendChild(icon);
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

    var cols = [];   // { el, count } for each rendered column

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
        cols.push({ el: col, count: ids.length });
    });

    // Assign each vertical seam to exactly one column — the taller of the two
    // neighbours (ties go to the left). That column draws the shared border, so
    // it stays a single 1px line (never doubled/thick) and it spans the taller
    // column, so the shorter neighbour's cells are still edged. The outermost
    // left/right edges are always drawn.
    cols.forEach(function (c, i) {
        var leftCount  = i > 0               ? cols[i - 1].count : -1;
        var rightCount = i < cols.length - 1 ? cols[i + 1].count : -1;

        if (i === 0 || c.count > leftCount)                 // owns left seam / outer left
            c.el.classList.add('mec-bl');
        if (i === cols.length - 1 || c.count >= rightCount) // owns right seam / outer right
            c.el.classList.add('mec-br');
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

function ma_OnMapUpdate(_) {
    ma_ZoomOnMapChange(_);
    ma_UpdateLink(_);
    ma_DrawZoneShapes(_);
    ma_DrawPois(_);
    ma_UpdateTitle(_);
    ma_UpdateBack(_);
    ma_UpdateChooseHint(_);
}

function ma_UpdateLink(_) {
    var b = '?maps';
    var l = _.getLink();
    if (l)
        b += '=' + l;

    b += ma_OptionsHash();
    $WH.ge('link-to-this-map').href = b;

    ma_SyncUrl(_, b);
}

/*  map options in the url hash (the ?maps= part is parsed by Mapper.setLink and must stay untouched):
 *    #o=<shown marker types, '.' separated>&c=<level colours 0|1>&b=<faction icons 0|1>
 */
var ma_hashOpts = null;

function ma_ReadHashOptions() {
    var h = location.hash.replace(/^#/, '');
    if (!h)
        return;

    var o = {};
    h.split('&').forEach(function (kv) {
        var p = kv.split('=');
        o[p[0]] = decodeURIComponent(p[1] || '');
    });
    ma_hashOpts = o;
}

function ma_OptionsHash() {
    if (typeof MA_POI_TYPES == 'undefined' || !MA_POI_TYPES.length || !Object.keys(ma_poiOn).length)
        return '';

    var on = MA_POI_TYPES.filter(function (t) { return ma_poiOn[t[0]] && t[0] != 'm-lc'; }).map(function (t) { return t[0]; });
    return '#o=' + on.join('.') + '&c=' + (ma_zsColored ? 1 : 0) + '&b=' + (ma_poiOn.badges ? 1 : 0) + '&m=1';
}


/*  Address bar follows the map: switching maps / floors adds a history entry (so Back / Forward walk through
 *  the maps you viewed), pin changes just update the current one.
 */

var ma_urlReady   = false;                                  // only after the initial ?maps= link was applied
var ma_urlPopping = false;
var ma_urlMapKey  = null;

function ma_InitUrlSync() {
    if (!window.history || !history.replaceState)
        return;

    ma_urlReady = true;
    if (parseInt(myMapper.zone))
        ma_UpdateLink(myMapper);

    window.addEventListener('popstate', function (e) {
        var href = ((e.state && e.state.maps) || location.search).split('#')[0];
        var i    = href.indexOf('maps=');
        if (i == -1)
            return;

        ma_urlPopping = true;
        if (myMapper.setLink(href.substr(i + 5), true))
            $WH.ge('mapper-wrap').style.display = '';
        ma_urlPopping = false;
    });
}

function ma_SyncUrl(mapper, href) {
    if (!ma_urlReady || !parseInt(mapper.zone))
        return;

    var key   = mapper.zone + '.' + mapper.level;
    var state = { maps: href };

    if (ma_urlMapKey !== null && key != ma_urlMapKey && !ma_urlPopping)
        history.pushState(state, '', href);
    else if (location.search + location.hash != href || !history.state)
        history.replaceState(state, '', href);

    ma_urlMapKey = key;
}


/*  Alt+click: GM teleport command for the clicked spot -> clipboard
 *    zone maps      : .go zonexy <x> <y> <zoneId>   (the server picks the ground height)
 *    continent maps : the zone under the cursor is found via its outline and the click converted into its map coords
 */

var MA_GO_CONTINENTS = [-3, -6, -2, -5];

function ma_InitGoCommand() {
    var ctrl = $WH.ge('mapper-controls');
    if (ctrl) {
        var box = document.createElement('div');
        box.id = 'zs-go';
        box.innerHTML = '<span class="zs-go-hint">Alt+click map: copy .go command</span>';

        var inp = document.createElement('input');
        inp.type     = 'text';
        inp.readOnly = true;
        inp.id       = 'zs-go-cmd';
        inp.placeholder = '.go zonexy x y zone';
        inp.onfocus  = function () { this.select(); };
        box.appendChild(inp);

        // above "Show on map"
        var anchor = $WH.ge('zs-legend');
        ctrl.insertBefore(box, anchor && anchor.parentNode == ctrl ? anchor : null);
    }

    ma_InitGoHistory();

    // capture on the mapper's parent so it runs before the pin / zone click handlers
    myMapper.parent.addEventListener('mouseup', function (e) {
        if (!e.altKey || e.button)
            return;

        e.stopPropagation();
        e.preventDefault();

        var r = myMapper.span.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width  * 100;
        var y = (e.clientY - r.top)  / r.height * 100;
        if (x < 0 || x > 100 || y < 0 || y > 100)
            return;

        ma_GoCommand(e, x, y);
    }, true);

    // Alt+mousedown would start a drag/selection in some browsers
    myMapper.parent.addEventListener('mousedown', function (e) {
        if (e.altKey && !e.button)
            e.preventDefault();
    }, true);
}

function ma_IsOutdoorZone(zoneId) {
    if (typeof g_zone_shapes == 'undefined')
        return false;

    for (var i = 0; i < MA_GO_CONTINENTS.length; i++)
        if (g_zone_shapes[MA_GO_CONTINENTS[i]] && g_zone_shapes[MA_GO_CONTINENTS[i]][zoneId])
            return true;

    return false;
}

function ma_PointInShape(x, y, rings) {
    var inside = false;
    for (var r = 0; r < rings.length; r++) {
        var p = rings[r];
        for (var i = 0, j = p.length - 2; i < p.length; j = i, i += 2)
            if (((p[i + 1] > y) != (p[j + 1] > y)) && (x < (p[j] - p[i]) * (y - p[i + 1]) / (p[j + 1] - p[i + 1]) + p[i]))
                inside = !inside;
    }
    return inside;
}

// zone outline under a point on a continent map; smallest wins (capital cities sit on top of their zone)
function ma_ZoneAt(contId, x, y) {
    var shapes = (typeof g_zone_shapes != 'undefined') ? g_zone_shapes[contId] : null, best = null, bestArea = 0;
    for (var id in shapes || {}) {
        var e = shapes[id];
        if (!e.r || !ma_PointInShape(x, y, e.p))
            continue;

        var area = 0;
        for (var i = 0; i < e.p.length; i++)
            area += ma_RingArea(e.p[i]);

        if (!best || area < bestArea) {
            best = parseInt(id);
            bestArea = area;
        }
    }
    return best;
}

function ma_GoCommand(e, x, y) {
    var zone = parseInt(myMapper.zone), cmd = null, err = null;

    if (zone > 0) {
        if (Mapper.multiLevelZones[zone] || !ma_IsOutdoorZone(zone))
            err = 'Instance / multi-floor map: .go zonexy only works in the open world';
        else
            cmd = '.go zonexy ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' ' + zone;
    }
    else if (MA_GO_CONTINENTS.indexOf(zone) != -1) {
        var z = ma_ZoneAt(zone, x, y);
        if (!z)
            err = 'No zone here';
        else {
            var r  = g_zone_shapes[zone][z].r;
            var zx = (x - r[0]) / (r[2] - r[0]) * 100;
            var zy = (y - r[1]) / (r[3] - r[1]) * 100;
            cmd = '.go zonexy ' + Math.min(100, Math.max(0, zx)).toFixed(2) + ' ' + Math.min(100, Math.max(0, zy)).toFixed(2) + ' ' + z;
        }
    }
    else
        err = 'Alt+click a continent or zone map';

    var inp = $WH.ge('zs-go-cmd');
    if (cmd && inp)
        inp.value = cmd;

    if (cmd) {
        ma_CopyText(cmd, function (ok) {
            ma_GoToast(e, ok ? 'Copied: ' + cmd : cmd, false);
        });
        ma_GoHistoryAdd(cmd, zone > 0 ? zone : ma_ZoneAt(zone, x, y));
    }
    else
        ma_GoToast(e, err, true);
}

function ma_CopyText(text, cb) {
    var fallback = function () {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity  = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (x) {}
        document.body.removeChild(ta);
        cb(ok);
    };

    if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(text).then(function () { cb(true); }, fallback);
    else
        fallback();
}

function ma_GoToast(e, text, isError) {
    var wrap = $WH.ge('mapper-wrap');
    var t = $WH.ge('zs-go-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'zs-go-toast';
        wrap.appendChild(t);
    }

    var wr = wrap.getBoundingClientRect();
    t.className   = isError ? 'zs-go-error' : '';
    t.textContent = text;
    t.style.left  = (e.clientX - wr.left + 12) + 'px';
    t.style.top   = (e.clientY - wr.top  - 28) + 'px';
    t.style.display = 'block';

    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.style.display = 'none'; }, 2200);
}


/*  Zone shapes
 *  Clickable outlines computed once by `php aowow --build=zoneshapes` from the client's map textures:
 *    ?data=zone-shapes : g_zone_shapes    = { mapZoneId: { areaId: { p: [[x,y,..], ..], l: [min, max] } } }
 *                                           world (-1), cosmic (-4) and the four continents; % of map size
 *                        g_zone_subshapes = [zoneId, ..] zone maps with subzone outlines in js/zone-shapes/<zoneId>.json
 *    ?data=zone-names  : g_zone_shape_names = { areaId: name } (localized; subzones)
 *  On world / cosmic / continent maps an outline opens that map. On zone maps subzone outlines only label the area,
 *  so clicks still place pins.
 */

var MA_ZS_SVGNS = 'http://www.w3.org/2000/svg';
var MA_ZS_STORE = 'aowow_maps_levelcolors';

// level brackets by a zone's minimum level; [minLevel, colour, label]
var MA_ZS_BANDS = [
    [ 1, '#2f9e44', '1-9'  ],
    [10, '#82c91e', '10-19'],
    [20, '#fcc419', '20-29'],
    [30, '#fd7e14', '30-39'],
    [40, '#e03131', '40-49'],
    [50, '#ae3ec9', '50-57'],
    [58, '#3b5bdb', '58-67'],
    [68, '#15aabf', '68-80']
];
var MA_ZS_CITY = ['#f1e6c8', 'City'];

// which continents make up a map without own level data (world map entries / cosmic worlds)
var MA_ZS_CHILDREN = { '-1': [-3, -6, -5] };

var ma_zsColored = true;
var ma_zsSubCache = {};

function ma_InitZoneShapes() {
    try {
        var v = window.localStorage.getItem(MA_ZS_STORE);
        if (v !== null)
            ma_zsColored = v == '1';
    } catch (e) {}
    if (ma_hashOpts && ma_hashOpts.c !== undefined)
        ma_zsColored = ma_hashOpts.c == '1';

    var ctrl = $WH.ge('mapper-controls');
    if (!ctrl)
        return;

    // "Level colours" lives with the other map options below the map (ma_InitPois)

    var legend = document.createElement('div');
    legend.id = 'zs-legend';
    ctrl.appendChild(legend);

    ma_DrawZoneShapes(myMapper, true);
}

function ma_ZoneName(id) {
    id = parseInt(id);
    if (typeof g_zones != 'undefined' && g_zones[id])
        return g_zones[id];
    if (typeof g_zone_shape_names != 'undefined' && g_zone_shape_names[id])
        return g_zone_shape_names[id];

    // continents / worlds: take the (localized) label of the nav entry
    var links = document.querySelectorAll('#maps-nav a');
    for (var i = 0; i < links.length; i++)
        if ((links[i].getAttribute('onclick') || '').indexOf('ma_SelectZone(' + id + ')') != -1)
            return links[i].textContent.replace(/^\s+|\s+$/g, '');

    return '#' + id;
}

function ma_IsSanctuary(l) {
    return l && l[0] <= 1 && l[1] >= 70;
}

// level range of a continent / world from the zones on it
function ma_AggregateLevels(id) {
    var maps = MA_ZS_CHILDREN[id] || [id], min = 0, max = 0;
    for (var i = 0; i < maps.length; i++) {
        var shapes = (typeof g_zone_shapes != 'undefined') ? g_zone_shapes[maps[i]] : null;
        for (var z in shapes || {}) {
            var l = shapes[z].l;
            if (!l || ma_IsSanctuary(l))
                continue;
            min = min ? Math.min(min, l[0]) : l[0];
            max = Math.max(max, l[1]);
        }
    }
    return max ? [min, max] : null;
}

function ma_ZoneBand(levels) {
    if (!levels)
        return null;

    if (ma_IsSanctuary(levels))
        return { color: MA_ZS_CITY[0], label: MA_ZS_CITY[1], idx: MA_ZS_BANDS.length };

    for (var i = MA_ZS_BANDS.length - 1; i >= 0; i--)
        if (levels[0] >= MA_ZS_BANDS[i][0])
            return { color: MA_ZS_BANDS[i][1], label: MA_ZS_BANDS[i][2], idx: i };

    return { color: MA_ZS_BANDS[0][1], label: MA_ZS_BANDS[0][2], idx: 0 };
}

function ma_RingArea(r) {
    var a = 0;
    for (var i = 0, n = r.length; i < n; i += 2) {
        var j = (i + 2) % n;
        a += r[i] * r[j + 1] - r[j] * r[i + 1];
    }
    return Math.abs(a / 2);
}

function ma_RemoveZoneShapes(mapper) {
    $WH.Tooltip.hide();

    ['_zsNb', '_zsSvg', '_zsNbLabels', '_zsSubLabels', '_zsPois'].forEach(function (k) {
        if (mapper[k] && mapper[k].parentNode)
            mapper[k].parentNode.removeChild(mapper[k]);
        mapper[k] = null;
    });
}

// keeps our layers at the bottom of the mapper span in a fixed order: neighbours (1) < subzones / zones (2) < icons (3) < labels (4)
function ma_InsertLayer(mapper, el, order) {
    el.setAttribute('data-zs-order', order);

    var ref = mapper.span.firstChild;
    while (ref && ref.getAttribute && ref.getAttribute('data-zs-order') !== null && parseFloat(ref.getAttribute('data-zs-order')) <= order)
        ref = ref.nextSibling;

    mapper.span.insertBefore(el, ref);
}

function ma_DrawZoneShapes(mapper, force) {
    if (!mapper || !mapper.span)
        return;

    var zone = parseInt(mapper.zone);
    if (!force && mapper._zsZone === zone)
        return;

    mapper._zsZone = zone;
    ma_RemoveZoneShapes(mapper);

    var legend = $WH.ge('zs-legend');
    if (legend)
        legend.innerHTML = '';

    if (!zone)                                              // nothing selected yet
        return;

    if (zone < 0) {
        var shapes = (typeof g_zone_shapes != 'undefined') ? g_zone_shapes[zone] : null;
        if (shapes)
            ma_RenderZoneShapes(mapper, shapes, false);
        return;
    }

    // zone maps: subzones + neighbouring zones (both fetched on demand)
    var hasSubs = !Mapper.multiLevelZones[zone] && typeof g_zone_subshapes != 'undefined' && g_zone_subshapes.indexOf(zone) != -1;
    var pending = 2;
    var done = function () {
        if (--pending || parseInt(mapper.zone) !== zone || mapper._zsSvg || mapper._zsNb)
            return;

        ma_RenderNeighbours(mapper, zone, ma_zsNbCache[zone] || []);
        if (ma_zsSubCache[zone])
            ma_RenderZoneShapes(mapper, ma_zsSubCache[zone], true);
    };

    ma_LoadJson(hasSubs ? g_staticUrl + '/js/zone-shapes/' + zone + '.json' : null, ma_zsSubCache, zone, done);
    ma_LoadJson(Mapper.multiLevelZones[zone] ? null : g_staticUrl + '/js/zone-nb/' + zone + '.json', ma_zsNbCache, zone, done);
}

var ma_zsNbCache = {};

// fetch a json file once; cb() is always called (also on errors / without url)
function ma_LoadJson(url, cache, key, cb) {
    if (!url || cache[key] !== undefined) {
        cb();
        return;
    }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onload = function () {
        cache[key] = null;
        if (xhr.status == 200)
            try { cache[key] = JSON.parse(xhr.responseText); } catch (e) {}
        cb();
    };
    xhr.onerror = function () { cache[key] = null; cb(); };
    xhr.send();
}

function ma_RenderZoneShapes(mapper, shapes, isSub) {
    var legend = $WH.ge('zs-legend');

    var svg = document.createElementNS(MA_ZS_SVGNS, 'svg');
    svg.setAttribute('class', 'zs-layer' + (ma_zsColored ? ' zs-colored' : ''));
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');

    // big areas first, so nested ones (capital cities) end up on top
    var order = [];
    for (var id in shapes) {
        var area = 0;
        for (var i = 0; i < shapes[id].p.length; i++)
            area += ma_RingArea(shapes[id].p[i]);
        order.push([id, area]);
    }
    order.sort(function (a, b) { return b[1] - a[1]; });

    var usedBands = {}, links = [];
    for (var k = 0; k < order.length; k++) {
        var areaId = order[k][0];
        var entry  = shapes[areaId];
        var band   = isSub ? null : ma_ZoneBand(entry.l);
        var d      = '';

        for (var r = 0; r < entry.p.length; r++) {
            var ring = entry.p[r];
            d += 'M' + ring[0] + ' ' + ring[1];
            for (var j = 2; j < ring.length; j += 2)
                d += 'L' + ring[j] + ' ' + ring[j + 1];
            d += 'Z';
        }

        var path = document.createElementNS(MA_ZS_SVGNS, 'path');
        path.setAttribute('d', d);
        var isLink = isSub && ma_FindContinent(areaId) !== null;    // subzone with its own map (capital cities)
        path.setAttribute('class', 'zs-zone' + (isSub ? ' zs-sub' + (isLink ? ' zs-link' : '') : (band ? '' : ' zs-plain')));
        if (isLink)
            links.push([parseInt(areaId), entry, path]);
        path.setAttribute('fill-rule', 'evenodd');
        path.setAttribute('vector-effect', 'non-scaling-stroke');
        if (band) {
            path.style.setProperty('--zs-c', band.color);
            usedBands[band.idx] = band;
        }

        ma_BindZoneShape(path, parseInt(areaId), entry, isSub);
        svg.appendChild(path);
    }

    // below pins and other overlays, above the map image
    ma_InsertLayer(mapper, svg, 2);
    mapper._zsSvg = svg;

    // labels for subzones that open their own map, same style as the neighbouring zones
    if (links.length) {
        var box = document.createElement('div');
        box.className = 'zs-nb-labels';
        links.forEach(function (lk) {
            var big = lk[1].p[0];
            lk[1].p.forEach(function (rg) { if (ma_RingArea(rg) > ma_RingArea(big)) big = rg; });
            var cx = 0, cy = 0, n = big.length / 2;
            for (var i = 0; i < big.length; i += 2) { cx += big[i]; cy += big[i + 1]; }
            cx = Math.min(98, Math.max(2, cx / n));
            cy = Math.min(95, Math.max(5, cy / n));

            var lbl = document.createElement('a');
            lbl.href      = 'javascript:;';
            lbl.className = 'zs-nb-label';
            lbl.style.left = cx + '%';
            lbl.style.top  = cy + '%';
            lbl.style.transform = 'translate(-' + cx.toFixed(1) + '%, -50%)';
            lbl.innerHTML  = '<b>' + ma_ZoneName(lk[0]) + '</b>' + (lk[1].l ? '<span>' + ma_LevelShort(lk[0], lk[1].l) + '</span>' : '') + '<i>&rsaquo;</i>';
            box.appendChild(lbl);

            ma_BindNeighbour([lbl], lk[2], lk[0], lk[1].l, ma_ZoneName(mapper.zone));
        });
        ma_InsertLayer(mapper, box, 4);
        mapper._zsSubLabels = box;
    }

    if (legend && ma_zsColored) {
        var html = '';
        for (var b = 0; b <= MA_ZS_BANDS.length; b++)
            if (usedBands[b])
                html += '<span class="zs-legend-item"><i style="background:' + usedBands[b].color + '"></i>' + usedBands[b].label + '</span>';
        legend.innerHTML = html;
    }
}

function ma_BindZoneShape(path, areaId, entry, isSub) {
    var tip = '<b class="q">' + ma_ZoneName(areaId) + '</b>';

    var ownMap = isSub && ma_FindContinent(areaId) !== null;  // e.g. Shattrath City inside Terokkar Forest

    if (isSub) {
        if (entry.l)
            tip += '<br /><span class="q2">' + ma_LevelText(entry.l, areaId) + '</span>';
        tip += '<br /><span class="q0">' + ma_ZoneName(myMapper.zone) + (ownMap ? ' &middot; click to open map' : '') + '</span>';
    }
    else {
        var l = entry.l || ma_AggregateLevels(areaId);
        if (l)
            tip += '<br /><span class="q2">' + (entry.l ? ma_LevelText(l, areaId) : 'Level ' + l[0] + ' - ' + l[1]) + '</span>';
        tip += ma_TerritoryLine(areaId);
        tip += '<br /><span class="q0">Click to open map &middot; Shift+click to place a pin</span>';
    }

    path.onmouseover = function (e) { $WH.Tooltip.showAtCursor(e || window.event, tip, 0, 0, 'q'); };
    path.onmousemove = function (e) { $WH.Tooltip.cursorUpdate(e || window.event); };
    path.onmouseout  = function ()  { $WH.Tooltip.hide(); };

    if (isSub && !ownMap)                                   // subzones: let the mapper place pins
        return;

    if (ownMap) {                                           // city inside this zone: same tooltip as its label
        ma_BindNeighbour([path], path, areaId, entry.l, ma_ZoneName(myMapper.zone));
        return;
    }

    if (ownMap)
        path.style.cursor = 'pointer';

    // the mapper places pins on mouseup - swallow it unless shift is held
    path.onmouseup = function (e) {
        e = e || window.event;
        if (e.shiftKey || (e.button && e.button >= 2))
            return;

        if (e.stopPropagation)
            e.stopPropagation();
        e.cancelBubble = true;

        $WH.Tooltip.hide();
        ma_SelectZone(areaId);
        return false;
    };
}


/*  Neighbouring zones on a zone map
 *  Zone maps show a bit of the surrounding zones. Their outlines from the continent map are projected into this
 *  zone map (via the zone rects stored with the continent outlines), cut by the current zone's own outline, and
 *  act as buttons to the neighbouring zone's map, each with a small name / level label.
 */

function ma_FindContinent(zone) {
    for (var i = 0; i < MA_GO_CONTINENTS.length; i++) {
        var c = g_zone_shapes[MA_GO_CONTINENTS[i]];
        if (c && c[zone] && c[zone].r)
            return MA_GO_CONTINENTS[i];
    }
    return null;
}

function ma_RingsToPath(rings) {
    var d = '';
    for (var r = 0; r < rings.length; r++) {
        var ring = rings[r];
        d += 'M' + ring[0].toFixed(2) + ' ' + ring[1].toFixed(2);
        for (var j = 2; j < ring.length; j += 2)
            d += 'L' + ring[j].toFixed(2) + ' ' + ring[j + 1].toFixed(2);
        d += 'Z';
    }
    return d;
}

// capital cities carry a 1-80 range; name them by their territory instead
function ma_CityText(zoneId) {
    var t = (typeof g_map_info != 'undefined' && zoneId) ? g_map_info.terr[zoneId] : undefined;
    return t === 0 ? 'Alliance city' : (t === 1 ? 'Horde city' : (t === 3 ? 'Sanctuary' : 'City'));
}

function ma_LevelText(l, zoneId) {
    if (!l)
        return '';
    if (ma_IsSanctuary(l))
        return ma_CityText(zoneId);
    return l[0] == l[1] ? 'Level ' + l[0] : 'Level ' + l[0] + ' - ' + l[1];
}

function ma_LevelShort(zoneId, l) {
    return ma_IsSanctuary(l) ? ma_CityText(zoneId) : l[0] + '-' + l[1];
}

function ma_RenderNeighbours(mapper, zone, list) {
    if (!list || !list.length || typeof g_zone_shapes == 'undefined')
        return;

    var cont = ma_FindContinent(zone);
    var all  = cont !== null ? g_zone_shapes[cont] : {};

    var svg = document.createElementNS(MA_ZS_SVGNS, 'svg');
    svg.setAttribute('class', 'zs-layer zs-nb-layer');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');

    var labels = document.createElement('div');
    labels.className = 'zs-nb-labels';

    var mapW = mapper.span.offsetWidth  || Mapper.sizes[mapper.zoom][0];
    var mapH = mapper.span.offsetHeight || Mapper.sizes[mapper.zoom][1];
    var placed = [];
    var ARROW  = { n: '&uarr;', s: '&darr;', w: '&larr;', e: '&rarr;' };

    // areas first (bigger labels get the better spots), then edge buttons
    list.slice().sort(function (a, b) { return (a.p ? 0 : 1) - (b.p ? 0 : 1); }).forEach(function (nb) {
        var lvl  = all[nb.z] ? all[nb.z].l : null;
        var path = null;

        if (nb.p) {
            path = document.createElementNS(MA_ZS_SVGNS, 'path');
            path.setAttribute('d', ma_RingsToPath(nb.p));
            path.setAttribute('class', 'zs-zone zs-nb');
            path.setAttribute('fill-rule', 'evenodd');
            path.setAttribute('vector-effect', 'non-scaling-stroke');
            svg.appendChild(path);
        }

        var pos  = nb.p ? nb.lp : nb.e;
        var text = ma_ZoneName(nb.z) + (lvl ? ' ' + ma_LevelShort(nb.z, lvl) : '');
        var w = text.length * 6.4 + (nb.p ? 34 : 44), h = 20;

        // nudge away from labels placed before
        var lx = Math.min(98, Math.max(2, pos[0])), ly = Math.min(95, Math.max(5, pos[1]));
        for (var tries = 0; tries < 12; tries++) {
            var bx = lx / 100 * mapW - lx / 100 * w, by = ly / 100 * mapH - h / 2;
            var box = [bx - 3, by - 2, bx + w + 3, by + h + 2], hit = false;
            for (var k = 0; !hit && k < placed.length; k++)
                hit = !(box[2] < placed[k][0] || box[0] > placed[k][2] || box[3] < placed[k][1] || box[1] > placed[k][3]);
            if (!hit)
                break;
            ly = Math.min(95, Math.max(5, ly + (tries % 2 ? -1 : 1) * (tries + 1) * (h + 4) / mapH * 100));
        }
        placed.push(box);

        var lbl = document.createElement('a');
        lbl.href      = 'javascript:;';
        lbl.className = 'zs-nb-label' + (nb.p ? '' : ' zs-nb-edge zs-nb-edge-' + nb.d);
        lbl.style.left = lx + '%';
        lbl.style.top  = ly + '%';
        lbl.style.transform = 'translate(-' + lx.toFixed(1) + '%, -50%)';
        lbl.innerHTML  = (!nb.p && (nb.d == 'w' || nb.d == 'n') ? '<i>' + ARROW[nb.d] + '</i>' : '') +
                         '<b>' + ma_ZoneName(nb.z) + '</b>' + (lvl ? '<span>' + ma_LevelShort(nb.z, lvl) + '</span>' : '') +
                         (nb.p ? '<i>&rsaquo;</i>' : (nb.d == 'e' || nb.d == 's' ? '<i>' + ARROW[nb.d] + '</i>' : ''));
        labels.appendChild(lbl);

        ma_BindNeighbour(path ? [path, lbl] : [lbl], path, nb.z, lvl);
    });

    ma_InsertLayer(mapper, svg, 1);
    ma_InsertLayer(mapper, labels, 4);
    mapper._zsNb       = svg;
    mapper._zsNbLabels = labels;
}

function ma_BindNeighbour(els, path, zoneId, levels, hint) {
    var tip = '<b class="q">' + ma_ZoneName(zoneId) + '</b>';
    if (levels)
        tip += '<br /><span class="q2">' + ma_LevelText(levels, zoneId) + '</span>';
    tip += ma_TerritoryLine(zoneId);
    tip += '<br /><span class="q0">' + (hint || 'Another area') + ' &middot; click to open map</span>';

    els.forEach(function (el) {
        el.onmouseover = function (e) {
            if (path)
                path.classList.add('zs-hover');
            $WH.Tooltip.showAtCursor(e || window.event, tip, 0, 0, 'q');
        };
        el.onmousemove = function (e) { $WH.Tooltip.cursorUpdate(e || window.event); };
        el.onmouseout  = function () {
            if (path)
                path.classList.remove('zs-hover');
            $WH.Tooltip.hide();
        };
        el.onmouseup   = function (e) {
            e = e || window.event;
            if (e.shiftKey || (e.button && e.button >= 2))
                return;

            if (e.stopPropagation)
                e.stopPropagation();
            e.cancelBubble = true;

            $WH.Tooltip.hide();
            ma_SelectZone(zoneId);
            return false;
        };
        el.onclick = function () { return false; };
    });
}


/*  Map icons (Questie-like) + faction relations
 *  generated by `php aowow --build=mappois`:
 *    js/zone-pois/<locale>/<mapZoneId>.json : [{t, x, y, n, s?, r?: [A, H], id?, z?, l?, c?}, ..]
 *    ?data=map-info                         : g_map_info = {exp: {zoneId: 1|2}, terr: {zoneId: 0..5}}
 */

var MA_POI_STORE  = 'aowow_maps_poi';
var MA_POI_GSTORE = 'aowow_maps_poi_groups';

// [group, open by default, [[type, label, on by default], ..]] - mirrors Questie's townsfolk menus
var MA_POI_GROUPS = [
    ['Map', true, [
        ['m-lc',    'Level colours',      true ],
        ['m-zb',    'Zone borders',       true ],
        ['m-sb',    'Subzone borders',    true ],
        ['m-nb',    'Map transitions',    true ],
        ['m-zn',    'Zone names',         true ]
    ]],
    ['Townsfolk', true, [
        ['ah',      'Auctioneer',     true ],
        ['bank',    'Banker',         false],
        ['barber',  'Barber',         false],
        ['bm',      'Battlemaster',   false],
        ['class',   'Class Trainer',  false],
        ['fm',      'Flight Master',  true ],
        ['inn',     'Innkeeper',      false],
        ['mail',    'Mailbox',        false],
        ['rep',     'Repair',         false],
        ['ride',    'Riding Trainer', false],
        ['sh',      'Spirit Healer',  true ],
        ['stable',  'Stable Master',  false],
        ['wm',      'Weapon Master',  false]
    ]],
    ['Professions', false, [
        ['p-alch',  'Alchemy',        false],
        ['p-bs',    'Blacksmithing',  false],
        ['p-ench',  'Enchanting',     false],
        ['p-eng',   'Engineering',    false],
        ['p-herb',  'Herbalism',      false],
        ['p-insc',  'Inscription',    false],
        ['p-jc',    'Jewelcrafting',  false],
        ['p-lw',    'Leatherworking', false],
        ['p-mine',  'Mining',         false],
        ['p-skin',  'Skinning',       false],
        ['p-tail',  'Tailoring',      false],
        ['p-cook',  'Cooking',        false],
        ['p-aid',   'First Aid',      false],
        ['p-fish',  'Fishing',        false]
    ], [['Primary', 0], ['Secondary', 11]]],
    ['Vendors', false, [
        ['v-drink',   'Drink',        false],
        ['v-food',    'Food',         false],
        ['v-potion',  'Potions',      false],
        ['v-ammo',    'Ammo',         false],
        ['v-bags',    'Bags',         false],
        ['v-poison',  'Poisons',      false],
        ['v-reagent', 'Reagents',     false],
        ['v-trade',   'Trade Goods',  false]
    ], [['Consumables', 0], ['Supplies', 3]]],
    ['Travel', true, [
        ['boat',    'Boats',               true],
        ['zep',     'Zeppelins',           true],
        ['gun',     'Gunships',            true],
        ['portal',  'Portals & crossings', true],
        ['route',   'Transport routes',    true]
    ]],
    ['Locations', true, [
        ['stone',   'Meeting Stones',     true ],
        ['dg',      'Dungeon Locations',  true ],
        ['rd',      'Raid Locations',     true ],
        ['qh',      'Quest hubs',         false],
        ['pvp',     'World PvP',          true ],
        ['terr',    'Faction relations',  true ]
    ]]
];

var MA_POI_TYPES = [];
var MA_POI_LABEL = {};
MA_POI_GROUPS.forEach(function (g) {
    g[2].forEach(function (t) {
        MA_POI_TYPES.push(t);
        MA_POI_LABEL[t[0]] = t[1];
    });
});

// game item / spell icons already served by aowow
var MA_POI_GAMEICON = {
    'ride':   'ability_mount_ridinghorse',
    'p-alch': 'trade_alchemy',        'p-bs':   'trade_blacksmithing',  'p-ench': 'trade_engraving',      'p-eng':  'trade_engineering',
    'p-herb': 'trade_herbalism',      'p-insc': 'inv_inscription_tradeskill01', 'p-jc': 'inv_misc_gem_01',  'p-lw':   'trade_leatherworking',
    'p-mine': 'trade_mining',         'p-skin': 'inv_misc_pelt_wolf_01', 'p-tail': 'trade_tailoring',     'p-cook': 'inv_misc_food_15',
    'p-aid':  'spell_holy_sealofsacrifice', 'p-fish': 'trade_fishing',
    'v-bags': 'inv_misc_bag_08',      'v-drink': 'inv_drink_07',        'v-potion': 'inv_potion_51',      'v-trade': 'inv_fabric_silk_01'
};

var MA_TERRITORY = ['Alliance territory', 'Horde territory', 'Contested territory', 'Sanctuary', 'PvP zone', 'World PvP zone'];

// game icons (Interface/Minimap/Tracking, TargetingFrame, WorldStateFrame, GossipFrame) + Questie's instance / meeting stone / rez icons
function ma_PoiIcon(t, p) {
    if (MA_POI_GAMEICON[t])
        return g_staticUrl + '/images/wow/icons/medium/' + MA_POI_GAMEICON[t] + '.jpg';

    if (t == 'route')
        return g_staticUrl + '/images/wow/maps/poi/boat-n.png';

    if (t == 'boat' || t == 'zep' || t == 'gun') {          // anchor / zeppelin (gunships: airships too) in the faction's colour
        var r = p && p.r ? p.r : [0, 0];
        if (t == 'gun')
            t = 'zep';
        t += r[0] > 0 && r[1] < 0 ? '-a' : (r[1] > 0 && r[0] < 0 ? '-h' : '-n');
    }

    return g_staticUrl + '/images/wow/maps/poi/' + t + '.png';
}

var ma_poiOn    = {};
var ma_poiCache = {};

// map display options are page classes the CSS hides things with (shapes stay hoverable / clickable)
function ma_ApplyDisplay() {
    var el = document.body;
    ['zb', 'sb', 'nb', 'zn'].forEach(function (k) {
        el.classList.toggle('zs-hide-' + k, ma_poiOn['m-' + k] === false);
    });
}

function ma_InitPois() {
    MA_POI_TYPES.forEach(function (t) { ma_poiOn[t[0]] = t[2]; });
    ma_poiOn.badges = true;                                 // "Show Faction Icons"
    var openGroups = {};
    MA_POI_GROUPS.forEach(function (g) { openGroups[g[0]] = g[1]; });
    try {
        var v = JSON.parse(window.localStorage.getItem(MA_POI_STORE) || 'null');
        if (v)
            for (var k in v)
                if (k in ma_poiOn)
                    ma_poiOn[k] = !!v[k];
        var o = JSON.parse(window.localStorage.getItem(MA_POI_GSTORE) || 'null');
        if (o)
            for (var k2 in o)
                if (k2 in openGroups)
                    openGroups[k2] = !!o[k2];
    } catch (e) {}

    if (ma_hashOpts) {
        if (ma_hashOpts.o !== undefined) {
            var shown = ma_hashOpts.o ? ma_hashOpts.o.split('.') : [];
            var oldLink = ma_hashOpts.m === undefined;     // &m=1 marks links that carry the map options
            MA_POI_TYPES.forEach(function (t) {
                if (t[0] == 'm-lc' || (oldLink && t[0].indexOf('m-') == 0))   // links made before the map options keep the defaults
                    return;
                ma_poiOn[t[0]] = shown.indexOf(t[0]) != -1;
            });
        }
        if (ma_hashOpts.b !== undefined)
            ma_poiOn.badges = ma_hashOpts.b == '1';
    }

    ma_poiOn['m-lc'] = ma_zsColored;
    ma_ApplyDisplay();

    var ctrl = $WH.ge('mapper-controls');
    if (!ctrl)
        return;

    var box = document.createElement('div');
    box.id = 'zs-poi';
    box.innerHTML = '<span class="zs-go-hint">Show on map</span>';

    var save = function () {
        try { window.localStorage.setItem(MA_POI_STORE, JSON.stringify(ma_poiOn)); } catch (e) {}
    };

    // faction badges on the markers
    var bl = document.createElement('label');
    bl.className = 'zs-poi-opt zs-poi-badgeopt';
    var bc = document.createElement('input');
    bc.type    = 'checkbox';
    bc.checked = ma_poiOn.badges;
    bc.onchange = function () {
        ma_poiOn.badges = this.checked;
        save();
        ma_DrawPois(myMapper, true);
        ma_UpdateLink(myMapper);
    };
    bl.appendChild(bc);
    bl.insertAdjacentHTML('beforeend', '<span>Show Faction Icons</span><img class="zs-poi-swatch" src="' + ma_PoiIcon('fa') + '" alt="" /><img class="zs-poi-swatch" src="' + ma_PoiIcon('fh') + '" alt="" />');
    box.appendChild(bl);

    var refreshers = [];
    var applyChange = function (terr) {
        save();
        refreshers.forEach(function (f) { f(); });
        if (ma_zsColored != ma_poiOn['m-lc']) {
            ma_zsColored = ma_poiOn['m-lc'];
            try { window.localStorage.setItem(MA_ZS_STORE, ma_zsColored ? '1' : '0'); } catch (e) {}
            terr = true;
        }
        ma_ApplyDisplay();
        if (terr)                                           // redrawing the zone shapes clears the marker layers, so it goes first
            ma_DrawZoneShapes(myMapper, true);
        ma_DrawPois(myMapper, true);
        ma_UpdateLink(myMapper);
    };
    var setTypes = function (types, on) {
        types.forEach(function (t) { ma_poiOn[t[0]] = on; });
        applyChange(types.some(function (t) { return t[0] == 'terr'; }));
    };
    // tri-state box for a set of types; inside a <summary> the click default must be cancelled so the group doesn't fold
    var triBox = function (types, cls) {
        var cb = document.createElement('input');
        cb.type  = 'checkbox';
        cb.title = 'All / none';
        cb.className = cls;
        cb.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            setTypes(types, !types.every(function (t) { return ma_poiOn[t[0]]; }));
        });
        var upd = function () {
            var n = types.filter(function (t) { return ma_poiOn[t[0]]; }).length;
            // preventDefault reverts the box after the handler, so set the state on the next tick too
            var set = function () { cb.checked = n == types.length; cb.indeterminate = n > 0 && n < types.length; };
            set();
            setTimeout(set, 0);
            return n;
        };
        return [cb, upd];
    };

    // select / deselect everything
    var bar = document.createElement('span');
    bar.className = 'zs-poi-bar';
    var poiTypes = MA_POI_TYPES.filter(function (t) { return t[0].indexOf('m-') != 0; });
    [['Select all', true], ['Deselect all', false], ['Default', null]].forEach(function (b) {
        var btn = document.createElement('a');
        btn.href = 'javascript:;';
        btn.className = 'zs-poi-btn';
        btn.textContent = b[0];
        btn.title = b[1] === null ? 'Back to the default selection' : '';
        btn.onclick = function () {
            if (b[1] !== null)
                return setTypes(poiTypes, b[1]);

            poiTypes.forEach(function (t) { ma_poiOn[t[0]] = t[2]; });   // on by default, see MA_POI_GROUPS
            ma_poiOn.badges = true;
            bc.checked = true;
            applyChange(true);
        };
        bar.appendChild(btn);
    });
    box.firstChild.appendChild(bar);

    MA_POI_GROUPS.forEach(function (g) {
        // map options stay in the side panel, below "Scroll to map"
        if (g[0] == 'Map') {
            var after = ctrl.querySelector('.mapper-ctrl-check');
            g[2].forEach(function (t, i) {
                var ml = document.createElement('label');
                ml.className = 'mapper-ctrl-check zs-mapopt' + (i < g[2].length - 1 ? ' zs-mapopt-mid' : '');
                ml.innerHTML = '<span>' + t[1] + '</span>';
                var mc = document.createElement('input');
                mc.type    = 'checkbox';
                mc.checked = ma_poiOn[t[0]];
                mc.onchange = function () {
                    ma_poiOn[t[0]] = this.checked;
                    applyChange(false);
                };
                refreshers.push(function () { mc.checked = ma_poiOn[t[0]]; });
                ml.appendChild(mc);
                ctrl.insertBefore(ml, after ? after.nextSibling : ctrl.firstChild);
                after = ml;
            });
            return;
        }

        var det = document.createElement('details');
        det.className = 'zs-poi-group';
        det.open = openGroups[g[0]];
        det.ontoggle = function () {
            openGroups[g[0]] = det.open;
            try { window.localStorage.setItem(MA_POI_GSTORE, JSON.stringify(openGroups)); } catch (e) {}
        };

        var sum   = document.createElement('summary');
        var count = document.createElement('i');
        var all   = triBox(g[2], 'zs-poi-all');
        sum.appendChild(all[0]);
        var title = document.createElement('span');
        title.textContent = g[0];
        sum.appendChild(title);
        sum.appendChild(count);
        det.appendChild(sum);

        var boxes = [];
        refreshers.push(function () {
            var n = all[1]();
            count.textContent = n ? n + '/' + g[2].length : '';
            boxes.forEach(function (b) { b[0].checked = ma_poiOn[b[1]]; });
        });

        var subs = g[3] || [];
        g[2].forEach(function (t, i) {
            subs.forEach(function (sg, j) {
                if (sg[1] != i)
                    return;
                var types = g[2].slice(i, j + 1 < subs.length ? subs[j + 1][1] : g[2].length);
                var hd  = document.createElement('label');
                hd.className = 'zs-poi-sub';
                var sb  = triBox(types, 'zs-poi-all');
                refreshers.push(sb[1]);
                hd.appendChild(sb[0]);
                hd.insertAdjacentHTML('beforeend', '<span>' + sg[0] + '</span>');
                det.appendChild(hd);
            });

            var lbl = document.createElement('label');
            lbl.className = 'zs-poi-opt' + (subs.length ? ' zs-poi-opt-sub' : '');

            var chk = document.createElement('input');
            chk.type    = 'checkbox';
            chk.checked = ma_poiOn[t[0]];
            chk.onchange = function () {
                ma_poiOn[t[0]] = this.checked;
                applyChange(t[0] == 'terr');
            };
            boxes.push([chk, t[0]]);

            lbl.appendChild(chk);
            lbl.insertAdjacentHTML('beforeend', '<span>' + t[1] + '</span>' + (t[0].indexOf('m-') == 0 ? '' : MA_POI_GAMEICON[t[0]]
                ? '<i class="zs-spell zs-poi-swatch"><img src="' + ma_PoiIcon(t[0]) + '" alt="" /></i>'
                : '<img class="zs-poi-swatch" src="' + ma_PoiIcon(t[0] == 'terr' ? 'ta' : t[0]) + '" alt="" />'));
            det.appendChild(lbl);
        });

        box.appendChild(det);
    });

    refreshers.forEach(function (f) { f(); });

    // the filters get their own full-width panel below the map
    var wrap = $WH.ge('mapper-wrap');
    if (wrap && wrap.parentNode)
        wrap.parentNode.insertBefore(box, wrap.nextSibling);
    else
        ctrl.appendChild(box);
}

function ma_ReactHtml(r) {
    if (!r)
        return '';
    var c = function (v) { return v < 0 ? 'q10' : (v > 0 ? 'q2' : 'q'); };
    return '<span class="' + c(r[0]) + '">A</span> <span class="' + c(r[1]) + '">H</span>';
}

function ma_TerritoryLine(zoneId) {
    if (!ma_poiOn.terr || typeof g_map_info == 'undefined' || g_map_info.terr[zoneId] === undefined)
        return '';

    var t = g_map_info.terr[zoneId];
    var r = [[1, -1], [-1, 1], [0, 0], [1, 1], [-1, -1], [-1, -1]][t] || null;
    return '<br /><span class="q1">' + MA_TERRITORY[t] + '</span> &nbsp;' + ma_ReactHtml(r);
}

function ma_PoiKey(t) {
    return (t == 'ta' || t == 'th') ? 'terr' : t;
}

function ma_DrawPois(mapper, force) {
    if (!mapper || !mapper.span)
        return;

    var zone = parseInt(mapper.zone);
    if (!force && mapper._zsPoiZone === zone)
        return;

    mapper._zsPoiZone = zone;
    ma_DrawRoutes(mapper);
    if (mapper._zsPois && mapper._zsPois.parentNode)
        mapper._zsPois.parentNode.removeChild(mapper._zsPois);
    mapper._zsPois = null;

    if (!zone || zone == -1 || zone == -4 || Mapper.multiLevelZones[zone])
        return;

    var render = function (list) {
        if (parseInt(mapper.zone) !== zone || mapper._zsPois)
            return;

        var layer = document.createElement('div');
        layer.className = 'zs-pois' + (zone < 0 ? ' zs-pois-cont' : '');

        list.forEach(function (p) {
            if (!ma_poiOn[ma_PoiKey(p.t)])
                return;

            var a = document.createElement('a');
            a.href = 'javascript:;';
            a.className = 'zs-poi zs-poi-' + p.t + (MA_POI_GAMEICON[p.t] ? ' zs-poi-sq' : '');
            a.style.left = p.x + '%';
            a.style.top  = p.y + '%';
            a.innerHTML  = (MA_POI_GAMEICON[p.t] ? '<i class="zs-spell"><img src="' + ma_PoiIcon(p.t, p) + '" alt="" draggable="false" /></i>' : '<img src="' + ma_PoiIcon(p.t, p) + '" alt="" draggable="false" />') + ma_PoiBadges(p);
            ma_BindPoi(a, p);
            layer.appendChild(a);
        });

        ma_InsertLayer(mapper, layer, 3);
        mapper._zsPois = layer;
    };

    if (ma_poiCache[zone]) {
        render(ma_poiCache[zone]);
        return;
    }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', g_staticUrl + '/js/zone-pois/' + Locale.getName() + '/' + zone + '.json');
    xhr.onload = function () {
        if (xhr.status != 200)
            return;
        try { ma_poiCache[zone] = JSON.parse(xhr.responseText); } catch (e) { return; }
        render(ma_poiCache[zone]);
    };
    xhr.send();
}

/*  transport routes: dashed line along the taxi path in the faction's colour, arrows show the direction of travel
 *  (static/js/zone-routes/<zone>.json, only for maps listed in g_map_info.rt)
 */
var ma_routeCache = {};

// hovering a transport line: what runs there, between where, how long a loop takes
// (ship / stops / timings come from the route itself, or from the dock markers that sit on the line)
function ma_RouteDist(rt, px, py) {                         // distance of a point to the route's polyline
    var best = Infinity;
    rt.l.forEach(function (l) {
        for (var i = 2; i < l.length; i += 2) {
            var ax = l[i - 2], ay = l[i - 1], dx = l[i] - ax, dy = l[i + 1] - ay;
            var f = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
            best = Math.min(best, Math.hypot(px - ax - f * dx, py - ay - f * dy));
        }
    });
    return best;
}

// docks of a line: same kind and faction, close to it - and closer to it than to any other line (towers stand side by side)
function ma_RouteStops(rt, zone, all) {
    var near = zone < 0 ? 1 : 2.5;
    var side = function (r) { return (r || [0, 0]).join(); };

    return (ma_poiCache[zone] || []).filter(function (p) {
        if (p.t != rt.t || side(p.r) != side(rt.r))
            return false;
        var d = ma_RouteDist(rt, p.x, p.y);
        return d < near && !all.some(function (o) {
            return o !== rt && o.t == rt.t && side(o.r) == side(rt.r) && ma_RouteDist(o, p.x, p.y) < d;
        });
    });
}

function ma_BindRoute(g, rt, zone, all) {
    var tip = function () {
        var kind  = rt.k || { boat: 'Boat', zep: 'Zeppelin', gun: 'Gunship' }[rt.t] || 'Transport';
        var stops = ma_RouteStops(rt, zone, all);
        var names = [];
        stops.forEach(function (p) { if (p.n && names.indexOf(p.n) == -1) names.push(p.n); });

        var mins = function (sec) { var m = Math.round(sec / 6) / 10; return m + (m == 1 ? ' minute' : ' minutes'); };
        var h = '<b class="q"><span class="zs-route-no zs-route-no-tip">' + (rt.id || rt._no) + '</span> ' + (rt.n || names.join(' / ') || kind) + '</b>';
        h += '<br /><span class="q1">' + (stops[0] && stops[0].k || kind) + '</span>' + (rt.r ? ' &nbsp;' + ma_ReactHtml(rt.r) : '');

        // stops: every dock names the next one, so their destinations are all stops of the line (this zone first)
        var pts = zone > 0 && rt.t != 'gun' ? [zone] : [];
        stops.forEach(function (p) { if (p.z && pts.indexOf(p.z) == -1) pts.push(p.z); });
        if (rt.w && rt.t != 'gun')
            h += '<br /><span class="q1">' + $WH.htmlentities(rt.w).replace(/ and /, ' &harr; ') + '</span>';
        else if (rt.t == 'gun' && pts.length)
            h += '<br /><span class="q1">Patrols over ' + pts.map(ma_ZoneName).join(', ') + '</span>';
        else if (pts.length > 1)
            h += '<br /><span class="q1">' + pts.map(ma_ZoneName).join(pts.length == 2 ? ' &harr; ' : ' &rarr; ') + '</span>';
        else if (pts.length)                                // only one dock on this map
            h += '<br /><span class="q1">To ' + ma_ZoneName(pts[0]) + '</span>';

        var t = stops.filter(function (p) { return p.rt; })[0];
        if (t) {
            h += '<br /><span class="q2">Wait time: ' + mins(t.w) + '</span>';
            h += '<br /><span class="q2">Travel 1-way: ' + mins(t.tt) + '</span>';
        }
        if (rt.rt || t)
            h += '<br /><span class="q2">Travel 2-way: ' + mins(rt.rt || t.rt) + '</span>';
        return h + '<br /><span class="q0">Arrows show the direction of travel</span>';
    };

    g.addEventListener('mouseover', function (e) { g.classList.add('zs-route-hl'); $WH.Tooltip.showAtCursor(e, tip(), 0, 0, 'q'); });
    g.addEventListener('mousemove', function (e) { $WH.Tooltip.cursorUpdate(e); });
    g.addEventListener('mouseout',  function () { g.classList.remove('zs-route-hl'); $WH.Tooltip.hide(); });
}

function ma_DrawRoutes(mapper) {
    ['_zsRoutes', '_zsRouteArrows'].forEach(function (k) {
        if (mapper[k] && mapper[k].parentNode)
            mapper[k].parentNode.removeChild(mapper[k]);
        mapper[k] = null;
    });

    var zone = parseInt(mapper.zone);
    if (ma_poiOn.route === false || typeof g_map_info == 'undefined' || !g_map_info.rt || g_map_info.rt.indexOf(zone) == -1)
        return;

    var render = function (list) {
        if (parseInt(mapper.zone) !== zone || mapper._zsRoutes)
            return;

        var svg = document.createElementNS(MA_ZS_SVGNS, 'svg');
        svg.setAttribute('class', 'zs-layer zs-routes');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');

        var arrows = document.createElement('div');
        arrows.className = 'zs-route-arrows';

        // arrows are spaced / turned in screen pixels, the map isn't square
        var W = mapper.span.offsetWidth || 772, H = mapper.span.offsetHeight || 515;
        var GAP = 110;

        var num = 0;
        list.forEach(function (rt) {
            if (ma_poiOn[rt.t] === false)
                return;

            rt._no = ++num;                                 // line number on this map (badge + tooltip)
            var bestLen = -1, bestAt = null;

            var side = rt.r && rt.r[0] > 0 && rt.r[1] < 0 ? 'a' : (rt.r && rt.r[1] > 0 && rt.r[0] < 0 ? 'h' : 'n');
            var g = document.createElementNS(MA_ZS_SVGNS, 'g');
            svg.appendChild(g);
            ma_BindRoute(g, rt, zone, list);
            rt.l.forEach(function (l) {
                var d = 'M' + l[0] + ' ' + l[1];
                for (var i = 2; i < l.length; i += 2)
                    d += 'L' + l[i] + ' ' + l[i + 1];

                // wide invisible stroke on top: the hover target
                ['zs-route-case', 'zs-route zs-route-' + side, 'zs-route-hit'].forEach(function (cls) {
                    var path = document.createElementNS(MA_ZS_SVGNS, 'path');
                    path.setAttribute('d', d);
                    path.setAttribute('class', cls);
                    path.setAttribute('vector-effect', 'non-scaling-stroke');
                    g.appendChild(path);
                });

                var next = GAP / 2;
                var run  = 0;
                var total = 0;
                for (var k = 2; k < l.length; k += 2)
                    total += Math.hypot((l[k] - l[k - 2]) * W / 100, (l[k + 1] - l[k - 1]) * H / 100);
                var half = Math.min(total * .5 + GAP / 4, total * .75);   // badge between two arrows, near the middle
                for (var j = 2; j < l.length; j += 2) {
                    var dx = (l[j] - l[j - 2]) * W / 100, dy = (l[j + 1] - l[j - 1]) * H / 100;
                    var len = Math.sqrt(dx * dx + dy * dy);
                    if (total > bestLen && half >= run && half <= run + len && len) {
                        bestLen = total;
                        bestAt  = [l[j - 2] + (l[j] - l[j - 2]) * (half - run) / len, l[j - 1] + (l[j + 1] - l[j - 1]) * (half - run) / len,
                                   Math.atan2(dy, dx) * 180 / Math.PI];
                    }
                    while (len && next <= run + len) {
                        var f = (next - run) / len;
                        var a = document.createElement('i');
                        a.className = 'zs-route-arrow zs-route-arrow-' + side;
                        a.style.left = (l[j - 2] + (l[j] - l[j - 2]) * f) + '%';
                        a.style.top  = (l[j - 1] + (l[j + 1] - l[j - 1]) * f) + '%';
                        a.style.setProperty('--a', (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1) + 'deg');
                        arrows.appendChild(a);
                        next += GAP;
                    }
                    run += len;
                }
            });

            if (bestAt) {
                var b = document.createElement('b');
                b.className = 'zs-route-no zs-route-no-' + side;
                b.textContent = rt.id || rt._no;            // transport ID once the build has it, else the line number
                b.style.left = bestAt[0] + '%';
                b.style.top  = bestAt[1] + '%';
                var ang = bestAt[2];                        // along the line, but never upside down
                if (ang > 90) ang -= 180; else if (ang < -90) ang += 180;
                b.style.setProperty('--r', ang.toFixed(1) + 'deg');
                b.addEventListener('mouseover', function (e) { g.dispatchEvent(new MouseEvent('mouseover', e)); });
                b.addEventListener('mousemove', function (e) { $WH.Tooltip.cursorUpdate(e); });
                b.addEventListener('mouseout',  function () { g.dispatchEvent(new MouseEvent('mouseout')); });
                arrows.appendChild(b);
            }
        });

        ma_InsertLayer(mapper, svg, 2.5);
        ma_InsertLayer(mapper, arrows, 2.5);
        mapper._zsRoutes      = svg;
        mapper._zsRouteArrows = arrows;
    };

    if (ma_routeCache[zone]) {
        render(ma_routeCache[zone]);
        return;
    }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', g_staticUrl + '/js/zone-routes/' + zone + '.json');
    xhr.onload = function () {
        if (xhr.status != 200)
            return;
        try { ma_routeCache[zone] = JSON.parse(xhr.responseText); } catch (e) { return; }
        render(ma_routeCache[zone]);
    };
    xhr.send();
}

// small Alliance / Horde icons above a marker: who can use it (npc reaction, transport faction, graveyard faction)
function ma_PoiBadges(p) {
    if (!ma_poiOn.badges || ['ta', 'th', 'pvp', 'dg', 'rd', 'qh', 'mail', 'stone', 'portal'].indexOf(p.t) != -1)
        return '';

    var f = p.t == 'sh' ? (p.f || 0) : (p.r ? (p.r[0] > 0 ? 1 : 0) | (p.r[1] > 0 ? 2 : 0) : 0);
    if (!f)
        return '';

    return '<span class="zs-poi-badges">' + (f & 1 ? '<img src="' + ma_PoiIcon('fa') + '" alt="" />' : '') + (f & 2 ? '<img src="' + ma_PoiIcon('fh') + '" alt="" />' : '') + '</span>';
}

function ma_BindPoi(a, p) {
    var TYPE = { fm: 'Flight Master', inn: 'Innkeeper', sh: 'Spirit Healer', ah: 'Auctioneer', bank: 'Banker', bm: 'Battlemaster', stable: 'Stable Master', mail: 'Mailbox', stone: 'Meeting Stone' };
    var tip, go = null;

    if (p.t == 'dg' || p.t == 'rd') {
        tip  = '<b class="zs-tip-inst">' + p.n + (p.l && p.l[1] ? ' (' + p.l[0] + '-' + p.l[1] + ')' : '') + ' [' + (p.t == 'rd' ? 'Raid' : 'Dungeon') + ']</b>';
        tip += '<br /><span class="q0">Click to open map</span>';
        go = function () { ma_SelectZone(p.z); };
    }
    else if (p.t == 'qh') {
        tip  = '<b class="q">' + p.n + '</b><br /><span class="q1">Quest hub</span> &middot; <span class="q0">' + p.c + ' quest giver' + (p.c == 1 ? '' : 's') + '</span>';
        tip += '<br />' + ma_ReactHtml(p.r);
        if (p.q) {
            tip += '<br /><span class="q0">Click to view the quests of ' + ma_ZoneName(p.q) + '</span>';
            go = function () { window.open('?zone=' + p.q + '#quests', '_blank'); };
        }
    }
    else if (p.t == 'boat' || p.t == 'zep' || p.t == 'gun' || p.t == 'portal') {
        var kind = p.k || { boat: 'Boat', zep: 'Zeppelin', gun: 'Gunship' }[p.t] || null;
        var here = p.z == parseInt(myMapper.zone);            // gunships patrol the zone they're in
        tip  = '<b class="q">' + p.n + '</b>';
        tip += '<br /><span class="q1">' + (p.t == 'gun' ? kind + ' patrol over ' : (kind ? kind + ' to ' : 'To ')) + ma_ZoneName(p.z) + '</span>' + (p.r ? ' &nbsp;' + ma_ReactHtml(p.r) : '');
        if (p.rt) {
            var mins = function (sec) { var m = Math.round(sec / 6) / 10; return m + (m == 1 ? ' minute' : ' minutes'); };
            tip += '<br /><span class="q2">Wait time: ' + mins(p.w) + '</span>';
            tip += '<br /><span class="q2">Travel 1-way: ' + mins(p.tt) + '</span>';
            tip += '<br /><span class="q2">Travel 2-way: ' + mins(p.rt) + '</span>';
        }
        if (!here) {
            tip += '<br /><span class="q0">Click to open map</span>';
            go = function () { ma_SelectZone(p.z); };
        }
    }
    else if (p.t == 'pvp') {
        tip = '<b class="q10">' + p.n + '</b><br /><span class="q1">World PvP</span>' + (p.z ? '<br /><span class="q0">Click to open map</span>' : '');
        if (p.z)
            go = function () { ma_SelectZone(p.z); };
    }
    else if (p.t == 'ta' || p.t == 'th') {
        tip  = '<b class="q">' + p.n + '</b>' + ma_TerritoryLine(p.z).replace(/^<br \/>/, '<br />');
        tip += '<br /><span class="q0">Click to open map</span>';
        go = function () { ma_SelectZone(p.z); };
    }
    else {
        tip  = '<b class="q">' + p.n + '</b>';
        if (p.s)
            tip += '<br /><span class="q0">&lt;' + p.s + '&gt;</span>';
        if (p.t == 'sh' && p.f)
            p.r = [p.f & 1 ? 1 : -1, p.f & 2 ? 1 : -1];
        if (p.t == 'sh' && p.gz && p.gz.length) {           // who is sent here, per zone you die in
            var FN = { 1: '<span class="q2">Alliance</span>', 2: '<span class="q10">Horde</span>', 3: 'Alliance &amp; Horde' };
            tip += '<br /><span class="q0">Resurrects players who die in:</span>';
            p.gz.forEach(function (g) {
                tip += '<br />&nbsp; ' + ma_ZoneName(g[0]) + ': ' + FN[g[1]];
            });
        }
        var role = TYPE[p.t] || (p.t.indexOf('p-') == 0 ? MA_POI_LABEL[p.t] + ' Trainer' : (p.t.indexOf('v-') == 0 ? 'Vendor: ' + MA_POI_LABEL[p.t] : MA_POI_LABEL[p.t] || ''));
        tip += '<br /><span class="q1">' + role + '</span>' + (p.r ? ' &nbsp;' + ma_ReactHtml(p.r) : '');
        if (p.id)
            tip += '<br /><span class="q0">Click to view NPC</span>';
        if (p.id)
            go = function () { window.open('?npc=' + p.id, '_blank'); };
    }

    a.onmouseover = function (e) { $WH.Tooltip.showAtCursor(e || window.event, tip, 0, 0, 'q'); };
    a.onmousemove = function (e) { $WH.Tooltip.cursorUpdate(e || window.event); };
    a.onmouseout  = function () { $WH.Tooltip.hide(); };
    a.onclick     = function () { return false; };
    a.onmouseup   = function (e) {
        e = e || window.event;
        if (e.shiftKey || e.altKey || (e.button && e.button >= 2))
            return;

        if (e.stopPropagation)
            e.stopPropagation();
        e.cancelBubble = true;

        if (go) {
            $WH.Tooltip.hide();
            go();
        }
        return false;
    };
}


/*  Map title (top left): boxed, with the expansion icon of the zone */

function ma_UpdateTitle(mapper) {
    var t = mapper.sZoneLink;
    if (!t)
        return;

    // the glow text stays (hidden) for the mapper; the visible title is our own box, built like "Back to:"
    t.classList.add('zs-title');

    var shown = null;
    for (var i = 0; i < t.childNodes.length; i++) {
        var c = t.childNodes[i];
        if (c.nodeName == 'DIV' && c.style.zIndex == '4')
            shown = c;
    }

    var box = $WH.ge('zs-title');
    if (!box) {
        box = document.createElement('div');
        box.id = 'zs-title';
        box.className = 'zs-mapbtn';
        box.onmousedown = box.onmouseup = function (e) { (e || window.event).stopPropagation(); };
    }
    if (box.parentNode != t.parentNode)
        t.parentNode.appendChild(box);

    // the mapper's own label can still hold the previous zone (e.g. after going back to a continent): name the map we show
    var zone = parseInt(mapper.zone);
    var a = shown ? shown.querySelector('a') : null;
    var name = (zone && ma_ZoneName(zone)) || (shown ? shown.textContent : '');
    if (a && zone > 0)
        a.setAttribute('href', '?zone=' + zone);
    else if (zone <= 0)
        a = null;
    if (!name) {
        box.style.display = 'none';
        return;
    }
    box.style.display = '';
    box.innerHTML = a ? '<a href="' + a.getAttribute('href') + '">' + $WH.htmlentities(name) + '</a>' : '<b>' + $WH.htmlentities(name) + '</b>';

    var exp  = (typeof g_map_info != 'undefined' && g_map_info.exp[zone]) || 0;
    if (exp && MA_EXP[exp] && MA_EXP[exp].src) {
        var img = document.createElement('img');
        img.src = MA_EXP[exp].src;
        img.className = 'zs-title-exp';
        img.alt = '';
        box.appendChild(img);
    }
}


/*  Mouse wheel zoom + drag to pan
 *  The mapper span (map image + all overlays + pins, positioned in %) is scaled with a CSS transform, so everything
 *  stays aligned. Icons, labels and pins are scaled back (--zs-k) to keep their size. While zoomed in, the sharper
 *  'original' map image is used.
 */

var ma_zoom = { k: 1, tx: 0, ty: 0, key: null, drag: null, hiRes: false };
var MA_ZOOM_MAX = 6;

function ma_InitZoom() {
    var m    = myMapper;
    var wrap = m.parent;

    wrap.classList.add('zs-zoomable');
    m.span.style.transformOrigin = '0 0';

    // cursor position from the (transformed) map rect instead of page offsets + fixed sizes
    m.getMousePos = function (e) {
        e = $WH.$E(e);
        var r = this.span.getBoundingClientRect();
        this.mouseX = Math.min(100, Math.max(0, Math.floor((e.clientX - r.left) / r.width  * 1000) / 10));
        this.mouseY = Math.min(100, Math.max(0, Math.floor((e.clientY - r.top)  / r.height * 1000) / 10));
        if (this.mouse)
            g_setTextNodes(this.sMouse, '(' + this.mouseX.toFixed(1) + ', ' + this.mouseY.toFixed(1) + ')');
    };
    m.span.onmousemove = m.span.onmousedown = m.getMousePos.bind(m);

    // keep the coordinate readout out of the scaled layer
    if (m.sMouse && m.sMouse.parentNode == m.span)
        wrap.appendChild(m.sMouse);

    wrap.addEventListener('wheel', function (e) {
        var r = wrap.getBoundingClientRect();
        var f = Math.exp(-e.deltaY * (e.deltaMode == 1 ? 0.05 : 0.0015));
        if (ma_zoom.k <= 1 && f < 1)                        // fully zoomed out: let the page scroll
            return;

        e.preventDefault();
        ma_ZoomAt(ma_zoom.k * f, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    // drag to pan (only while zoomed); a drag never places a pin / opens a map
    wrap.addEventListener('mousedown', function (e) {
        if (e.button || ma_zoom.k <= 1 || e.altKey || e.shiftKey)
            return;
        ma_zoom.drag = { x: e.clientX, y: e.clientY, tx: ma_zoom.tx, ty: ma_zoom.ty, moved: false };
    }, true);

    window.addEventListener('mousemove', function (e) {
        var d = ma_zoom.drag;
        if (!d)
            return;
        if (!d.moved && Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) {
            d.moved = true;
            wrap.classList.add('zs-dragging');
            $WH.Tooltip.hide();
        }
        if (d.moved) {
            ma_zoom.tx = d.tx + e.clientX - d.x;
            ma_zoom.ty = d.ty + e.clientY - d.y;
            ma_ApplyZoom();
        }
    });

    wrap.addEventListener('mouseup', function (e) {
        var d = ma_zoom.drag;
        ma_zoom.drag = null;
        wrap.classList.remove('zs-dragging');
        if (d && d.moved) {
            e.stopPropagation();
            e.preventDefault();
        }
    }, true);
    window.addEventListener('mouseup', function () { ma_zoom.drag = null; wrap.classList.remove('zs-dragging'); });

    // +, -, reset
    var ctl = document.createElement('div');
    ctl.className = 'zs-zoom-ctl';
    [['+', 1.5, 'Zoom in'], ['&minus;', 1 / 1.5, 'Zoom out'], ['&#10227;', 0, 'Reset zoom']].forEach(function (b) {
        var a = document.createElement('a');
        a.href = 'javascript:;';
        a.innerHTML = b[0];
        a.title = b[2];
        a.onmousedown = a.onmouseup = function (e) { (e || window.event).stopPropagation(); };
        a.onclick = function () {
            if (b[1])
                ma_ZoomAt(ma_zoom.k * b[1], wrap.clientWidth / 2, wrap.clientHeight / 2);
            else
                ma_ZoomAt(1, 0, 0);
            return false;
        };
        ctl.appendChild(a);
    });
    wrap.appendChild(ctl);
}

function ma_ZoomAt(k, cx, cy) {
    k = Math.min(MA_ZOOM_MAX, Math.max(1, k));
    var f = k / ma_zoom.k;
    ma_zoom.tx = cx - (cx - ma_zoom.tx) * f;
    ma_zoom.ty = cy - (cy - ma_zoom.ty) * f;
    ma_zoom.k  = k;
    ma_ApplyZoom();
}

function ma_ApplyZoom() {
    var m = myMapper, z = ma_zoom;
    var W = m.parent.clientWidth  || m.span.offsetWidth;
    var H = m.parent.clientHeight || m.span.offsetHeight;

    if (z.k <= 1.0001) {
        z.k = 1;
        z.tx = z.ty = 0;
    }
    z.tx = Math.min(0, Math.max(W - W * z.k, z.tx));
    z.ty = Math.min(0, Math.max(H - H * z.k, z.ty));

    m.span.style.transform = z.k == 1 ? '' : 'translate(' + z.tx.toFixed(1) + 'px, ' + z.ty.toFixed(1) + 'px) scale(' + z.k.toFixed(4) + ')';
    m.span.style.setProperty('--zs-k', z.k.toFixed(4));
    m.parent.classList.toggle('zs-zoomed', z.k > 1);

    // sharper image while zoomed in - swapped only once it is loaded (no blank flash)
    var hi = z.k > 1.15;
    if (hi != z.hiRes) {
        z.hiRes = hi;
        var size = Mapper.sizes[m.zoom][2];
        var bg   = m.span.style.backgroundImage || '';
        if (hi && size != 'original' && bg.indexOf('/' + size + '/') != -1) {
            var url = ma_HiResUrl(m);
            ma_Preload(url, function () {
                if (!ma_zoom.hiRes || (m.span.style.backgroundImage || '').indexOf('/' + size + '/') == -1)
                    return;
                m.span.style.backgroundImage = 'url("' + url + '")';
                m.span.style.backgroundSize  = '100% 100%';
            });
        }
        else if (!hi && bg.indexOf('/original/') != -1 && size != 'original')
            m.span.style.backgroundImage = bg.replace('/original/', '/' + size + '/');
    }
}

var ma_preloaded = {};

function ma_HiResUrl(m) {
    var bg = m.span.style.backgroundImage || '';
    var u  = bg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
    return u.replace('/' + Mapper.sizes[m.zoom][2] + '/', '/original/');
}

function ma_Preload(url, cb) {
    if (!url)
        return;

    var st = ma_preloaded[url];
    if (st === true) {
        cb && cb();
        return;
    }
    if (st) {                                               // already loading: queue
        cb && st.push(cb);
        return;
    }

    ma_preloaded[url] = cb ? [cb] : [];
    var img = new Image();
    img.onload = function () {
        var q = ma_preloaded[url];
        ma_preloaded[url] = true;
        (q || []).forEach(function (f) { f(); });
    };
    img.onerror = function () { delete ma_preloaded[url]; };
    img.src = url;
}

// a different map / floor starts unzoomed (setMap() also resets the background)
function ma_ZoomOnMapChange(mapper) {
    var key = mapper.zone + '.' + mapper.level + '.' + mapper.zoom;
    if (key == ma_zoom.key)
        return;
    ma_zoom.key   = key;
    ma_zoom.k     = 1;
    ma_zoom.hiRes = false;
    if (mapper.parent.classList.contains('zs-zoomable'))
        ma_ApplyZoom();

    // fetch the sharp image in the background, so the first zoom has it ready
    if (Mapper.sizes[mapper.zoom][2] != 'original' && parseInt(mapper.zone))
        setTimeout(function () { ma_Preload(ma_HiResUrl(mapper)); }, 300);
}


/*  History of copied .go commands (right side): newest first, loads more while scrolling, clear button */

var MA_GOH_STORE = 'aowow_maps_gohistory';
var MA_GOH_PAGE  = 40;
var MA_GOH_MAX   = 2000;
var ma_goh       = [];
var ma_gohShown  = 0;

function ma_InitGoHistory() {
    try { ma_goh = JSON.parse(window.localStorage.getItem(MA_GOH_STORE) || '[]') || []; } catch (e) { ma_goh = []; }

    var wrap = $WH.ge('mapper-wrap');
    if (!wrap || $WH.ge('zs-goh'))
        return;

    var box = document.createElement('div');
    box.id = 'zs-goh';
    box.innerHTML = '<div class="zs-goh-head"><span>.go history</span><a href="javascript:;" id="zs-goh-clear">Clear</a></div>' +
                    '<div class="zs-goh-list" id="zs-goh-list"></div>';
    wrap.appendChild(box);

    $WH.ge('zs-goh-clear').onclick = function () {
        ma_goh = [];
        ma_GoHistorySave();
        ma_GoHistoryRender(true);
        return false;
    };

    var list = $WH.ge('zs-goh-list');
    list.addEventListener('scroll', function () {
        if (list.scrollTop + list.clientHeight >= list.scrollHeight - 40)
            ma_GoHistoryRender(false);
    });

    ma_GoHistoryRender(true);
}

function ma_GoHistorySave() {
    try { window.localStorage.setItem(MA_GOH_STORE, JSON.stringify(ma_goh)); } catch (e) {}
}

function ma_GoHistoryAdd(cmd, zoneId) {
    if (ma_goh.length && ma_goh[0].c == cmd)
        return;

    ma_goh.unshift({ c: cmd, z: zoneId || 0, t: Date.now() });
    if (ma_goh.length > MA_GOH_MAX)
        ma_goh.length = MA_GOH_MAX;

    ma_GoHistorySave();
    ma_GoHistoryRender(true);
}

// reset: render the first page again; otherwise append the next page (infinite scroll)
function ma_GoHistoryRender(reset) {
    var list = $WH.ge('zs-goh-list');
    if (!list)
        return;

    if (reset) {
        list.innerHTML = '';
        ma_gohShown = 0;
        list.scrollTop = 0;
    }

    if (!ma_goh.length) {
        list.innerHTML = '<div class="zs-goh-empty">Alt+click the map to copy a .go command - it will show up here.</div>';
        return;
    }

    var end = Math.min(ma_goh.length, ma_gohShown + MA_GOH_PAGE);
    for (var i = ma_gohShown; i < end; i++) {
        var h = ma_goh[i];
        var d = new Date(h.t);
        var row = document.createElement('a');
        row.href = 'javascript:;';
        row.className = 'zs-goh-row';
        row.title = 'Click to copy again';
        row.innerHTML = '<code>' + h.c.replace(/</g, '&lt;') + '</code>' +
                        '<span>' + (h.z ? ma_ZoneName(h.z) : '') + '<i>' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ' ' + d.toLocaleDateString() + '</i></span>';
        row.onclick = (function (c, el) {
            return function () {
                ma_CopyText(c, function (ok) {
                    el.classList.add('zs-goh-copied');
                    setTimeout(function () { el.classList.remove('zs-goh-copied'); }, 900);
                });
                var inp = $WH.ge('zs-go-cmd');
                if (inp)
                    inp.value = c;
                return false;
            };
        })(h.c, row);
        list.appendChild(row);
    }
    ma_gohShown = end;
}


/*  "Back to" (top right): one level up - zone -> continent -> Azeroth -> Cosmic, Outland -> Cosmic,
 *  instance -> the zone of its entrance
 */

function ma_ParentMap(zone) {
    zone = parseInt(zone);
    if (!zone || zone == -4)
        return null;
    if (zone == -1 || zone == -2)
        return -4;
    if (zone == -3 || zone == -6 || zone == -5)
        return -1;

    var cont = typeof g_zone_shapes != 'undefined' ? ma_FindContinent(zone) : null;
    if (cont !== null)
        return cont;

    if (typeof g_map_info != 'undefined' && g_map_info.par && g_map_info.par[zone])
        return g_map_info.par[zone];

    return null;
}

function ma_UpdateBack(mapper) {
    var host = mapper.buttonDiv || mapper.parent;
    var btn  = $WH.ge('zs-back');
    if (!btn) {
        btn = document.createElement('a');
        btn.id = 'zs-back';
        btn.className = 'zs-mapbtn';
        btn.href = 'javascript:;';
        btn.onmousedown = btn.onmouseup = function (e) { (e || window.event).stopPropagation(); };
        host.insertBefore(btn, host.firstChild);
    }

    var to = ma_ParentMap(mapper.zone);
    if (to === null) {
        btn.style.display = 'none';
        return;
    }

    btn.style.display = '';
    btn.innerHTML = '<i>&larr;</i> Back to: <b>' + ma_ZoneName(to) + '</b>';
    btn.onclick = function () {
        $WH.Tooltip.hide();
        ma_SelectZone(to);
        return false;
    };
}


/*  plain ?maps (nothing picked yet): hint instead of an empty page */

function ma_InitChooseHint() {
    var wrap = $WH.ge('mapper-wrap');
    if (!wrap || $WH.ge('zs-choose'))
        return;

    var hint = document.createElement('div');
    hint.id = 'zs-choose';
    hint.innerHTML = '<span>&uarr;</span> Choose a map from the menus above';
    wrap.parentNode.insertBefore(hint, wrap);
    ma_UpdateChooseHint(myMapper);
}

function ma_UpdateChooseHint(mapper) {
    var hint = $WH.ge('zs-choose');
    if (hint)
        hint.style.display = (mapper && parseInt(mapper.zone)) ? 'none' : '';
}
