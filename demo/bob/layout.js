// Written by ../make-demo.cjs.
module.exports = {
 "room": "W1N1",
 "start": 1140,
 "acts": [
  {
   "name": "Brute",
   "do": "attack",
   "creep": "Guard"
  },
  {
   "name": "Archer",
   "do": "rangedMassAttack"
  },
  {
   "name": "Rioter",
   "do": "attack",
   "at": [
    5,
    17
   ]
  },
  {
   "name": "Sniper",
   "do": "rangedAttack",
   "pc": "Regenerate"
  },
  {
   "name": "Brute 2",
   "do": "attack",
   "pc": "Reflect"
  },
  {
   "name": "Brute 2 Medic",
   "do": "heal",
   "creep": "Brute 2"
  },
  {
   "name": "Brute 3",
   "do": "attack",
   "pc": "Reinforce"
  },
  {
   "name": "Bunker",
   "do": "heal"
  }
 ]
};
