# krebs-powerclasses

A mod for Krebs, which is on [GitHub](https://github.com/DefaultO/krebs) and [Gitea](https://gitea.defaul.to/DefaultO/krebs).
Either one is enough. It lives at `mods/powerclasses` in the core, as a git submodule, and it builds only inside the core. To
get it:

```
git clone --recursive https://github.com/DefaultO/krebs.git
```

Screeps planned three power creep classes and shipped one, the Operator. This mod adds the other two, the **Commander** and
the **Executor**, with the powers the official [power planner](https://screeps.com/power-planner/) gives them. The game
client already carries their sprites and most of their power icons, so they look like themselves in it.

Turn it on with `"mods": ["powerclasses"]` in `krebs.json`, or `krebs serve --mods powerclasses`. Nothing enables it by
default, and with it off nothing about the game changes.

## In a script

```js
PowerCreep.create('Ada', POWER_CLASS.COMMANDER);
PowerCreep.create('Bo', POWER_CLASS.EXECUTOR);
Game.powerCreeps.Ada.upgrade(PWR_ENCOURAGE);
Game.powerCreeps.Ada.usePower(PWR_ENCOURAGE, Game.creeps.hauler);
Game.powerCreeps.Bo.usePower(PWR_REMOTE_TRANSFER, storage, RESOURCE_ENERGY, 500);
```

Creating, upgrading, spawning, renewing and deleting work as they do for an Operator, from the same pool of power levels.
`usePower` returns the usual error codes. REMOTE_TRANSFER takes a resource type and an amount after the target, as
`transfer` does. For the new powers `usePower` sends the mod's own `classPower` intent, which is `usePower` with those two
fields more; `cancelOrder('usePower')` cancels it as well. `POWER_INFO` has an entry for every power: `className`, `level` (the power creep level each power level
needs), `cooldown`, and where they apply `range`, `area`, `effect`, `duration` and `energy`. A number in place of a list is
the same at every level. `MASS_HEAL_POWER` is mass heal by distance. Power creeps get `effects`, as other room objects do.

None of these powers use ops. The room needs its power enabled, as for an Operator.

## Commander

| Power | Number | Needs level | What it does | Cooldown | Range |
| --- | --- | --- | --- | --- | --- |
| `PWR_ENCOURAGE` | 20 | 0 2 7 14 22 | Removes all fatigue of a creep. | 10/8/6/4/2 | 20 |
| `PWR_EXHAUST` | 21 | 0 2 7 14 22 | Adds 2/4/6/8/10 fatigue per non-MOVE part. | 10/8/6/4/2 | 20 |
| `PWR_DEFEND` | 22 | 0 2 7 14 22 | Blocks up to 100/200/400/600/800 damage to a creep on the next tick. | 5 | 20 |
| `PWR_SUMMON` | 23 | 0 2 7 14 22 | Moves one of your creeps in the room to the free square next to the power creep that is nearest to it. | 10/8/6/4/2 | the room |
| `PWR_RENEW` | 24 | 0 2 7 14 22 | `renewCreep` on one of your creeps, paid with the power creep's energy. Removes its boosts. | 5/4/3/2/1 | 20 |
| `PWR_MASS_HEAL` | 25 | 0 2 7 14 22 | Heals every other creep and power creep for 2500/1000/250 at 1/2/3 squares. | 25/20/15/10/5 | 3 around |
| `PWR_DISABLE` | 26 | 0 2 7 14 22 | A creep does nothing on the next tick. | 10/8/6/4/2 | 1 |
| `PWR_FOREMAN` | 27 | 10 11 12 14 22 | Doubles a creep's harvest, build, repair and upgradeController, and the energy they use, for 30/60/90/120/150 ticks. | 50 | 20 |
| `PWR_RESURRECT` | 28 | 10 11 12 14 22 | Brings back the creep of one of your tombstones. | 1000/900/800/700/600 | 1 |
| `PWR_SIGHT` | 29 | 20 21 22 23 24 | rangedAttack, rangedHeal, build, repair and upgradeController reach 4 squares, for 5 ticks. | 10/8/6/4/2 | 20 |
| `PWR_BERSERK` | 30 | 20 21 22 23 24 | A creep deals double damage and heal and takes double damage and heal, for 5 ticks. | 10/8/6/4/2 | 20 |

## Executor

| Power | Number | Needs level | What it does | Cooldown | Range |
| --- | --- | --- | --- | --- | --- |
| `PWR_DASH` | 31 | 0 2 7 14 22 | One more square in the direction the power creep moves this tick. | 10/8/6/4/2 | itself |
| `PWR_REGENERATE` | 32 | 0 2 7 14 22 | Heals the power creep for 1000 to 5000. | 5 | itself |
| `PWR_HARVEST_ENERGY` | 33 | 0 2 7 14 22 | Harvests 200 to 1000 energy from a source. | 20 | 1 |
| `PWR_HARVEST_MINERAL` | 34 | 0 2 7 14 22 | Harvests 200 to 1000 from a mineral with an extractor. | 40 | 1 |
| `PWR_HARVEST_DEPOSIT` | 35 | 0 2 7 14 22 | Harvests 200 to 1000 from a deposit. | 40 | 1 |
| `PWR_REMOTE_TRANSFER` | 36 | 0 2 7 14 22 | Transfers to any creep or structure, not to a power creep. | 10 | 5/10/15/20/30 |
| `PWR_MASS_REPAIR` | 37 | 0 2 7 14 22 | Repairs every structure within 10 for 1000 to 5000 hits in all, shared out, for up to 10 to 50 energy. | none | 10 around |
| `PWR_PUNCH` | 38 | 0 2 7 14 22 | 300 to 1500 damage to a creep, power creep or structure. | none | 1 |
| `PWR_DEMOLISH` | 39 | 0 2 7 14 22 | 5000 to 25000 damage to a rampart or wall. | 10 | 10 |
| `PWR_REFLECT` | 40 | 0 2 7 14 22 | Half of each hit the power creep takes goes back to the creep that dealt it, for 5 ticks. | 20/18/16/14/12 | itself |
| `PWR_REINFORCE` | 41 | 10 11 12 14 22 | The power creep takes no damage for 3 ticks. | 20/18/16/14/12 | itself |
| `PWR_SNIPE` | 42 | 20 21 22 23 24 | 300 damage to a creep or power creep, past any rampart. | none | 1/2/3/4/5 |
| `PWR_KILL` | 43 | 20 21 22 23 24 | Kills a creep that no rampart of someone else covers. | 900/800/700/600/500 | 3 |
| `PWR_NUKE` | 44 | 20 21 22 23 24 | Drops a nuke on the power creep's square, landing in 90000/80000/70000/60000/50000 ticks. The power creep dies. | none | itself |

## Where the planner left room

The planner describes each power in a sentence. Where that left a choice, the mod made it as follows.

* An effect lasts its stated ticks from the tick after the power was used, so a player sees it from their next run with
  `ticksRemaining` counting down to 1. DEFEND and DISABLE work on that one next tick only, whatever order the room runs
  intents in.
* FOREMAN and BERSERK lend the creep a second copy of the parts they double (WORK; ATTACK, RANGED_ATTACK and HEAL) while
  its own intents run, so the game works the result out as it always does, boosts and limits included. FOREMAN leaves a
  creep that also dismantles alone that tick.
* SIGHT runs an action that was one square too far from one square closer.
* REFLECT: the power creep takes half and the attacker takes half, even inside ramparts. Only creeps get hit back: a
  power creep's hit lands whole. Screeps' descriptions of the two classes (on its Discord, December 2025) say "creep" for
  a creep and "power creep" for a power creep, and its developer said so in the same thread; the same goes for REMOTE
  TRANSFER's targets.
* RESURRECT takes one of your own creep's tombstones from which nothing was taken. The creep comes back where it fell, with
  the time it had left, full hits and no boosts, holding what the tombstone held up to its capacity, the rest dropped. Its
  name must be free. A tombstone records what it held when the room first sees it, before anyone can withdraw from it.
* SUMMON takes only your own creeps, and not to exit squares. KILL and SUMMON leave spawning creeps alone.
* PUNCH hits the rampart over a creep, as a melee attack does, and the target hits back as it would a creep.
* NUKE: a second nuke of the same power creep in the same room takes the place of the first. When the power creep is
  deleted, its nukes go.
* A power whose target is gone or wrong does nothing and starts no cooldown, as vanilla's do.

## What the client shows

The room view draws Commanders and Executors with the renderer's own sprites, at the renderer's own sizes. Each power
shows the way an Operator's does: a red beam from the power creep and the power's icon where it lands, a red flare
pulsing over whatever its effect is on for as long as it lasts (Defend, Disable, Foreman, Sight, Berserk, Reflect,
Reinforce), and in the side panel under Powers, with its level ring and cooldown bar, and under Effects while it lasts.
The renderer draws nothing more for any power: github.com/screeps/renderer has no other logic for power uses. As for an
Operator, a power is drawn once, on the tick it is used, at the square it struck then: its target's, or the power
creep's own for a power on itself, which has no beam. So Dash's icon is on the square it dashes from and Summon's beam
goes to where the creep stood, which the renderer then slides over to the Commander. 18 of the icons are the client's
own, which it ships for these classes; the other 7 (Mass Heal, Foreman, Resurrect, Dash, Regenerate, Harvest Deposit,
Nuke) are drawn for this mod in the same style, in `icons/`.

`client.js` does this inside the client, which runs it each time it connects (Krebs's `Registry::client_js`):

* The renderer only knows the Operator's powers, and an id it does not know stops it from drawing the room, so the server
  logs the new powers as `actionLog.classPower`. Just before the renderer reads a tick, client.js turns each back into
  `actionLog.power`, under an id that finds the icon. The client gets room objects as diffs, in which a key that went
  away arrives as nothing, so on the tick after a use the server sets `classPower` to null, as vanilla keeps `power` at
  null; otherwise the client would keep the old entry and draw the power again every tick.
* The flare goes over an object with an effect whose power the renderer's `POWER_INFO` has, which again is the Operator's
  alone. In the same step client.js gives the new powers' effects the ids that find the icons, which that lookup finds
  too. The renderer gets a copy of the client's objects, so the client's own are left as they are.
* The side panel names a power by its `PWR_*` constant and loads `PWR_<name>.svg` from the client's files. client.js adds
  the new powers to the client's constants (`PWR_*`, `POWER_INFO`, `POWER_CLASS`), and points the panel at the client's
  Commander and Executor icons, or this mod's.

The client's Power Creeps page reads the same constants, so it lists the new classes' powers too. It has not been tried
with them: create and upgrade the new classes from scripts.

## How it is built

* `src/table.rs`: the classes and powers, which game.js turns into the players' constants.
* `game.js`: the players' side, evaluated in every player VM.
* `src/powers.rs`: the `classPower` intent (a custom intent type, `intent_types`), which `usePower` sends for the new
  powers.
* `src/effects.rs`: what the powers leave on creeps and power creeps, and the hooks that act on it.
* `client.js` and `icons/`: the game client's side, sent to it with the server's data.
* `test/` and `demo/`: the end-to-end test and the showcase, each a scenario with its bots.

Core lets a mod add power classes and powers (`ProcessorHooks::power_classes`, `powers`) and gives it a hook between the
intents and the tick loop (`pre_tick`). The mod registers no object tick and no post-object hook, so the tick loop's quiet
path for walls, roads and ramparts stays on.

`cargo test -p mod-powerclasses` runs the table's tests. `test/` checks the powers end to end: a room at RCL 8 and a bot
that creates, upgrades and spawns both classes through its script, uses every power and prints a `PASS` or `FAIL` line for
each of about a hundred checks, then `DONE fails=0`. From `mods/powerclasses/test`:

```
krebs bench --scenario scenario.json --mods powerclasses --console --ticks 150 --warmup 0
```

`make-scenario.cjs` writes `scenario.json` again after a change to the room.

## Showcase

`demo/` is a room to watch in the game client: one power creep for each of the 25 powers, each at a station of its own
with what its power needs, framed and named in the room. Your creeps walk, work, get hurt and die there, and Bob's hit
them, so the healing and shielding powers have work and the hostile ones have targets. Kill and Resurrect share one
creep, Lazarus, who dies and comes back. Those two come round once in hundreds of ticks, and Nuke once (its power creep
dies), so all three wait until the world runs at watching speed and go off about half a minute later. From
`mods/powerclasses/demo`:

```
krebs bench --scenario showcase.json --mods powerclasses --ticks 160 --warmup 0 --save world
krebs serve --data world --mods powerclasses --tick-rate 1000
```

The first line sets the room up: it creates the power creeps, levels each until its own power is at level 5 (Harvest
Energy stays at 1, which takes just what its source gives), spawns them and walks them to their stations. The room is
`player`'s, the name `krebs serve` signs the game client in as on this PC, so the client shows it as yours, with the
bot's labels and its console, which counts each power's uses. `make-demo.cjs` writes `showcase.json` and the bots'
`layout.js` again after a change to the room.

The code is under the MIT licence, see `LICENSE`.
