/*
 * Quest completion of the characters on the linked game account (data: g_questStatus from ?quest-tracker=status)
 *  - Completion column in quest listviews
 *  - Completion line in Quick Facts of quest pages, quest counts on NPC pages
 * status codes: 0 not started, 1 in progress, 2 ready to turn in, 3 completed, 4 failed
 */
var AoQuestStatus = (function () {
    var S = window.g_questStatus || { c: [], q: {} };
    var NAMES = ['Not started', 'In progress', 'Ready to turn in', 'Completed', 'Failed'];

    function esc(t) {
        return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    }

    function codes(questId) {
        var s = S.q[questId] || '';
        return S.c.map(function (c, i) { var k = '-prcf'.indexOf(s[i] || '-'); return k < 0 ? 0 : k; });
    }

    function charLabel(i) {
        var c = S.c[i];
        return '<span class="c' + c[4] + '">' + esc(c[2]) + '</span> <span class="q0">' + esc(c[6]) + '</span>';
    }

    // one dot per character
    function dots(questId) {
        return '<span class="qc-dots" data-quest="' + questId + '">' + codes(questId).map(function (code, i) {
            return '<i class="qc-dot qc-s' + code + '" data-c="' + i + '"></i>';
        }).join('') + '</span>';
    }

    // every character with its status, for a quest tooltip
    function list(questId) {
        return codes(questId).map(function (code, i) {
            return '<i class="qc-dot qc-s' + code + '"></i> ' + charLabel(i) + ' <span class="qc-st' + code + '">' + NAMES[code] + '</span>';
        }).join('<br />');
    }

    function bindDots(root) {
        var els = (root || document).querySelectorAll('.qc-dot[data-c]');
        for (var k = 0; k < els.length; k++) {
            (function (d) {
                var q = d.parentNode.getAttribute('data-quest'), i = +d.getAttribute('data-c');
                d.onmouseover = function () {
                    var code = codes(q)[i];
                    $WH.Tooltip.show(d, '<span class="q">' + NAMES[code] + ':</span><br />' + charLabel(i));
                };
                d.onmouseout = $WH.Tooltip.hide;
            })(els[k]);
        }
    }

    // Completion column for quest listviews
    function addColumn() {
        if (!S.c.length || typeof Listview == 'undefined' || !Listview.templates || !Listview.templates.quest)
            return;

        var cols = Listview.templates.quest.columns;
        if (cols.some(function (c) { return c.id == 'completion'; }))
            return;

        cols.push({
            id: 'completion',
            name: 'Completion',
            width: Math.max(10, S.c.length * 1.6) + '%',
            compute: function (quest, td) {
                td.innerHTML = dots(quest.id);
                bindDots(td);
            },
            getVisibleText: function (quest) {
                return codes(quest.id).filter(function (c) { return c == 3; }).length + '';
            },
            sortFunc: function (a, b) {
                var n = function (q) { return codes(q.id).reduce(function (s, c) { return s + (c == 3 ? 10 : c ? 1 : 0); }, 0); };
                return n(a) - n(b);
            }
        });
    }

    // Quick Facts: the infobox list of the page
    function quickFacts() {
        if (!S.c.length || typeof g_pageInfo == 'undefined')
            return;

        var box = document.querySelector('.infobox ul, table.infobox ul');
        if (!box)
            return;

        var li = document.createElement('li');
        if (g_pageInfo.type == 5) {
            li.innerHTML = '<div>Completion: ' + dots(g_pageInfo.typeId) + '</div>';
            box.appendChild(li);
            bindDots(li);
            return;
        }

        // npc / object: how many of the quests it starts each character has done
        if ((g_pageInfo.type == 1 || g_pageInfo.type == 2) && typeof g_listviews != 'undefined' && g_listviews.starts) {
            var ids = (g_listviews.starts.data || []).map(function (q) { return q.id; });
            if (!ids.length)
                return;

            li.innerHTML = '<div>Quests completed: <span class="qc-dots">' + S.c.map(function (c, i) {
                var done = ids.filter(function (id) { return codes(id)[i] == 3; }).length;
                return '<i class="qc-dot qc-s' + (done == ids.length ? 3 : done ? 1 : 0) + '" data-done="' + done + '" data-i="' + i + '"></i>';
            }).join('') + '</span></div>';
            box.appendChild(li);
            var els = li.querySelectorAll('.qc-dot');
            for (var k = 0; k < els.length; k++) {
                (function (d) {
                    d.onmouseover = function () { $WH.Tooltip.show(d, charLabel(+d.getAttribute('data-i')) + '<br />' + d.getAttribute('data-done') + ' / ' + ids.length + ' quests completed'); };
                    d.onmouseout = $WH.Tooltip.hide;
                })(els[k]);
            }
        }
    }

    addColumn();
    $(document).ready(quickFacts);

    return { codes: codes, dots: dots, list: list, bindDots: bindDots, chars: function () { return S.c; }, NAMES: NAMES };
})();
