<?php

if (!defined('AOWOW_REVISION'))
    die('illegal access');

if (!CLI)
    die('not in cli mode');


/*
 * ZoneShapeTracer
 *
 * Turns the client's continent-map zone highlight textures
 *   Interface/WorldMap/<nameINT>/<nameINT>Highlight.blp
 * into clean, non-overlapping vector outlines (one multi-polygon per zone) in continent-map space.
 *
 * Pipeline per continent:
 *   1. rasterize  - every highlight is stretched over its zone's WorldMapArea rectangle (projected into
 *                   continent space). Only the top 1002:668 portion of the square texture is used, exactly
 *                   like the client does (texcoords 0..1 / 0..0.667). Lit texels (relative to the zone's own
 *                   peak brightness) become the zone mask.
 *   2. resolve    - highlights have soft glows and overlap their neighbours. Every pixel is awarded to the zone
 *                   it lies deepest inside (chamfer distance to that zone's own mask edge), so borders end up
 *                   halfway between zones. Zones that sit inside another one (capital cities) are painted on top.
 *   3. clean      - majority filter + removal of tiny specks.
 *   4. vectorize  - pixel-edge contour tracing per zone (outer rings + holes), collinear-point removal,
 *                   Douglas-Peucker simplification and an optional Chaikin pass for a softer, hand-drawn look.
 *
 * Output coordinates are in pixels of a MAP_W x MAP_H map. Nothing in here touches the DB or file system.
 */
class ZoneShapeTracer
{
    public const MAP_W = 1002;
    public const MAP_H = 668;

    public float $relThreshold = 0.07;                      // texel counts as lit at >= x * zone's peak brightness
    public int   $absThreshold = 4;                         // .. and at least this bright (0-255), suppresses noise
    public int   $smoothPasses = 2;                         // majority filter passes
    public int   $gapClose     = 6;                         // px; gaps up to 2x this between zones are closed (coastlines are kept)
    public int   $minSpeck     = 20;                        // connected regions smaller than this (px) are dropped
    public float $nestedCover  = 0.70;                      // zone is "nested" if >= x of its mask lies inside another zone ..
    public float $nestedRatio  = 0.35;                      // .. that is at least 1/x larger
    public float $simplify     = 0.85;                      // Douglas-Peucker epsilon in px
    public int   $chaikin      = 1;                         // corner cutting iterations
    public float $minRingArea  = 12.0;                      // px²; smaller rings are discarded after simplification
    public float $cityRadius   = 0.30;                      // blank highlights (capital cities): ellipse of x * rect size, drawn on top

    private const W = self::MAP_W;
    private const H = self::MAP_H;

    /**
     * @param array $zones list of zones; a zone is ['id' => int, 'parts' => [part, ..]] or a single part with an 'id'
     *                     part: ['img' => GdImage, 'rect' => [x0, y0, x1, y1] (px, may exceed map),
     *                            'crop'      => bool   (default true)  only use the top 1002:668 of the texture (zone highlights)
     *                            'mode'      => string (default 'lum') 'lum': brightness * alpha, 'alpha': opacity only
     *                            'outline'   => bool   (default false) texture is an outline - fill its inside
     *                            'threshold' => float  (optional)      absolute 0-255 cut-off instead of relThreshold]
     *                       or ['ellipse' => [cx, cy, rx, ry]] (px)
     * @return array [zoneId => [ring, ring, ..]]; ring = [x0, y0, x1, y1, ..] in px
     */
    public function trace(array $zones) : array
    {
        // 1. rasterize
        $masks = [];
        foreach ($zones as $idx => $z)
        {
            $parts = [];
            foreach ($z['parts'] ?? [$z] as $part)
            {
                if (isset($part['ellipse']))
                    $m = $this->ellipseMask($part['ellipse'], false);
                else
                    $m = $this->rasterize($part['img'], $part['rect'], $part['crop'] ?? true, $part['mode'] ?? 'lum', $part['outline'] ?? false, $part['threshold'] ?? null);

                if ($m)
                    $parts[] = $m;
            }

            if ($parts)
                $masks[$idx] = count($parts) == 1 ? $parts[0] : $this->unionMasks($parts);
        }

        if (!$masks)
            return [];

        // 2. resolve overlaps
        $label  = array_fill(0, self::W * self::H, -1);
        $nested = $this->findNested($masks);
        foreach ($masks as $idx => $m)
            if ($m['synthetic'])
                $nested[$idx] = true;

        $best = array_fill(0, self::W * self::H, 0);
        foreach ($masks as $idx => $m)
        {
            if (isset($nested[$idx]))
                continue;

            $dist = $this->chamfer($m);
            for ($y = 0; $y < $m['h']; $y++)
            {
                $row = ($m['y'] + $y) * self::W + $m['x'];
                $mr  = $y * $m['w'];
                for ($x = 0; $x < $m['w']; $x++)
                {
                    $d = $dist[$mr + $x];
                    if ($d > 0 && $d > $best[$row + $x])
                    {
                        $best[$row + $x]  = $d;
                        $label[$row + $x] = $idx;
                    }
                }
            }
        }
        unset($best);

        // nested zones on top; largest first so the smallest wins if nested twice
        uksort($nested, fn($a, $b) => $masks[$b]['n'] <=> $masks[$a]['n']);
        foreach ($nested as $idx => $_)
        {
            $m = $masks[$idx];
            for ($y = 0; $y < $m['h']; $y++)
            {
                $row = ($m['y'] + $y) * self::W + $m['x'];
                $mr  = $y * $m['w'];
                for ($x = 0; $x < $m['w']; $x++)
                    if ($m['m'][$mr + $x])
                        $label[$row + $x] = $idx;
            }
        }

        // 3. clean up
        [$bx0, $by0, $bx1, $by1] = $this->unionBox($masks, $this->gapClose + 2);
        if ($this->gapClose > 0)
            $this->closeGaps($label, $bx0, $by0, $bx1, $by1);

        $this->fillHoles($label, $bx0, $by0, $bx1, $by1);

        for ($i = 0; $i < $this->smoothPasses; $i++)
            $label = $this->majority($label, $bx0, $by0, $bx1, $by1);

        $this->removeSpecks($label, $bx0, $by0, $bx1, $by1);

        // 4. vectorize
        $result = [];
        foreach ($this->vectorizeRings($label, $bx0, $by0, $bx1, $by1) as $idx => $rings)
            $result[$zones[$idx]['id']] = $rings;

        return $result;
    }

    /**
     * outlines of an already labeled map (MAP_W x MAP_H, -1 = none): smoothing, speck removal, tracing, simplification
     * @return array [label => [ring, ..]]; ring = [x0, y0, x1, y1, ..] in px
     */
    public function vectorize(array $label, int $minSpeck = 0) : array
    {
        $box = [0, 0, self::W, self::H];

        for ($i = 0; $i < $this->smoothPasses; $i++)
            $label = $this->majority($label, ...$box);

        $keep = $this->minSpeck;
        $this->minSpeck = $minSpeck ?: $keep;
        $this->removeSpecks($label, ...$box);
        $this->minSpeck = $keep;

        return $this->vectorizeRings($label, ...$box);
    }

    private function vectorizeRings(array $label, int $bx0, int $by0, int $bx1, int $by1) : array
    {
        $result = [];
        foreach ($this->traceRings($label, $bx0, $by0, $bx1, $by1) as $idx => $rings)
        {
            $out = [];
            foreach ($rings as $ring)
            {
                $ring = $this->dropCollinear($ring);
                $ring = $this->douglasPeucker($ring, $this->simplify);
                for ($i = 0; $i < $this->chaikin; $i++)
                    $ring = $this->chaikinRing($ring);

                if (count($ring) < 3 || abs($this->ringArea($ring)) < $this->minRingArea)
                    continue;

                $flat = [];
                foreach ($ring as [$x, $y])
                    array_push($flat, $x, $y);

                $out[] = $flat;
            }

            if ($out)
                $result[$idx] = $out;
        }

        return $result;
    }

    /** @return ?array ['x', 'y', 'w', 'h', 'n' (lit px), 'm' (flat 0/1 mask)] */
    private function rasterize(GdImage $img, array $rect, bool $crop = true, string $mode = 'lum', bool $outline = false, ?float $threshold = null) : ?array
    {
        [$x0, $y0, $x1, $y1] = $rect;
        if ($x1 - $x0 < 1 || $y1 - $y0 < 1)
            return null;

        $tw    = imagesx($img);
        $th    = imagesy($img);
        $cropH = $crop ? $th * self::H / self::W : $th;     // zone highlights: client only shows the top 1002:668 part
        $rows  = min($th, (int)ceil($cropH));
        $true  = imageistruecolor($img);

        // brightness per texel: max(r, g, b) * alpha
        $lum  = [];
        $peak = 0;
        for ($ty = 0; $ty < $rows; $ty++)
        {
            for ($tx = 0; $tx < $tw; $tx++)
            {
                $c = imagecolorat($img, $tx, $ty);
                if (!$true)
                {
                    $c = imagecolorsforindex($img, $c);
                    $c = ((int)$c['alpha'] << 24) | ($c['red'] << 16) | ($c['green'] << 8) | $c['blue'];
                }

                $a = 127 - (($c >> 24) & 0x7F);
                if ($mode == 'alpha')
                    $v = $a * 255 / 127;
                else
                    $v = max(($c >> 16) & 0xFF, ($c >> 8) & 0xFF, $c & 0xFF) * $a / 127;

                $lum[$ty * $tw + $tx] = $v;
                if ($v > $peak)
                    $peak = $v;
            }
        }

        $bx0 = max(0, (int)floor($x0));
        $by0 = max(0, (int)floor($y0));
        $bx1 = min(self::W, (int)ceil($x1));
        $by1 = min(self::H, (int)ceil($y1));
        if ($bx1 <= $bx0 || $by1 <= $by0)
            return null;

        $w  = $bx1 - $bx0;
        $h  = $by1 - $by0;

        // blank texture (capital cities have no highlight in 3.3.5) - fall back to an ellipse in the middle of the rect
        if ($peak <= 0)
            return $this->ellipseMask([($x0 + $x1) / 2, ($y0 + $y1) / 2, ($x1 - $x0) * $this->cityRadius, ($y1 - $y0) * $this->cityRadius], true);

        $thresh = $threshold ?? max($this->absThreshold, $peak * $this->relThreshold);
        $sx = $tw    / ($x1 - $x0);
        $sy = $cropH / ($y1 - $y0);
        $m  = array_fill(0, $w * $h, 0);
        $n  = 0;

        for ($y = 0; $y < $h; $y++)
        {
            $v  = ($by0 + $y + 0.5 - $y0) * $sy - 0.5;
            $v  = max(0.0, min($rows - 1.0, $v));
            $iv = (int)$v;
            $fv = $v - $iv;
            $iv2 = min($iv + 1, $rows - 1);

            for ($x = 0; $x < $w; $x++)
            {
                $u  = ($bx0 + $x + 0.5 - $x0) * $sx - 0.5;
                if ($u < -0.5 || $u > $tw - 0.5)
                    continue;

                $u  = max(0.0, min($tw - 1.0, $u));
                $iu = (int)$u;
                $fu = $u - $iu;
                $iu2 = min($iu + 1, $tw - 1);

                $val = ($lum[$iv  * $tw + $iu] * (1 - $fu) + $lum[$iv  * $tw + $iu2] * $fu) * (1 - $fv)
                     + ($lum[$iv2 * $tw + $iu] * (1 - $fu) + $lum[$iv2 * $tw + $iu2] * $fu) * $fv;

                if ($val >= $thresh)
                {
                    $m[$y * $w + $x] = 1;
                    $n++;
                }
            }
        }

        if (!$n)
            return null;

        $mask = ['x' => $bx0, 'y' => $by0, 'w' => $w, 'h' => $h, 'n' => $n, 'm' => $m, 'synthetic' => false];

        return $outline ? $this->fillOutline($mask) : $mask;
    }

    // closes small breaks in an outline (dilation) and fills everything not reachable from outside
    private function fillOutline(array $mk, int $r = 2) : array
    {
        // pad so the flood fill can walk around the shape
        $pad = $r + 1;
        $w   = $mk['w'] + 2 * $pad;
        $h   = $mk['h'] + 2 * $pad;
        $m   = array_fill(0, $w * $h, 0);
        for ($y = 0; $y < $mk['h']; $y++)
            for ($x = 0; $x < $mk['w']; $x++)
                if ($mk['m'][$y * $mk['w'] + $x])
                    for ($dy = -$r; $dy <= $r; $dy++)
                        for ($dx = -$r; $dx <= $r; $dx++)
                            if ($dx * $dx + $dy * $dy <= $r * $r)
                                $m[($y + $pad + $dy) * $w + $x + $pad + $dx] = 1;

        $outside = [0 => true];
        $queue   = [0];
        for ($q = 0; $q < count($queue); $q++)
        {
            $p  = $queue[$q];
            $px = $p % $w;
            foreach ([$px > 0 ? $p - 1 : -1, $px < $w - 1 ? $p + 1 : -1, $p - $w, $p + $w] as $n)
            {
                if ($n < 0 || $n >= $w * $h || isset($outside[$n]) || $m[$n])
                    continue;

                $outside[$n] = true;
                $queue[]     = $n;
            }
        }

        // map back, clipped to the map
        $x0 = $mk['x'] - $pad;
        $y0 = $mk['y'] - $pad;
        $cx0 = max(0, $x0); $cy0 = max(0, $y0);
        $cx1 = min(self::W, $x0 + $w); $cy1 = min(self::H, $y0 + $h);
        $cw = $cx1 - $cx0; $ch = $cy1 - $cy0;
        $out = array_fill(0, $cw * $ch, 0);
        $n   = 0;
        for ($y = 0; $y < $ch; $y++)
            for ($x = 0; $x < $cw; $x++)
                if (!isset($outside[($y + $cy0 - $y0) * $w + $x + $cx0 - $x0]))
                {
                    $out[$y * $cw + $x] = 1;
                    $n++;
                }

        return ['x' => $cx0, 'y' => $cy0, 'w' => $cw, 'h' => $ch, 'n' => $n, 'm' => $out, 'synthetic' => $mk['synthetic']];
    }

    private function unionMasks(array $parts) : array
    {
        $x0 = min(array_column($parts, 'x'));
        $y0 = min(array_column($parts, 'y'));
        $x1 = max(array_map(fn($p) => $p['x'] + $p['w'], $parts));
        $y1 = max(array_map(fn($p) => $p['y'] + $p['h'], $parts));
        $w  = $x1 - $x0;
        $h  = $y1 - $y0;
        $m  = array_fill(0, $w * $h, 0);
        $n  = 0;
        foreach ($parts as $p)
            for ($y = 0; $y < $p['h']; $y++)
                for ($x = 0; $x < $p['w']; $x++)
                    if ($p['m'][$y * $p['w'] + $x] && !$m[$i = ($y + $p['y'] - $y0) * $w + $x + $p['x'] - $x0])
                    {
                        $m[$i] = 1;
                        $n++;
                    }

        return ['x' => $x0, 'y' => $y0, 'w' => $w, 'h' => $h, 'n' => $n, 'm' => $m, 'synthetic' => false];
    }

    private function ellipseMask(array $e, bool $synthetic) : ?array
    {
        [$cx, $cy, $rx, $ry] = $e;
        $rx  = max(2.5, $rx);
        $ry  = max(2.5, $ry);
        $bx0 = max(0, (int)floor($cx - $rx));
        $by0 = max(0, (int)floor($cy - $ry));
        $w   = min(self::W, (int)ceil($cx + $rx)) - $bx0;
        $h   = min(self::H, (int)ceil($cy + $ry)) - $by0;
        if ($w <= 0 || $h <= 0)
            return null;

        $m  = array_fill(0, $w * $h, 0);
        $n  = 0;

        for ($y = 0; $y < $h; $y++)
        {
            for ($x = 0; $x < $w; $x++)
            {
                $dx = ($bx0 + $x + 0.5 - $cx) / $rx;
                $dy = ($by0 + $y + 0.5 - $cy) / $ry;
                if ($dx * $dx + $dy * $dy <= 1)
                {
                    $m[$y * $w + $x] = 1;
                    $n++;
                }
            }
        }

        return $n ? ['x' => $bx0, 'y' => $by0, 'w' => $w, 'h' => $h, 'n' => $n, 'm' => $m, 'synthetic' => $synthetic] : null;
    }

    // 3-4 chamfer distance from the mask's edge (pixels outside the mask/box count as background)
    private function chamfer(array $mk) : array
    {
        $w = $mk['w'];
        $h = $mk['h'];
        $m = $mk['m'];
        $INF = 1 << 30;
        $d = [];
        for ($i = 0, $n = $w * $h; $i < $n; $i++)
            $d[$i] = $m[$i] ? $INF : 0;

        for ($y = 0; $y < $h; $y++)
        {
            for ($x = 0; $x < $w; $x++)
            {
                $i = $y * $w + $x;
                if (!$d[$i])
                    continue;

                $v = $d[$i];
                $v = min($v, $x > 0              ? $d[$i - 1]      + 3 : 3);
                $v = min($v, $y > 0              ? $d[$i - $w]     + 3 : 3);
                $v = min($v, $x > 0 && $y > 0    ? $d[$i - $w - 1] + 4 : 4);
                $v = min($v, $x < $w - 1 && $y > 0 ? $d[$i - $w + 1] + 4 : 4);
                $d[$i] = $v;
            }
        }

        for ($y = $h - 1; $y >= 0; $y--)
        {
            for ($x = $w - 1; $x >= 0; $x--)
            {
                $i = $y * $w + $x;
                if (!$d[$i])
                    continue;

                $v = $d[$i];
                $v = min($v, $x < $w - 1              ? $d[$i + 1]      + 3 : 3);
                $v = min($v, $y < $h - 1              ? $d[$i + $w]     + 3 : 3);
                $v = min($v, $x < $w - 1 && $y < $h - 1 ? $d[$i + $w + 1] + 4 : 4);
                $v = min($v, $x > 0 && $y < $h - 1      ? $d[$i + $w - 1] + 4 : 4);
                $d[$i] = $v;
            }
        }

        return $d;
    }

    // zones that (mostly) lie inside a single, much larger zone - e.g. Stormwind in Elwynn
    private function findNested(array $masks) : array
    {
        $nested = [];
        foreach ($masks as $a => $ma)
        {
            foreach ($masks as $b => $mb)
            {
                if ($a == $b || $ma['n'] > $mb['n'] * $this->nestedRatio)
                    continue;

                $ox0 = max($ma['x'], $mb['x']);
                $oy0 = max($ma['y'], $mb['y']);
                $ox1 = min($ma['x'] + $ma['w'], $mb['x'] + $mb['w']);
                $oy1 = min($ma['y'] + $ma['h'], $mb['y'] + $mb['h']);
                if ($ox1 <= $ox0 || $oy1 <= $oy0)
                    continue;

                $cover = 0;
                for ($y = $oy0; $y < $oy1; $y++)
                    for ($x = $ox0; $x < $ox1; $x++)
                        if ($ma['m'][($y - $ma['y']) * $ma['w'] + $x - $ma['x']] && $mb['m'][($y - $mb['y']) * $mb['w'] + $x - $mb['x']])
                            $cover++;

                if ($cover >= $ma['n'] * $this->nestedCover)
                {
                    $nested[$a] = $b;
                    break;
                }
            }
        }

        return $nested;
    }

    private function unionBox(array $masks, int $pad = 1) : array
    {
        $x0 = self::W; $y0 = self::H; $x1 = 0; $y1 = 0;
        foreach ($masks as $m)
        {
            $x0 = min($x0, $m['x']);
            $y0 = min($y0, $m['y']);
            $x1 = max($x1, $m['x'] + $m['w']);
            $y1 = max($y1, $m['y'] + $m['h']);
        }

        return [max(0, $x0 - $pad), max(0, $y0 - $pad), min(self::W, $x1 + $pad), min(self::H, $y1 + $pad)];
    }

    // 3-4 chamfer distance within a box to the nearest pixel where $isSeed is true
    private function boxDistance(callable $isSeed, int $x0, int $y0, int $x1, int $y1) : array
    {
        $w = $x1 - $x0;
        $h = $y1 - $y0;
        $INF = 1 << 30;
        $d = [];
        for ($y = 0; $y < $h; $y++)
            for ($x = 0; $x < $w; $x++)
                $d[$y * $w + $x] = $isSeed(($y0 + $y) * self::W + $x0 + $x) ? 0 : $INF;

        for ($y = 0; $y < $h; $y++)
            for ($x = 0; $x < $w; $x++)
            {
                $i = $y * $w + $x;
                if (!$d[$i]) continue;
                $v = $d[$i];
                if ($x > 0)                 $v = min($v, $d[$i - 1] + 3);
                if ($y > 0)                 $v = min($v, $d[$i - $w] + 3);
                if ($x > 0 && $y > 0)       $v = min($v, $d[$i - $w - 1] + 4);
                if ($x < $w - 1 && $y > 0)  $v = min($v, $d[$i - $w + 1] + 4);
                $d[$i] = $v;
            }

        for ($y = $h - 1; $y >= 0; $y--)
            for ($x = $w - 1; $x >= 0; $x--)
            {
                $i = $y * $w + $x;
                if (!$d[$i]) continue;
                $v = $d[$i];
                if ($x < $w - 1)                $v = min($v, $d[$i + 1] + 3);
                if ($y < $h - 1)                $v = min($v, $d[$i + $w] + 3);
                if ($x < $w - 1 && $y < $h - 1) $v = min($v, $d[$i + $w + 1] + 4);
                if ($x > 0 && $y < $h - 1)      $v = min($v, $d[$i + $w - 1] + 4);
                $d[$i] = $v;
            }

        return $d;
    }

    // morphological closing of the union of all zones; newly covered pixels go to the nearest zone
    private function closeGaps(array &$label, int $x0, int $y0, int $x1, int $y1) : void
    {
        $w = $x1 - $x0;
        $h = $y1 - $y0;
        $r = $this->gapClose * 3;                           // chamfer units

        $toZone = $this->boxDistance(fn($i) => $label[$i] >= 0, $x0, $y0, $x1, $y1);
        $toOut  = $this->boxDistance(function($i) use ($toZone, $x0, $y0, $w, $r) {
            $bi = (intdiv($i, self::W) - $y0) * $w + ($i % self::W) - $x0;
            return $toZone[$bi] > $r;
        }, $x0, $y0, $x1, $y1);

        // seeds: zone pixels bordering a pixel to be filled
        $queue = [];
        for ($y = 0; $y < $h; $y++)
        {
            for ($x = 0; $x < $w; $x++)
            {
                $bi = $y * $w + $x;
                if ($toZone[$bi] == 0 || $toOut[$bi] <= $r)
                    continue;

                $toZone[$bi] = -1;                          // mark as fill candidate
            }
        }

        for ($y = 0; $y < $h; $y++)
            for ($x = 0; $x < $w; $x++)
                if ($label[($y0 + $y) * self::W + $x0 + $x] >= 0)
                    $queue[] = $y * $w + $x;

        // multi-source BFS through the candidates
        for ($q = 0; $q < count($queue); $q++)
        {
            $bi = $queue[$q];
            $bx = $bi % $w;
            $l  = $label[($y0 + intdiv($bi, $w)) * self::W + $x0 + $bx];
            foreach ([$bx > 0 ? $bi - 1 : -1, $bx < $w - 1 ? $bi + 1 : -1, $bi - $w, $bi + $w] as $n)
            {
                if ($n < 0 || $n >= $w * $h || $toZone[$n] !== -1)
                    continue;

                $toZone[$n] = 0;
                $label[($y0 + intdiv($n, $w)) * self::W + $x0 + $n % $w] = $l;
                $queue[] = $n;
            }
        }
    }

    // unlabeled regions that are completely enclosed by a single zone (lakes, glow gaps) belong to that zone
    private function fillHoles(array &$label, int $x0, int $y0, int $x1, int $y1) : void
    {
        $seen = [];
        for ($y = $y0; $y < $y1; $y++)
        {
            for ($x = $x0; $x < $x1; $x++)
            {
                $i = $y * self::W + $x;
                if ($label[$i] >= 0 || isset($seen[$i]))
                    continue;

                $queue = [$i];
                $seen[$i] = true;
                $owners = [];
                $open   = false;
                for ($q = 0; $q < count($queue); $q++)
                {
                    $p  = $queue[$q];
                    $px = $p % self::W;
                    $py = intdiv($p, self::W);
                    if ($px <= $x0 || $px >= $x1 - 1 || $py <= $y0 || $py >= $y1 - 1)
                        $open = true;

                    foreach ([$px > $x0 ? $p - 1 : -1, $px < $x1 - 1 ? $p + 1 : -1, $py > $y0 ? $p - self::W : -1, $py < $y1 - 1 ? $p + self::W : -1] as $n)
                    {
                        if ($n < 0)
                            continue;
                        if ($label[$n] >= 0)
                            $owners[$label[$n]] = true;
                        else if (!isset($seen[$n]))
                        {
                            $seen[$n] = true;
                            $queue[]  = $n;
                        }
                    }
                }

                if (!$open && count($owners) == 1)
                {
                    $l = key($owners);
                    foreach ($queue as $p)
                        $label[$p] = $l;
                }
            }
        }
    }

    // 3x3 majority vote; a pixel takes the label held by >= 5 of its 9 cells
    private function majority(array $label, int $x0, int $y0, int $x1, int $y1) : array
    {
        $out = $label;
        for ($y = max(1, $y0); $y < min(self::H - 1, $y1); $y++)
        {
            for ($x = max(1, $x0); $x < min(self::W - 1, $x1); $x++)
            {
                $i = $y * self::W + $x;
                $c = $label[$i];

                // fast path: uniform neighbourhood
                if ($label[$i - 1] === $c && $label[$i + 1] === $c && $label[$i - self::W] === $c && $label[$i + self::W] === $c &&
                    $label[$i - self::W - 1] === $c && $label[$i - self::W + 1] === $c && $label[$i + self::W - 1] === $c && $label[$i + self::W + 1] === $c)
                    continue;

                $cnt = [];
                foreach ([$i - self::W - 1, $i - self::W, $i - self::W + 1, $i - 1, $i, $i + 1, $i + self::W - 1, $i + self::W, $i + self::W + 1] as $j)
                {
                    $l = $label[$j];
                    $cnt[$l] = ($cnt[$l] ?? 0) + 1;
                }

                arsort($cnt);
                $top = key($cnt);
                if ($cnt[$top] >= 5)
                    $out[$i] = $top;
            }
        }

        return $out;
    }

    private function removeSpecks(array &$label, int $x0, int $y0, int $x1, int $y1) : void
    {
        $seen = [];
        for ($y = $y0; $y < $y1; $y++)
        {
            for ($x = $x0; $x < $x1; $x++)
            {
                $i = $y * self::W + $x;
                if ($label[$i] < 0 || isset($seen[$i]))
                    continue;

                $l     = $label[$i];
                $queue = [$i];
                $comp  = [];
                $seen[$i] = true;
                while ($queue)
                {
                    $p = array_pop($queue);
                    $comp[] = $p;
                    $px = $p % self::W;
                    foreach ([$px > 0 ? $p - 1 : -1, $px < self::W - 1 ? $p + 1 : -1, $p - self::W, $p + self::W] as $q)
                    {
                        if ($q < 0 || $q >= self::W * self::H || isset($seen[$q]) || $label[$q] !== $l)
                            continue;

                        $seen[$q] = true;
                        $queue[]  = $q;
                    }
                }

                if (count($comp) < $this->minSpeck)
                    foreach ($comp as $p)
                        $label[$p] = -1;
            }
        }
    }

    // walks the pixel edges of every label; interior is always on the right-hand side
    private function traceRings(array $label, int $x0, int $y0, int $x1, int $y1) : array
    {
        $VW    = self::W + 1;                               // vertex grid width
        $edges = [];                                        // [label][startVertex] => [endVertex, ..]

        $at = fn($x, $y) => ($x < 0 || $y < 0 || $x >= self::W || $y >= self::H) ? -1 : $label[$y * self::W + $x];

        for ($y = $y0; $y < $y1; $y++)
        {
            for ($x = $x0; $x < $x1; $x++)
            {
                $l = $label[$y * self::W + $x];
                if ($l < 0)
                    continue;

                if ($at($x, $y - 1) !== $l)                 // top    : east
                    $edges[$l][$y * $VW + $x][] = $y * $VW + $x + 1;
                if ($at($x + 1, $y) !== $l)                 // right  : south
                    $edges[$l][$y * $VW + $x + 1][] = ($y + 1) * $VW + $x + 1;
                if ($at($x, $y + 1) !== $l)                 // bottom : west
                    $edges[$l][($y + 1) * $VW + $x + 1][] = ($y + 1) * $VW + $x;
                if ($at($x - 1, $y) !== $l)                 // left   : north
                    $edges[$l][($y + 1) * $VW + $x][] = $y * $VW + $x;
            }
        }

        $rings = [];
        foreach ($edges as $l => $out)
        {
            foreach (array_keys($out) as $start)
            {
                while (!empty($out[$start]))
                {
                    $ring = [];
                    $cur  = $start;
                    $next = array_pop($out[$start]);
                    $dx   = ($next % $VW) - ($cur % $VW);
                    $dy   = intdiv($next, $VW) - intdiv($cur, $VW);

                    while (true)
                    {
                        $ring[] = [$cur % $VW, intdiv($cur, $VW)];
                        $cur    = $next;
                        if ($cur == $start)
                            break;

                        $cands = $out[$cur] ?? [];
                        if (!$cands)
                            break;                          // should not happen on a closed boundary

                        // prefer right turn, then straight, then left - keeps diagonal-only contacts apart
                        $pick = 0;
                        if (count($cands) > 1)
                        {
                            $prefs = [[-$dy, $dx], [$dx, $dy], [$dy, -$dx]];
                            foreach ($prefs as [$px, $py])
                            {
                                foreach ($cands as $k => $c)
                                {
                                    if (($c % $VW) - ($cur % $VW) == $px && intdiv($c, $VW) - intdiv($cur, $VW) == $py)
                                    {
                                        $pick = $k;
                                        break 2;
                                    }
                                }
                            }
                        }

                        $next = $cands[$pick];
                        array_splice($out[$cur], $pick, 1);
                        $dx = ($next % $VW) - ($cur % $VW);
                        $dy = intdiv($next, $VW) - intdiv($cur, $VW);
                    }

                    if (count($ring) >= 4)
                        $rings[$l][] = $ring;
                }
            }
        }

        return $rings;
    }

    private function dropCollinear(array $ring) : array
    {
        $n = count($ring);
        $out = [];
        for ($i = 0; $i < $n; $i++)
        {
            [$ax, $ay] = $ring[($i - 1 + $n) % $n];
            [$bx, $by] = $ring[$i];
            [$cx, $cy] = $ring[($i + 1) % $n];
            if (($bx - $ax) * ($cy - $by) - ($by - $ay) * ($cx - $bx) != 0)
                $out[] = $ring[$i];
        }

        return $out;
    }

    private function douglasPeucker(array $ring, float $eps) : array
    {
        $n = count($ring);
        if ($n < 4)
            return $ring;

        // split the closed ring at its two most distant points
        $far = 0; $fd = -1;
        for ($i = 1; $i < $n; $i++)
        {
            $d = ($ring[$i][0] - $ring[0][0]) ** 2 + ($ring[$i][1] - $ring[0][1]) ** 2;
            if ($d > $fd) { $fd = $d; $far = $i; }
        }

        $a = $this->dpLine(array_slice($ring, 0, $far + 1), $eps);
        $b = $this->dpLine(array_merge(array_slice($ring, $far), [$ring[0]]), $eps);

        array_pop($a);
        array_pop($b);

        return array_merge($a, $b);
    }

    private function dpLine(array $pts, float $eps) : array
    {
        $n = count($pts);
        if ($n < 3)
            return $pts;

        [$ax, $ay] = $pts[0];
        [$bx, $by] = $pts[$n - 1];
        $dx  = $bx - $ax;
        $dy  = $by - $ay;
        $len = sqrt($dx * $dx + $dy * $dy) ?: 1e-9;

        $idx = 0; $max = -1;
        for ($i = 1; $i < $n - 1; $i++)
        {
            $d = abs($dy * $pts[$i][0] - $dx * $pts[$i][1] + $bx * $ay - $by * $ax) / $len;
            if ($d > $max) { $max = $d; $idx = $i; }
        }

        if ($max <= $eps)
            return [$pts[0], $pts[$n - 1]];

        $l = $this->dpLine(array_slice($pts, 0, $idx + 1), $eps);
        $r = $this->dpLine(array_slice($pts, $idx), $eps);
        array_pop($l);

        return array_merge($l, $r);
    }

    private function chaikinRing(array $ring) : array
    {
        $n = count($ring);
        if ($n < 3)
            return $ring;

        $out = [];
        for ($i = 0; $i < $n; $i++)
        {
            [$ax, $ay] = $ring[$i];
            [$bx, $by] = $ring[($i + 1) % $n];
            $out[] = [0.75 * $ax + 0.25 * $bx, 0.75 * $ay + 0.25 * $by];
            $out[] = [0.25 * $ax + 0.75 * $bx, 0.25 * $ay + 0.75 * $by];
        }

        return $out;
    }

    private function ringArea(array $ring) : float
    {
        $a = 0.0;
        $n = count($ring);
        for ($i = 0; $i < $n; $i++)
        {
            [$x0, $y0] = $ring[$i];
            [$x1, $y1] = $ring[($i + 1) % $n];
            $a += $x0 * $y1 - $x1 * $y0;
        }

        return $a / 2;
    }
}


CLISetup::registerSetup("build", new class extends SetupScript
{
    use TrImageProcessor;

    protected $info = array(
        'zoneshapes' => [[], CLISetup::ARGV_PARAM, 'Compute clickable zone / subzone outlines for the world, continent and zone maps from the client\'s map textures.']
    );

    protected $dbcSourceFiles  = ['worldmaparea', 'worldmaptransforms', 'worldmapoverlay', 'factiontemplate'];
    protected $setupAfter      = [['zones'], []];
    protected $worldDependency = ['creature', 'creature_template', 'game_event_creature'];
    protected $requiredDirs   = ['datasets/', 'static/js/zone-shapes/'];
    protected $localized      = true;                       // zone-names

    private const OUT_SHAPES = 'datasets/zone-shapes';      // world, cosmic + continent outlines (?data=zone-shapes)
    private const OUT_SUB    = 'static/js/zone-shapes/%d.json'; // subzone outlines per zone map, fetched on demand
    private const OUT_NAMES  = 'datasets/%s/zone-names';    // localized names for everything not in g_zones (?data=zone-names)
    private const DECIMALS   = 2;                           // output in % of map size

    // continent zone id (as used by Mapper) => WorldMapArea.dbc/id
    private const CONTINENTS = array(
        -3 => 14,                                           // Eastern Kingdoms
        -6 => 13,                                           // Kalimdor
        -2 => 466,                                          // Outland
        -5 => 485                                           // Northrend
    );

    /*  World map (-1): continent highlight textures. The client places these in code, so the placement on the
     *  1002x668 map was fitted once against the world map art (texture outline vs. coastline, NCC ~0.3-0.4).
     *  [texture, x, y, scaleX, scaleY] - the texture is drawn at x/y with size 512 * scale
     */
    private const WORLD_CONTINENTS = array(
        -3 => ['Azeroth/AzerothHighlight',     702,  56, 1.182, 1.118],
        -6 => ['Kalimdor/KalimdorHighlight',    -1, 131, 0.962, 0.959],
        -5 => ['Northrend/NorthrendHighlight', 354,   9, 0.647, 0.652]
    );

    /*  Cosmic map (-4): its highlight textures are decorative rings, so the two globes are used directly
     *  (circles detected on the map art). [cx, cy, r] in px of the 1002x668 map
     */
    private const COSMIC_WORLDS = array(
        -1 => [777, 425, 163],                              // Azeroth
        -2 => [309, 228, 166]                               // Outland
    );

    private const SUBZONE_ALPHA = 64;                       // overlay texel opacity (0-255) that counts as part of the subzone

    // subzone level range from the creatures spawned inside its outline
    private const LEVEL_MIN_SPAWNS = 4;                     // fewer hostile spawns than this: no level range
    private const LEVEL_PCT_LOW    = 0.10;                  // percentiles of the spawns' min / max levels, so a single
    private const LEVEL_PCT_HIGH   = 0.90;                  // rare elite or boss does not stretch the range

    // zones without level range in LFGDungeons.dbc (and thus ?_zones)
    private const LEVEL_FALLBACK = array(
          41 => [55, 60],                                   // Deadwind Pass
         493 => [55, 60],                                   // Moonglade
        2817 => [74, 76],                                   // Crystalsong Forest
        4742 => [77, 80]                                    // Hrothgar's Landing
    );

    // src, resourcePath, localized, [tileOrder], [[dest, destW, destH]]
    private $genSteps = array(
        ['WorldMap/', null, true, [], []]
    );

    private $srcDir      = '';
    private $onContinent = [];                              // zoneId => [contZoneId, contWMA, offsetX, offsetY (WorldMapTransforms)]
    private $contShapes  = [];                              // zoneId => outline on its continent map

    public function __construct()
    {
        $this->imgPath     = CLISetup::$srcDir.$this->imgPath;
        $this->maxExecTime = ini_get('max_execution_time');
    }

    public function generate() : bool
    {
        if (!$this->checkSourceDirs())
        {
            // localized source dirs: we only need one, as none of the used textures carry text
            if (!$this->genSteps[0][self::GEN_IDX_SRC_REAL])
            {
                CLI::write('[zoneshapes] Interface/WorldMap/ not found in any locale.', CLI::LOG_ERROR);
                return false;
            }

            $this->success = true;
        }

        $this->srcDir = reset($this->genSteps[0][self::GEN_IDX_SRC_REAL]);

        $wmAreas    = DB::Aowow()->select('SELECT `id` AS ARRAY_KEY, `id`, `mapId`, `areaId`, `nameINT`, `left`, `right`, `top`, `bottom` FROM dbc_worldmaparea');
        $transforms = DB::Aowow()->select('SELECT * FROM dbc_worldmaptransforms WHERE `targetMapId` <> `sourceMapId`');
        $overlays   = DB::Aowow()->select('SELECT `id` AS ARRAY_KEY, `worldMapAreaId`, `areaTableId`, `textureString`, `w`, `h`, `x`, `y` FROM dbc_worldmapoverlay WHERE `textureString` <> "" AND `areaTableId` > 0');
        $levels     = DB::Aowow()->select('SELECT `id` AS ARRAY_KEY, `levelMin`, `levelMax` FROM ?_zones');

        if (!$wmAreas)
        {
            CLI::write('[zoneshapes] could not read WorldMapArea.dbc from db', CLI::LOG_ERROR);
            return false;
        }

        $data = [];

        // continents: zone highlights
        foreach (self::CONTINENTS as $contZoneId => $wmaId)
        {
            if (!($cont = $wmAreas[$wmaId] ?? null))
            {
                CLI::write('[zoneshapes] continent WorldMapArea '.$wmaId.' missing', CLI::LOG_WARN);
                continue;
            }

            $zones = [];
            foreach ($wmAreas as $wma)
            {
                if (!$wma['areaId'] || $wma['left'] == $wma['right'] || $wma['top'] == $wma['bottom'])
                    continue;

                [$l, $r, $t, $b] = [$wma['left'], $wma['right'], $wma['top'], $wma['bottom']];

                // zones shown on another map's continent (Eversong, Azuremyst, ..) are shifted by WorldMapTransforms.dbc
                $mapId = $wma['mapId'];
                $cx    = ($t + $b) / 2;
                $cy    = ($l + $r) / 2;
                foreach ($transforms as $tf)
                {
                    if ($tf['sourceMapId'] != $mapId || $cx < $tf['minX'] || $cx > $tf['maxX'] || $cy < $tf['minY'] || $cy > $tf['maxY'])
                        continue;

                    $mapId = $tf['targetMapId'];
                    $t += $tf['offsetX']; $b += $tf['offsetX'];
                    $l += $tf['offsetY']; $r += $tf['offsetY'];
                    break;
                }

                if ($mapId != $cont['mapId'])
                    continue;

                if (!($img = $this->loadTexture($wma['nameINT'].'/'.$wma['nameINT'].'Highlight')))
                    continue;

                $this->onContinent[$wma['areaId']] = [$contZoneId, $cont, $t - $wma['top'], $l - $wma['left']];

                $zones[] = array(
                    'id'   => $wma['areaId'],
                    'img'  => $img,
                    'rect' => array(
                        ($cont['left'] - $l) / ($cont['left'] - $cont['right']) * ZoneShapeTracer::MAP_W,
                        ($cont['top']  - $t) / ($cont['top']  - $cont['bottom']) * ZoneShapeTracer::MAP_H,
                        ($cont['left'] - $r) / ($cont['left'] - $cont['right']) * ZoneShapeTracer::MAP_W,
                        ($cont['top']  - $b) / ($cont['top']  - $cont['bottom']) * ZoneShapeTracer::MAP_H
                    )
                );
            }

            $rects = [];                                    // zone map rect on the continent; lets the page convert clicks into .go zonexy coords
            foreach ($zones as $z)
                $rects[$z['id']] = array(
                    round($z['rect'][0] * 100 / ZoneShapeTracer::MAP_W, 3), round($z['rect'][1] * 100 / ZoneShapeTracer::MAP_H, 3),
                    round($z['rect'][2] * 100 / ZoneShapeTracer::MAP_W, 3), round($z['rect'][3] * 100 / ZoneShapeTracer::MAP_H, 3)
                );

            foreach ($this->traceMap($contZoneId, $cont['nameINT'], $zones) as $zoneId => $rings)
            {
                $this->contShapes[$zoneId] = $rings;
                $data[$contZoneId][$zoneId] = ['p' => $rings, 'r' => $rects[$zoneId]];
                if (isset($levels[$zoneId]) && $levels[$zoneId]['levelMax'])
                    $data[$contZoneId][$zoneId]['l'] = [(int)$levels[$zoneId]['levelMin'], (int)$levels[$zoneId]['levelMax']];
                else if (isset(self::LEVEL_FALLBACK[$zoneId]))
                    $data[$contZoneId][$zoneId]['l'] = self::LEVEL_FALLBACK[$zoneId];
            }
        }

        // world map: continent outlines
        $zones = [];
        foreach (self::WORLD_CONTINENTS as $contZoneId => [$tex, $x, $y, $sx, $sy])
            if ($img = $this->loadTexture($tex))
                $zones[] = ['id' => $contZoneId, 'img' => $img, 'crop' => false, 'outline' => true, 'rect' => [$x, $y, $x + imagesx($img) * $sx, $y + imagesy($img) * $sy]];

        foreach ($this->traceMap(-1, 'World', $zones) as $zoneId => $rings)
            $data[-1][$zoneId] = ['p' => $rings];

        // cosmic map: Azeroth + Outland
        $zones = [];
        foreach (self::COSMIC_WORLDS as $zoneId => [$cx, $cy, $r])
            $zones[] = ['id' => $zoneId, 'ellipse' => [$cx, $cy, $r, $r]];

        foreach ($this->traceMap(-4, 'Cosmic', $zones) as $zoneId => $rings)
            $data[-4][$zoneId] = ['p' => $rings];

        // zone maps: subzones from WorldMapOverlay.dbc (the "explored" textures)
        $byWma = [];
        foreach ($overlays as $ov)
            $byWma[$ov['worldMapAreaId']][$ov['areaTableId']][] = $ov;

        $nSub     = 0;
        $nLevels  = 0;
        $sub      = [];
        $friendly = $this->friendlyFactions();
        foreach ($byWma as $wmaId => $areas)
        {
            $wma = $wmAreas[$wmaId] ?? null;
            if (!$wma || !$wma['areaId'])
                continue;

            $zones = [];
            foreach ($areas as $areaId => $ovs)
            {
                $parts = [];
                foreach ($ovs as $ov)
                    if ($img = $this->assembleOverlay($wma['nameINT'], $ov))
                        $parts[] = ['img' => $img, 'crop' => false, 'mode' => 'alpha', 'threshold' => self::SUBZONE_ALPHA, 'rect' => [$ov['x'], $ov['y'], $ov['x'] + $ov['w'], $ov['y'] + $ov['h']]];

                if ($parts)
                    $zones[] = ['id' => $areaId, 'parts' => $parts];
            }

            $shapes = [];
            foreach ($this->traceMap($wma['areaId'], $wma['nameINT'], $zones, true) as $areaId => $rings)
                $shapes[$areaId] = ['p' => $rings];

            if (!$shapes)
                continue;

            foreach ($this->subzoneLevels($wma, $shapes, $friendly) as $areaId => $range)
            {
                $shapes[$areaId]['l'] = $range;
                $nLevels++;
            }

            // sanctuaries (capital cities, ..) keep their flag-based range, which the page shows as "Sanctuary"
            foreach ($shapes as $areaId => &$e)
                if (isset($levels[$areaId]) && $levels[$areaId]['levelMin'] <= 1 && $levels[$areaId]['levelMax'] >= 70)
                    $e['l'] = [(int)$levels[$areaId]['levelMin'], (int)$levels[$areaId]['levelMax']];
            unset($e);

            if (!CLISetup::writeFile(sprintf(self::OUT_SUB, $wma['areaId']), json_encode($shapes, JSON_UNESCAPED_SLASHES)))
                $this->success = false;

            $sub[$wma['areaId']] = array_keys($shapes);
            $nSub += count($shapes);
        }

        ksort($sub);
        CLI::write('[zoneshapes] '.$nSub.' subzone outlines on '.count($sub).' zone maps, '.$nLevels.' with a level range from creature spawns');

        if (!$data)
        {
            CLI::write('[zoneshapes] no shapes generated', CLI::LOG_ERROR);
            return false;
        }

        $js  = "var g_zone_shapes = ".json_encode($data, JSON_UNESCAPED_SLASHES).";\n";
        $js .= "var g_zone_subshapes = ".json_encode(array_keys($sub)).";\n";
        if (!CLISetup::writeFile(self::OUT_SHAPES, $js))
            $this->success = false;

        // localized names for everything that is not in g_zones (subzones)
        $ids = [];
        foreach ($data as $shapes)
            $ids = array_merge($ids, array_keys($shapes));
        foreach ($sub as $areaIds)
            $ids = array_merge($ids, $areaIds);

        $ids   = array_unique(array_filter($ids, fn($x) => $x > 0));
        $names = $ids ? DB::Aowow()->select('SELECT `id` AS ARRAY_KEY, `name_loc0`, `name_loc1`, `name_loc2`, `name_loc3`, `name_loc4`, `name_loc5`, `name_loc6`, `name_loc7`, `name_loc8` FROM ?_zones WHERE `id` IN (?a)', $ids) : [];

        foreach (CLISetup::$locales as $loc)
        {
            Lang::load($loc);

            $out = [];
            foreach ($names as $id => $row)
                $out[$id] = Util::localizedString($row, 'name');

            if (!CLISetup::writeFile(sprintf(self::OUT_NAMES, $loc->json()), "var g_zone_shape_names = ".Util::toJSON($out).";\n"))
                $this->success = false;
        }

        return $this->success;
    }

    private function traceMap(int $mapZoneId, string $label, array $zones, bool $quiet = false) : array
    {
        if (!$zones)
            return [];

        ini_set('max_execution_time', $this->maxExecTime);

        $tracer = new ZoneShapeTracer();
        $result = $tracer->trace($zones);

        if (!$quiet)
            CLI::write('[zoneshapes] '.str_pad($label, 18).str_pad(count($zones), 3, ' ', STR_PAD_LEFT).' areas in, '.str_pad(count($result), 3, ' ', STR_PAD_LEFT).' outlines out');

        foreach ($result as &$rings)
            foreach ($rings as &$ring)
                foreach ($ring as $i => &$v)
                    $v = round($v * 100 / ($i % 2 ? ZoneShapeTracer::MAP_H : ZoneShapeTracer::MAP_W), self::DECIMALS);

        return $result;
    }

    // faction templates that belong to a player faction or are friendly to players - their creatures don't count for levels
    private function friendlyFactions() : array
    {
        $rows = DB::Aowow()->select('SELECT `id` AS ARRAY_KEY, `ourMask`, `friendlyMask` FROM dbc_factiontemplate');
        $out  = [];
        foreach ($rows ?: [] as $id => $r)
            if (($r['ourMask'] & 0x7) || ($r['friendlyMask'] & 0x7))        // 0x1: player, 0x2: alliance, 0x4: horde
                $out[$id] = true;

        return $out;
    }

    /*  level range per subzone from the hostile / neutral creatures spawned inside its outline
     *  skipped: npcs with gossip/vendor/.. flags, critters, non-combat pets, unattackable / unselectable units,
     *  civilians, triggers, guards, anything of a player-friendly faction and holiday spawns (game_event_creature)
     */
    private function subzoneLevels(array $wma, array $shapes, array $friendly) : array
    {
        [$l, $r, $t, $b] = [$wma['left'], $wma['right'], $wma['top'], $wma['bottom']];
        if ($l == $r || $t == $b)
            return [];

        $spawns = DB::World()->select(
           'SELECT c.`position_x` AS "x", c.`position_y` AS "y", ct.`minlevel`, ct.`maxlevel`, ct.`faction`
            FROM   creature c
            JOIN   creature_template ct ON ct.`entry` = c.`id1`
            WHERE  c.`map` = ?d AND c.`position_x` BETWEEN ?f AND ?f AND c.`position_y` BETWEEN ?f AND ?f AND
                   ct.`npcflag` = 0 AND c.`npcflag` = 0 AND ct.`type` NOT IN (8, 12) AND ct.`minlevel` > 0 AND
                   (ct.`unit_flags` & ?d) = 0 AND (c.`unit_flags` & ?d) = 0 AND (ct.`flags_extra` & ?d) = 0 AND
                   NOT EXISTS (SELECT 1 FROM game_event_creature gec WHERE gec.`guid` = c.`guid` AND gec.`eventEntry` > 0)',
            $wma['mapId'], min($t, $b), max($t, $b), min($l, $r), max($l, $r),
            0x2 | 0x100 | 0x2000000,                        // UNIT_FLAG_NON_ATTACKABLE | UNIT_FLAG_IMMUNE_TO_PC | UNIT_FLAG_NOT_SELECTABLE
            0x2 | 0x2000000,
            0x2 | 0x80 | 0x8000                             // CREATURE_FLAG_EXTRA_CIVILIAN | _TRIGGER | _GUARD
        );

        if (!$spawns)
            return [];

        // bounding boxes of the outlines for a quick reject
        $boxes = [];
        foreach ($shapes as $areaId => $e)
        {
            $x0 = $y0 = 100; $x1 = $y1 = 0;
            foreach ($e['p'] as $ring)
                for ($i = 0, $n = count($ring); $i < $n; $i += 2)
                {
                    $x0 = min($x0, $ring[$i]);     $x1 = max($x1, $ring[$i]);
                    $y0 = min($y0, $ring[$i + 1]); $y1 = max($y1, $ring[$i + 1]);
                }
            $boxes[$areaId] = [$x0, $y0, $x1, $y1];
        }

        // the zone map's rectangle overlaps its neighbours: only count spawns inside the zone's own continent outline
        $contCheck = null;
        if (isset($this->onContinent[$wma['areaId']], $this->contShapes[$wma['areaId']]))
        {
            [, $cont, $ox, $oy] = $this->onContinent[$wma['areaId']];
            $contCheck = function ($x, $y) use ($cont, $ox, $oy, $wma) {
                $cx = ($cont['left'] - ($y + $oy)) / ($cont['left'] - $cont['right']) * 100;
                $cy = ($cont['top']  - ($x + $ox)) / ($cont['top']  - $cont['bottom']) * 100;
                return $this->pointInRings($cx, $cy, $this->contShapes[$wma['areaId']]);
            };
        }

        $lows = $highs = [];
        foreach ($spawns as $sp)
        {
            if (isset($friendly[$sp['faction']]))
                continue;

            if ($contCheck && !$contCheck($sp['x'], $sp['y']))
                continue;

            // world -> map coords (%)
            $px = ($l - $sp['y']) / ($l - $r) * 100;
            $py = ($t - $sp['x']) / ($t - $b) * 100;

            foreach ($boxes as $areaId => [$x0, $y0, $x1, $y1])
            {
                if ($px < $x0 || $px > $x1 || $py < $y0 || $py > $y1 || !$this->pointInRings($px, $py, $shapes[$areaId]['p']))
                    continue;

                $lows[$areaId][]  = (int)$sp['minlevel'];
                $highs[$areaId][] = (int)$sp['maxlevel'];
                break;
            }
        }

        $result = [];
        foreach ($lows as $areaId => $lo)
        {
            if (count($lo) < self::LEVEL_MIN_SPAWNS)
                continue;

            $hi = $highs[$areaId];
            sort($lo);
            sort($hi);
            $min = $lo[(int)floor((count($lo) - 1) * self::LEVEL_PCT_LOW)];
            $max = $hi[(int)ceil((count($hi) - 1) * self::LEVEL_PCT_HIGH)];
            $result[$areaId] = [min($min, $max), max($min, $max)];
        }

        return $result;
    }

    private function pointInRings(float $x, float $y, array $rings) : bool
    {
        $in = false;
        foreach ($rings as $p)
            for ($i = 0, $n = count($p), $j = $n - 2; $i < $n; $j = $i, $i += 2)
                if ((($p[$i + 1] > $y) != ($p[$j + 1] > $y)) && ($x < ($p[$j] - $p[$i]) * ($y - $p[$i + 1]) / ($p[$j + 1] - $p[$i + 1]) + $p[$i]))
                    $in = !$in;

        return $in;
    }

    private function loadTexture(string $relPath) : ?GdImage
    {
        $img = $this->loadImageFile($this->srcDir.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $relPath), $noSrc);
        if (!$img)
            CLI::write('[zoneshapes] - texture '.$relPath.' '.($noSrc ? 'missing' : 'unreadable'), CLI::LOG_WARN);

        return $img;
    }

    // overlay textures are split into 256x256 tiles: <texture>1 .. <texture>N, row by row
    private function assembleOverlay(string $nameINT, array $ov) : ?GdImage
    {
        $dest = imagecreatetruecolor($ov['w'], $ov['h']);
        imagealphablending($dest, false);
        imagesavealpha($dest, true);
        imagefill($dest, 0, 0, imagecolorallocatealpha($dest, 0, 0, 0, 127));

        $i = 1;
        for ($y = 0; $y < $ov['h']; $y += 256)
        {
            for ($x = 0; $x < $ov['w']; $x += 256)
            {
                if (!($tile = $this->loadTexture($nameINT.'/'.$ov['textureString'].$i++)))
                    return null;

                imagecopy($dest, $tile, $x, $y, 0, 0, min(imagesx($tile), $ov['w'] - $x), min(imagesy($tile), $ov['h'] - $y));
            }
        }

        return $dest;
    }
});

?>
