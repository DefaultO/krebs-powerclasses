// Test bot for mods/powerclasses: one step per tick, PASS/FAIL lines on the console.
const C_UP = [PWR_ENCOURAGE, PWR_EXHAUST, PWR_DEFEND, PWR_SUMMON, PWR_RENEW, PWR_MASS_HEAL, PWR_DISABLE, PWR_DEFEND, PWR_ENCOURAGE, PWR_EXHAUST,
    PWR_FOREMAN, PWR_RESURRECT, PWR_DEFEND, PWR_ENCOURAGE, PWR_EXHAUST, PWR_SUMMON, PWR_RENEW, PWR_MASS_HEAL, PWR_DISABLE, PWR_SUMMON,
    PWR_SIGHT, PWR_BERSERK];
const E_UP = [PWR_DASH, PWR_REGENERATE, PWR_HARVEST_ENERGY, PWR_HARVEST_MINERAL, PWR_HARVEST_DEPOSIT, PWR_REMOTE_TRANSFER, PWR_MASS_REPAIR,
    PWR_PUNCH, PWR_DEMOLISH, PWR_REFLECT, PWR_REINFORCE, PWR_PUNCH, PWR_HARVEST_ENERGY, PWR_REMOTE_TRANSFER, PWR_DEMOLISH, PWR_MASS_REPAIR,
    PWR_REGENERATE, PWR_PUNCH, PWR_HARVEST_ENERGY, PWR_REMOTE_TRANSFER, PWR_SNIPE, PWR_KILL, PWR_NUKE];

const R = () => Game.rooms.W1N1;
const at = (x, y) => new RoomPosition(x, y, 'W1N1');
const look = (type, x, y) => R().lookForAt(type, x, y);
const struct = (x, y, type) => look(LOOK_STRUCTURES, x, y).find(s => s.structureType == type);
const tombAt = (x, y) => look(LOOK_TOMBSTONES, x, y)[0];
const creepAt = (x, y) => look(LOOK_CREEPS, x, y)[0];
const cr = name => Game.creeps[name];
const pc = name => Game.powerCreeps[name];
const PS = () => struct(20, 20, STRUCTURE_POWER_SPAWN);

function report(name, ok, info) {
    console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' ' + JSON.stringify(info) : ''));
    if(!ok) {
        Memory.fails = (Memory.fails || 0) + 1;
    }
}
function eq(name, got, want) {
    report(name, JSON.stringify(got) === JSON.stringify(want), {got, want});
}

const setup = [
    () => {
        eq('create commander', PowerCreep.create('Cmd', POWER_CLASS.COMMANDER), OK);
        eq('create executor', PowerCreep.create('Exe', POWER_CLASS.EXECUTOR), OK);
        eq('create operator', PowerCreep.create('Op', POWER_CLASS.OPERATOR), OK);
        eq('create unknown class', PowerCreep.create('X', 'wizard'), ERR_INVALID_ARGS);
        eq('constants', [PWR_ENCOURAGE, PWR_NUKE, POWER_CLASS.COMMANDER, POWER_CLASS.EXECUTOR, POWER_INFO[PWR_PUNCH].className, POWER_INFO[PWR_SIGHT].level],
            [20, 44, 'commander', 'executor', 'executor', [20, 21, 22, 23, 24]]);
    },
    () => {
        eq('classes', ['Cmd', 'Exe', 'Op'].map(n => pc(n) && pc(n).className), ['commander', 'executor', 'operator']);
        eq('executor power on commander', pc('Cmd').upgrade(PWR_PUNCH), ERR_INVALID_ARGS);
        eq('operator power on commander', pc('Cmd').upgrade(PWR_GENERATE_OPS), ERR_INVALID_ARGS);
        eq('tier 3 too early', pc('Cmd').upgrade(PWR_SIGHT), ERR_FULL);
    },
    () => {
        const lists = {Cmd: C_UP, Exe: E_UP, Op: [PWR_GENERATE_OPS]};
        let done = true;
        for(const name in lists) {
            const p = pc(name), list = lists[name];
            if(p.level < list.length) {
                done = false;
                const r = p.upgrade(list[p.level]);
                if(r !== OK) {
                    report(`upgrade ${name} ${list[p.level]} at ${p.level}`, false, r);
                }
            }
        }
        if(!done) {
            return false;
        }
        eq('commander powers', _.mapValues(pc('Cmd').powers, 'level'), {20: 3, 21: 3, 22: 3, 23: 3, 24: 2, 25: 2, 26: 2, 27: 1, 28: 1, 29: 1, 30: 1});
        eq('executor powers', _.mapValues(pc('Exe').powers, 'level'), {31: 1, 32: 2, 33: 3, 34: 1, 35: 1, 36: 3, 37: 2, 38: 3, 39: 2, 40: 1, 41: 1, 42: 1, 43: 1, 44: 1});
        eq('levels', [pc('Cmd').level, pc('Exe').level, pc('Cmd').hitsMax, pc('Exe').store.getCapacity()], [22, 23, 23000, 2400]);
    },
    () => {
        eq('spawn commander', pc('Cmd').spawn(PS()), OK);
    },
    () => {
        const c = pc('Cmd'), e = pc('Exe'), o = pc('Op');
        if(!c.room) {
            return false;
        }
        if(!c.pos.isEqualTo(at(25, 20))) {
            c.moveTo(at(25, 20));
        }
        if(!e.room) {
            if(!c.pos.isEqualTo(PS().pos)) {
                e.spawn(PS());
            }
            return false;
        }
        if(!e.pos.isEqualTo(at(25, 30))) {
            e.moveTo(at(25, 30));
        }
        if(!o.room) {
            if(!e.pos.isEqualTo(PS().pos)) {
                o.spawn(PS());
            }
            return false;
        }
        if(!o.pos.isEqualTo(at(20, 24))) {
            o.moveTo(at(20, 24));
        }
        return c.pos.isEqualTo(at(25, 20)) && e.pos.isEqualTo(at(25, 30)) && o.pos.isEqualTo(at(20, 24));
    },
];

const commander = [
    [
        () => {
            eq('exhaust, then cancel it', pc('Cmd').usePower(PWR_EXHAUST, cr('f1')), OK);
            eq('cancelOrder usePower', pc('Cmd').cancelOrder('usePower'), OK);
            eq('nothing left to cancel', pc('Cmd').cancelOrder('usePower'), ERR_NOT_FOUND);
        },
        () => eq('cancelled: no fatigue, no cooldown', [cr('f1').fatigue, pc('Cmd').powers[PWR_EXHAUST].cooldown], [0, 0]),
    ],
    [
        () => eq('exhaust', pc('Cmd').usePower(PWR_EXHAUST, cr('f1')), OK),
        () => {
            eq('exhaust: 6 fatigue a part, less one tick of MOVE', cr('f1').fatigue, 10);
            eq('exhaust cooldown', pc('Cmd').powers[PWR_EXHAUST].cooldown, 5);
            eq('exhaust again too soon', pc('Cmd').usePower(PWR_EXHAUST, cr('f1')), ERR_TIRED);
        },
    ],
    [
        () => eq('encourage', pc('Cmd').usePower(PWR_ENCOURAGE, cr('f1')), OK),
        () => eq('encourage: no fatigue', cr('f1').fatigue, 0),
    ],
    [
        () => {
            eq('disable out of range', pc('Cmd').usePower(PWR_DISABLE, cr('d1')), ERR_NOT_IN_RANGE);
            eq('disable', pc('Cmd').usePower(PWR_DISABLE, cr('f1')), OK);
        },
        () => {
            eq('disable seen', cr('f1').effects.map(e => [e.power, e.level, e.ticksRemaining]), [[PWR_DISABLE, 2, 1]]);
            eq('disabled creep asks to move', cr('f1').move(RIGHT), OK);
        },
        () => {
            eq('disabled creep did not move', [cr('f1').pos.x, cr('f1').pos.y], [26, 20]);
            cr('f1').move(RIGHT);
        },
        () => eq('moves again after', [cr('f1').pos.x, cr('f1').pos.y], [27, 20]),
    ],
    [
        () => eq('defend', pc('Cmd').usePower(PWR_DEFEND, cr('d1')), OK),
        () => {
            eq('defend seen', cr('d1').effects.map(e => e.power), [PWR_DEFEND]);
            cr('h1').attack(cr('d1'));
        },
        () => {
            eq('defend blocks 150 of 400', cr('d1').hits, 1100);
            cr('h1').attack(cr('d1'));
        },
        () => eq('defend lasts one tick', cr('d1').hits, 950),
    ],
    [
        () => eq('berserk', pc('Cmd').usePower(PWR_BERSERK, cr('h1')), OK),
        () => {
            cr('h1').attack(cr('d1'));
            cr('h2').attack(cr('h1'));
        },
        () => {
            eq('berserk deals double', cr('d1').hits, 650);
            eq('berserk takes double', cr('h1').hits, 480);
            eq('hit back stays single', cr('h2').hits, 650);
        },
    ],
    [
        () => {
            eq('ranged at 4 without sight', cr('ar').rangedAttack(cr('dm')), ERR_NOT_IN_RANGE);
            eq('sight', pc('Cmd').usePower(PWR_SIGHT, cr('ar')), OK);
        },
        () => eq('ranged at 4 with sight', cr('ar').rangedAttack(cr('dm')), OK),
        () => eq('sight hits at 4', cr('dm').hits, 580),
    ],
    [
        () => eq('harvest', cr('wk').harvest(look(LOOK_SOURCES, 28, 25)[0]), OK),
        () => {
            eq('harvest 4', cr('wk').store.energy, 4);
            eq('foreman', pc('Cmd').usePower(PWR_FOREMAN, cr('wk')), OK);
        },
        () => cr('wk').harvest(look(LOOK_SOURCES, 28, 25)[0]),
        () => {
            eq('foreman harvests 8', cr('wk').store.energy, 12);
            eq('foreman seen', cr('wk').effects.map(e => [e.power, e.ticksRemaining]), [[PWR_FOREMAN, 29]]);
            eq('body untouched', cr('wk').body.length, 7);
        },
    ],
    [
        () => eq('summon', pc('Cmd').usePower(PWR_SUMMON, cr('far')), OK),
        () => eq('summoned next to the commander', cr('far').pos.getRangeTo(pc('Cmd')), 1),
    ],
    [
        () => {
            eq('renew without energy', pc('Cmd').usePower(PWR_RENEW, cr('old')), ERR_NOT_ENOUGH_ENERGY);
            eq('withdraw', pc('Cmd').withdraw(struct(24, 21, STRUCTURE_STORAGE), RESOURCE_ENERGY, 500), OK);
        },
        () => {
            Memory.ttl = cr('old').ticksToLive;
            eq('renew', pc('Cmd').usePower(PWR_RENEW, cr('old')), OK);
        },
        () => {
            eq('renewed by 300', cr('old').ticksToLive, Memory.ttl - 1 + 300);
            eq('renew cost 30', pc('Cmd').store.energy, 470);
        },
    ],
    [
        () => {
            Memory.h = [cr('d1').hits, cr('h1').hits, cr('h2').hits];
            eq('mass heal', pc('Cmd').usePower(PWR_MASS_HEAL), OK);
        },
        () => eq('mass heal by distance', [cr('d1').hits, cr('h1').hits, cr('h2').hits],
            [Math.min(1100, Memory.h[0] + 1000), Math.min(600, Memory.h[1] + 250), Memory.h[2]]),
    ],
    [
        () => cr('lt').suicide(),
        () => {
            report('tombstone', !!tombAt(26, 19));
            eq('loot', cr('looter').withdraw(tombAt(26, 19), RESOURCE_ENERGY, 10), OK);
        },
        () => eq('resurrect a looted tombstone (code cannot tell)', pc('Cmd').usePower(PWR_RESURRECT, tombAt(26, 19)), OK),
        () => {
            eq('looted tombstone stays dead', !!cr('lt'), false);
            eq('no cooldown when refused', pc('Cmd').powers[PWR_RESURRECT].cooldown, 0);
            Memory.vic = cr('vic').ticksToLive;
            cr('vic').suicide();
        },
        () => {
            eq('resurrect', pc('Cmd').usePower(PWR_RESURRECT, tombAt(24, 19)), OK);
        },
        () => {
            const v = cr('vic');
            eq('resurrected', v && [v.hits, v.hitsMax, v.ticksToLive, v.store.energy, v.pos.x, v.pos.y], [200, 200, Memory.vic - 1, 50, 24, 19]);
            eq('resurrect cooldown', pc('Cmd').powers[PWR_RESURRECT].cooldown, 999);
        },
    ],
];

const exe = () => pc('Exe');
const executor = [
    [
        () => cr('h3').attack(exe()),
        () => {
            eq('executor hit', exe().hits, 24000 - 300);
            eq('regenerate', exe().usePower(PWR_REGENERATE), OK);
        },
        () => eq('regenerated', exe().hits, 24000),
    ],
    [
        () => eq('reflect', exe().usePower(PWR_REFLECT), OK),
        () => {
            eq('reflect seen', exe().effects.map(e => e.power), [PWR_REFLECT]);
            cr('h3').attack(exe());
        },
        () => {
            eq('reflect: half taken', exe().hits, 24000 - 150);
            eq('reflect: half sent back', cr('h3').hits, 1100 - 150);
        },
    ],
    [
        () => eq('reinforce', exe().usePower(PWR_REINFORCE), OK),
        () => {
            Memory.eh = exe().hits;
            cr('h3').attack(exe());
        },
        () => {
            eq('reinforced: nothing taken', exe().hits, Memory.eh);
            // h3 lost an ATTACK part to the first reflection: 9 parts hit for 270, half of it comes back
            eq('reflect still sends back', cr('h3').hits, 950 - 135);
        },
    ],
    [
        () => eq('harvest energy', exe().usePower(PWR_HARVEST_ENERGY, look(LOOK_SOURCES, 26, 29)[0]), OK),
        () => {
            eq('harvested 600 energy', [exe().store.energy, look(LOOK_SOURCES, 26, 29)[0].energy], [600, 2400]);
            eq('harvest mineral', exe().usePower(PWR_HARVEST_MINERAL, look(LOOK_MINERALS, 24, 31)[0]), OK);
        },
        () => {
            eq('harvested 200 H', exe().store.H, 200);
            eq('harvest deposit', exe().usePower(PWR_HARVEST_DEPOSIT, look(LOOK_DEPOSITS, 24, 29)[0]), OK);
        },
        () => eq('harvested 200 silicon', exe().store.silicon, 200),
    ],
    [
        () => {
            eq('remote transfer out of range', exe().usePower(PWR_REMOTE_TRANSFER, cr('dist'), RESOURCE_ENERGY, 1), ERR_NOT_IN_RANGE);
            eq('remote transfer', exe().usePower(PWR_REMOTE_TRANSFER, cr('rc'), RESOURCE_ENERGY, 100), OK);
            eq('remote transfer of nothing known', exe().usePower(PWR_REMOTE_TRANSFER, cr('rc'), 'nope', 1), ERR_INVALID_ARGS);
        },
        () => {
            eq('transferred 100 over 10 squares', [cr('rc').store.energy, exe().store.energy], [100, 500]);
            eq('remote transfer cooldown', exe().usePower(PWR_REMOTE_TRANSFER, cr('rc'), RESOURCE_ENERGY, 1), ERR_TIRED);
        },
    ],
    [
        () => {
            Memory.r = [struct(27, 33, STRUCTURE_RAMPART).hits, struct(23, 33, STRUCTURE_WALL).hits, struct(30, 30, STRUCTURE_WALL).hits, struct(26, 30, STRUCTURE_RAMPART).hits];
            eq('mass repair', exe().usePower(PWR_MASS_REPAIR), OK);
        },
        () => {
            // Bob's rampart has hitsMax 0 in Alice's room (ramparts/tick.js), so three share 2000, the least damaged first
            eq('mass repair shares 2000 over 3', [struct(27, 33, STRUCTURE_RAMPART).hits, struct(23, 33, STRUCTURE_WALL).hits, struct(30, 30, STRUCTURE_WALL).hits,
                struct(26, 30, STRUCTURE_RAMPART).hits], [Memory.r[0] + 667, Memory.r[1] + 667, Memory.r[2] + 666, Memory.r[3]]);
            eq('mass repair cost 20', exe().store.energy, 480);
        },
    ],
    [
        () => eq('punch', exe().usePower(PWR_PUNCH, creepAt(26, 30)), OK),
        () => {
            eq('the rampart takes the punch', [struct(26, 30, STRUCTURE_RAMPART).hits, creepAt(26, 30).hits], [10000 - 900, 2100]);
            eq('snipe', exe().usePower(PWR_SNIPE, creepAt(26, 30)), OK);
        },
        () => {
            eq('snipe past the rampart', creepAt(26, 30).hits, 1800);
            eq('kill under a rampart', exe().usePower(PWR_KILL, creepAt(26, 30)), ERR_INVALID_TARGET);
            eq('kill', exe().usePower(PWR_KILL, creepAt(27, 28)), OK);
        },
        () => {
            eq('killed', !!creepAt(27, 28), false);
            report('kill leaves a tombstone', !!tombAt(27, 28));
            eq('demolish', exe().usePower(PWR_DEMOLISH, struct(30, 30, STRUCTURE_WALL)), OK);
        },
        () => eq('demolished 10000', struct(30, 30, STRUCTURE_WALL).hits, 100666 - 10000),
    ],
    [
        () => {
            eq('dash', exe().usePower(PWR_DASH), OK);
            exe().move(LEFT);
        },
        () => eq('dashed 2 squares', [exe().pos.x, exe().pos.y], [23, 30]),
    ],
    [
        () => {
            eq('an operator has no commander power', pc('Op').usePower(PWR_ENCOURAGE, cr('f1')), ERR_NO_BODYPART);
            eq('generate ops still works', pc('Op').usePower(PWR_GENERATE_OPS), OK);
        },
        () => eq('ops', pc('Op').store.ops, 1),
    ],
    [
        () => eq('nuke', exe().usePower(PWR_NUKE), OK),
        () => {
            const n = R().find(FIND_NUKES)[0];
            eq('nuke dropped', n && [n.pos.x, n.pos.y, n.timeToLand], [23, 30, 89999]);
            eq('executor died', !!exe().room, false);
        },
        () => {},
        () => eq('the nuke stays while its executor exists', R().find(FIND_NUKES).length, 1),
    ],
];

const finish = () => {
    console.log('DONE fails=' + (Memory.fails || 0));
    Memory.done = true;
};

const STEPS = [].concat(setup, ...commander, ...executor, [finish]);

module.exports.loop = function() {
    if(Memory.done) {
        return;
    }
    if(Game.time > 1400) {
        console.log('FAIL timeout at step ' + Memory.s);
        Memory.done = true;
        return;
    }
    const s = Memory.s || 0;
    let r;
    try {
        r = STEPS[s]();
    }
    catch(e) {
        report('step ' + s + ' threw', false, String(e && e.stack || e));
    }
    if(r !== false) {
        Memory.s = s + 1;
    }
};
