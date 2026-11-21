//! The two classes and their powers, as the official power planner (screeps.com/power-planner, `skills.commander.ts`
//! and `skills.executor.ts` in its bundle) describes them. Numbers 20 to 44 follow on from vanilla's 1 to 19, in the
//! planner's order. Players read the same table as `POWER_INFO`, which `js_tables` writes.

use engine::constants::{PerLevel, PowerInfo};
use std::fmt::Write;

pub const COMMANDER: &str = "commander";
pub const EXECUTOR: &str = "executor";

pub const PWR_ENCOURAGE: u32 = 20;
pub const PWR_EXHAUST: u32 = 21;
pub const PWR_DEFEND: u32 = 22;
pub const PWR_SUMMON: u32 = 23;
pub const PWR_RENEW: u32 = 24;
pub const PWR_MASS_HEAL: u32 = 25;
pub const PWR_DISABLE: u32 = 26;
pub const PWR_FOREMAN: u32 = 27;
pub const PWR_RESURRECT: u32 = 28;
pub const PWR_SIGHT: u32 = 29;
pub const PWR_BERSERK: u32 = 30;
pub const PWR_DASH: u32 = 31;
pub const PWR_REGENERATE: u32 = 32;
pub const PWR_HARVEST_ENERGY: u32 = 33;
pub const PWR_HARVEST_MINERAL: u32 = 34;
pub const PWR_HARVEST_DEPOSIT: u32 = 35;
pub const PWR_REMOTE_TRANSFER: u32 = 36;
pub const PWR_MASS_REPAIR: u32 = 37;
pub const PWR_PUNCH: u32 = 38;
pub const PWR_DEMOLISH: u32 = 39;
pub const PWR_REFLECT: u32 = 40;
pub const PWR_REINFORCE: u32 = 41;
pub const PWR_SNIPE: u32 = 42;
pub const PWR_KILL: u32 = 43;
pub const PWR_NUKE: u32 = 44;

/// The power creep level each power level needs: the planner's default, then its two `requiresLevel` rows. They are
/// the Operator's three tables.
const BASE: [u32; 5] = [0, 2, 7, 14, 22];
const TIER2: [u32; 5] = [10, 11, 12, 14, 22];
const TIER3: [u32; 5] = [20, 21, 22, 23, 24];
/// The cooldown most powers have: 10/8/6/4/2 ticks.
const QUICK: PerLevel = PerLevel::Levels([10, 8, 6, 4, 2]);
const PER_LEVEL: [f64; 5] = [1.0, 2.0, 3.0, 4.0, 5.0];

/// What a power is aimed at.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Aim {
    /// No target: the power creep itself, or everything around it.
    Self_,
    /// A room object within `range`.
    Target,
}

#[derive(Clone, Copy, Debug)]
pub struct Power {
    pub id: u32,
    /// The constant's name after `PWR_`.
    pub name: &'static str,
    pub class: &'static str,
    pub level: [u32; 5],
    pub cooldown: PerLevel,
    pub aim: Aim,
    /// How far the target may be.
    pub range: Option<PerLevel>,
    /// How far a power without a target reaches around the power creep.
    pub area: Option<u32>,
    /// The power's strength by level: damage, hits, units, fatigue, ticks to land.
    pub effect: Option<[f64; 5]>,
    /// Ticks the effect on the target lasts, from the tick after the power was used.
    pub duration: Option<PerLevel>,
    /// The most energy a level may spend (mass repair).
    pub energy: Option<[f64; 5]>,
}

const fn def(id: u32, name: &'static str, class: &'static str) -> Power {
    Power { id, name, class, level: BASE, cooldown: QUICK, aim: Aim::Target, range: None, area: None, effect: None, duration: None, energy: None }
}

const fn levels(a: [f64; 5], k: f64) -> [f64; 5] {
    [a[0] * k, a[1] * k, a[2] * k, a[3] * k, a[4] * k]
}

pub const POWERS: [Power; 25] = [
    // Remove all fatigue of the target creep. Range 20.
    Power { range: Some(PerLevel::Fixed(20)), ..def(PWR_ENCOURAGE, "ENCOURAGE", COMMANDER) },
    // Add 2/4/6/8/10 fatigue per non-MOVE body part. Range 20.
    Power { range: Some(PerLevel::Fixed(20)), effect: Some(levels(PER_LEVEL, 2.0)), ..def(PWR_EXHAUST, "EXHAUST", COMMANDER) },
    // Block up to 100/200/400/600/800 damage to the target creep on the next tick. Cooldown 5, range 20.
    Power {
        cooldown: PerLevel::Fixed(5),
        range: Some(PerLevel::Fixed(20)),
        effect: Some([100.0, 200.0, 400.0, 600.0, 800.0]),
        duration: Some(PerLevel::Fixed(1)),
        ..def(PWR_DEFEND, "DEFEND", COMMANDER)
    },
    // Move one of your own creeps in the room next to the power creep.
    Power { range: Some(PerLevel::Fixed(50)), ..def(PWR_SUMMON, "SUMMON", COMMANDER) },
    // StructureSpawn.renewCreep from range 20, paid with the power creep's energy, boosts removed.
    Power { cooldown: PerLevel::Levels([5, 4, 3, 2, 1]), range: Some(PerLevel::Fixed(20)), ..def(PWR_RENEW, "RENEW", COMMANDER) },
    // Heal every other creep and power creep within 3 for 2500/1000/250 hits by distance (`MASS_HEAL_POWER`).
    Power { cooldown: PerLevel::Levels([25, 20, 15, 10, 5]), aim: Aim::Self_, area: Some(3), ..def(PWR_MASS_HEAL, "MASS_HEAL", COMMANDER) },
    // Cancel every action of the target creep on the next tick. Melee range.
    Power { range: Some(PerLevel::Fixed(1)), duration: Some(PerLevel::Fixed(1)), ..def(PWR_DISABLE, "DISABLE", COMMANDER) },
    // Double the target creep's harvest, build, repair and upgradeController, and the energy they use. Cooldown 50.
    Power {
        level: TIER2,
        cooldown: PerLevel::Fixed(50),
        range: Some(PerLevel::Fixed(20)),
        duration: Some(PerLevel::Levels([30, 60, 90, 120, 150])),
        ..def(PWR_FOREMAN, "FOREMAN", COMMANDER)
    },
    // Bring back the creep of an untouched tombstone with the time it had left and full hits. Melee range.
    Power { level: TIER2, cooldown: PerLevel::Levels([1000, 900, 800, 700, 600]), range: Some(PerLevel::Fixed(1)), ..def(PWR_RESURRECT, "RESURRECT", COMMANDER) },
    // +1 range for rangedAttack, rangedHeal, build, repair and upgradeController for 5 ticks. Range 20.
    Power { level: TIER3, range: Some(PerLevel::Fixed(20)), duration: Some(PerLevel::Fixed(5)), ..def(PWR_SIGHT, "SIGHT", COMMANDER) },
    // Double the damage and heal a creep deals, and the damage and heal it takes, for 5 ticks. Range 20.
    Power { level: TIER3, range: Some(PerLevel::Fixed(20)), duration: Some(PerLevel::Fixed(5)), ..def(PWR_BERSERK, "BERSERK", COMMANDER) },
    // One more square in the direction of this tick's move.
    Power { aim: Aim::Self_, ..def(PWR_DASH, "DASH", EXECUTOR) },
    // Heal the power creep itself for 1000..5000 hits. Cooldown 5.
    Power { cooldown: PerLevel::Fixed(5), aim: Aim::Self_, effect: Some(levels(PER_LEVEL, 1000.0)), ..def(PWR_REGENERATE, "REGENERATE", EXECUTOR) },
    // Harvest 200..1000 energy from a source. Cooldown 20.
    Power {
        cooldown: PerLevel::Fixed(20),
        range: Some(PerLevel::Fixed(1)),
        effect: Some(levels(PER_LEVEL, 200.0)),
        ..def(PWR_HARVEST_ENERGY, "HARVEST_ENERGY", EXECUTOR)
    },
    // Harvest 200..1000 units from a mineral with an extractor. Cooldown 40.
    Power {
        cooldown: PerLevel::Fixed(40),
        range: Some(PerLevel::Fixed(1)),
        effect: Some(levels(PER_LEVEL, 200.0)),
        ..def(PWR_HARVEST_MINERAL, "HARVEST_MINERAL", EXECUTOR)
    },
    // Harvest 200..1000 units from a deposit. Cooldown 40.
    Power {
        cooldown: PerLevel::Fixed(40),
        range: Some(PerLevel::Fixed(1)),
        effect: Some(levels(PER_LEVEL, 200.0)),
        ..def(PWR_HARVEST_DEPOSIT, "HARVEST_DEPOSIT", EXECUTOR)
    },
    // Transfer to any creep or structure 5/10/15/20/30 squares away. Cooldown 10.
    Power { cooldown: PerLevel::Fixed(10), range: Some(PerLevel::Levels([5, 10, 15, 20, 30])), ..def(PWR_REMOTE_TRANSFER, "REMOTE_TRANSFER", EXECUTOR) },
    // Repair everything within 10 for up to 1000..5000 hits in all, shared out, for up to 10..50 energy. No cooldown.
    Power {
        cooldown: PerLevel::Fixed(0),
        aim: Aim::Self_,
        area: Some(10),
        effect: Some(levels(PER_LEVEL, 1000.0)),
        energy: Some(levels(PER_LEVEL, 10.0)),
        ..def(PWR_MASS_REPAIR, "MASS_REPAIR", EXECUTOR)
    },
    // 300..1500 damage to a creep, power creep or structure in melee range. No cooldown.
    Power { cooldown: PerLevel::Fixed(0), range: Some(PerLevel::Fixed(1)), effect: Some(levels(PER_LEVEL, 300.0)), ..def(PWR_PUNCH, "PUNCH", EXECUTOR) },
    // 5K..25K damage to a rampart or a wall. Range 10, cooldown 10.
    Power {
        cooldown: PerLevel::Fixed(10),
        range: Some(PerLevel::Fixed(10)),
        effect: Some(levels(PER_LEVEL, 5000.0)),
        ..def(PWR_DEMOLISH, "DEMOLISH", EXECUTOR)
    },
    // Send half of the damage the power creep takes back to the creep that dealt it, for 5 ticks.
    Power {
        cooldown: PerLevel::Levels([20, 18, 16, 14, 12]),
        aim: Aim::Self_,
        effect: Some([0.5; 5]),
        duration: Some(PerLevel::Fixed(5)),
        ..def(PWR_REFLECT, "REFLECT", EXECUTOR)
    },
    // The power creep takes no damage for 3 ticks.
    Power {
        level: TIER2,
        cooldown: PerLevel::Levels([20, 18, 16, 14, 12]),
        aim: Aim::Self_,
        duration: Some(PerLevel::Fixed(3)),
        ..def(PWR_REINFORCE, "REINFORCE", EXECUTOR)
    },
    // 300 damage to a creep or power creep 1..5 squares away, ramparts or not. No cooldown.
    Power {
        level: TIER3,
        cooldown: PerLevel::Fixed(0),
        range: Some(PerLevel::Levels([1, 2, 3, 4, 5])),
        effect: Some([300.0; 5]),
        ..def(PWR_SNIPE, "SNIPE", EXECUTOR)
    },
    // Kill a creep within 3 that no hostile rampart covers.
    Power { level: TIER3, cooldown: PerLevel::Levels([900, 800, 700, 600, 500]), range: Some(PerLevel::Fixed(3)), ..def(PWR_KILL, "KILL", EXECUTOR) },
    // A nuke on the power creep's square, landing in 90000..50000 ticks. The power creep dies.
    Power {
        level: TIER3,
        cooldown: PerLevel::Fixed(0),
        aim: Aim::Self_,
        effect: Some([90000.0, 80000.0, 70000.0, 60000.0, 50000.0]),
        ..def(PWR_NUKE, "NUKE", EXECUTOR)
    },
];

/// Mass heal by distance 1, 2 and 3.
pub const MASS_HEAL_POWER: [f64; 3] = [2500.0, 1000.0, 250.0];

/// The power numbered `id`, if this mod adds it.
pub fn power(id: u32) -> Option<&'static Power> {
    POWERS.get(id.checked_sub(PWR_ENCOURAGE)? as usize)
}

const fn info(p: &Power) -> PowerInfo {
    PowerInfo {
        power: p.id,
        class_name: p.class,
        level: p.level,
        cooldown: 0,
        duration: p.duration,
        range: None,
        ops: None,
        effect: p.effect,
        energy: None,
        period: None,
        keys: &[],
    }
}

/// What core's upgradePowerCreep reads (`class_name`, `level`); the rest of the table is this mod's own.
pub static INFOS: [PowerInfo; 25] = {
    let mut out = [info(&POWERS[0]); 25];
    let mut i = 1;
    while i < 25 {
        out[i] = info(&POWERS[i]);
        i += 1;
    }
    out
};

fn per_level_json(p: PerLevel) -> String {
    match p {
        PerLevel::Fixed(v) => v.to_string(),
        PerLevel::Levels(a) => format!("[{}]", a.map(|v| v.to_string()).join(",")),
    }
}

fn levels_json(a: [f64; 5]) -> String {
    format!("[{}]", a.map(|v| v.to_string()).join(","))
}

/// The tables game.js starts from: `CLASSES` for `POWER_CLASS`, `POWERS` for the `PWR_*` constants and `POWER_INFO`,
/// `MASS_HEAL_POWER`.
pub fn js_tables() -> String {
    let mut js = format!("var CLASSES = {{\"COMMANDER\":\"{COMMANDER}\",\"EXECUTOR\":\"{EXECUTOR}\"}};\nvar POWERS = [\n");
    for p in &POWERS {
        let mut info = format!("\"className\":\"{}\",\"level\":[{}],\"cooldown\":{}", p.class, p.level.map(|v| v.to_string()).join(","), per_level_json(p.cooldown));
        if let Some(d) = p.duration {
            write!(info, ",\"duration\":{}", per_level_json(d)).unwrap();
        }
        if let Some(r) = p.range {
            write!(info, ",\"range\":{}", per_level_json(r)).unwrap();
        }
        if let Some(a) = p.area {
            write!(info, ",\"area\":{a}").unwrap();
        }
        if let Some(e) = p.effect {
            write!(info, ",\"effect\":{}", levels_json(e)).unwrap();
        }
        if let Some(e) = p.energy {
            write!(info, ",\"energy\":{}", levels_json(e)).unwrap();
        }
        writeln!(js, "  {{\"id\":{},\"name\":\"{}\",\"info\":{{{info}}}}},", p.id, p.name).unwrap();
    }
    write!(js, "];\nvar MASS_HEAL_POWER = {};\n", format!("[{}]", MASS_HEAL_POWER.map(|v| v.to_string()).join(","))).unwrap();
    js
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numbered_in_order() {
        for (i, p) in POWERS.iter().enumerate() {
            assert_eq!(p.id, PWR_ENCOURAGE + i as u32, "{}", p.name);
            assert_eq!(power(p.id).map(|q| q.name), Some(p.name));
            assert_eq!(INFOS[i].power, p.id);
            assert_eq!(INFOS[i].class_name, p.class);
        }
        assert!(power(19).is_none() && power(45).is_none());
        assert_eq!(POWERS.iter().filter(|p| p.class == COMMANDER).count(), 11);
        assert_eq!(POWERS.iter().filter(|p| p.class == EXECUTOR).count(), 14);
    }

    #[test]
    fn targets_have_a_range_and_the_rest_do_not() {
        for p in &POWERS {
            assert_eq!(p.aim == Aim::Target, p.range.is_some(), "{}", p.name);
        }
    }

    #[test]
    fn tables_are_json() {
        let js = js_tables();
        let json = |name: &str| {
            let start = js.find(&format!("var {name} = ")).unwrap() + name.len() + 7;
            let end = start + js[start..].find(";\n").unwrap();
            util::json::Json::parse(&js[start..end].replace(",\n]", "]")).unwrap_or_else(|e| panic!("{name}: {e:?}"))
        };
        assert!(matches!(json("POWERS"), util::json::Json::Arr(a) if a.len() == 25));
        assert!(matches!(json("CLASSES"), util::json::Json::Obj(_)));
        assert!(matches!(json("MASS_HEAL_POWER"), util::json::Json::Arr(a) if a.len() == 3));
    }
}
