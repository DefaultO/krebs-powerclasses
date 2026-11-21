//! Small idioms over the engine's live objects. Core keeps its own as `pub(crate)`.

use engine::atom;
use engine::bulk::Target;
use engine::constants::{OBSTACLE_OBJECT_TYPES, TERRAIN_MASK_WALL};
use engine::doc::Atom;
use engine::live::{to_number, truthy, Crash, A, O, V};
use engine::processor::RoomScope;
use engine::utils;

pub fn n(x: f64) -> V {
    V::Num(x)
}

pub fn s(x: &str) -> V {
    V::str(x)
}

/// `{k: v, …}` as a fresh live object.
pub fn obj(pairs: Vec<(&str, V)>) -> V {
    let o = O::new();
    for (k, v) in pairs {
        o.set(Atom::intern(k), v);
    }
    V::Obj(o)
}

pub fn arr(items: Vec<V>) -> V {
    V::Arr(A::from_vec(items))
}

/// `base[key]` of a value that may not be an object.
pub fn get(base: &V, key: Atom) -> V {
    match base {
        V::Obj(o) => o.get(key),
        _ => V::Undef,
    }
}

/// `_.values` of an array or an object (effects are stored as either).
pub fn values(v: &V) -> Vec<V> {
    match v {
        V::Arr(a) => a.to_vec(),
        V::Obj(o) => o.keys().into_iter().map(|k| o.get(k)).collect(),
        _ => Vec::new(),
    }
}

/// A number field, NaN when missing.
pub fn num(o: &O, k: Atom) -> f64 {
    to_number(&o.get(k))
}

pub fn is(o: &O, ty: &str) -> bool {
    o.eq_str(atom!("type"), ty)
}

pub fn same_user(a: &O, b: &O) -> bool {
    let (x, y) = (a.get(atom!("user")), b.get(atom!("user")));
    truthy(&x) && engine::live::to_js_string(&x) == engine::live::to_js_string(&y)
}

/// Squares between two objects of one room, diagonals counting one.
pub fn range(a: &O, b: &O) -> f64 {
    utils::dist(&V::Obj(a.clone()), &V::Obj(b.clone()))
}

pub fn update(scope: &mut RoomScope, o: &O, data: V) -> Result<(), Crash> {
    scope.bulk.update(Target::Obj(o), &data)
}

/// `eventLog.push({event, objectId, data})`.
pub fn event(scope: &mut RoomScope, event: u32, object: &O, data: V) {
    scope.event_log.push(obj(vec![("event", n(event as f64)), ("objectId", object.get(atom!("_id"))), ("data", data)]));
}

/// `actionLog[key] = {x, y}` of `at`.
pub fn log(object: &O, key: Atom, at: &O) {
    if let V::Obj(l) = object.get(atom!("actionLog")) {
        l.set(key, obj(vec![("x", at.get(atom!("x"))), ("y", at.get(atom!("y")))]));
    }
}

pub fn stored(o: &O, resource: Atom) -> f64 {
    let v = get(&o.get(atom!("store")), resource);
    if truthy(&v) {
        to_number(&v)
    } else {
        0.0
    }
}

/// Room left in a creep's or power creep's store.
pub fn free(o: &O) -> Result<f64, Crash> {
    Ok((num(o, atom!("storeCapacity")) - utils::calc_resources(&V::Obj(o.clone()))?).max(0.0))
}

/// Adds `amount` of `resource` to a creep's or power creep's store.
pub fn add_to_store(scope: &mut RoomScope, o: &O, resource: Atom, amount: f64) -> Result<(), Crash> {
    if !truthy(&o.get(atom!("store"))) {
        o.set(atom!("store"), V::Obj(O::new()));
    }
    let next = stored(o, resource) + amount;
    let store = O::new();
    store.set(resource, n(next));
    update(scope, o, obj(vec![("store", V::Obj(store))]))
}

/// The room objects at a square.
pub fn at(scope: &RoomScope, x: f64, y: f64) -> Vec<O> {
    let (vx, vy) = (n(x), n(y));
    scope.room_objects.near(&vx, &vy).filter(|o| num(o, atom!("x")) == x && num(o, atom!("y")) == y).cloned().collect()
}

/// Whether a creep of `user` can stand on a square: inside the room, no wall, nothing solid and no rampart of someone
/// else that is not public. Creeps and power creeps count as solid.
pub fn walkable(scope: &RoomScope, x: f64, y: f64, user: &V) -> bool {
    if !(0.0..=49.0).contains(&x) || !(0.0..=49.0).contains(&y) || utils::check_terrain(scope.room_terrain, x, y, TERRAIN_MASK_WALL) {
        return false;
    }
    !at(scope, x, y).iter().any(|o| {
        let ty = o.get(atom!("type"));
        let ty = engine::live::to_js_string(&ty);
        OBSTACLE_OBJECT_TYPES.contains(&&*ty)
            || &*ty == "rampart" && !truthy(&o.get(atom!("isPublic"))) && engine::live::to_js_string(&o.get(atom!("user"))) != engine::live::to_js_string(user)
    })
}
