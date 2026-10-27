<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');

class AjaxTrainerrank extends AjaxHandler
{
    protected $_get = array(
        'class' => ['filter' => FILTER_SANITIZE_NUMBER_INT],
        'level' => ['filter' => FILTER_SANITIZE_NUMBER_INT],
    );

    public function __construct(array $params)
    {
        parent::__construct($params);

        $this->handler = 'handleTrainerRank';
    }

    /* responses
        { spells: [{id, name, rank, reqLevel}] }
    */
    protected function handleTrainerRank() : string
    {
        $classId = (int)$this->_get['class'];
        $level   = (int)$this->_get['level'];

        if ($classId < 1 || $classId > 12 || $level < 1 || $level > 80)
            return json_encode(['spells' => []]);

        // 1. Find all class trainer NPC IDs from the aowow creature table
        //    trainerType=0 means class trainer; trainerRequirement = class ID
        $npcIds = DB::Aowow()->selectCol(
            'SELECT id FROM ?_creature WHERE trainerType = 0 AND trainerRequirement = ?d',
            $classId
        );

        if (empty($npcIds))
            return json_encode(['spells' => []]);

        // 2. Get trainer spells from world DB for those NPCs, capped at level
        $worldSpells = DB::World()->select(
            'SELECT DISTINCT ts.SpellId AS ARRAY_KEY, ts.ReqLevel AS reqLevel
             FROM   trainer_spell ts
             JOIN   creature_default_trainer cdt ON cdt.TrainerId = ts.TrainerId
             WHERE  cdt.CreatureId IN (?a)
               AND  ts.ReqLevel <= ?d
             ORDER  BY ts.ReqLevel ASC, ts.SpellId ASC',
            $npcIds, $level
        );

        if (empty($worldSpells))
            return json_encode(['spells' => []]);

        $spellIds = array_keys($worldSpells);

        // 3. Get spell names, ranks and icons from the aowow spell table
        $aowowSpells = DB::Aowow()->select(
            'SELECT s.id AS ARRAY_KEY, s.name_loc0 AS name, s.rank_loc0 AS rankText, ic.name AS icon, s.skillLine1 AS skill, sl.name_loc0 AS skillName
             FROM   ?_spell s
             LEFT JOIN ?_icons ic ON ic.id = s.iconId
             LEFT JOIN ?_skillline sl ON sl.id = s.skillLine1
             WHERE  s.id IN (?a)',
            $spellIds
        );

        // 4. Only the highest rank of each spell the trainer teaches up to this level (same name = same spell)
        $best = [];
        foreach ($spellIds as $spellId)
        {
            if (empty($aowowSpells[$spellId]))
                continue;

            $info  = $aowowSpells[$spellId];
            $req   = (int)($worldSpells[$spellId]['reqLevel'] ?? 0);
            $key   = mb_strtolower($info['name'] ?? '');
            if (isset($best[$key]) && ($best[$key]['reqLevel'] > $req || ($best[$key]['reqLevel'] == $req && $best[$key]['id'] > $spellId)))
                continue;

            $best[$key] = [
                'id'       => (int)$spellId,
                'name'     => $info['name']     ?? '',
                'rank'     => $info['rankText'] ?? '',
                'icon'     => $info['icon']     ?: 'inv_misc_questionmark',
                'reqLevel' => $req,
                'skill'    => max(0, (int)$info['skill']),          // talent tree (skill line) the spell belongs to
                'skillName'=> (int)$info['skill'] > 0 ? ($info['skillName'] ?? '') : '',
            ];
        }

        $result = array_values($best);
        usort($result, fn($a, $b) => strcmp($a['name'], $b['name']));

        return json_encode(['spells' => $result]);
    }
}

?>
