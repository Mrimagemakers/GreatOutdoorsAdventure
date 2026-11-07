# Character builder

`build.py` makes each character's body (`play/assets/characters/<id>.glb`) from the MakeHuman base mesh, targets, skeleton and weights (CC0).

1. Clone https://github.com/makehumancommunity/makehuman next to this folder at `../mh` (the script reads `mh/makehuman/data`; adjust `D` in `mhcore.py` if it lives elsewhere).
2. Run `pip install numpy pillow pygltflib`.
3. Run `python3 build.py <id> ../play/assets/characters/<id>.glb`.

Each person's sex, age, build, ancestry, height, colours, hair and beard are set in `chars.py`.
