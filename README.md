# The Spider & Butterfly Resonance Web

**A small network engine where every node is both signal and structure.**

Every node is a butterfly (its actions send ripples) and a spider (it holds bonds to other nodes). Knowledge is earned by observing or by being taught through a bond, and it dies with its last holder. Death sends a shockwave through the web and leaves grief in everyone bonded to the dead.

Created by [Dosage2ag](https://github.com/Dosage2AG), 2026. One file, zero dependencies, MIT licensed.

**[Live demo](https://dosage2ag.github.io/resonance-web/demo.html)**

---

## What it does

- **Nothing is known until observed.** A new node knows nothing. It learns an item by spending time near a knowledge source, by watching a nearby node that knows it, or by being taught through a bond. There is no call that hands a node knowledge directly.
- **Knowledge travels through bonds.** Every `observe()` tick, a node that knows an item teaches it to bonded nodes (bond weight 0.2 or more), faster through stronger bonds.
- **Knowledge can be lost forever.** When the last node holding an item is removed, the item is marked lost, a `knowledge-lost` event is logged, and nobody can learn it again, not even from its original source.
- **Grief hurts, in proportion to the bond.** Removing a node adds grief to each bonded survivor equal to the bond weight. Grief only ever lowers mood, and it fades by 5% per tick.
- **Ripples amplify through strong bonds.** A ripple re-emitted through a bond has gain `weight x 1.25`, so bonds above 0.8 amplify and weaker bonds damp. Every ripple is capped at intensity 1, dies after 4 hops, and only one ripple per target node and polarity is queued per tick, so the web cannot explode.
- **Death feeds the web.** A removed node's resonance goes into a hidden accumulator, and if it carried enough resonance it leaves a world memory at the spot where it died.
- **Save and load keep everything.** `serialize()` captures nodes, bonds, weights, knowledge, learning progress, mood, grief, pending ripples, sources, lost items, world memory and the accumulator. Loading it and saving again gives the same bytes.

---

## Use cases

| Domain | Application |
|--------|------------|
| **Game development** | Ecosystems where creatures learn, teach, grieve and forget |
| **Education** | Simulate how knowledge spreads in a group and disappears when its holders leave |
| **Social simulation** | Influence, cultural transmission, institutional memory |
| **AI agents** | Toy model of agents that know only what they observed or were taught |

---

## Quick start

```html
<script src="resonance-web.js"></script>
<script>
  // Same seed = same world
  var world = ResonanceWeb.initFromSeed("my-world");
  var clusters = world.generate(1000);

  ResonanceWeb.addNode("alice", 100, 200, "creature");
  ResonanceWeb.addNode("bob", 150, 210, "creature");
  ResonanceWeb.updateEdge("alice", "bob", 0.8);

  // Something worth knowing, near alice
  ResonanceWeb.addKnowledgeSource("fire", 100, 200, 50);

  // Your host objects: anything with id, x, y, alive (mood, e, maxE, vx, vy are optional)
  var creatures = [
    {id: "alice", x: 100, y: 200, alive: true, mood: 0},
    {id: "bob",   x: 150, y: 210, alive: true, mood: 0}
  ];

  ResonanceWeb.emit({x: 100, y: 200, intensity: 0.7, polarity: 0.5, sourceId: "alice"});

  // Each tick:
  ResonanceWeb.observe();             // learning and teaching
  ResonanceWeb.propagate(creatures);  // ripples, grief, mood
  var events = ResonanceWeb.takeEvents(); // learned / knowledge-lost / death
</script>
```

Node positions live in the engine. If your creatures move, copy their `x` and `y` onto `ResonanceWeb.getNodes()[id]` each tick, as `demo.html` does.

---

## Core concepts

### Nodes
Every entity in the web. Each node has a position, a type, bonds, **resonance** (how much ripple energy has passed through it, fading 0.1% per tick), **mood** (-1 to 1), **grief**, the set of items it **knows**, and its **learning** progress toward items it does not know yet.

### Bonds
Two-way weights from 0 to 1. Bonds of 0.2 or more carry ripples and teaching.

### Ripples
Each ripple has an intensity (0 to 1), a polarity, and a hop count.
- **Warmth** (polarity above 0.3) raises mood and restores energy.
- **Shadow** (polarity below -0.3) lowers mood and pushes creatures away.
- **Neutral** ripples, including death shockwaves, add resonance only.

Every creature reached by a ripple re-emits it to its bonded nodes with gain `weight x 1.25`, polarity times 0.8, capped at intensity 1, for up to 4 hops.

### Knowledge
Add observable things with `addKnowledgeSource(item, x, y, radius)`. Each `observe()` tick a node learns:
- from a source it is inside: 0.01 per tick at the centre, less toward the edge (about 100 ticks at the centre);
- from watching a node that knows the item within 60 units: up to 0.002 per tick;
- from a bonded teacher: `weight x 0.02` per tick, at any distance.

Progress reaches 1, the node knows the item, and a `learned` event records how (`observation` or `teaching`). When the last holder is removed, the item is lost for good.

### Grief
On `removeNode`, each bonded survivor gains grief equal to the bond weight. Each `propagate()` tick, mood drops by 5% of current grief and grief shrinks by 5%. No randomness is involved.

### World memory
When a node with resonance above 0.1 is removed, a world memory with 30% of its resonance is left where it died. World memories fade slowly; at most 100 are kept.

### The hidden accumulator
Every death adds the dead node's resonance to a global accumulator that fades 0.1% per tick. The demo never displays it. Your code can read it with `getHiddenAccumulator()`.

---

## API reference

### Initialization
| Method | Description |
|--------|-------------|
| `initFromSeed(name)` | Reset the web and seed it from a string. Returns a cluster generator. |
| `hashSeed(name)` | Convert a world name to a numeric seed. |

### Nodes and bonds
| Method | Description |
|--------|-------------|
| `addNode(id, x, y, type)` | Add a node that knows nothing. |
| `removeNode(id)` | Remove a node: grief to bonded nodes, death shockwave, world memory, accumulator, knowledge loss check. |
| `updateEdge(id1, id2, weight)` | Set bond weight (clamped to 0..1). |
| `getNodes()` | The live node map. |

### Ripples
| Method | Description |
|--------|-------------|
| `emit(event)` | Queue a ripple `{x, y, intensity, polarity, type, sourceId}`. |
| `propagate(creatures)` | One tick: process ripples, apply grief, fade resonance. |
| `getPendingRipples()` | Ripples queued for the next tick. |
| `getResonanceAt(x, y, radius)` | Total resonance near a point. |

### Knowledge
| Method | Description |
|--------|-------------|
| `addKnowledgeSource(item, x, y, radius)` | Place something that can be learned by observing it. |
| `observe()` | One tick of observation and teaching for every node. |
| `teach(fromId, toId, item)` | One tick of teaching through a bond. Returns true when the item is learned. |
| `getKnowledge(id)` | Items a node knows (sorted). |
| `whoKnows(item)` | Ids of nodes that know an item. |
| `getKnownItems()` | `{item: holderCount}` for the whole web. |
| `isLost(item)` | True once the item's last holder is gone. |
| `takeEvents()` | Return and clear the event log (`learned`, `knowledge-lost`, `death`). |

### World memory
| Method | Description |
|--------|-------------|
| `addWorldMemory(x, y, type, strength, sourceId)` | Add a persistent memory. |
| `updateWorldMemory()` | Age and fade all world memories. |
| `getWorldMemoryNear(x, y, radius)` | Memories near a point. |

### Serialization
| Method | Description |
|--------|-------------|
| `serialize()` | Full web state as a JSON string. |
| `deserialize(json)` | Restore that state. Returns false on bad input. |

---

## Tests

```
npm test
```

`test.js` (plain node, no dependencies) checks that grief never raises mood across 300 seeded deaths, that strong bonds amplify while 10,000 dense steps stay finite and under the cap, that knowledge appears only through observation or teaching and is lost with its last holder, and that save, load, save gives identical bytes and the same future.

---

## The philosophy

> "Every creature is simultaneously butterfly AND spider. Every action creates ripples. Every bond is a web thread. Death strengthens the web. The web IS the simulation."

The Resonance Web came out of building **ANIMA: Numen**, a god-game where you guide civilizations as a formless presence.

---

## License

MIT License. Use it, build on it, make something alive.

---

*Built by a human and an AI, in Madrid, with no funding, no team, and no safety net.*
