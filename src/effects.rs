//! What the powers leave on creeps and power creeps, and the hooks that act on it.
//!
//! An effect is stored as vanilla stores the Operator's, `{effect, power, level, endTime}` in `effects`, and is on for
//! the `duration` ticks after the tick it was put on: players see it from their next run, with `ticksRemaining`
//! counting down from `duration` to 1, and it does nothing before that, whatever order the room runs intents in.
//!
//! * DISABLE empties the creep's intents before they run (`before_intents`).
//! * FOREMAN and BERSERK lend the creep a second copy of the body parts they double while its own intents run, so
//!   every action and its energy cost doubles the way the game works it out, boosts included (`before_intents`, given
//!   back in `after_intents`).
//! * SIGHT runs an intent core left alone for being one square too far, from one square closer (`after_intents`).
//! * BERSERK's damage and heal taken, DEFEND, REFLECT and REINFORCE change `_damageToApply` and `_healToApply` once
//!   every intent has run (`pre_tick`).
//! * DASH moves the power creep a square further once the room has moved everything (`room_end`).

use crate::table::{self, PWR_BERSERK, PWR_DASH, PWR_DEFEND, PWR_DISABLE, PWR_FOREMAN, PWR_REFLECT, PWR_REINFORCE, PWR_SIGHT};
use crate::util::*;
use engine::atom;
use engine::constants::{ATTACK, EVENT_ATTACK, EVENT_ATTACK_TYPE_HIT_BACK, EVENT_EXIT, EVENT_HEAL, HEAL, RANGED_ATTACK, WORK};
use engine::doc::Atom;
use engine::doc::Id;
use engine::live::{clone_deep, strict_eq, to_js_string, to_number, truthy, Crash, A, O, V};
use engine::processor::intents::creeps::{build, intents::PRIORITIES, ranged_attack, ranged_heal, repair, upgrade_controller};
use engine::processor::{IntentFn, RoomScope};
use engine::utils;
use std::cell::RefCell;

/// The effect of `power` the object is under on this tick, and its level.
pub fn active(o: &O, power: u32, game_time: f64) -> Option<(O, f64)> {
    let effects = o.get(atom!("effects"));
    if !truthy(&effects) {
        return None;
    }
    let p = table::power(power)?;
    for e in values(&effects) {
        let V::Obj(e) = e else { continue };
        if num(&e, atom!("power")) != power as f64 {
            continue;
        }
        let (level, end) = (num(&e, atom!("level")), num(&e, atom!("endTime")));
        let duration = p.duration.map_or(0.0, |d| d.at((level as usize).clamp(1, 5) - 1) as f64);
        if game_time < end && game_time >= end - duration {
            return Some((e, level));
        }
    }
    None
}

/// Vanilla's ERR_FULL in usePower: the target is under the same power at a higher level, still going.
pub fn stronger(o: &O, power: u32, level: f64, game_time: f64) -> bool {
    values(&o.get(atom!("effects"))).iter().any(|e| {
        let V::Obj(e) = e else { return false };
        num(e, atom!("power")) == power as f64 && num(e, atom!("level")) > level && num(e, atom!("endTime")) > game_time
    })
}

/// Puts `power` at `level` on `target` for the power's duration from the next tick. The effect replaces the one of
/// the same power, and this mod's effects that have run out go.
pub fn put(scope: &mut RoomScope, target: &O, power: u32, level: f64, extra: Vec<(&str, V)>) -> Result<(), Crash> {
    let game_time = scope.game_time as f64;
    let p = table::power(power).expect("a power of this mod");
    let duration = p.duration.map_or(0.0, |d| d.at(level as usize - 1) as f64);
    let mut list: Vec<V> = values(&target.get(atom!("effects")))
        .into_iter()
        .filter(|e| {
            let V::Obj(e) = e else { return true };
            let pw = num(e, atom!("power"));
            pw != power as f64 && !(table::power(pw as u32).is_some() && num(e, atom!("endTime")) <= game_time)
        })
        .collect();
    let mut fields = vec![("effect", n(power as f64)), ("power", n(power as f64)), ("level", n(level)), ("endTime", n(game_time + duration + 1.0))];
    fields.extend(extra);
    list.push(obj(fields));
    // as core's usePower does: the second update replaces the list instead of merging into it
    update(scope, target, obj(vec![("effects", V::Null)]))?;
    update(scope, target, obj(vec![("effects", arr(list))]))
}

/// Writes `target`'s effects again after one of them changed in place.
fn rewrite(scope: &mut RoomScope, target: &O) -> Result<(), Crash> {
    let list = values(&target.get(atom!("effects")));
    update(scope, target, obj(vec![("effects", V::Null)]))?;
    update(scope, target, obj(vec![("effects", arr(list))]))
}

/// Per room thread: what this mod changed for the length of one object's intents, and dashes waiting for the room's
/// end. A room runs start to end on one thread.
#[derive(Default)]
struct Pending {
    /// Creeps holding a lent body, with their own.
    bodies: Vec<(O, V)>,
    /// (room, tick, power creep, dx, dy, x, y where it started the tick)
    dashes: Vec<(u32, u64, O, f64, f64, f64, f64)>,
}

thread_local! {
    static PENDING: RefCell<Pending> = RefCell::new(Pending::default());
}

/// Body parts FOREMAN and BERSERK double.
fn doubled_parts(o: &O, intents: &V, game_time: f64) -> Vec<&'static str> {
    let mut parts = Vec::new();
    let has = |k: &str| truthy(&get(intents, Atom::intern(k)));
    // a creep that dies by its own hand reads its body for the tombstone
    if has("suicide") {
        return parts;
    }
    if active(o, PWR_FOREMAN, game_time).is_some() && !has("dismantle") {
        parts.push(WORK);
    }
    if active(o, PWR_BERSERK, game_time).is_some() {
        parts.extend([ATTACK, RANGED_ATTACK, HEAL]);
    }
    parts
}

/// `pre_object_intents`: DISABLE, and the lent body of FOREMAN and BERSERK.
pub fn before_intents(object: Option<&O>, user: engine::world::UserIdx, intents: &V, scope: &mut RoomScope) {
    let Some(o) = object else { return };
    if !is(o, "creep") || !truthy(&o.get(atom!("effects"))) {
        return;
    }
    // what processor.js skips gets no `after_intents` to give the body back
    let owner = scope.ctx.users.get(user as usize).map(|u| u.id.as_str().to_string());
    if truthy(&o.get(atom!("_skip"))) || owner.as_deref() != Some(&*to_js_string(&o.get(atom!("user")))) {
        return;
    }
    let game_time = scope.game_time as f64;
    if active(o, PWR_DISABLE, game_time).is_some() {
        if let V::Obj(i) = intents {
            for k in i.keys() {
                i.set(k, V::Null);
            }
        }
        return;
    }
    let parts = doubled_parts(o, intents, game_time);
    if parts.is_empty() {
        return;
    }
    let body = o.get(atom!("body"));
    let mut lent = values(&body);
    for part in values(&body) {
        if parts.iter().any(|p| strict_eq(&get(&part, atom!("type")), &s(p))) {
            lent.push(clone_deep(&part));
        }
    }
    o.set(atom!("body"), V::Arr(A::from_vec(lent)));
    PENDING.with(|p| p.borrow_mut().bodies.push((o.clone(), body)));
}

/// Gives back every lent body still out (`o`'s alone when given).
fn give_back(only: Option<&O>) {
    PENDING.with(|p| {
        p.borrow_mut().bodies.retain(|(c, body)| {
            if only.is_some_and(|o| !o.same(c)) {
                return true;
            }
            c.set(atom!("body"), body.clone());
            false
        })
    });
}

/// The intents SIGHT reaches one square further with, in the order core runs a creep's intents.
const SIGHTED: &[(&str, IntentFn)] = &[
    ("rangedHeal", ranged_heal::run),
    ("repair", repair::run),
    ("build", build::run),
    ("rangedAttack", ranged_attack::run),
    ("upgradeController", upgrade_controller::run),
];
/// How far those reach without SIGHT.
const SIGHTED_RANGE: f64 = 3.0;

/// `post_object_intents`: SIGHT, DASH, then the lent body back.
pub fn after_intents(object: &O, _user: engine::world::UserIdx, intents: &V, scope: &mut RoomScope) {
    if is(object, "powerCreep") {
        if let Err(e) = dash(object, intents, scope) {
            report(e);
        }
        return;
    }
    if !is(object, "creep") || !truthy(&object.get(atom!("effects"))) {
        return;
    }
    if active(object, PWR_SIGHT, scope.game_time as f64).is_some() {
        if let Err(e) = sight(object, intents, scope) {
            report(e);
        }
    }
    give_back(Some(object));
}

/// Runs, from one square closer, each SIGHT intent whose target is one square past its range: core skipped those
/// without a trace. An intent another one blocks stays skipped, as core's priorities say.
fn sight(object: &O, intents: &V, scope: &mut RoomScope) -> Result<(), Crash> {
    for &(name, run) in SIGHTED {
        let intent = get(intents, Atom::intern(name));
        if !truthy(&intent) {
            continue;
        }
        let blockers = PRIORITIES.iter().find(|(n, _)| *n == name).map_or(&[][..], |(_, b)| *b);
        if blockers.iter().any(|b| truthy(&get(intents, Atom::intern(b)))) {
            continue;
        }
        let Some(target) = scope.room_objects.get(&to_js_string(&get(&intent, atom!("id")))) else { continue };
        if range(object, &target) != SIGHTED_RANGE + 1.0 {
            continue;
        }
        let (x, y) = (object.get(atom!("x")), object.get(atom!("y")));
        let step = |k: Atom| (num(&target, k) - num(object, k)).signum();
        object.set(atom!("x"), n(to_number(&x) + step(atom!("x"))));
        object.set(atom!("y"), n(to_number(&y) + step(atom!("y"))));
        let result = run(object, &intent, scope);
        object.set(atom!("x"), x);
        object.set(atom!("y"), y);
        result?;
    }
    Ok(())
}

/// DASH, which this hook handles whole because it needs the power creep's move: the power is used when the power creep
/// also moves this tick, and the extra square is taken at the room's end.
fn dash(object: &O, intents: &V, scope: &mut RoomScope) -> Result<(), Crash> {
    let intent = get(intents, Atom::intern("classPower"));
    if to_number(&get(&intent, atom!("power"))) != PWR_DASH as f64 {
        return Ok(());
    }
    let Some(level) = crate::powers::ready(object, PWR_DASH, scope) else { return Ok(()) };
    let mv = get(intents, atom!("move"));
    let Some((dx, dy)) = utils::get_offsets_by_direction(&get(&mv, atom!("direction"))) else { return Ok(()) };
    let (x, y) = (num(object, atom!("x")), num(object, atom!("y")));
    let (room, time) = (scope.room, scope.game_time);
    PENDING.with(|p| p.borrow_mut().dashes.push((room, time, object.clone(), dx, dy, x, y)));
    let at = (object.get(atom!("x")), object.get(atom!("y")));
    crate::powers::used(object, PWR_DASH, level, None, at, scope)
}

/// `room_end`: the dashes of this room.
pub fn room_end(scope: &mut RoomScope) {
    let (room, time) = (scope.room, scope.game_time);
    let dashes: Vec<_> = PENDING.with(|p| {
        let mut p = p.borrow_mut();
        let all = std::mem::take(&mut p.dashes);
        all.into_iter().filter(|d| d.0 == room && d.1 == time).collect()
    });
    for (_, _, pc, dx, dy, x0, y0) in dashes {
        if let Err(e) = dash_step(&pc, dx, dy, x0, y0, scope) {
            report(e);
        }
    }
}

/// The extra square: in the direction of the move the power creep made this tick, when nothing stands there.
fn dash_step(pc: &O, dx: f64, dy: f64, x0: f64, y0: f64, scope: &mut RoomScope) -> Result<(), Crash> {
    let id = to_js_string(&pc.get(atom!("_id")));
    if scope.room_objects.get(&id).is_none() || truthy(&pc.get(atom!("interRoom"))) {
        return Ok(());
    }
    let (x, y) = (num(pc, atom!("x")), num(pc, atom!("y")));
    if x != x0 + dx || y != y0 + dy {
        return Ok(()); // the move did not happen
    }
    let (nx, ny) = (x + dx, y + dy);
    let user = pc.get(atom!("user"));
    if !walkable(scope, nx, ny, &user) {
        return Ok(());
    }
    let portal = at(scope, nx, ny).into_iter().find(|o| is(o, "portal"));
    if let Some(p) = &portal {
        if truthy(&get(&p.get(atom!("destination")), atom!("shard"))) {
            return Ok(());
        }
    }
    update(scope, pc, obj(vec![("x", n(nx)), ("y", n(ny))]))?;
    if let Some(p) = portal {
        return update(scope, pc, obj(vec![("interRoom", p.get(atom!("destination")))]));
    }
    // power-creeps/tick.js at an exit
    if nx == 0.0 || ny == 0.0 || nx == 49.0 || ny == 49.0 {
        let (rx, ry) = utils::room_name_to_xy(&to_js_string(&pc.get(atom!("room"))));
        let (mut tx, mut ty, mut room) = (nx, ny, String::new());
        if nx == 0.0 {
            tx = 49.0;
            room = utils::get_room_name_from_xy(rx - 1.0, ry);
        } else if ny == 0.0 {
            ty = 49.0;
            room = utils::get_room_name_from_xy(rx, ry - 1.0);
        } else if nx == 49.0 {
            tx = 0.0;
            room = utils::get_room_name_from_xy(rx + 1.0, ry);
        } else if ny == 49.0 {
            ty = 0.0;
            room = utils::get_room_name_from_xy(rx, ry + 1.0);
        }
        update(scope, pc, obj(vec![("interRoom", obj(vec![("room", s(&room)), ("x", n(tx)), ("y", n(ty))]))]))?;
        event(scope, EVENT_EXIT, pc, obj(vec![("room", s(&room)), ("x", n(tx)), ("y", n(ty))]));
    }
    Ok(())
}

/// `pre_tick`: what creeps and power creeps take this tick, now that it is all known.
pub fn pre_tick(scope: &mut RoomScope) {
    // a body lent to a creep whose intents never ran
    give_back(None);
    // who was hit or healed, from the event log: every damage and heal goes through it
    let mut hit: Vec<V> = Vec::new();
    for e in &scope.event_log {
        let ev = to_number(&get(e, atom!("event")));
        if ev == EVENT_ATTACK as f64 || ev == EVENT_HEAL as f64 {
            let t = get(&get(e, atom!("data")), atom!("targetId"));
            if !hit.iter().any(|h| strict_eq(h, &t)) {
                hit.push(t);
            }
        }
    }
    let game_time = scope.game_time as f64;
    for id in hit {
        let Some(o) = scope.room_objects.get(&to_js_string(&id)) else { continue };
        if !truthy(&o.get(atom!("effects"))) {
            continue;
        }
        let result = if is(&o, "creep") {
            taken_by_creep(&o, game_time, scope)
        } else if is(&o, "powerCreep") {
            taken_by_power_creep(&o, game_time, scope)
        } else {
            Ok(())
        };
        if let Err(e) = result {
            report(e);
        }
    }
}

fn amount(o: &O, k: Atom) -> f64 {
    let v = o.get(k);
    if truthy(&v) {
        to_number(&v)
    } else {
        0.0
    }
}

fn set_amount(o: &O, k: Atom, v: f64) {
    if v > 0.0 {
        o.set(k, n(v));
    } else {
        o.delete(k);
    }
}

/// BERSERK doubles what the creep takes, then DEFEND blocks what it can.
fn taken_by_creep(o: &O, game_time: f64, scope: &mut RoomScope) -> Result<(), Crash> {
    if active(o, PWR_BERSERK, game_time).is_some() {
        set_amount(o, atom!("_damageToApply"), amount(o, atom!("_damageToApply")) * 2.0);
        set_amount(o, atom!("_healToApply"), amount(o, atom!("_healToApply")) * 2.0);
    }
    if let Some((e, _)) = active(o, PWR_DEFEND, game_time) {
        let (damage, left) = (amount(o, atom!("_damageToApply")), amount(&e, Atom::intern("left")));
        let blocked = damage.min(left);
        if blocked > 0.0 {
            set_amount(o, atom!("_damageToApply"), damage - blocked);
            e.set(Atom::intern("left"), n(left - blocked));
            rewrite(scope, o)?;
        }
    }
    Ok(())
}

/// REFLECT sends half of each hit back to the creep that dealt it, past any rampart, and REINFORCE takes the rest away.
/// A power creep that hits it takes nothing back, and its hit lands whole: Screeps' description reflects "back to an
/// attacker creep", and a creep there is not a power creep.
fn taken_by_power_creep(o: &O, game_time: f64, scope: &mut RoomScope) -> Result<(), Crash> {
    if let Some((e, _)) = active(o, PWR_REFLECT, game_time) {
        let share = {
            let level = num(&e, atom!("level")) as usize;
            table::power(PWR_REFLECT).and_then(|p| p.effect).map_or(0.5, |a| a[level.clamp(1, 5) - 1])
        };
        let id = o.get(atom!("_id"));
        let hits: Vec<(V, f64)> = scope
            .event_log
            .iter()
            .filter(|ev| to_number(&get(ev, atom!("event"))) == EVENT_ATTACK as f64 && strict_eq(&get(&get(ev, atom!("data")), atom!("targetId")), &id))
            .map(|ev| (get(ev, atom!("objectId")), to_number(&get(&get(ev, atom!("data")), atom!("damage")))))
            .collect();
        for (attacker, damage) in hits {
            let Some(a) = scope.room_objects.get(&to_js_string(&attacker)) else { continue };
            if !is(&a, "creep") {
                continue;
            }
            let back = (damage * share).floor();
            if back <= 0.0 {
                continue;
            }
            set_amount(&a, atom!("_damageToApply"), amount(&a, atom!("_damageToApply")) + back);
            set_amount(o, atom!("_damageToApply"), amount(o, atom!("_damageToApply")) - back);
            let data = obj(vec![("targetId", attacker.clone()), ("damage", n(back)), ("attackType", n(EVENT_ATTACK_TYPE_HIT_BACK as f64))]);
            event(scope, EVENT_ATTACK, o, data);
        }
    }
    if active(o, PWR_REINFORCE, game_time).is_some() {
        o.delete(atom!("_damageToApply"));
    }
    Ok(())
}

/// `process_object`: a power creep's `classPower` of last tick cleared, what RESURRECT needs to know of a tombstone, and
/// the nukes of power creeps that are gone.
pub fn prescan(o: &O, scope: &mut RoomScope) {
    if is(o, "powerCreep") {
        // The engine has just given the power creep a fresh action log, vanilla's keys at null (processor.js), without
        // `classPower`. The game client gets room objects as diffs, and a nested key that went away reaches it as
        // nothing at all (common's getDiff), so the client would keep last tick's `classPower` and draw that power again
        // every tick. Vanilla's `power` stays in the log at null; `classPower` does the same on the tick after a use.
        let used_last = match o.get(atom!("_actionLog")) {
            V::Obj(last) => truthy(&last.get(Atom::intern("classPower"))),
            _ => false,
        };
        if let (true, V::Obj(log)) = (used_last, o.get(atom!("actionLog"))) {
            log.set(Atom::intern("classPower"), V::Null);
        }
    } else if is(o, "tombstone") {
        // a new tombstone is seen here before anything can be withdrawn from it
        if truthy(&o.get(atom!("creepId"))) && !o.has(Atom::intern(STORE_AT_DEATH)) {
            let store = o.get(atom!("store"));
            let at_death = if truthy(&store) { clone_deep(&store) } else { obj(vec![]) };
            if let Err(e) = update(scope, o, obj(vec![(STORE_AT_DEATH, at_death)])) {
                report(e);
            }
        }
    } else if is(o, "nuke") && truthy(&o.get(Atom::intern(NUKE_OWNER))) && !power_creep_exists(o, scope) {
        let id = o.get(atom!("_id"));
        scope.bulk.remove(&to_js_string(&id));
        scope.room_objects.remove(&to_js_string(&id));
    }
}

/// A tombstone's store when it was made; RESURRECT wants it untouched.
pub const STORE_AT_DEATH: &str = "storeAtDeath";
/// The power creep a nuke came from, and its player.
pub const NUKE_OWNER: &str = "powerCreep";
pub const NUKE_USER: &str = "powerCreepUser";

/// Whether the power creep that dropped a nuke still exists: deleting a power creep takes its nukes away.
fn power_creep_exists(nuke: &O, scope: &RoomScope) -> bool {
    let pc = to_js_string(&nuke.get(Atom::intern(NUKE_OWNER)));
    let user = to_js_string(&nuke.get(Atom::intern(NUKE_USER)));
    let Some(u) = Id::new(&user).and_then(|id| scope.ctx.user_ids.get(&id)) else { return false };
    scope.ctx.users.get(*u as usize).is_some_and(|u| u.power_creeps.iter().any(|d| d.obj.get(atom!("_id")).is_some_and(|v| v.as_str() == Some(&*pc))))
}

/// A hook cannot fail the room the way an intent handler can: what went wrong goes to the server's log.
pub fn report(e: Crash) {
    eprintln!("powerclasses: {}", e.0);
}
