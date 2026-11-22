// Bob's side of the showcase: his creeps in player's room each do one thing every tick (layout.js, written by
// ../make-demo.cjs), once the power creeps have had time to reach their stations: hit a creep, a power creep or a wall,
// shoot everything around, or heal.
const L = require('layout');

module.exports.loop = function() {
    const room = Game.rooms[L.room];
    if(!room) {
        return;
    }
    const creeps = room.find(FIND_HOSTILE_CREEPS), pcs = room.find(FIND_HOSTILE_POWER_CREEPS);
    for(const a of L.acts) {
        const c = Game.creeps[a.name];
        // healing from the start, hitting from the show's start
        if(!c || a.do != 'heal' && Game.time < L.start) {
            continue;
        }
        if(a.do == 'rangedMassAttack') {
            c.rangedMassAttack();
            continue;
        }
        const target = a.pc ? pcs.find(p => p.name == a.pc)
            : a.creep ? creeps.find(h => h.name == a.creep) || Game.creeps[a.creep]
            : a.at ? room.lookForAt(LOOK_STRUCTURES, a.at[0], a.at[1])[0]
            : null;
        if(a.do == 'heal') {
            const who = target || c;
            if(who.hits < who.hitsMax) {
                c.heal(who);
            }
        } else if(target) {
            c[a.do](target);
        }
    }
};
