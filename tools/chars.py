# Six characters. Ages map 25 y -> 0.5, 90 y -> 1.0. Colours match play/characters.js.
def age(y): return 0.5 + (y - 25) / 130
CHARS = {
 'hunter': dict(gender=1, age=age(38), muscle=0.68, weight=0.6, race={'african': 1.0}, height=1.82, skin='#6a432b', hairCol='#141110', hair='short',
   beard=True, beardCol='#1d1612', beardAmt=0.9, eye='#4a2e1c', shirt='#6b6a3c', jacket='#5f5e36', camo=True, vest='#ef6a1d', pants='#7a6a4c', boots='#3a2a1d'),
 'ranger': dict(gender=0, age=age(34), muscle=0.55, weight=0.5, race={'caucasian': 0.55, 'asian': 0.25, 'african': 0.2}, height=1.68, skin='#a8754f', hairCol='#2a1a12', hair='bun',
   eye='#5a3a1e', shirt='#7b7b55', jacket='#56603e', openFront=True, pants='#3f4a33', boots='#2b2219'),
 'guide': dict(gender=1, age=age(63), muscle=0.5, weight=0.66, race={'caucasian': 1.0}, height=1.80, skin='#d9a888', hairCol='#b9b4ab', hair='short',
   beard=True, beardCol='#cfcac1', beardAmt=0.95, browCol='#a8a299', eye='#6f8494', shirt='#9b2f2a', plaid=True, pants='#3f5576', denim=True, boots='#5a3b24', topT=0.007),
 'camper': dict(gender=0, age=age(29), muscle=0.55, weight=0.55, race={'asian': 0.5, 'caucasian': 0.3, 'african': 0.2}, height=1.65, skin='#ad7651', hairCol='#120e0c', hair='braid',
   eye='#3a2416', shirt='#2f7a76', jacket='#2b6c69', pants='#a3926e', boots='#4a3626'),
 'tracker': dict(gender=1, age=age(31), muscle=0.72, weight=0.45, race={'african': 1.0}, height=1.86, skin='#4e3121', hairCol='#0e0b0a', hair='crop',
   eye='#2f1d12', shirt='#4e5638', jacket='#56603a', camo=True, pants='#4d4a3a', boots='#2b2016'),
 'photographer': dict(gender=0, age=age(27), muscle=0.45, weight=0.4, race={'asian': 1.0}, height=1.62, skin='#e3bc98', hairCol='#1a1514', hair='bob',
   eye='#3b2a1c', shirt='#d9d2c2', jacket='#b39a6f', openFront=True, pants='#5b5d5a', boots='#3b2f25'),
}
