// Writes scenario.json for `krebs bench --scenario`: one plain room W1N1 at RCL 8 with power enabled, player A (a1)
// who runs a/main.js, player B (b1) who stands still.
const fs = require('fs');
const path = require('path');
const G = 1000;
let id = 0;
const o = (type, x, y, more) => Object.assign({_id: 'o' + (++id).toString(16).padStart(10, '0'), type, x, y}, more);
const creep = (name, user, x, y, parts, more = {}) => {
    const body = parts.map(type => ({type, hits: 100}));
    const carry = parts.filter(p => p == 'carry').length * 50;
    return o('creep', x, y, Object.assign({name, user, body, hits: body.length * 100, hitsMax: body.length * 100, store: {}, storeCapacity: carry,
        fatigue: 0, ageTime: G + 1400, spawning: false, notifyWhenAttacked: false}, more));
};
const rep = (n, p) => Array(n).fill(p);
const BIG = 300000000;

const objects = [
    o('controller', 5, 5, {level: 8, user: 'a1', progress: 0, downgradeTime: G + 100000, safeModeAvailable: 0, isPowerEnabled: true}),
    o('powerSpawn', 20, 20, {user: 'a1', hits: 5000, hitsMax: 5000, store: {energy: 0, power: 0}, storeCapacityResource: {energy: 5000, power: 100}}),
    o('storage', 24, 21, {user: 'a1', hits: 10000, hitsMax: 10000, store: {energy: 100000}, storeCapacity: 1000000}),
    // the Commander's corner, around (25,20)
    creep('f1', 'a1', 26, 20, ['work', 'carry', 'move']),
    creep('d1', 'a1', 27, 21, [...rep(10, 'tough'), 'move']),
    creep('h1', 'a1', 28, 21, [...rep(5, 'attack'), 'move']),
    creep('h2', 'a1', 29, 21, [...rep(2, 'attack'), ...rep(5, 'tough'), 'move']),
    creep('wk', 'a1', 27, 24, ['work', 'work', ...rep(4, 'carry'), 'move']),
    o('source', 28, 25, {energy: 3000, energyCapacity: 3000, ticksToRegeneration: 300}),
    creep('ar', 'a1', 29, 18, ['ranged_attack', 'ranged_attack', 'move']),
    creep('dm', 'a1', 33, 18, [...rep(5, 'tough'), 'move']),
    creep('far', 'a1', 40, 40, ['move']),
    creep('old', 'a1', 23, 22, ['work', 'move'], {ageTime: G + 500}),
    creep('vic', 'a1', 24, 19, ['carry', 'move'], {store: {energy: 50}}),
    creep('lt', 'a1', 26, 19, ['carry', 'move'], {store: {energy: 50}}),
    creep('looter', 'a1', 27, 18, ['carry', 'carry', 'move']),
    // the Executor's corner, around (25,30)
    o('source', 26, 29, {energy: 3000, energyCapacity: 3000, ticksToRegeneration: 300}),
    o('mineral', 24, 31, {mineralType: 'H', mineralAmount: 50000, density: 3}),
    o('extractor', 24, 31, {user: 'a1', hits: 500, hitsMax: 500, cooldown: 0}),
    o('deposit', 24, 29, {depositType: 'silicon', harvested: 0, decayTime: G + 50000}),
    creep('h3', 'a1', 26, 31, [...rep(10, 'attack'), 'move']),
    creep('rc', 'a1', 35, 30, [...rep(4, 'carry'), 'move']),
    creep('dist', 'a1', 45, 45, ['carry', 'move']),
    o('rampart', 27, 33, {user: 'a1', hits: 1000, hitsMax: BIG, nextDecayTime: G + 100000, isPublic: false}),
    o('constructedWall', 23, 33, {hits: 5000, hitsMax: BIG}),
    o('constructedWall', 30, 30, {hits: 100000, hitsMax: BIG}),
    o('rampart', 26, 30, {user: 'b1', hits: 10000, hitsMax: BIG, nextDecayTime: G + 100000, isPublic: false}),
    creep('bx', 'b1', 26, 30, [...rep(20, 'tough'), 'move']),
    creep('kx', 'b1', 27, 28, ['move']),
];

const scenario = {
    gameTime: G,
    rooms: [{name: 'W1N1', terrain: '0'.repeat(2500), objects}],
    players: [
        {username: 'Alice', id: 'a1', code: 'a', cpu: 300, bucket: 10000, gcl: 1e9, power: 1e8},
        {username: 'Bob', id: 'b1', code: 'b', cpu: 100, bucket: 10000, gcl: 1e6, power: 0},
    ],
};
fs.writeFileSync(path.join(__dirname, 'scenario.json'), JSON.stringify(scenario, null, 1));
console.log('objects', objects.length);
