// mods/powerclasses in the game client: each Commander and Executor power shown as the client shows an Operator's, by the
// very code that shows those: its beam and icon where it lands, the red flare over whatever its effect is on while it
// lasts, and its icon under Powers and Effects in the side panel. ICONS (power ->
// texture), PANEL_ICONS (power -> image), CLASSES and POWERS are table.rs's, written ahead of this file. Runs every time the
// client connects (backend::mods::Registry::client_js), so a second run in the same page only puts its renderer hook in
// place of the first's and changes nothing else again.

// Where a power lands. The renderer draws a power from a power creep's `actionLog.power` (powerInfluence.js in
// github.com/screeps/renderer): the icon its table INFLUENCE_TEXTURE gives the power's id, on the square the power was used
// on, growing in and fading over the tick. That table holds the Operator's powers alone, and on an id it does not hold the
// renderer throws and stops drawing the room, so the server logs this mod's powers as `actionLog.classPower`, which the
// renderer leaves alone. Just before the renderer reads a tick, each becomes `actionLog.power` again, with an id the table
// finds: INFLUENCE_TEXTURE is a plain object inside renderer.js, so it inherits from Object.prototype, which gets the ids
// `krebs.powerclasses.<power>`, not enumerable, holding the texture. Nothing but that lookup reads those names.
var PREFIX = 'krebs.powerclasses.';

function installRoom() {
    var renderer = window.GameRenderer && window.GameRenderer.prototype;
    if(!renderer) {
        return false;
    }
    Object.keys(ICONS).forEach(function(power) {
        if(!Object.prototype.hasOwnProperty.call(Object.prototype, PREFIX + power)) {
            Object.defineProperty(Object.prototype, PREFIX + power, {value: ICONS[power], configurable: true});
        }
    });
    // The client keeps its page when it connects again, maybe to a server with a newer version of this mod: this run's
    // wrapper takes the place of one an earlier run left, around the renderer's own applyState. Over any other wrapper it
    // goes on top, which does no harm, since nothing below changes what has been changed once.
    var applyState = renderer.applyState.krebsPowerClassesOriginal || renderer.applyState;
    Object.defineProperty(renderer, 'krebsPowerClasses', {value: true, configurable: true});
    renderer.applyState = function(state) {
        var objects = state && state.objects;
        var list = Array.isArray(objects) ? objects : objects ? Object.keys(objects).map(function(id) { return objects[id]; }) : [];
        for(var i = 0; i < list.length; i++) {
            // the client hands the renderer a deep copy of its objects each tick, so this changes none of its own
            var log = list[i] && list[i].actionLog, used = log && log.classPower;
            if(used && ICONS[used.id] && !log.power) {
                log.power = {id: PREFIX + used.id, x: used.x, y: used.y};
            }
            // The red flare the renderer pulses over anything under a power's effect (_all.metadata.js, hasEffect) looks
            // the effect's power up in its POWER_INFO, which holds the Operator's alone; under the names above, it finds
            // these too. Nothing else in the renderer reads an effect's power but the factory, for PWR_OPERATE_FACTORY.
            var effects = list[i] && list[i].effects;
            if(effects && typeof effects == 'object') {
                Object.keys(effects).forEach(function(k) {
                    var e = effects[k];
                    if(e && ICONS[e.power]) {
                        e.power = PREFIX + e.power;
                    }
                });
            }
        }
        return applyState.apply(this, arguments);
    };
    renderer.applyState.krebsPowerClassesOriginal = applyState;
    return true;
}

// The side panel. A selected power creep's Powers, and any object's Effects, are drawn by the client's effect-icon directive
// (components/game/room/effect-icon): it names a power by the key of the client's Constants that holds its number, `PWR_*`,
// shows `icons/<name>.svg` from the client's own files, and takes the cooldown and duration bars from `POWER_INFO`. Constants
// learns this mod's powers as a bot's game does in game.js: `PWR_*`, `POWER_INFO` and `POWER_CLASS`. The client has no
// `icons/PWR_ENCOURAGE.svg` and the like; it ships the Commander's and the Executor's icons, in this style, for its Power
// Creeps page instead, so the directive's template looks in PANEL_ICONS (on the root scope, where every template reaches it)
// before it builds that name. A template Angular compiled before this ran keeps the old lookup, and the Power Creeps page asks
// for `app2/assets/powers/operator/<power>.svg` whatever the class: an image of one of this mod's powers that does not load
// gets its icon from PANEL_ICONS instead.
var PANEL_SRC = "ng-src='components/game/room/effect-icon/icons/{{EffectIcon.name}}.svg'";
var PANEL_OURS = "ng-src='{{$root.krebsPowerIcons[EffectIcon.effectId] || " +
    "(EffectIcon.name && \"components/game/room/effect-icon/icons/\" + EffectIcon.name + \".svg\")}}'";
var MISSING = [/\/effect-icon\/icons\/PWR_([A-Z_]+)\.svg$/, /\/app2\/assets\/powers\/operator\/([a-z-]+)\.svg$/];

function ownIcon(img) {
    var src = img && img.tagName == 'IMG' && img.getAttribute('src') && img.src;
    for(var i = 0; src && i < MISSING.length; i++) {
        var name = (MISSING[i].exec(src) || [])[1];
        for(var j = 0; name && j < POWERS.length; j++) {
            if(POWERS[j].name == name || POWERS[j].name.toLowerCase().replace(/_/g, '-') == name) {
                img.src = PANEL_ICONS[POWERS[j].id];
                return;
            }
        }
    }
}

function installPanel() {
    var injector = window.angular && window.angular.element(document.body).injector();
    if(!injector || !injector.has('Constants') || !injector.has('appEffectIconDirective')) {
        return false;
    }
    var root = injector.get('$rootScope');
    if(root.krebsPowerIcons) {
        return true;
    }
    var constants = injector.get('Constants');
    Object.keys(CLASSES).forEach(function(key) {
        if(constants.POWER_CLASS && !(key in constants.POWER_CLASS)) {
            constants.POWER_CLASS[key] = CLASSES[key];
        }
    });
    POWERS.forEach(function(p) {
        if(!(('PWR_' + p.name) in constants)) {
            constants['PWR_' + p.name] = p.id;
        }
        if(constants.POWER_INFO && !constants.POWER_INFO[p.id]) {
            constants.POWER_INFO[p.id] = p.info;
        }
    });
    root.krebsPowerIcons = PANEL_ICONS;
    document.addEventListener('error', function(event) {
        ownIcon(event.target);
    }, true);
    Array.prototype.forEach.call(document.querySelectorAll('img'), function(img) {
        if(img.complete && !img.naturalWidth) {
            ownIcon(img);
        }
    });
    // the template as the client fetches it; a panel drawn from now on uses this one
    var url = injector.get('appEffectIconDirective')[0].templateUrl;
    injector.get('$templateRequest')(url).then(function(html) {
        if(html.indexOf(PANEL_SRC) < 0) {
            console.warn('mods/powerclasses: the side panel\'s effect icon is not as expected, so it shows no icon for the new powers');
            return;
        }
        injector.get('$templateCache').put(url, html.replace(PANEL_SRC, PANEL_OURS));
    });
    return true;
}

// renderer.js and the page's Angular are there before any server is reached; should they not be, a second's wait at a time
var installed = {room: installRoom(), panel: installPanel()};
if(!installed.room || !installed.panel) {
    var tries = 0;
    var timer = setInterval(function() {
        installed.room = installed.room || installRoom();
        installed.panel = installed.panel || installPanel();
        if(installed.room && installed.panel || ++tries >= 60) {
            clearInterval(timer);
        }
    }, 1000);
}
