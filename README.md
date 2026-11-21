# krebs-powerclasses

A mod for Krebs, which is on [GitHub](https://github.com/DefaultO/krebs) and [Gitea](https://gitea.defaul.to/DefaultO/krebs).
Either one is enough. It lives at `mods/powerclasses` in the core, as a git submodule, and it builds only inside the core. To
get it:

```
git clone --recursive https://github.com/DefaultO/krebs.git
```

Screeps planned three power creep classes and shipped one, the Operator. This mod adds the other two, the **Commander** and
the **Executor**, with the powers the official [power planner](https://screeps.com/power-planner/) gives them. The game
client already carries their sprites, so they look like themselves in the room view.

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
| `PWR_REMOTE_TRANSFER` | 36 | 0 2 7 14 22 | Transfers to any creep, power creep or structure. | 10 | 5/10/15/20/30 |
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
* REFLECT: the power creep takes half and the attacker takes half. Only creeps and power creeps get hit back.
* RESURRECT takes one of your own creep's tombstones from which nothing was taken. The creep comes back where it fell, with
  the time it had left, full hits and no boosts, holding what the tombstone held up to its capacity, the rest dropped. Its
  name must be free. A tombstone records what it held when the room first sees it, before anyone can withdraw from it.
* SUMMON takes only your own creeps, and not to exit squares. KILL and SUMMON leave spawning creeps alone.
* PUNCH hits the rampart over a creep, as a melee attack does, and the target hits back as it would a creep.
* NUKE: a second nuke of the same power creep in the same room takes the place of the first. When the power creep is
  deleted, its nukes go.
* A power whose target is gone or wrong does nothing and starts no cooldown, as vanilla's do.

## What the client shows

The room view draws Commanders and Executors with their own sprites. It shows no power icon for the new powers, because
the client's renderer only has a table for the Operator's: the mod logs them as `actionLog.classPower` instead of
`actionLog.power`, since an id the renderer does not know stops it from drawing the room. The client's own power creep
screens know only the Operator, so the new classes come from scripts.

## How it is built

* `src/table.rs`: the classes and powers, which game.js turns into the players' constants.
* `game.js`: the players' side, evaluated in every player VM.
* `src/powers.rs`: the `classPower` intent (a custom intent type, `intent_types`), which `usePower` sends for the new
  powers.
* `src/effects.rs`: what the powers leave on creeps and power creeps, and the hooks that act on it.

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

The code is under the MIT licence, see `LICENSE`.
