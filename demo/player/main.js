// The mods/powerclasses showcase, as the room's owner plays it: 25 power creeps, one for each Commander and Executor
// power, each at the station layout.js gives it (written by ../make-demo.cjs). First it creates them, levels each until its
// own power is at level 5, spawns them one by one at the power spawn and walks them to their stations. From then on each
// uses its power whenever it is ready and its target fits, and the room's creeps play their parts: walk, work, heal.
// Kill, Resurrect and Nuke come round once in hundreds of ticks (Nuke once: its power creep dies), so they wait until the
// world runs at watching speed, a second or so a tick, and go off shortly after.
const L = require('layout');

const room = () => Game.rooms[L.room];
const pos = ([x, y]) => new RoomPosition(x, y, L.room);
const at = ([x, y], look) => room().lookForAt(look, x, y);
const structure = (xy, type) => at(xy, LOOK_STRUCTURES).find(s => s.structureType == type) || at(xy, LOOK_STRUCTURES)[0];
const hostile = name => room().find(FIND_HOSTILE_CREEPS).find(c => c.name == name);
const hurt = o => o && o.hits < o.hitsMax;
const ready = (pc, power) => pc.powers[power] && !pc.powers[power].cooldown;
const affected = (o, power) => (o.effects || []).some(e => e.power == power || e.effect == power);

// ---- setup ----

// The next power to level: this station's own while its next level is open at the power creep's level, otherwise the
// class's power whose next level is open soonest. Done once its own is at the station's level, 5 unless it says.
function nextUpgrade(pc, s) {
    const own = s.power;
    const have = id => (pc.powers[id] ? pc.powers[id].level : 0);
    const open = id => have(id) < 5 && POWER_INFO[id].level[have(id)] <= pc.level;
    if(have(own) >= (s.level || 5)) {
        return null;
    }
    if(open(own)) {
        return own;
    }
    const others = Object.keys(POWER_INFO).map(Number).filter(id => id != own && POWER_INFO[id].className == pc.className && open(id));
    others.sort((a, b) => POWER_INFO[a].level[have(a)] - POWER_INFO[b].level[have(b)]);
    return others[0] || null;
}

function setup() {
    for(const s of L.stations) {
        const pc = Game.powerCreeps[s.name];
        if(!pc) {
            PowerCreep.create(s.name, POWER_CLASS[s.cls.toUpperCase()]);
            continue;
        }
        const up = nextUpgrade(pc, s);
        if(up) {
            pc.upgrade(up);
        }
    }
    // Fully levelled first: an upgrade sent in the tick a power creep spawns reaches only its account copy, as in vanilla,
    // and the spawned power creep keeps its old level. Then one at a time: a power creep appears on the power spawn and has
    // to step off before the next can.
    const spawn = structure(L.powerSpawn, STRUCTURE_POWER_SPAWN);
    if(spawn && !at(L.powerSpawn, LOOK_POWER_CREEPS).length) {
        const next = L.stations.find(s => {
            const pc = Game.powerCreeps[s.name];
            return pc && !pc.room && !pc.spawnCooldownTime && !Memory.nuked && !nextUpgrade(pc, s);
        });
        if(next) {
            Game.powerCreeps[next.name].spawn(spawn);
        }
    }
}

// ---- the stations ----

// a creep that walks between the two ends of a lane
function patrol(c, lane) {
    const end = pos(lane[c.memory.back ? 0 : 1]);
    if(c.pos.isEqualTo(end)) {
        c.memory.back = !c.memory.back;
    }
    c.moveTo(pos(lane[c.memory.back ? 0 : 1]), {range: 0});
}
function topUp(pc, xy, below) {
    if(pc.store[RESOURCE_ENERGY] < below) {
        pc.withdraw(structure(xy), RESOURCE_ENERGY, Math.min(1000, pc.store.getFreeCapacity()));
    }
}
// a harvesting power creep empties itself whenever the next harvest would not fit
function dropAll(pc, power) {
    if(pc.store.getUsedCapacity() > 0 && pc.store.getFreeCapacity() < POWER_INFO[power].effect[pc.powers[power].level - 1]) {
        const type = Object.keys(pc.store).find(t => pc.store[t] > 0);
        pc.drop(type);
    }
}

const STATIONS = {
    Encourage(pc, s) {
        const c = Game.creeps[s.creep];
        if(c && c.fatigue > 0) {
            pc.usePower(PWR_ENCOURAGE, c);
        }
    },
    Exhaust(pc, s) {
        const c = Game.creeps[s.creep];
        if(c && c.fatigue == 0 && Game.time % 8 == 0) {
            pc.usePower(PWR_EXHAUST, c);
        }
    },
    Defend(pc, s) {
        const c = Game.creeps[s.creep];
        if(c && Game.time >= L.start) {
            pc.usePower(PWR_DEFEND, c);
        }
    },
    Summon(pc, s) {
        const c = Game.creeps[s.creep];
        if(c && c.pos.isEqualTo(pos(s.far))) {
            pc.usePower(PWR_SUMMON, c);
        }
    },
    Renew(pc, s) {
        topUp(pc, s.energy, 200);
        const c = Game.creeps[s.creep];
        if(c && c.ticksToLive <= CREEP_LIFE_TIME - Math.floor(SPAWN_RENEW_RATIO * CREEP_LIFE_TIME / CREEP_SPAWN_TIME / c.body.length)) {
            pc.usePower(PWR_RENEW, c);
        }
    },
    'Mass Heal'(pc) {
        if(pc.pos.findInRange(FIND_MY_CREEPS, 3).some(hurt)) {
            pc.usePower(PWR_MASS_HEAL);
        }
    },
    Disable(pc, s) {
        const c = hostile(s.hostile);
        if(c && Game.time % 5 == 0) {
            pc.usePower(PWR_DISABLE, c);
        }
    },
    Foreman(pc, s) {
        const c = Game.creeps[s.creep];
        if(c) {
            pc.usePower(PWR_FOREMAN, c);
        }
    },
    Resurrect(pc, s) {
        const grave = at(s.grave, LOOK_TOMBSTONES).find(t => t.creep.my && t.creep.name == s.creep);
        if(grave) {
            pc.usePower(PWR_RESURRECT, grave);
        }
    },
    Kill(pc, s) {
        const c = Game.creeps[s.creep], raiser = Game.powerCreeps.Resurrect;
        if(c && show() && raiser && raiser.room && ready(raiser, PWR_RESURRECT)) {
            pc.usePower(PWR_KILL, c);
        }
    },
    Sight(pc, s) {
        const c = Game.creeps[s.creep];
        if(c && !affected(c, PWR_SIGHT)) {
            pc.usePower(PWR_SIGHT, c);
        }
    },
    Berserk(pc, s) {
        const c = Game.creeps[s.creep];
        if(c && !affected(c, PWR_BERSERK)) {
            pc.usePower(PWR_BERSERK, c);
        }
    },
    Regenerate(pc) {
        if(hurt(pc)) {
            pc.usePower(PWR_REGENERATE);
        }
    },
    'Harvest Energy'(pc, s) {
        const tower = structure(s.tower, STRUCTURE_TOWER);
        if(tower && pc.store[RESOURCE_ENERGY] > 0 && tower.store.getFreeCapacity(RESOURCE_ENERGY) >= pc.store[RESOURCE_ENERGY]) {
            pc.transfer(tower, RESOURCE_ENERGY);
        }
        pc.usePower(PWR_HARVEST_ENERGY, at(s.target, LOOK_SOURCES)[0]);
    },
    'Harvest Mineral'(pc, s) {
        dropAll(pc, PWR_HARVEST_MINERAL);
        pc.usePower(PWR_HARVEST_MINERAL, at(s.target, LOOK_MINERALS)[0]);
    },
    'Harvest Deposit'(pc, s) {
        dropAll(pc, PWR_HARVEST_DEPOSIT);
        pc.usePower(PWR_HARVEST_DEPOSIT, at(s.target, LOOK_DEPOSITS)[0]);
    },
    'Remote Transfer'(pc, s) {
        topUp(pc, s.energy, 500);
        const tower = structure(s.tower, STRUCTURE_TOWER);
        const space = tower ? tower.store.getFreeCapacity(RESOURCE_ENERGY) : 0;
        if(space >= 200 && pc.store[RESOURCE_ENERGY] > 0) {
            pc.usePower(PWR_REMOTE_TRANSFER, tower, RESOURCE_ENERGY, Math.min(space, pc.store[RESOURCE_ENERGY]));
        }
    },
    'Mass Repair'(pc, s) {
        topUp(pc, s.energy, 200);
        pc.usePower(PWR_MASS_REPAIR);
    },
    Punch(pc, s) {
        pc.usePower(PWR_PUNCH, structure(s.wall));
    },
    Demolish(pc, s) {
        pc.usePower(PWR_DEMOLISH, structure(s.wall));
    },
    Reflect(pc) {
        if(Game.time >= L.start) {
            pc.usePower(PWR_REFLECT);
        }
    },
    Reinforce(pc) {
        if(Game.time >= L.start) {
            pc.usePower(PWR_REINFORCE);
        }
    },
    Snipe(pc, s) {
        const c = hostile(s.hostile);
        if(c && Game.time >= L.start) {
            pc.usePower(PWR_SNIPE, c);
        }
    },
    Nuke(pc) {
        if(show() && Game.time >= Memory.showAt + 40 && pc.usePower(PWR_NUKE) === OK) {
            Memory.nuked = Game.time;
        }
    },
};

// Dash walks its lane instead of standing, and dashes on the way whenever it can.
function dash(pc, s) {
    const [left, right] = s.lane;
    if(pc.pos.y != left[1] || pc.pos.x < left[0] || pc.pos.x > right[0]) {
        pc.moveTo(pos(left), {range: 0});
        return;
    }
    if(pc.pos.x >= right[0] - 1) {
        pc.memory.left = true;
    } else if(pc.pos.x <= left[0] + 1) {
        pc.memory.left = false;
    }
    pc.move(pc.memory.left ? LEFT : RIGHT);
    const ahead = pc.memory.left ? pc.pos.x - left[0] : right[0] - pc.pos.x;
    if(ahead >= 2) {
        pc.usePower(PWR_DASH);
    }
}

// ---- the room's creeps ----

function creeps() {
    const s = name => L.stations.find(st => st.name == name);
    const c = Game.creeps;
    if(c.Slowpoke) patrol(c.Slowpoke, s('Encourage').lane);
    if(c.Sprinter) patrol(c.Sprinter, s('Exhaust').lane);
    if(c.Wanderer && !c.Wanderer.pos.isEqualTo(pos(s('Summon').far))) c.Wanderer.moveTo(pos(s('Summon').far), {range: 0});
    if(c['Guard Medic'] && hurt(c.Guard)) c['Guard Medic'].heal(c.Guard);
    for(const [medic, pc] of [['Reflect Medic', 'Reflect'], ['Reinforce Medic', 'Reinforce']]) {
        const p = Game.powerCreeps[pc];
        if(c[medic] && p && p.room && hurt(p) && c[medic].pos.isNearTo(p)) c[medic].heal(p);
    }
    if(c.Spotter) c.Spotter.rangedAttack(structure(s('Sight').wall));
    if(c.Brawler) c.Brawler.attack(structure(s('Berserk').wall));
    const w = c.Worker, f = s('Foreman');
    if(w) {
        if(w.store.getFreeCapacity() == 0) w.memory.up = true;
        if(w.store[RESOURCE_ENERGY] == 0) w.memory.up = false;
        if(w.memory.up) w.upgradeController(structure(f.controller, STRUCTURE_CONTROLLER));
        else w.harvest(at(f.source, LOOK_SOURCES)[0]);
    }
    // the towers Remote Transfer and Harvest Energy fill spend it on a wall
    for(const st of L.stations.filter(st => st.tower)) {
        const tower = structure(st.tower, STRUCTURE_TOWER), target = structure(st.wall);
        if(tower && target && tower.store[RESOURCE_ENERGY] >= 10) tower.repair(target);
    }
}

// Kill, Resurrect and Nuke wait for the world to run at watching speed: three ticks in a row at least 0.6 s apart.
function show() {
    return Memory.showAt && Game.time >= Memory.showAt;
}
function watchSpeed() {
    const now = Date.now();
    Memory.slow = Memory.last && now - Memory.last >= 600 ? (Memory.slow || 0) + 1 : 0;
    Memory.last = now;
    if(!Memory.showAt && Memory.slow >= 3) {
        Memory.showAt = Game.time + 30;
    }
}

// Each station's frame and name, the Commander's in gold and the Executor's in red.
function labels() {
    const v = room().visual;
    v.text('mods/powerclasses: one power creep for each Commander and Executor power', 25, 1.4, {color: '#cccccc', font: 0.6});
    for(const c of L.cells) {
        const color = c.cls == 'commander' ? '#f4e383' : '#cc3d3e';
        v.rect(c.x0 - 0.5, c.y0 - 0.5, 7, 7, {fill: 'transparent', stroke: color, opacity: 0.35, lineStyle: 'dashed'});
        v.text(c.title, c.x0 + 3, c.y0 - 0.75, {color, font: 0.55});
    }
    v.text('POWER SPAWN', L.powerSpawn[0], L.powerSpawn[1] - 1.2, {color: '#cccccc', font: 0.5});
    if(Memory.showAt && Game.time < Memory.showAt) {
        v.text(`Kill and Resurrect in ${Memory.showAt - Game.time} ticks, Nuke in ${Memory.showAt + 40 - Game.time}`, 25, 47.8, {color: '#cccccc', font: 0.55});
    }
}

// How often each power went off, in Memory.used and on the console every 25 ticks.
const usePower = PowerCreep.prototype.usePower;
PowerCreep.prototype.usePower = function(power, ...rest) {
    const result = usePower.call(this, power, ...rest);
    if(result === OK) {
        const used = Memory.used || (Memory.used = {});
        used[power] = (used[power] || 0) + 1;
    }
    return result;
};

module.exports.loop = function() {
    if(!room()) {
        return;
    }
    if(Game.time % 25 == 0) {
        const used = Memory.used || {};
        console.log(`tick ${Game.time}: ` + L.stations.map(s => `${s.name} ${used[s.power] || 0}`).join(', '));
    }
    watchSpeed();
    setup();
    for(const s of L.stations) {
        const pc = Game.powerCreeps[s.name];
        if(!pc || !pc.room) {
            continue;
        }
        if(s.name == 'Dash') {
            dash(pc, s);
        } else if(!pc.pos.isEqualTo(pos(s.pc))) {
            pc.moveTo(pos(s.pc), {range: 0});
        } else {
            STATIONS[s.name](pc, s);
        }
    }
    creeps();
    labels();
};
