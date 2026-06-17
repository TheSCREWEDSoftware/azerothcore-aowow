<?php

// debugging START (disable this in production) // Qeme
// ini_set('display_errors', 1);
// ini_set('display_startup_errors', 1);
// error_reporting(E_ALL);

// echo "index.php is being executed.<br>";
// debugging END

require 'includes/kernel.php';

if (CLI)
    die("this script must not be run from CLI.\nto setup aowow use 'php aowow'\n");


// Easter egg: Mankrik's Wife — https://www.wowhead.com/search=mankrik+wife
if ($pageCall === 'search' && preg_match("/mankrik'?s?\s+wife/i", urldecode($pageParam)))
{
    header('Location: ?maps=17:493504246248246262246275246287246302246314220234233234242234262234251234272234290236291248291260291277291289291310291322299277310277319277332254332240332267332277332318334300369236370275371310410312398312387306379306369295370258378238388236380266393266401266398234411234430236430279431316431297431254441233459234466246461258455269445281455295466306475316505229503304503287503273505256516234511310520314549312515267527267534267528233540233549233430267505240579330579347579366572390562403549419519407588328612374612353607388602405595425589436575454582446531413538421569491514487527493549491511473512458516425558491601326585481567467615335608322577475531314538314452229512438536493577491', true, 302);
    exit;
}

$altClass = '';
switch ($pageCall)
{
    /* called by user */
    case '':                                                // no parameter given -> MainPage
        $altClass = 'home';
    case 'home':
    case 'admin':
    case 'account':                                         // account management [nyi]
    case 'achievement':
    case 'achievements':
    case 'areatrigger':
    case 'areatriggers':
    case 'arena-team':
    case 'arena-teams':
    case 'class':
    case 'classes':
    case 'currency':
    case 'currencies':
    case 'compare':                                         // tool: item comparison
    case 'emote':
    case 'emotes':
    case 'enchantment':
    case 'enchantments':
    case 'event':
    case 'events':
    case 'faction':
    case 'factions':
    case 'guide':
    case 'guides':
    case 'guild':
    case 'guilds':
    case 'icon':
    case 'icons':
    case 'item':
    case 'items':
    case 'itemset':
    case 'itemsets':
    case 'maps':                                            // tool: map listing
    case 'mail':
    case 'mails':
    case 'my-guides':
        if ($pageCall == 'my-guides')
            $altClass = 'guides';
    case 'npc':
    case 'npcs':
    case 'object':
    case 'objects':
    case 'pet':
    case 'pets':
    case 'petcalc':                                         // tool: pet talent calculator
        if ($pageCall == 'petcalc')
            $altClass = 'talent';
    case 'profile':                                         // character profiler [nyi]
    case 'profiles':                                        // character profile listing [nyi]
    case 'profiler':                                        // character profiler main page
    case 'quest':
    case 'quests':
    case 'race':
    case 'races':
    case 'screenshot':                                      // prepare uploaded screenshots
    case 'search':                                          // tool: searches
    case 'skill':
    case 'skills':
    case 'sound':
    case 'sounds':
    case 'spell':
    case 'spells':
    case 'talent':                                          // tool: talent calculator
    case 'title':
    case 'titles':
    case 'user':
    case 'video':
    case 'zone':
    case 'zones':
    /* called by script */
    case 'data':                                            // tool: dataset-loader
    case 'cookie':                                          // lossless cookies and user settings
    case 'contactus':
    case 'comment':
    case 'edit':                                            // guide editor: targeted by QQ fileuploader, detail-page article editor
    case 'get-description':                                 // guide editor: shorten fulltext into description
    case 'filter':                                          // pre-evaluate filter POST-data; sanitize and forward as GET-data
    case 'go-to-reply':                                     // find page the reply is on and forward
        if ($pageCall == 'go-to-reply')
            $altClass = 'go-to-comment';
    case 'go-to-comment':                                   // find page the comment is on and forward
    case 'locale':                                          // subdomain-workaround, change the language
        $cleanName = str_replace(['-', '_'], '', ucFirst($altClass ?: $pageCall));
        try                                                 // can it be handled as ajax?
        {
            $out   = '';
            $class = 'Ajax'.$cleanName;
            $ajax  = new $class(explode('.', $pageParam));

            if ($ajax->handle($out))
            {
                Util::sendNoCacheHeader();

                if ($ajax->doRedirect)
                    header('Location: '.$out, true, 302);
                else
                {
                    header($ajax->getContentType());
                    die($out);
                }
            }
            else
                throw new Exception('not handled as ajax');
        }
        catch (Exception $e)                                // no, apparently not..
        {
            $class = $cleanName.'Page';
            $classInstance = class_exists($class) ? new $class($pageCall, $pageParam) : null;

            if (is_callable([$classInstance, 'display']))
                $classInstance->display();
            else if (isset($_GET['power']))
                die('$WowheadPower.register(0, '.Lang::getLocale()->value.', {})');
            else                                            // in conjunction with a proper rewriteRule in .htaccess...
                (new GenericPage($pageCall))->error();
        }

        break;
    /* other pages */
    case 'whats-new':
    case 'searchplugins':
    case 'searchbox':
    case 'tooltips':
    case 'help':
    case 'faq':
    case 'aboutus':
    case 'reputation':
    case 'privilege':
    case 'privileges':
    case 'top-users':
        (new MorePage($pageCall, $pageParam))->display();
        break;
    case 'latest-additions':
    case 'latest-comments':
    case 'latest-screenshots':
    case 'latest-videos':
    case 'unrated-comments':
    case 'missing-screenshots':
    case 'most-comments':
    case 'random':
    case 'errors':                                          // tool: error log viewer
        (new UtilityPage($pageCall, $pageParam))->display();
        break;
    default:                                                // unk parameter given -> ErrorPage
        if (isset($_GET['power']))
            die('$WowheadPower.register(0, '.Lang::getLocale()->value.', {})');
        else                                                // in conjunction with a proper rewriteRule in .htaccess...
            (new GenericPage($pageCall))->error();
        break;
}

?>
