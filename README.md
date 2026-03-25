# The Spider & Butterfly Resonance Web

**A living network engine where every node is both signal and structure.**

Every node is simultaneously a butterfly (creating ripples through its actions) and a spider (weaving threads of connection). Knowledge propagates through observation, strengthens through bonds, and dies when forgotten. Death sends shockwaves through the web. The network remembers what the nodes cannot.

Created by [Dosage2ag](https://github.com/Dosage2AG), 2026.

---

## What is this?

The Resonance Web is a lightweight JavaScript engine for simulating emergent networks where:

- **Nothing is known until observed** — nodes earn knowledge through proximity and interaction, not configuration
- **Relationships are memory** — bonds form from shared experience, fade with distance, and carry grief when broken
- **Actions ripple** — every event propagates through the network, decaying with distance and amplifying through strong bonds
- **Death strengthens the web** — when a node is removed, its accumulated resonance feeds the collective, and its strongest memory becomes permanent
- **Knowledge can be lost** — if all nodes carrying a piece of knowledge are removed, it's gone forever

This isn't a social graph. It's a living nervous system.

---

## Use Cases

| Domain | Application |
|--------|------------|
| **Game Development** | Emergent AI ecosystems, relationship systems, knowledge propagation |
| **Education** | Simulate how knowledge spreads and dies in organizations |
| **Social Simulation** | Model influence, cultural transmission, institutional memory |
| **AI Agents** | Earned-knowledge frameworks where agents learn by observation, not pretraining |
| **Data Visualization** | Living network graphs that respond to events and decay over time |

---

## Quick Start

```html
<script src="resonance-web.js"></script>
<script>
  // Initialize a world from a seed (same seed = same world)
  var world = ResonanceWeb.initFromSeed("my-world");
  var clusters = world.generate(1000);

  // Add nodes
  ResonanceWeb.addNode("alice", 100, 200, "creature");
  ResonanceWeb.addNode("bob", 150, 210, "creature");

  // Form a bond
  ResonanceWeb.updateEdge("alice", "bob", 0.8);

  // Emit a resonance event (ripple)
  ResonanceWeb.emit({
    x: 100, y: 200,
    intensity: 0.7,
    polarity: 0.5,    // -1 = shadow, 0 = neutral, 1 = warmth
    type: "interaction",
    sourceId: "alice"
  });

  // Propagate through the network
  ResonanceWeb.propagate(creatureArray);
</script>
```

---

## Core Concepts

### Nodes
Every entity in the web. Can be creatures, landmarks, or sacred sites. Each node accumulates **resonance** — a measure of how much life has flowed through it.

### Edges (Web Threads)
Bidirectional bonds between nodes. Weight ranges from 0 (strangers) to 1 (inseparable). Bonds above 0.2 carry resonance ripples between nodes.

### Resonance Events
Actions that ripple outward. Each event has:
- **Intensity** — how strong the ripple is
- **Polarity** — warmth (+1) attracts and heals, shadow (-1) scatters and stresses
- **Hops** — ripples travel up to 4 hops through the bond network, decaying at each step

### World Memory
When significant nodes are removed, their strongest resonance becomes a **world memory** — a persistent mark at that location. The web remembers what lived there.

### The Hidden Accumulator
Every death feeds a global resonance counter. The web grows heavier with history. This value is never displayed — but it's always there.

---

## API Reference

### Initialization
| Method | Description |
|--------|-------------|
| `initFromSeed(name)` | Initialize world from a string seed. Returns cluster data. |
| `hashSeed(name)` | Convert world name to numeric seed. |

### Nodes & Edges
| Method | Description |
|--------|-------------|
| `addNode(id, x, y, type)` | Add a node. Type: `'creature'`, `'mark'`, or `'site'` |
| `removeNode(id)` | Remove node. Sends death shockwave through all bonds. |
| `updateEdge(id1, id2, weight)` | Set bond strength (0–1) between two nodes. |

### Resonance
| Method | Description |
|--------|-------------|
| `emit(event)` | Emit a resonance event at a position. |
| `propagate(creatures)` | Process all pending events through the network. |
| `getResonanceAt(x, y, radius)` | Query total resonance near a point. |

### World Memory
| Method | Description |
|--------|-------------|
| `addWorldMemory(x, y, type, strength, sourceId)` | Manually add a persistent memory. |
| `updateWorldMemory()` | Age and decay all world memories. |
| `getWorldMemoryNear(x, y, radius)` | Query memories near a point. |

### Serialization
| Method | Description |
|--------|-------------|
| `serialize()` | Export world state as JSON. |
| `deserialize(json)` | Restore world state from JSON. |

---

## The Philosophy

> "Every creature is simultaneously butterfly AND spider. Every action creates ripples. Every bond is a web thread. Death strengthens the web. Escape weakens one strand but creates new ripples. The web IS the simulation."

Traditional network engines model static connections. The Resonance Web models **living relationships** — where bonds form through shared experience, knowledge must be earned and can be permanently lost, and the death of a node sends real consequences cascading through every connection it ever had.

This isn't about modeling a network. It's about growing one.

---

## License

MIT License — use it, build on it, make something alive.

---

## See it in Action — ANIMA: Numen

The Resonance Web was born as the core engine of **ANIMA: Numen**, a god-game where you guide civilizations as a formless divine presence. 9000+ lines of living simulation, 27 interconnected systems, all running on this engine.

**[Play ANIMA free in your browser →](https://dosage2ag.itch.io/animanumen)**

In ANIMA, the Resonance Web powers everything:
- Creatures form tribes through shared bonds — **the web threads are their relationships**
- Knowledge spreads by observation and oral tradition — **resonance events carry what was learned**
- When an elder dies, grief cascades through every creature who knew them — **death shockwaves through the web**
- If every creature who knew farming is killed, farming is forgotten forever — **knowledge lost from the network permanently**
- Dreams collide with memories to create breakthroughs — **resonance accumulation triggers emergence**

The engine demo shows the mechanics. The game shows what they become.

**[Engine Demo (minimal)](https://dosage2ag.github.io/resonance-web/demo.html)** | **[ANIMA: Numen (full game)](https://dosage2ag.itch.io/animanumen)**

---

## License

MIT License — use it, build on it, make something alive.

---

*Built by a human and an AI, in Madrid, with no funding, no team, and no safety net.*
