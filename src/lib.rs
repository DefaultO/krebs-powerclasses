//! Power classes (`mods: ["powerclasses"]`, or `krebs serve --mods powerclasses`): the Commander and the Executor, the
//! two power creep classes Screeps planned besides the Operator and never shipped, with the 25 powers the official
//! power planner (screeps.com/power-planner) gives them. The game client already carries their sprites.
//!
//! * `table.rs`: the classes and powers, `PWR_ENCOURAGE` (20) to `PWR_NUKE` (44), which players read as `POWER_INFO`.
//! * `game.js`: what players' scripts get: `POWER_CLASS.COMMANDER` and `EXECUTOR`, the constants, `usePower` for the
//!   new powers with the checks it returns errors from, SIGHT's extra square, and `effects` on power creeps.
//! * `powers.rs`: the `classPower` intent, which `usePower` sends for the new powers.
//! * `effects.rs`: what the powers leave on creeps and power creeps, and the hooks that act on it.
//!
//! Core lets a mod add power classes and powers (`ProcessorHooks::power_classes`, `powers`) for createPowerCreep and
//! upgradePowerCreep; everything else about them is here.

mod effects;
mod powers;
mod table;
mod util;

use backend::mods::{Manifest, Mod, Registry};
use std::sync::OnceLock;

pub struct PowerClasses;

/// What the server registers (modlist finds it by this name).
pub static MOD: PowerClasses = PowerClasses;

impl Mod for PowerClasses {
    fn manifest(&self) -> Manifest {
        Manifest { name: "powerclasses", version: env!("CARGO_PKG_VERSION"), dependencies: &[] }
    }

    fn register(&self, r: &mut Registry) {
        let p = &mut r.engine.processor;
        p.power_classes.extend([table::COMMANDER, table::EXECUTOR]);
        p.powers.extend(table::INFOS.iter());
        p.intent_types.push(("classPower", powers::CLASS_POWER));
        p.object_intents.push(("powerCreep", "classPower", powers::use_power));
        p.process_object.push(effects::prescan);
        p.pre_object_intents.push(effects::before_intents);
        p.post_object_intents.push(effects::after_intents);
        p.pre_tick.push(effects::pre_tick);
        p.room_end.push(effects::room_end);
        r.js_game.push(game_js());
        // the game client: the powers' icons where they land and in the side panel, shown as it shows an Operator's
        // (client.js), the 7 new ones among its textures
        r.client_js.push(client_js());
        for (name, svg) in table::NEW_ICONS {
            let path: &'static str = Box::leak(format!("renderer.resources.{name}").into_boxed_str());
            r.server_data.push((path, ::util::json::Json::Str(table::icon_uri(svg))));
        }
    }
}

/// game.js after the tables it reads.
fn game_js() -> &'static str {
    static JS: OnceLock<String> = OnceLock::new();
    JS.get_or_init(|| format!("{}\n{}", table::js_tables(), include_str!("../game.js")))
}

/// client.js after the tables it reads: the icons for the room and for the side panel, and the powers for the client's
/// constants.
fn client_js() -> &'static str {
    static JS: OnceLock<String> = OnceLock::new();
    JS.get_or_init(|| {
        format!(
            "var ICONS = {};\nvar PANEL_ICONS = {};\n{}\n{}",
            table::icons_json(),
            table::panel_icons_json(),
            table::js_tables(),
            include_str!("../client.js")
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registers_its_pieces() {
        let mut r = Registry::default();
        MOD.register(&mut r);
        let p = &r.engine.processor;
        assert_eq!(p.power_classes, ["commander", "executor"]);
        assert_eq!(p.powers.len(), 25);
        assert_eq!((p.object_intents[0].1, p.intent_types[0].0), ("classPower", "classPower"));
        assert_eq!((p.pre_tick.len(), p.room_end.len(), p.process_object.len()), (1, 1, 1));
        // the tick loop's quiet path stays on: no object ticks, no post-object hook
        assert!(p.object_ticks.is_empty() && p.post_object.is_empty());
        assert_eq!(r.js_game.len(), 1);
        assert!(r.client_js.len() == 1 && r.client_js[0].starts_with("var ICONS = {\"20\":\"encourage\""));
        assert!(r.client_js[0].contains("\nvar PANEL_ICONS = {\"20\":\"app2/assets/powers/commander/encourage.svg\"")
            && r.client_js[0].contains("\nvar POWERS = [\n"));
        assert_eq!(r.server_data.len(), 7);
        assert!(r.server_data.iter().all(|(k, v)| k.starts_with("renderer.resources.powerclasses-")
            && v.as_str().is_some_and(|s| s.starts_with("data:image/svg+xml;base64,"))));
        assert!(r.js_game[0].starts_with("var CLASSES = "));
    }
}
