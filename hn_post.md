> **DRAFT. Not posted.** Show HN draft for this repo. Links checked live on 2026-10-11.

# Show HN: The Resonance Web, a tiny network engine where knowledge dies with its last holder

Live demo: https://dosage2ag.github.io/resonance-web/demo.html
GitHub: https://github.com/Dosage2AG/resonance-web

I built a JavaScript engine for simulating networks where every node is both a butterfly (its actions send ripples) and a spider (it holds bonds). A node starts knowing nothing. It learns by spending time near something observable, by watching a neighbour who knows it, or by being taught through a bond. When the last node holding a piece of knowledge is removed, that item is marked lost and can never be learned again. Removing a node also leaves grief in every bonded survivor, scaled by the bond, which lowers their mood and fades over time.

This came out of building ANIMA, a god-game where creatures had to earn what they know instead of spawning pre-configured. The same pattern fits anywhere you want to model how knowledge moves through relationships and disappears when its holders leave: organizational memory, cultural transmission, toy models of agents that only know what they saw.

The engine is one file of about 450 lines, zero dependencies, MIT licensed, with a plain node test suite. Ripples amplify through strong bonds (gain above 1 for bonds over 0.8) but are hard-capped and limited to 4 hops, and the tests run 10,000 dense steps to show they stay bounded. Save and load round-trip the full web byte for byte. The demo spawns seeded clusters; click to send warmth, right-click to send shadow, and the status line shows who knows what and what has been lost forever. A hidden accumulator tracks resonance from every death; the demo never shows it.

Feedback welcome.
