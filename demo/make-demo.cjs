// Writes the showcase: showcase.json for `krebs bench --scenario … --save`, and the layout the two bots read
// (player/layout.js, bob/layout.js). Room W1N1 is cut into stations, one for each Commander and Executor power, each with
// a power creep of its own and what that power needs: creeps that walk, work, get hurt or die, structures to hit or fill,
// sources to harvest. `player`, who owns the room and the power creeps, is the name the server signs a game client in as
// on this PC; Bob's creeps give the hostile powers something to hit and the healing powers something to heal.
const fs = require('fs');
const path = require('path');

const G = 1000;
// the bots start their show here, once every power creep has had time to reach its station
const START = G + 140;
const ROOM = 'W1N1';
const P = 'p1', B = 'b1';
const LONG = G + 1000000;
const BIG = 300000000;

// plain inside a wall on the edge: the client's room view waits for terrain with a wall or swamp in it
const terrain = Array.from({length: 2500}, (_, i) => (i % 50 == 0 || i % 50 == 49 || i < 50 || i >= 2450 ? '1' : '0')).join('');
let id = 0;
const objects = [];
const put = (type, [x, y], more) => {
    const doc = Object.assign({_id: 's' + (++id).toString(16).padStart(10, '0'), type, x, y}, more);
    objects.push(doc);
    return doc;
};
const rep = (n, p) => Array(n).fill(p);
const creep = (name, user, at, parts, more = {}) => {
    const body = parts.map(type => ({type, hits: 100}));
    return put('creep', at, Object.assign({name, user, body, hits: body.length * 100, hitsMax: body.length * 100, store: {},
        storeCapacity: parts.filter(p => p == 'carry').length * 50, fatigue: 0, ageTime: LONG, spawning: false, notifyWhenAttacked: false}, more));
};
const wall = (at, hits = 100000000) => put('constructedWall', at, {hits, hitsMax: BIG});

// Bob's creeps and what each does every tick (bob/main.js)
const acts = [];
const bob = (name, at, parts, act) => {
    creep(name, B, at, parts);
    acts.push(Object.assign({name}, act));
};

// The room as a grid of 7 x 7 cells; a station takes one.
const COLS = [2, 10, 18, 26, 34, 42], ROWS = [3, 12, 21, 30, 39];
const cells = [];
const stations = [];
function cell(title, cls, row, col, build) {
    const x0 = COLS[col], y0 = ROWS[row];
    const A = (dx, dy) => [x0 + dx, y0 + dy];
    cells.push({title, cls, x0, y0});
    build(A);
}
function station(name, power, cls, fields) {
    stations.push(Object.assign({name, power, cls}, fields));
}
const mine = (name, at, parts, more) => creep(name, P, at, parts, more);

// ---- Commander ----
cell('ENCOURAGE', 'commander', 0, 0, A => {
    mine('Slowpoke', A(0, 4), [...rep(4, 'work'), 'move']);
    station('Encourage', 20, 'commander', {pc: A(3, 1), creep: 'Slowpoke', lane: [A(0, 4), A(6, 4)]});
});
cell('EXHAUST', 'commander', 0, 1, A => {
    mine('Sprinter', A(0, 4), ['work', 'move']);
    station('Exhaust', 21, 'commander', {pc: A(3, 1), creep: 'Sprinter', lane: [A(0, 4), A(6, 4)]});
});
cell('DEFEND', 'commander', 0, 2, A => {
    mine('Guard', A(3, 4), [...rep(10, 'tough'), 'move']);
    mine('Guard Medic', A(2, 4), [...rep(3, 'heal'), 'move']);
    bob('Brute', A(3, 5), ['attack', 'move'], {do: 'attack', creep: 'Guard'});
    station('Defend', 22, 'commander', {pc: A(3, 1), creep: 'Guard', medic: 'Guard Medic'});
});
cell('SUMMON', 'commander', 0, 3, A => {
    mine('Wanderer', A(6, 6), ['move']);
    station('Summon', 23, 'commander', {pc: A(1, 1), creep: 'Wanderer', far: A(6, 6)});
});
cell('RENEW', 'commander', 0, 4, A => {
    put('factory', A(3, 1), {user: P, hits: 1000, hitsMax: 1000, cooldown: 0, store: {energy: 50000}, storeCapacity: 50000});
    mine('Elder', A(3, 5), [...rep(25, 'carry'), ...rep(25, 'move')], {ageTime: G + 1100});
    station('Renew', 24, 'commander', {pc: A(3, 2), creep: 'Elder', energy: A(3, 1)});
});
cell('MASS HEAL', 'commander', 0, 5, A => {
    [[2, 2], [4, 2], [2, 4], [4, 4]].forEach(([dx, dy], i) => mine('Patient ' + (i + 1), A(dx, dy), [...rep(10, 'tough'), 'move']));
    bob('Archer', A(3, 6), [...rep(2, 'ranged_attack'), 'move'], {do: 'rangedMassAttack'});
    station('Mass Heal', 25, 'commander', {pc: A(3, 3)});
});
cell('DISABLE', 'commander', 1, 0, A => {
    wall(A(3, 5));
    bob('Rioter', A(3, 4), [...rep(2, 'attack'), 'move'], {do: 'attack', at: A(3, 5)});
    station('Disable', 26, 'commander', {pc: A(3, 3), hostile: 'Rioter'});
});
cell('FOREMAN', 'commander', 1, 1, A => {
    put('source', A(3, 6), {energy: 3000, energyCapacity: 3000, ticksToRegeneration: 300});
    put('controller', A(6, 4), {level: 8, user: P, progress: 0, downgradeTime: LONG, safeModeAvailable: 0, isPowerEnabled: true});
    mine('Worker', A(3, 5), [...rep(4, 'work'), ...rep(2, 'carry'), 'move']);
    station('Foreman', 27, 'commander', {pc: A(1, 1), creep: 'Worker', source: A(3, 6), controller: A(6, 4)});
});
cell('RESURRECT + KILL', 'commander', 1, 2, A => {
    mine('Lazarus', A(3, 4), ['work', 'carry', 'move']);
    station('Resurrect', 28, 'commander', {pc: A(2, 4), creep: 'Lazarus', grave: A(3, 4)});
    station('Kill', 43, 'executor', {pc: A(6, 4), creep: 'Lazarus'});
});
cell('SIGHT', 'commander', 1, 3, A => {
    wall(A(5, 4));
    mine('Spotter', A(1, 4), [...rep(2, 'ranged_attack'), 'move']);
    station('Sight', 29, 'commander', {pc: A(3, 1), creep: 'Spotter', wall: A(5, 4)});
});
cell('BERSERK', 'commander', 1, 4, A => {
    wall(A(3, 5));
    mine('Brawler', A(3, 4), [...rep(2, 'attack'), 'move']);
    station('Berserk', 30, 'commander', {pc: A(3, 1), creep: 'Brawler', wall: A(3, 5)});
});

// ---- Executor ----
cell('DASH', 'executor', 2, 0, A => {
    station('Dash', 31, 'executor', {pc: A(0, 3), lane: [A(0, 3), A(6, 3)]});
});
cell('REGENERATE', 'executor', 2, 1, A => {
    bob('Sniper', A(3, 6), [...rep(3, 'ranged_attack'), 'move'], {do: 'rangedAttack', pc: 'Regenerate'});
    station('Regenerate', 32, 'executor', {pc: A(3, 3)});
});
// the middle: the power spawn they all start from
const powerSpawn = [25, 24];
put('powerSpawn', powerSpawn, {user: P, hits: 5000, hitsMax: 5000, store: {energy: 0, power: 0}, storeCapacityResource: {energy: 5000, power: 100}});
cell('REFLECT', 'executor', 2, 4, A => {
    bob('Brute 2', A(3, 4), ['attack', 'move'], {do: 'attack', pc: 'Reflect'});
    bob('Brute 2 Medic', A(4, 5), [...rep(2, 'heal'), 'move'], {do: 'heal', creep: 'Brute 2'});
    mine('Reflect Medic', A(2, 3), [...rep(3, 'heal'), 'move']);
    station('Reflect', 40, 'executor', {pc: A(3, 3), medic: 'Reflect Medic'});
});
cell('REINFORCE', 'executor', 2, 5, A => {
    bob('Brute 3', A(3, 4), ['attack', 'move'], {do: 'attack', pc: 'Reinforce'});
    mine('Reinforce Medic', A(2, 3), [...rep(3, 'heal'), 'move']);
    station('Reinforce', 41, 'executor', {pc: A(3, 3), medic: 'Reinforce Medic'});
});
cell('HARVEST ENERGY', 'executor', 3, 0, A => {
    // At level 1 the power takes 200 every 20 ticks, all a source gives in its 300, so it never runs dry, and the tower
    // it fills spends just that repairing a wall. (Dropped, the energy would pile up into a block the client draws huge.)
    put('source', A(3, 4), {energy: 3000, energyCapacity: 3000, ticksToRegeneration: 300});
    put('tower', A(3, 2), {user: P, hits: 3000, hitsMax: 3000, store: {energy: 0}, storeCapacityResource: {energy: 1000}});
    wall(A(5, 5), 1000000);
    station('Harvest Energy', 33, 'executor', {pc: A(3, 3), target: A(3, 4), look: 'source', level: 1, tower: A(3, 2), wall: A(5, 5)});
});
cell('HARVEST MINERAL', 'executor', 3, 1, A => {
    put('mineral', A(3, 4), {mineralType: 'H', mineralAmount: 1000000, density: 3});
    put('extractor', A(3, 4), {user: P, hits: 500, hitsMax: 500, cooldown: 0});
    station('Harvest Mineral', 34, 'executor', {pc: A(3, 3), target: A(3, 4), look: 'mineral'});
});
cell('HARVEST DEPOSIT', 'executor', 3, 2, A => {
    put('deposit', A(3, 4), {depositType: 'silicon', harvested: 0, decayTime: LONG});
    station('Harvest Deposit', 35, 'executor', {pc: A(3, 3), target: A(3, 4), look: 'deposit'});
});
cell('REMOTE TRANSFER', 'executor', 3, 3, A => {
    put('storage', A(0, 3), {user: P, hits: 10000, hitsMax: 10000, store: {energy: 500000}, storeCapacity: 1000000});
    put('tower', A(6, 3), {user: P, hits: 3000, hitsMax: 3000, store: {energy: 0}, storeCapacityResource: {energy: 1000}});
    wall(A(6, 5), 1000000);
    station('Remote Transfer', 36, 'executor', {pc: A(1, 3), energy: A(0, 3), tower: A(6, 3), wall: A(6, 5)});
});
cell('MASS REPAIR', 'executor', 3, 4, A => {
    put('terminal', A(3, 2), {user: P, hits: 3000, hitsMax: 3000, store: {energy: 300000}, storeCapacity: 300000});
    [[1, 1], [5, 1], [1, 5], [5, 5]].forEach(([dx, dy]) => wall(A(dx, dy), 10000));
    station('Mass Repair', 37, 'executor', {pc: A(3, 3), energy: A(3, 2)});
});
cell('PUNCH', 'executor', 3, 5, A => {
    wall(A(3, 4));
    station('Punch', 38, 'executor', {pc: A(3, 3), wall: A(3, 4)});
});
cell('DEMOLISH', 'executor', 4, 1, A => {
    wall(A(6, 3));
    station('Demolish', 39, 'executor', {pc: A(0, 3), wall: A(6, 3)});
});
cell('SNIPE', 'executor', 4, 2, A => {
    put('rampart', A(3, 5), {user: B, hits: 10000000, hitsMax: BIG, nextDecayTime: LONG, isPublic: false});
    bob('Bunker', A(3, 5), [...rep(5, 'tough'), ...rep(30, 'heal'), 'move'], {do: 'heal'});
    station('Snipe', 42, 'executor', {pc: A(3, 0), hostile: 'Bunker'});
});
cell('NUKE', 'executor', 4, 3, A => {
    station('Nuke', 44, 'executor', {pc: A(3, 3)});
});

const scenario = {
    gameTime: G,
    rooms: [{name: ROOM, terrain, objects}],
    // the client draws a room only once everyone who owns something in it has a badge
    players: [
        {username: 'player', id: P, code: 'player', cpu: 500, bucket: 10000, gcl: 1e9, power: 1e9,
            badge: {type: 9, color1: '#f4e383', color2: '#cc3d3e', color3: '#2b2b2b', param: 0, flip: false}},
        {username: 'Bob', id: B, code: 'bob', cpu: 100, bucket: 10000, gcl: 1e6, power: 0,
            badge: {type: 3, color1: '#3d7acc', color2: '#1b1b1b', color3: '#9fc5f4', param: 0, flip: false}},
    ],
};
const layout = (o) => '// Written by ../make-demo.cjs.\nmodule.exports = ' + JSON.stringify(o, null, 1) + ';\n';
fs.writeFileSync(path.join(__dirname, 'showcase.json'), JSON.stringify(scenario, null, 1));
fs.writeFileSync(path.join(__dirname, 'player', 'layout.js'), layout({room: ROOM, start: START, powerSpawn, cells, stations}));
fs.writeFileSync(path.join(__dirname, 'bob', 'layout.js'), layout({room: ROOM, start: START, acts}));
console.log(`${stations.length} power creeps, ${objects.length} objects`);
