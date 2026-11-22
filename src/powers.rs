//! The `classPower` intent: `PowerCreep.usePower` with one of this mod's powers (20 to 44). It is vanilla's
//! `usePower` with two more fields, the resource type and amount REMOTE_TRANSFER takes (`CLASS_POWER`). The checks are
//! vanilla usePower's (the room's power is on, no hostile safe mode, the power has a level and no cooldown, the target
//! is in range), then each power's own, and the cooldown starts only when the power did something.

use crate::effects::{self, NUKE_OWNER, NUKE_USER, STORE_AT_DEATH};
use crate::table::{self, *};
use crate::util::*;
use engine::atom;
use engine::bulk::Target;
use engine::constants::{
    CARRY, CARRY_CAPACITY, CLAIM, CREEP_LIFE_TIME, CREEP_SPAWN_TIME, DEPOSIT_DECAY_TIME, DEPOSIT_EXHAUST_MULTIPLY, DEPOSIT_EXHAUST_POW, EVENT_ATTACK_TYPE_DISMANTLE,
    EVENT_ATTACK_TYPE_MELEE, EVENT_ATTACK_TYPE_RANGED, EVENT_HARVEST, EVENT_HEAL, EVENT_HEAL_TYPE_RANGED, EVENT_POWER, EVENT_REPAIR, MOVE, REPAIR_COST, SPAWN_RENEW_RATIO,
};
use engine::doc::Atom;
use engine::live::{strict_eq, to_js_string, to_number, truthy, Crash, O, V};
use engine::processor::intents::creeps::{_die, _drop_resources_without_space, _recalc_body, transfer};
use engine::processor::intents::{_create_energy, _damage, movement};
use engine::processor::RoomScope;
use engine::utils;

/// The level of `power` the power creep may use now, by vanilla usePower's checks of the room and of the power.
pub fn ready(object: &O, power: u32, scope: &RoomScope) -> Option<f64> {
    let game_time = scope.game_time as f64;
    if let Some(c) = &scope.room_controller {
        if !truthy(&c.get(atom!("isPowerEnabled"))) {
            return None;
        }
        let mine = to_js_string(&c.get(atom!("user"))) == to_js_string(&object.get(atom!("user")));
        if !mine && num(c, atom!("safeMode")) > game_time {
            return None;
        }
    }
    let entry = get(&object.get(atom!("powers")), Atom::intern(&power.to_string()));
    let level = to_number(&get(&entry, atom!("level")));
    let cooldown = get(&entry, atom!("cooldownTime"));
    if !(level >= 1.0) || truthy(&cooldown) && to_number(&cooldown) > game_time {
        return None;
    }
    Some(level.min(5.0).floor())
}

/// After a power worked: its cooldown, the event, and the power creep's action log.
///
/// The action log entry is `classPower`, not vanilla's `power`: the game client's renderer looks `power.id` up in a
/// table of the Operator's icons and stops drawing the room on an id it does not know (powerInfluence.js,
/// `Assets.get(undefined)`), and it leaves keys it does not know alone. `at` is the square the power struck when it was
/// used, before it moved anything, as vanilla logs an Operator's power: the target's, or the power creep's own for a
/// power on itself. The renderer draws its beam from where the power creep is at the tick's start to that square, so a
/// power on itself has none, DASH included.
pub fn used(object: &O, power: u32, level: f64, target: Option<V>, at: (V, V), scope: &mut RoomScope) -> Result<(), Crash> {
    let p = table::power(power).expect("a power of this mod");
    let cooldown = p.cooldown.at(level as usize - 1) as f64;
    let entry = O::new();
    entry.set(atom!("cooldownTime"), n(scope.game_time as f64 + cooldown));
    let powers = O::new();
    powers.set(Atom::intern(&power.to_string()), V::Obj(entry));
    update(scope, object, obj(vec![("powers", V::Obj(powers))]))?;
    event(scope, EVENT_POWER, object, obj(vec![("power", n(power as f64)), ("targetId", target.unwrap_or(V::Undef))]));
    if let V::Obj(l) = object.get(atom!("actionLog")) {
        l.set(Atom::intern("classPower"), obj(vec![("id", n(power as f64)), ("x", at.0), ("y", at.1)]));
    }
    Ok(())
}

/// `customIntentTypes.classPower`, as storeIntents sanitizes it.
pub const CLASS_POWER: engine::system::IntentType = {
    use engine::system::FieldType::{Number, String};
    &[("power", Number), ("id", String), ("resourceType", String), ("amount", Number)]
};

/// `object_intents` for `powerCreep`/`classPower`.
pub fn use_power(object: &O, intent: &V, scope: &mut RoomScope) -> Result<(), Crash> {
    let power = match get(intent, atom!("power")) {
        V::Num(x) if x.fract() == 0.0 && x >= 0.0 => x as u32,
        _ => return Ok(()),
    };
    // DASH waits for the power creep's move: effects.rs
    let Some(p) = table::power(power).filter(|_| power != PWR_DASH) else { return Ok(()) };
    let Some(level) = ready(object, power, scope) else { return Ok(()) };
    let lvl = level as usize - 1;
    let id = to_js_string(&get(intent, atom!("id")));

    let target = match p.aim {
        Aim::Self_ => None,
        Aim::Target => {
            let Some(t) = scope.room_objects.get(&id) else { return Ok(()) };
            let reach = p.range.map_or(0, |r| r.at(lvl)) as f64;
            if range(object, &t) > reach {
                return Ok(());
            }
            Some(t)
        }
    };
    let t = target.as_ref();
    let effect = p.effect.map_or(0.0, |e| e[lvl]);
    let game_time = scope.game_time as f64;
    // where the power strikes, before it moves anything
    let struck = t.unwrap_or(object);
    let at = (struck.get(atom!("x")), struck.get(atom!("y")));

    let done = match power {
        PWR_ENCOURAGE => encourage(t.unwrap(), scope)?,
        PWR_EXHAUST => exhaust(t.unwrap(), effect, scope)?,
        PWR_DEFEND => buff(t.unwrap(), power, level, vec![("left", n(effect))], scope)?,
        PWR_DISABLE | PWR_FOREMAN | PWR_SIGHT | PWR_BERSERK => buff(t.unwrap(), power, level, vec![], scope)?,
        PWR_SUMMON => summon(object, t.unwrap(), scope)?,
        PWR_RENEW => renew(object, t.unwrap(), scope)?,
        PWR_MASS_HEAL => mass_heal(object, p.area.unwrap_or(0) as f64, scope)?,
        PWR_RESURRECT => resurrect(object, t.unwrap(), scope)?,
        PWR_REGENERATE => regenerate(object, effect, scope)?,
        PWR_HARVEST_ENERGY => harvest_energy(object, t.unwrap(), effect, scope)?,
        PWR_HARVEST_MINERAL => harvest_mineral(object, t.unwrap(), effect, scope)?,
        PWR_HARVEST_DEPOSIT => harvest_deposit(object, t.unwrap(), effect, scope)?,
        PWR_REMOTE_TRANSFER => {
            let (resource, amount) = (to_js_string(&get(intent, atom!("resourceType"))), to_number(&get(intent, atom!("amount"))));
            remote_transfer(object, t.unwrap(), &resource, amount, scope)?
        }
        PWR_MASS_REPAIR => mass_repair(object, effect, p.energy.map_or(0.0, |e| e[lvl]), p.area.unwrap_or(0) as f64, scope)?,
        PWR_PUNCH => punch(object, t.unwrap(), effect, scope)?,
        PWR_DEMOLISH => demolish(object, t.unwrap(), effect, scope)?,
        PWR_SNIPE => snipe(object, t.unwrap(), effect, scope)?,
        PWR_KILL => kill(object, t.unwrap(), scope)?,
        PWR_REFLECT | PWR_REINFORCE => !effects::stronger(object, power, level, game_time) && effects::put(scope, object, power, level, vec![]).map(|_| true)?,
        PWR_NUKE => nuke(object, effect, scope)?,
        _ => false,
    };
    if done {
        let target_id = t.map(|t| t.get(atom!("_id")));
        used(object, power, level, target_id, at, scope)?;
    }
    Ok(())
}

/// A creep that is out of its spawn.
fn live_creep(t: &O) -> bool {
    is(t, "creep") && !truthy(&t.get(atom!("spawning")))
}

fn encourage(t: &O, scope: &mut RoomScope) -> Result<bool, Crash> {
    if !live_creep(t) {
        return Ok(false);
    }
    // a move it asked for this tick goes ahead too: movement reads the fatigue the creep had when it asked
    t.set(Atom::intern("_oldFatigue"), n(0.0));
    update(scope, t, obj(vec![("fatigue", n(0.0))]))?;
    Ok(true)
}

fn exhaust(t: &O, per_part: f64, scope: &mut RoomScope) -> Result<bool, Crash> {
    if !live_creep(t) {
        return Ok(false);
    }
    let parts = values(&t.get(atom!("body"))).iter().filter(|b| !strict_eq(&get(b, atom!("type")), &s(MOVE))).count() as f64;
    let fatigue = num(t, atom!("fatigue"));
    let fatigue = if fatigue.is_nan() { 0.0 } else { fatigue };
    update(scope, t, obj(vec![("fatigue", n(fatigue + per_part * parts))]))?;
    Ok(true)
}

/// DEFEND, DISABLE, FOREMAN, SIGHT and BERSERK: an effect on a creep.
fn buff(t: &O, power: u32, level: f64, extra: Vec<(&str, V)>, scope: &mut RoomScope) -> Result<bool, Crash> {
    if !live_creep(t) || effects::stronger(t, power, level, scope.game_time as f64) {
        return Ok(false);
    }
    effects::put(scope, t, power, level, extra)?;
    Ok(true)
}

const AROUND: [(f64, f64); 8] = [(0.0, -1.0), (1.0, -1.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0), (-1.0, 1.0), (-1.0, 0.0), (-1.0, -1.0)];

/// Your own creep to the free square next to the power creep that is closest to it (no exit squares).
fn summon(object: &O, t: &O, scope: &mut RoomScope) -> Result<bool, Crash> {
    if !live_creep(t) || !same_user(t, object) {
        return Ok(false);
    }
    if range(object, t) <= 1.0 {
        return Ok(true);
    }
    let (px, py, cx, cy) = (num(object, atom!("x")), num(object, atom!("y")), num(t, atom!("x")), num(t, atom!("y")));
    let user = t.get(atom!("user"));
    let mut best: Option<(f64, f64, f64)> = None;
    for (dx, dy) in AROUND {
        let (x, y) = (px + dx, py + dy);
        if !(1.0..=48.0).contains(&x) || !(1.0..=48.0).contains(&y) || !walkable(scope, x, y, &user) || movement::is_tile_busy(scope, &n(x), &n(y)) {
            continue;
        }
        let d = (x - cx).abs().max((y - cy).abs());
        if best.is_none_or(|b| d < b.0) {
            best = Some((d, x, y));
        }
    }
    let Some((_, x, y)) = best else { return Ok(false) };
    // a move or pull it asked for from where it was does not happen
    let pulled = t.get(Atom::intern("_pulled"));
    if truthy(&pulled) {
        if let Some(puller) = scope.room_objects.get(&to_js_string(&pulled)) {
            movement::remove_pulling(scope, &puller);
        }
    }
    movement::remove_pulling(scope, t);
    t.set(Atom::intern("_oldFatigue"), n(1.0));
    update(scope, t, obj(vec![("x", n(x)), ("y", n(y))]))?;
    Ok(true)
}

/// spawns/renew-creep.js from range 20, paid with the power creep's own energy.
fn renew(object: &O, t: &O, scope: &mut RoomScope) -> Result<bool, Crash> {
    if !live_creep(t) || !same_user(t, object) {
        return Ok(false);
    }
    let body = t.get(atom!("body"));
    let parts = values(&body);
    if parts.is_empty() || parts.iter().any(|b| strict_eq(&get(b, atom!("type")), &s(CLAIM))) {
        return Ok(false);
    }
    let count = parts.len() as f64;
    let effect = (SPAWN_RENEW_RATIO * CREEP_LIFE_TIME as f64 / CREEP_SPAWN_TIME as f64 / count).floor();
    if num(t, atom!("ageTime")) + effect > scope.game_time as f64 + CREEP_LIFE_TIME as f64 {
        return Ok(false);
    }
    let cost = (SPAWN_RENEW_RATIO * utils::calc_creep_cost(&body)? / CREEP_SPAWN_TIME as f64 / count).ceil();
    let energy = stored(object, atom!("energy"));
    if energy < cost {
        return Ok(false);
    }
    update(scope, object, obj(vec![("store", obj(vec![("energy", n(energy - cost))]))]))?;
    scope.stats_inc(atom!("energyCreeps"), &object.get(atom!("user")), cost);
    log(t, atom!("healed"), object);
    scope.bulk.inc(Target::Obj(t), &[atom!("ageTime")], effect);
    if parts.iter().any(|b| truthy(&get(b, atom!("boost")))) {
        for b in values(&t.get(atom!("body"))) {
            if let V::Obj(b) = b {
                b.set(atom!("boost"), V::Null);
            }
        }
        _recalc_body::recalc_body(t)?;
        _drop_resources_without_space::drop_resources_without_space(t, scope)?;
        update(scope, t, obj(vec![("body", t.get(atom!("body"))), ("storeCapacity", t.get(atom!("storeCapacity")))]))?;
    }
    Ok(true)
}

/// Every other creep and power creep within `area`, by distance (`MASS_HEAL_POWER`).
fn mass_heal(object: &O, area: f64, scope: &mut RoomScope) -> Result<bool, Crash> {
    let near: Vec<(O, f64)> = scope
        .room_objects
        .iter()
        .filter(|o| !o.same(object) && (live_creep(o) || is(o, "powerCreep")))
        .map(|o| (o.clone(), range(object, o)))
        .filter(|(_, d)| *d >= 1.0 && *d <= area)
        .collect();
    for (o, d) in near {
        let heal = MASS_HEAL_POWER[d as usize - 1];
        let before = to_number(&o.get(atom!("_healToApply")));
        o.set(atom!("_healToApply"), n(if before.is_nan() { 0.0 } else { before } + heal));
        log(&o, atom!("healed"), object);
        let data = obj(vec![("targetId", o.get(atom!("_id"))), ("amount", n(heal)), ("healType", n(EVENT_HEAL_TYPE_RANGED as f64))]);
        event(scope, EVENT_HEAL, object, data);
    }
    Ok(true)
}

/// Whether two stores hold the same of everything.
fn same_store(a: &V, b: &V) -> bool {
    let amount = |s: &V, k: Atom| {
        let v = get(s, k);
        if truthy(&v) {
            to_number(&v)
        } else {
            0.0
        }
    };
    let keys = |s: &V| match s {
        V::Obj(o) => o.keys(),
        _ => Vec::new(),
    };
    keys(a).into_iter().chain(keys(b)).all(|k| amount(a, k) == amount(b, k))
}

/// The creep of one of your own tombstones, back where it fell with the time it had left, full hits and its body
/// unboosted, if nothing was taken from the tombstone. It holds what the tombstone held, up to its capacity; the rest
/// is dropped.
fn resurrect(object: &O, t: &O, scope: &mut RoomScope) -> Result<bool, Crash> {
    if !is(t, "tombstone") || !truthy(&t.get(atom!("creepId"))) || !same_user(t, object) {
        return Ok(false);
    }
    let at_death = t.get(Atom::intern(STORE_AT_DEATH));
    if !truthy(&at_death) || !same_store(&at_death, &t.get(atom!("store"))) {
        return Ok(false);
    }
    let ttl = num(t, Atom::intern("creepTicksToLive"));
    let types: Vec<V> = values(&t.get(Atom::intern("creepBody")));
    if !(ttl > 1.0) || types.is_empty() {
        return Ok(false);
    }
    let (x, y, user, name) = (num(t, atom!("x")), num(t, atom!("y")), t.get(atom!("user")), t.get(Atom::intern("creepName")));
    if !walkable(scope, x, y, &user) {
        return Ok(false);
    }
    let taken = scope.room_objects.iter().any(|o| is(o, "creep") && same_user(o, t) && strict_eq(&o.get(atom!("name")), &name));
    if taken {
        return Ok(false);
    }

    let body: Vec<V> = types.iter().map(|ty| obj(vec![("type", ty.clone()), ("hits", n(100.0))])).collect();
    let capacity = types.iter().filter(|ty| strict_eq(ty, &s(CARRY))).count() as f64 * CARRY_CAPACITY as f64;
    let hits = n(body.len() as f64 * 100.0);
    let store = engine::live::O::new();
    let mut room_left = capacity;
    let mut dropped = Vec::new();
    if let V::Obj(held) = t.get(atom!("store")) {
        for k in held.keys() {
            let amount = to_number(&held.get(k));
            if !(amount > 0.0) {
                continue;
            }
            let keep = amount.min(room_left);
            room_left -= keep;
            if keep > 0.0 {
                store.set(k, n(keep));
            }
            if amount > keep {
                dropped.push((k, amount - keep));
            }
        }
    }
    let room = to_js_string(&t.get(atom!("room")));
    let creep = obj(vec![
        ("name", name),
        ("x", n(x)),
        ("y", n(y)),
        ("body", arr(body)),
        ("store", V::Obj(store)),
        ("storeCapacity", n(capacity)),
        ("type", s("creep")),
        ("room", s(&room)),
        ("user", user),
        ("hits", hits.clone()),
        ("hitsMax", hits),
        ("spawning", V::Bool(false)),
        ("fatigue", n(0.0)),
        ("notifyWhenAttacked", V::Bool(true)),
        ("ageTime", n(scope.game_time as f64 + ttl)),
    ]);
    let id = to_js_string(&t.get(atom!("_id")));
    scope.bulk.remove(&id);
    scope.room_objects.remove(&id);
    scope.bulk.insert(&creep, None);
    for (k, amount) in dropped {
        _create_energy::create_energy(x, y, &room, amount, k.as_str(), scope)?;
    }
    Ok(true)
}

fn regenerate(object: &O, heal: f64, scope: &mut RoomScope) -> Result<bool, Crash> {
    let before = to_number(&object.get(atom!("_healToApply")));
    object.set(atom!("_healToApply"), n(if before.is_nan() { 0.0 } else { before } + heal));
    log(object, atom!("healed"), object);
    let data = obj(vec![("targetId", object.get(atom!("_id"))), ("amount", n(heal)), ("healType", n(EVENT_HEAL_TYPE_RANGED as f64))]);
    event(scope, EVENT_HEAL, object, data);
    Ok(true)
}

/// creeps/harvest.js's rule for sources: not in a room someone else owns or reserves.
fn may_harvest_source(object: &O, scope: &RoomScope) -> bool {
    let Some(c) = &scope.room_controller else { return true };
    let user = to_js_string(&object.get(atom!("user")));
    let owner = c.get(atom!("user"));
    let reservation = get(&c.get(atom!("reservation")), atom!("user"));
    !(truthy(&owner) && to_js_string(&owner) != user || truthy(&reservation) && to_js_string(&reservation) != user)
}

fn harvested(object: &O, t: &O, amount: f64, scope: &mut RoomScope) {
    event(scope, EVENT_HARVEST, object, obj(vec![("targetId", t.get(atom!("_id"))), ("amount", n(amount))]));
}

fn harvest_energy(object: &O, t: &O, effect: f64, scope: &mut RoomScope) -> Result<bool, Crash> {
    let energy = num(t, atom!("energy"));
    if !is(t, "source") || !(energy > 0.0) || !may_harvest_source(object, scope) {
        return Ok(false);
    }
    let amount = effect.min(energy).min(free(object)?).floor();
    if amount <= 0.0 {
        return Ok(false);
    }
    let invader = to_number(&t.get(atom!("invaderHarvested")));
    update(scope, t, obj(vec![("energy", n(energy - amount)), ("invaderHarvested", n(if invader.is_nan() { 0.0 } else { invader } + amount))]))?;
    add_to_store(scope, object, atom!("energy"), amount)?;
    scope.stats_inc(atom!("energyHarvested"), &object.get(atom!("user")), amount);
    harvested(object, t, amount, scope);
    Ok(true)
}

/// From a mineral with an extractor that is yours or nobody's and works at this controller level. The extractor's own
/// cooldown does not apply.
fn harvest_mineral(object: &O, t: &O, effect: f64, scope: &mut RoomScope) -> Result<bool, Crash> {
    let left = num(t, atom!("mineralAmount"));
    if !is(t, "mineral") || !(left > 0.0) {
        return Ok(false);
    }
    let Some(extractor) = at(scope, num(t, atom!("x")), num(t, atom!("y"))).into_iter().find(|o| is(o, "extractor")) else { return Ok(false) };
    if truthy(&extractor.get(atom!("user"))) && !same_user(&extractor, object) {
        return Ok(false);
    }
    if !utils::check_structure_against_controller(&extractor, &scope.room_objects, scope.room_controller.as_ref())? {
        return Ok(false);
    }
    let amount = effect.min(left).min(free(object)?).floor();
    if amount <= 0.0 {
        return Ok(false);
    }
    update(scope, t, obj(vec![("mineralAmount", n(left - amount))]))?;
    add_to_store(scope, object, Atom::intern(&to_js_string(&t.get(atom!("mineralType")))), amount)?;
    harvested(object, t, amount, scope);
    Ok(true)
}

/// From a deposit out of cooldown, which then exhausts as creeps/harvest.js has it.
fn harvest_deposit(object: &O, t: &O, effect: f64, scope: &mut RoomScope) -> Result<bool, Crash> {
    let game_time = scope.game_time as f64;
    let cooldown = t.get(atom!("cooldownTime"));
    if !is(t, "deposit") || truthy(&cooldown) && to_number(&cooldown) > game_time {
        return Ok(false);
    }
    let amount = effect.min(free(object)?).floor();
    if amount <= 0.0 {
        return Ok(false);
    }
    add_to_store(scope, object, Atom::intern(&to_js_string(&t.get(atom!("depositType")))), amount)?;
    scope.bulk.inc(Target::Obj(t), &[atom!("harvested")], amount);
    let cooldown = (DEPOSIT_EXHAUST_MULTIPLY * engine::processor::js_pow(num(t, atom!("harvested")), DEPOSIT_EXHAUST_POW)).ceil();
    if cooldown > 1.0 {
        t.set(Atom::intern("_cooldown"), n(cooldown));
    }
    update(scope, t, obj(vec![("decayTime", n(DEPOSIT_DECAY_TIME as f64 + game_time))]))?;
    harvested(object, t, amount, scope);
    Ok(true)
}

/// creeps/transfer.js as if the power creep stood by the target, so every rule of what fits where is the game's.
fn remote_transfer(object: &O, t: &O, resource: &str, amount: f64, scope: &mut RoomScope) -> Result<bool, Crash> {
    // "to any creep or structure", and a creep there is not a power creep (Screeps' description of the Executor)
    if resource.is_empty() || !(amount > 0.0) || is(t, "powerCreep") {
        return Ok(false);
    }
    let rt = Atom::intern(resource);
    let before = stored(object, rt);
    let intent = obj(vec![("id", t.get(atom!("_id"))), ("resourceType", s(resource)), ("amount", n(amount))]);
    let (x, y) = (object.get(atom!("x")), object.get(atom!("y")));
    object.set(atom!("x"), t.get(atom!("x")));
    object.set(atom!("y"), t.get(atom!("y")));
    let result = transfer::run(object, &intent, scope);
    object.set(atom!("x"), x);
    object.set(atom!("y"), y);
    result?;
    Ok(stored(object, rt) < before)
}

/// Everything repairable within `area` shares out `hits` (fewer when the energy runs short), each structure taking no
/// more than it is missing, at the price of creeps' repair.
fn mass_repair(object: &O, hits: f64, energy_max: f64, area: f64, scope: &mut RoomScope) -> Result<bool, Crash> {
    let energy = stored(object, atom!("energy"));
    let budget = hits.min(energy_max.min(energy) / REPAIR_COST).floor();
    if !(budget > 0.0) {
        return Ok(false);
    }
    let mut damaged: Vec<(O, f64)> = scope
        .room_objects
        .iter()
        .filter(|o| truthy(&o.get(atom!("hitsMax"))) && utils::construction_cost(&o.get(atom!("type"))).is_some() && range(object, o) <= area)
        .map(|o| (o.clone(), num(o, atom!("hitsMax")) - num(o, atom!("hits"))))
        .filter(|(_, missing)| *missing > 0.0)
        .collect();
    damaged.sort_by(|a, b| a.1.total_cmp(&b.1));
    let mut left = budget;
    let count = damaged.len();
    let mut given = Vec::with_capacity(count);
    for (i, (o, missing)) in damaged.into_iter().enumerate() {
        let give = missing.min((left / (count - i) as f64).floor());
        left -= give;
        if give > 0.0 {
            given.push((o, give));
        }
    }
    let total: f64 = given.iter().map(|g| g.1).sum();
    if total <= 0.0 {
        return Ok(false);
    }
    let cost = energy.min((total * REPAIR_COST).ceil());
    for (o, give) in given {
        let next = num(&o, atom!("hits")) + give;
        update(scope, &o, obj(vec![("hits", n(next))]))?;
        let data = obj(vec![("targetId", o.get(atom!("_id"))), ("amount", n(give)), ("energySpent", n(give * REPAIR_COST))]);
        event(scope, EVENT_REPAIR, object, data);
    }
    update(scope, object, obj(vec![("store", obj(vec![("energy", n(energy - cost))]))]))?;
    scope.stats_inc(atom!("energyConstruction"), &object.get(atom!("user")), cost);
    Ok(true)
}

/// The rampart on a creep's square takes a melee hit meant for the creep, as with creeps/attack.js.
fn rampart_over(scope: &RoomScope, t: &O) -> Option<O> {
    at(scope, num(t, atom!("x")), num(t, atom!("y"))).into_iter().find(|o| is(o, "rampart"))
}

fn punch(object: &O, t: &O, damage: f64, scope: &mut RoomScope) -> Result<bool, Crash> {
    if !truthy(&t.get(atom!("hits"))) || is(t, "creep") && !live_creep(t) || t.same(object) {
        return Ok(false);
    }
    let target = if is(t, "creep") || is(t, "powerCreep") { rampart_over(scope, t).unwrap_or_else(|| t.clone()) } else { t.clone() };
    _damage::damage(object, &target, damage, EVENT_ATTACK_TYPE_MELEE, scope)?;
    Ok(true)
}

fn demolish(object: &O, t: &O, damage: f64, scope: &mut RoomScope) -> Result<bool, Crash> {
    if !is(t, "rampart") && !is(t, "constructedWall") || !truthy(&t.get(atom!("hits"))) {
        return Ok(false);
    }
    _damage::damage(object, t, damage, EVENT_ATTACK_TYPE_DISMANTLE, scope)?;
    Ok(true)
}

/// Straight at the creep: no rampart takes it.
fn snipe(object: &O, t: &O, damage: f64, scope: &mut RoomScope) -> Result<bool, Crash> {
    if !(live_creep(t) || is(t, "powerCreep")) || t.same(object) {
        return Ok(false);
    }
    _damage::damage(object, t, damage, EVENT_ATTACK_TYPE_RANGED, scope)?;
    Ok(true)
}

/// A creep no rampart of someone else covers dies at once.
fn kill(object: &O, t: &O, scope: &mut RoomScope) -> Result<bool, Crash> {
    if !live_creep(t) {
        return Ok(false);
    }
    if at(scope, num(t, atom!("x")), num(t, atom!("y"))).iter().any(|o| is(o, "rampart") && !same_user(o, object)) {
        return Ok(false);
    }
    _die::die(t, None, true, scope, None)?;
    Ok(true)
}

/// A nuke on the power creep's square, which takes the place of one it dropped in this room before; the power creep
/// dies at the end of the tick.
fn nuke(object: &O, land_in: f64, scope: &mut RoomScope) -> Result<bool, Crash> {
    let pc = object.get(atom!("_id"));
    let old: Vec<O> = scope.room_objects.iter().filter(|o| is(o, "nuke") && strict_eq(&o.get(Atom::intern(NUKE_OWNER)), &pc)).cloned().collect();
    for o in old {
        let id = to_js_string(&o.get(atom!("_id")));
        scope.bulk.remove(&id);
        scope.room_objects.remove(&id);
    }
    let room = object.get(atom!("room"));
    let doc = obj(vec![
        ("type", s("nuke")),
        ("room", room.clone()),
        ("x", object.get(atom!("x"))),
        ("y", object.get(atom!("y"))),
        ("landTime", n(scope.game_time as f64 + land_in)),
        ("launchRoomName", room),
        (NUKE_OWNER, pc),
        (NUKE_USER, object.get(atom!("user"))),
    ]);
    scope.bulk.insert(&doc, None);
    // power.js kills a power creep at 0 hits in the global stage
    update(scope, object, obj(vec![("hits", n(0.0))]))?;
    Ok(true)
}
