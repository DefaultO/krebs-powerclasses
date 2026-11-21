// mods/powerclasses in players' scripts: the Commander and the Executor. CLASSES, POWERS and MASS_HEAL_POWER are
// table.rs's, written ahead of this file. Runs once per player VM, before the game runtime loads.
//
// * POWER_CLASS.COMMANDER and EXECUTOR, PWR_ENCOURAGE (20) to PWR_NUKE (44) and their POWER_INFO entries, which
//   PowerCreep.create and upgrade already check against.
// * PowerCreep.prototype.usePower for those powers: what each needs, as error codes, then a `classPower` intent, which
//   is `usePower` with the resource type and amount REMOTE_TRANSFER takes: `(power, target, resourceType, amount)`.
//   cancelOrder('usePower') cancels it too.
// * PowerCreep.prototype.effects, which vanilla leaves out for power creeps.
// * SIGHT: rangedAttack, rangedHeal, build, repair and upgradeController reach one square further.
var _ = require('lodash');
var C = _constants;

var ownClass = {};
for (var key in CLASSES) {
    C.POWER_CLASS[key] = CLASSES[key];
    ownClass[CLASSES[key]] = true;
}
POWERS.forEach(function(p) {
    C['PWR_' + p.name] = p.id;
    C.POWER_INFO[p.id] = p.info;
});
C.MASS_HEAL_POWER = MASS_HEAL_POWER;

// Engine modules read driver.constants when they load, and runtime.js sets it only after this file: to this same
// object, so loading power-creeps.js here early changes nothing for it.
require('~runtime-driver').constants = C;
var engineUtils = require('@screeps/engine/src/utils');
var powerCreeps = require('@screeps/engine/src/game/power-creeps');

var runtimeData, intents, register, globals, patched = null;

// game.js calls this module's make on every tick; PowerCreep is made on the first one and kept.
var make = powerCreeps.make;
powerCreeps.make = function(_runtimeData, _intents, _register, _globals) {
    runtimeData = _runtimeData;
    intents = _intents;
    register = _register;
    globals = _globals;
    var result = make.apply(this, arguments);
    var PowerCreep = _globals.PowerCreep;
    if(PowerCreep && patched !== PowerCreep.prototype) {
        patched = PowerCreep.prototype;
        patch(PowerCreep, _globals.Creep);
    }
    return result;
};

// power-creeps.js data(id)
function data(id) {
    return Object.assign({}, runtimeData.userPowerCreeps[id], runtimeData.roomObjects[id]);
}

function hasEffect(object, power) {
    return _.some(object.effects, function(e) { return e.power == power && e.ticksRemaining > 0; });
}

function isCreep(t) {
    return t instanceof globals.Creep && !t.spawning;
}

function structureAt(pos, type) {
    return _.find(pos.lookFor(C.LOOK_STRUCTURES), function(s) { return s.structureType == type; });
}

function freeCapacity(object) {
    return object.store ? object.store.getFreeCapacity() : 0;
}

// What each power needs of its target and of the power creep, past vanilla's checks of the room and the power.
var check = {};
function needsCreep(pc, t) {
    return isCreep(t) ? C.OK : C.ERR_INVALID_TARGET;
}
[C.PWR_ENCOURAGE, C.PWR_EXHAUST, C.PWR_DEFEND, C.PWR_DISABLE, C.PWR_FOREMAN, C.PWR_SIGHT, C.PWR_BERSERK].forEach(function(p) {
    check[p] = needsCreep;
});
check[C.PWR_SUMMON] = function(pc, t) {
    return isCreep(t) && t.my ? C.OK : C.ERR_INVALID_TARGET;
};
check[C.PWR_RENEW] = function(pc, t) {
    if(!isCreep(t) || !t.my || _.any(t.body, {type: C.CLAIM})) {
        return C.ERR_INVALID_TARGET;
    }
    var parts = t.body.length;
    if(t.ticksToLive + Math.floor(C.SPAWN_RENEW_RATIO * C.CREEP_LIFE_TIME / C.CREEP_SPAWN_TIME / parts) > C.CREEP_LIFE_TIME) {
        return C.ERR_FULL;
    }
    var cost = Math.ceil(C.SPAWN_RENEW_RATIO * engineUtils.calcCreepCost(t.body) / C.CREEP_SPAWN_TIME / parts);
    return (pc.store.energy || 0) < cost ? C.ERR_NOT_ENOUGH_ENERGY : C.OK;
};
check[C.PWR_RESURRECT] = function(pc, t) {
    if(!(t instanceof globals.Tombstone) || !(t.creep instanceof globals.Creep) || !t.creep.my || !(t.creep.ticksToLive > 1)) {
        return C.ERR_INVALID_TARGET;
    }
    return globals.Game.creeps[t.creep.name] ? C.ERR_NAME_EXISTS : C.OK;
};
check[C.PWR_HARVEST_ENERGY] = function(pc, t) {
    if(!(t instanceof globals.Source)) {
        return C.ERR_INVALID_TARGET;
    }
    var c = pc.room.controller;
    if(c && (c.owner && !c.my || c.reservation && c.reservation.username != pc.owner.username)) {
        return C.ERR_NOT_OWNER;
    }
    if(!t.energy) {
        return C.ERR_NOT_ENOUGH_RESOURCES;
    }
    return freeCapacity(pc) > 0 ? C.OK : C.ERR_FULL;
};
check[C.PWR_HARVEST_MINERAL] = function(pc, t) {
    if(!(t instanceof globals.Mineral)) {
        return C.ERR_INVALID_TARGET;
    }
    var extractor = structureAt(t.pos, C.STRUCTURE_EXTRACTOR);
    if(!extractor) {
        return C.ERR_NOT_FOUND;
    }
    if(extractor.owner && !extractor.my) {
        return C.ERR_NOT_OWNER;
    }
    if(!extractor.isActive()) {
        return C.ERR_RCL_NOT_ENOUGH;
    }
    if(!t.mineralAmount) {
        return C.ERR_NOT_ENOUGH_RESOURCES;
    }
    return freeCapacity(pc) > 0 ? C.OK : C.ERR_FULL;
};
check[C.PWR_HARVEST_DEPOSIT] = function(pc, t) {
    if(!(t instanceof globals.Deposit)) {
        return C.ERR_INVALID_TARGET;
    }
    if(t.cooldown) {
        return C.ERR_TIRED;
    }
    return freeCapacity(pc) > 0 ? C.OK : C.ERR_FULL;
};
check[C.PWR_MASS_REPAIR] = function(pc) {
    return pc.store.energy > 0 ? C.OK : C.ERR_NOT_ENOUGH_ENERGY;
};
check[C.PWR_PUNCH] = function(pc, t) {
    var hittable = isCreep(t) || t instanceof globals.PowerCreep || t instanceof globals.Structure;
    return hittable && t.hits && t !== pc ? C.OK : C.ERR_INVALID_TARGET;
};
check[C.PWR_DEMOLISH] = function(pc, t) {
    return t instanceof globals.StructureRampart || t instanceof globals.StructureWall ? C.OK : C.ERR_INVALID_TARGET;
};
check[C.PWR_SNIPE] = function(pc, t) {
    return (isCreep(t) || t instanceof globals.PowerCreep) && t !== pc ? C.OK : C.ERR_INVALID_TARGET;
};
check[C.PWR_KILL] = function(pc, t) {
    if(!isCreep(t)) {
        return C.ERR_INVALID_TARGET;
    }
    var rampart = structureAt(t.pos, C.STRUCTURE_RAMPART);
    return rampart && !rampart.my ? C.ERR_INVALID_TARGET : C.OK;
};

// (pc, target, resourceType, amount) -> error code, or the amount to send
function remoteTransfer(pc, t, resourceType, amount) {
    if(!t || t === pc || !t.store || !(t instanceof globals.Creep || t instanceof globals.PowerCreep || t instanceof globals.Structure)) {
        return C.ERR_INVALID_TARGET;
    }
    if(!_.contains(C.RESOURCES_ALL, resourceType)) {
        return C.ERR_INVALID_ARGS;
    }
    var free = t.store.getFreeCapacity(resourceType);
    if(free === null || free === undefined) {
        return C.ERR_INVALID_TARGET;
    }
    var have = pc.store[resourceType] || 0;
    if(amount === undefined) {
        amount = Math.min(have, free);
    }
    if(!(amount > 0) || have < amount) {
        return amount < 0 ? C.ERR_INVALID_ARGS : C.ERR_NOT_ENOUGH_RESOURCES;
    }
    if(amount > free) {
        return C.ERR_FULL;
    }
    return {amount: Math.floor(amount)};
}

function useClassPower(pc, power, info, target, resourceType, amount) {
    // vanilla usePower: the power creep, the room, the power
    if(!pc.my) {
        return C.ERR_NOT_OWNER;
    }
    if(!pc.room) {
        return C.ERR_BUSY;
    }
    var controller = pc.room.controller;
    if(controller) {
        if(!controller.isPowerEnabled) {
            return C.ERR_INVALID_ARGS;
        }
        if(!controller.my && controller.safeMode) {
            return C.ERR_INVALID_ARGS;
        }
    }
    var powerData = (data(pc.id).powers || {})[power];
    if(!powerData || !powerData.level) {
        return C.ERR_NO_BODYPART;
    }
    if(powerData.cooldownTime > runtimeData.time) {
        return C.ERR_TIRED;
    }
    var level = Math.min(5, powerData.level);
    var at = function(v) { return Array.isArray(v) ? v[level - 1] : v; };

    var id, transfer;
    if(info.range !== undefined) {
        if(!target || !target.id || !target.pos) {
            return C.ERR_INVALID_TARGET;
        }
        var answer;
        if(power == C.PWR_REMOTE_TRANSFER) {
            answer = remoteTransfer(pc, target, resourceType, amount);
            if(typeof answer == 'number') {
                return answer;
            }
            transfer = answer;
        }
        else {
            answer = check[power](pc, target);
            if(answer !== C.OK) {
                return answer;
            }
        }
        id = target.id;
        if(!pc.pos.inRangeTo(target, at(info.range))) {
            return C.ERR_NOT_IN_RANGE;
        }
    }
    else if(check[power]) {
        var error = check[power](pc);
        if(error !== C.OK) {
            return error;
        }
    }
    if(info.duration !== undefined) {
        var current = _.find((target || pc).effects, function(e) { return e.power == power; });
        if(current && current.level > level && current.ticksRemaining > 0) {
            return C.ERR_FULL;
        }
    }

    var intent = {power: power, id: id};
    if(transfer) {
        intent.resourceType = resourceType;
        intent.amount = transfer.amount;
    }
    intents.set(pc.id, 'classPower', intent);
    return C.OK;
}

var sighted = ['rangedAttack', 'rangedHeal', 'build', 'repair', 'upgradeController'];

function patch(PowerCreep, Creep) {
    var usePower = PowerCreep.prototype.usePower;
    PowerCreep.prototype.usePower = register.wrapFn(function(power, target, resourceType, amount) {
        var info = C.POWER_INFO[power];
        if(!info || !ownClass[info.className]) {
            return usePower.call(this, power, target);
        }
        return useClassPower(this, power, info, target, resourceType, amount);
    });

    var cancelOrder = PowerCreep.prototype.cancelOrder;
    PowerCreep.prototype.cancelOrder = register.wrapFn(function(name) {
        if(name == 'usePower' && this.room && this.my && intents.remove(this.id, 'classPower')) {
            return C.OK;
        }
        return cancelOrder.call(this, name);
    });

    // RoomObject's own, which power creeps do not get
    Object.defineProperty(PowerCreep.prototype, 'effects', {
        configurable: true,
        get: function() {
            var effects = this.id && data(this.id).effects;
            if(!effects) {
                return undefined;
            }
            return _(effects).map(function(i) {
                return {power: i.power, effect: i.effect, level: i.level, ticksRemaining: i.endTime - runtimeData.time};
            }).filter(function(i) { return i.ticksRemaining > 0; }).value();
        }
    });

    // SIGHT: an action refused for being out of range by one square is asked again from one square closer, which is
    // how the server runs it too.
    sighted.forEach(function(name) {
        var action = Creep.prototype[name];
        Creep.prototype[name] = register.wrapFn(function(target) {
            var result = action.apply(this, arguments);
            if(result !== C.ERR_NOT_IN_RANGE || !target || !target.pos || target.pos.roomName !== this.pos.roomName ||
                this.pos.getRangeTo(target) !== 4 || !hasEffect(this, C.PWR_SIGHT)) {
                return result;
            }
            var pos = this.pos;
            this.pos = new globals.RoomPosition(pos.x + Math.sign(target.pos.x - pos.x), pos.y + Math.sign(target.pos.y - pos.y), pos.roomName);
            try {
                return action.apply(this, arguments);
            }
            finally {
                this.pos = pos;
            }
        });
    });
}
