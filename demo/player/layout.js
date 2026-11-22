// Written by ../make-demo.cjs.
module.exports = {
 "room": "W1N1",
 "start": 1140,
 "powerSpawn": [
  25,
  24
 ],
 "cells": [
  {
   "title": "ENCOURAGE",
   "cls": "commander",
   "x0": 2,
   "y0": 3
  },
  {
   "title": "EXHAUST",
   "cls": "commander",
   "x0": 10,
   "y0": 3
  },
  {
   "title": "DEFEND",
   "cls": "commander",
   "x0": 18,
   "y0": 3
  },
  {
   "title": "SUMMON",
   "cls": "commander",
   "x0": 26,
   "y0": 3
  },
  {
   "title": "RENEW",
   "cls": "commander",
   "x0": 34,
   "y0": 3
  },
  {
   "title": "MASS HEAL",
   "cls": "commander",
   "x0": 42,
   "y0": 3
  },
  {
   "title": "DISABLE",
   "cls": "commander",
   "x0": 2,
   "y0": 12
  },
  {
   "title": "FOREMAN",
   "cls": "commander",
   "x0": 10,
   "y0": 12
  },
  {
   "title": "RESURRECT + KILL",
   "cls": "commander",
   "x0": 18,
   "y0": 12
  },
  {
   "title": "SIGHT",
   "cls": "commander",
   "x0": 26,
   "y0": 12
  },
  {
   "title": "BERSERK",
   "cls": "commander",
   "x0": 34,
   "y0": 12
  },
  {
   "title": "DASH",
   "cls": "executor",
   "x0": 2,
   "y0": 21
  },
  {
   "title": "REGENERATE",
   "cls": "executor",
   "x0": 10,
   "y0": 21
  },
  {
   "title": "REFLECT",
   "cls": "executor",
   "x0": 34,
   "y0": 21
  },
  {
   "title": "REINFORCE",
   "cls": "executor",
   "x0": 42,
   "y0": 21
  },
  {
   "title": "HARVEST ENERGY",
   "cls": "executor",
   "x0": 2,
   "y0": 30
  },
  {
   "title": "HARVEST MINERAL",
   "cls": "executor",
   "x0": 10,
   "y0": 30
  },
  {
   "title": "HARVEST DEPOSIT",
   "cls": "executor",
   "x0": 18,
   "y0": 30
  },
  {
   "title": "REMOTE TRANSFER",
   "cls": "executor",
   "x0": 26,
   "y0": 30
  },
  {
   "title": "MASS REPAIR",
   "cls": "executor",
   "x0": 34,
   "y0": 30
  },
  {
   "title": "PUNCH",
   "cls": "executor",
   "x0": 42,
   "y0": 30
  },
  {
   "title": "DEMOLISH",
   "cls": "executor",
   "x0": 10,
   "y0": 39
  },
  {
   "title": "SNIPE",
   "cls": "executor",
   "x0": 18,
   "y0": 39
  },
  {
   "title": "NUKE",
   "cls": "executor",
   "x0": 26,
   "y0": 39
  }
 ],
 "stations": [
  {
   "name": "Encourage",
   "power": 20,
   "cls": "commander",
   "pc": [
    5,
    4
   ],
   "creep": "Slowpoke",
   "lane": [
    [
     2,
     7
    ],
    [
     8,
     7
    ]
   ]
  },
  {
   "name": "Exhaust",
   "power": 21,
   "cls": "commander",
   "pc": [
    13,
    4
   ],
   "creep": "Sprinter",
   "lane": [
    [
     10,
     7
    ],
    [
     16,
     7
    ]
   ]
  },
  {
   "name": "Defend",
   "power": 22,
   "cls": "commander",
   "pc": [
    21,
    4
   ],
   "creep": "Guard",
   "medic": "Guard Medic"
  },
  {
   "name": "Summon",
   "power": 23,
   "cls": "commander",
   "pc": [
    27,
    4
   ],
   "creep": "Wanderer",
   "far": [
    32,
    9
   ]
  },
  {
   "name": "Renew",
   "power": 24,
   "cls": "commander",
   "pc": [
    37,
    5
   ],
   "creep": "Elder",
   "energy": [
    37,
    4
   ]
  },
  {
   "name": "Mass Heal",
   "power": 25,
   "cls": "commander",
   "pc": [
    45,
    6
   ]
  },
  {
   "name": "Disable",
   "power": 26,
   "cls": "commander",
   "pc": [
    5,
    15
   ],
   "hostile": "Rioter"
  },
  {
   "name": "Foreman",
   "power": 27,
   "cls": "commander",
   "pc": [
    11,
    13
   ],
   "creep": "Worker",
   "source": [
    13,
    18
   ],
   "controller": [
    16,
    16
   ]
  },
  {
   "name": "Resurrect",
   "power": 28,
   "cls": "commander",
   "pc": [
    20,
    16
   ],
   "creep": "Lazarus",
   "grave": [
    21,
    16
   ]
  },
  {
   "name": "Kill",
   "power": 43,
   "cls": "executor",
   "pc": [
    24,
    16
   ],
   "creep": "Lazarus"
  },
  {
   "name": "Sight",
   "power": 29,
   "cls": "commander",
   "pc": [
    29,
    13
   ],
   "creep": "Spotter",
   "wall": [
    31,
    16
   ]
  },
  {
   "name": "Berserk",
   "power": 30,
   "cls": "commander",
   "pc": [
    37,
    13
   ],
   "creep": "Brawler",
   "wall": [
    37,
    17
   ]
  },
  {
   "name": "Dash",
   "power": 31,
   "cls": "executor",
   "pc": [
    2,
    24
   ],
   "lane": [
    [
     2,
     24
    ],
    [
     8,
     24
    ]
   ]
  },
  {
   "name": "Regenerate",
   "power": 32,
   "cls": "executor",
   "pc": [
    13,
    24
   ]
  },
  {
   "name": "Reflect",
   "power": 40,
   "cls": "executor",
   "pc": [
    37,
    24
   ],
   "medic": "Reflect Medic"
  },
  {
   "name": "Reinforce",
   "power": 41,
   "cls": "executor",
   "pc": [
    45,
    24
   ],
   "medic": "Reinforce Medic"
  },
  {
   "name": "Harvest Energy",
   "power": 33,
   "cls": "executor",
   "pc": [
    5,
    33
   ],
   "target": [
    5,
    34
   ],
   "look": "source",
   "level": 1,
   "tower": [
    5,
    32
   ],
   "wall": [
    7,
    35
   ]
  },
  {
   "name": "Harvest Mineral",
   "power": 34,
   "cls": "executor",
   "pc": [
    13,
    33
   ],
   "target": [
    13,
    34
   ],
   "look": "mineral"
  },
  {
   "name": "Harvest Deposit",
   "power": 35,
   "cls": "executor",
   "pc": [
    21,
    33
   ],
   "target": [
    21,
    34
   ],
   "look": "deposit"
  },
  {
   "name": "Remote Transfer",
   "power": 36,
   "cls": "executor",
   "pc": [
    27,
    33
   ],
   "energy": [
    26,
    33
   ],
   "tower": [
    32,
    33
   ],
   "wall": [
    32,
    35
   ]
  },
  {
   "name": "Mass Repair",
   "power": 37,
   "cls": "executor",
   "pc": [
    37,
    33
   ],
   "energy": [
    37,
    32
   ]
  },
  {
   "name": "Punch",
   "power": 38,
   "cls": "executor",
   "pc": [
    45,
    33
   ],
   "wall": [
    45,
    34
   ]
  },
  {
   "name": "Demolish",
   "power": 39,
   "cls": "executor",
   "pc": [
    10,
    42
   ],
   "wall": [
    16,
    42
   ]
  },
  {
   "name": "Snipe",
   "power": 42,
   "cls": "executor",
   "pc": [
    21,
    39
   ],
   "hostile": "Bunker"
  },
  {
   "name": "Nuke",
   "power": 44,
   "cls": "executor",
   "pc": [
    29,
    42
   ]
  }
 ]
};
