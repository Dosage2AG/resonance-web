// ===== THE RESONANCE WEB: The Spider and Butterfly =====
// Every creature is a node. Every interaction creates edges.
// Every action ripples. Knowledge is earned by observing or by being taught,
// and it dies with its last holder.
// Coined by Dosage2ag, 2026-03-21.

var ResonanceWeb = (function(){
  // ---- Tunable constants (all bounded on purpose) ----
  var BOND_CARRY_MIN = 0.2;   // bonds at or above this carry ripples and teaching
  var AMP_GAIN = 1.25;        // ripple gain per hop = bondWeight * AMP_GAIN (above 1 only for bonds > 0.8)
  var MAX_INTENSITY = 1;      // hard cap on any ripple intensity
  var MAX_HOPS = 4;           // ripples die after this many hops
  var RESONANCE_DECAY = 0.999;// node resonance and the accumulator fade each tick
  var GRIEF_TO_MOOD = 0.05;   // share of current grief that lowers mood each tick
  var GRIEF_DECAY = 0.95;     // grief fades each tick
  var OBSERVE_RATE = 0.01;    // learning per tick at the centre of a knowledge source
  var WATCH_RANGE = 60;       // distance at which a node can watch a holder use what it knows
  var WATCH_RATE = 0.002;     // learning per tick from watching a holder
  var TEACH_RATE = 0.02;      // learning per tick from a bonded teacher, times bond weight
  var LOG_LIMIT = 1000;       // undrained events beyond this are dropped (oldest first)

  var _nodes = {};    // id -> node (see addNode)
  var _events = [];   // pending ripples, processed by propagate()
  var _worldMemory = []; // persistent marks {x,y,type,strength,age,source}
  var _sources = [];  // observable knowledge sources {item,x,y,radius}
  var _lost = {};     // item -> true once its last holder is gone. Never relearnable.
  var _log = [];      // engine events for the host: learned, knowledge-lost, death
  var _seed = null;   // world name
  var _totalResonance = 0; // hidden accumulator: never shown by the demo

  // Seeded random for deterministic world generation
  var _seedState = 0;
  function seedRng(s){ _seedState = s; }
  function seededRandom(){
    _seedState = (_seedState * 1664525 + 1013904223) & 0x7fffffff;
    return _seedState / 0x7fffffff;
  }

  // === SEED SYSTEM ===
  // World name = procedural seed. Same name = same world.
  function hashSeed(name){
    var h = 0;
    for(var i = 0; i < name.length; i++){
      h = ((h << 5) - h + name.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  function initFromSeed(worldName){
    _seed = worldName;
    var h = hashSeed(worldName);
    seedRng(h);
    _totalResonance = 0;
    _nodes = {};
    _events = [];
    _worldMemory = [];
    _sources = [];
    _lost = {};
    _log = [];
    return {
      seed: h,
      clusterCount: 3 + Math.floor(seededRandom() * 3), // 3-5 clusters
      clusters: [],
      generate: function(worldSize){
        for(var i = 0; i < this.clusterCount; i++){
          this.clusters.push({
            x: worldSize * 0.2 + seededRandom() * worldSize * 0.6,
            y: worldSize * 0.2 + seededRandom() * worldSize * 0.6,
            size: 5 + Math.floor(seededRandom() * 8), // 5-12 creatures per cluster
            dnaBase: {
              agg: seededRandom(),
              social: 0.3 + seededRandom() * 0.5,
              sp: 0.2 + seededRandom() * 0.6,
              diet: seededRandom(),
              sz: 0.3 + seededRandom() * 0.5,
              resilience: 0.3 + seededRandom() * 0.5
            }
          });
        }
        return this.clusters;
      }
    };
  }

  function log(ev){
    _log.push(ev);
    if(_log.length > LOG_LIMIT) _log.shift();
  }

  function clamp(v, lo, hi){ return v < lo ? lo : (v > hi ? hi : v); }

  // === NODE MANAGEMENT ===
  // A node starts knowing nothing.
  function addNode(id, x, y, type){
    _nodes[id] = {
      id: id, x: x, y: y, type: type || 'creature',
      edges: {},      // otherId -> weight (0..1)
      resonance: 0,   // how much life has flowed through this node
      mood: 0,        // -1..1
      grief: 0,       // pending grief, drains into mood and fades
      knows: {},      // item -> true
      learning: {}    // item -> progress 0..1
    };
    return _nodes[id];
  }

  function removeNode(id){
    var node = _nodes[id];
    if(!node) return;
    var edgeIds = Object.keys(node.edges);
    var strongest = 0;
    for(var i = 0; i < edgeIds.length; i++){
      var w = node.edges[edgeIds[i]];
      var other = _nodes[edgeIds[i]];
      if(other){
        // Grief: always negative, scaled by the bond to the dead.
        other.grief += w;
        delete other.edges[id];
      }
      if(w > strongest) strongest = w;
    }
    // One neutral shockwave: it carries resonance, not mood. Grief does the hurting.
    if(strongest > 0){
      emit({x:node.x, y:node.y, intensity:strongest*0.5, polarity:0, type:'death', sourceId:id});
    }
    // Strongest memory becomes world memory (ancestral echo)
    if(node.resonance > 0.1){
      addWorldMemory(node.x, node.y, 'death', node.resonance * 0.3, id);
    }
    _totalResonance += node.resonance; // death feeds the accumulator
    delete _nodes[id];
    log({type:'death', nodeId:id});

    // Knowledge dies with its last holder.
    var items = Object.keys(node.knows).sort();
    for(var k = 0; k < items.length; k++){
      if(holderCount(items[k]) === 0) loseItem(items[k], id);
    }
  }

  function updateEdge(id1, id2, weight){
    if(!_nodes[id1] || !_nodes[id2] || id1 === id2) return;
    var w = clamp(weight, 0, 1);
    _nodes[id1].edges[id2] = w;
    _nodes[id2].edges[id1] = w;
  }

  // === KNOWLEDGE ===
  // Knowledge enters the web only by observation (a source, or watching a holder)
  // or by teaching through a bond. There is no call that grants it directly.
  function addKnowledgeSource(item, x, y, radius){
    _sources.push({item:String(item), x:x, y:y, radius:radius || 80});
  }

  function holderCount(item){
    var n = 0;
    for(var id in _nodes) if(_nodes[id].knows[item]) n++;
    return n;
  }

  function loseItem(item, lastHolder){
    _lost[item] = true;
    for(var id in _nodes) delete _nodes[id].learning[item];
    log({type:'knowledge-lost', item:item, lastHolder:lastHolder});
  }

  function progress(node, item, amount, via, fromId){
    if(amount <= 0 || node.knows[item] || _lost[item]) return false;
    var p = (node.learning[item] || 0) + amount;
    if(p >= 1){
      delete node.learning[item];
      node.knows[item] = true;
      log({type:'learned', nodeId:node.id, item:item, via:via, from:fromId === undefined ? null : fromId});
      return true;
    }
    node.learning[item] = p;
    return false;
  }

  // One tick of teaching. Requires the teacher to know the item and a carrying bond.
  function teach(fromId, toId, item){
    var a = _nodes[fromId], b = _nodes[toId];
    if(!a || !b || !a.knows[item]) return false;
    var w = a.edges[toId] || 0;
    if(w < BOND_CARRY_MIN) return false;
    return progress(b, item, w * TEACH_RATE, 'teaching', fromId);
  }

  // One tick of observation for every node: watch sources, watch nearby holders,
  // and learn from bonded teachers.
  function observe(){
    var ids = Object.keys(_nodes);
    for(var i = 0; i < ids.length; i++){
      var n = _nodes[ids[i]];
      for(var s = 0; s < _sources.length; s++){
        var src = _sources[s];
        var dx = n.x - src.x, dy = n.y - src.y;
        var d = Math.sqrt(dx*dx + dy*dy);
        if(d < src.radius) progress(n, src.item, OBSERVE_RATE * (1 - d / src.radius), 'observation', null);
      }
      for(var j = 0; j < ids.length; j++){
        if(i === j) continue;
        var o = _nodes[ids[j]];
        var items = Object.keys(o.knows);
        if(!items.length) continue;
        var w = o.edges[n.id] || 0;
        var ox = n.x - o.x, oy = n.y - o.y;
        var od = Math.sqrt(ox*ox + oy*oy);
        for(var k = 0; k < items.length; k++){
          if(w >= BOND_CARRY_MIN) teach(o.id, n.id, items[k]);
          else if(od < WATCH_RANGE) progress(n, items[k], WATCH_RATE * (1 - od / WATCH_RANGE), 'observation', o.id);
        }
      }
    }
  }

  // === RESONANCE EVENTS ===
  function emit(event){
    // event: {x, y, intensity, polarity(-1 to 1), type, sourceId}
    _events.push({
      x: event.x, y: event.y,
      intensity: clamp(event.intensity === undefined ? 0.5 : event.intensity, 0, MAX_INTENSITY),
      polarity: clamp(event.polarity || 0, -1, 1), // -1=shadow, 0=neutral, 1=warmth
      type: event.type || 'tap',
      sourceId: event.sourceId === undefined ? null : event.sourceId,
      hops: 0,
      maxHops: MAX_HOPS
    });
  }

  // Mood lives on the node. A host creature object (optional) mirrors it.
  function setMood(c, node, delta){
    if(node){ node.mood = clamp(node.mood + delta, -1, 1); c.mood = node.mood; }
    else c.mood = clamp((c.mood || 0) + delta, -1, 1);
  }

  function propagate(creatures){
    creatures = creatures || [];
    // At most one queued ripple per (target node, polarity sign) per tick,
    // so ripple count stays at or below 3 x nodes no matter how dense the web.
    var next = {};
    var nextOrder = [];
    for(var e = 0; e < _events.length; e++){
      var ev = _events[e];
      if(ev.intensity < 0.01 || ev.hops >= ev.maxHops) continue;

      var range = 100 + ev.intensity * 200; // stronger = wider
      for(var i = 0; i < creatures.length; i++){
        var c = creatures[i];
        if(!c.alive || c.dying) continue;
        if(c.id === ev.sourceId) continue;
        var dx = c.x - ev.x, dy = c.y - ev.y;
        var d = Math.sqrt(dx*dx + dy*dy);
        if(d > range) continue;

        var received = ev.intensity * (1 - d / range);
        var node = _nodes[c.id];
        if(node) node.resonance += received * 0.1;

        if(ev.polarity > 0.3){
          // Warmth: comfort, heal
          setMood(c, node, received * 0.05);
          if(c.e !== undefined && c.maxE !== undefined) c.e = Math.min(c.maxE, c.e + received * 2);
        } else if(ev.polarity < -0.3){
          // Shadow: stress, scatter
          setMood(c, node, -received * 0.08);
          var angle = Math.atan2(c.y - ev.y, c.x - ev.x);
          if(c.vx !== undefined){ c.vx += Math.cos(angle) * received * 0.5; c.vy += Math.sin(angle) * received * 0.5; }
        }
        // Neutral ripples (including death shockwaves) add resonance only.

        // Re-emit through bonds (the butterfly ripple). Strong bonds amplify.
        if(node && ev.hops < ev.maxHops - 1){
          var bondIds = Object.keys(node.edges);
          for(var b = 0; b < bondIds.length; b++){
            var w = node.edges[bondIds[b]];
            var target = _nodes[bondIds[b]];
            if(w < BOND_CARRY_MIN || !target) continue;
            var out = Math.min(MAX_INTENSITY, received * w * AMP_GAIN);
            var pol = ev.polarity * 0.8; // polarity dilutes
            var key = bondIds[b] + '|' + (pol > 0.3 ? 1 : (pol < -0.3 ? -1 : 0));
            var prev = next[key];
            if(!prev){
              next[key] = {x:target.x, y:target.y, intensity:out, polarity:pol, type:ev.type,
                           sourceId:c.id, hops:ev.hops + 1, maxHops:ev.maxHops};
              nextOrder.push(key);
            } else if(out > prev.intensity){
              prev.intensity = out; prev.polarity = pol; prev.sourceId = c.id; prev.hops = ev.hops + 1;
            }
          }
        }
      }
    }
    _events = nextOrder.map(function(k){ return next[k]; });

    // Grief drains into mood (always downward) and fades.
    for(var g = 0; g < creatures.length; g++){
      var gc = creatures[g], gn = _nodes[gc.id];
      if(!gn || gn.grief <= 0) continue;
      if(gc.alive !== false) setMood(gc, gn, -gn.grief * GRIEF_TO_MOOD);
      gn.grief *= GRIEF_DECAY;
      if(gn.grief < 1e-4) gn.grief = 0;
    }
    for(var id in _nodes) _nodes[id].resonance *= RESONANCE_DECAY;
    _totalResonance *= RESONANCE_DECAY;
  }

  // === WORLD MEMORY ===
  function addWorldMemory(x, y, type, strength, sourceId){
    _worldMemory.push({x:x, y:y, type:type, strength:strength, age:0, source:sourceId});
    if(_worldMemory.length > 100) _worldMemory.shift();
  }

  function updateWorldMemory(){
    for(var i = _worldMemory.length - 1; i >= 0; i--){
      _worldMemory[i].age++;
      _worldMemory[i].strength -= 0.0001;
      if(_worldMemory[i].strength <= 0){
        _worldMemory[i] = _worldMemory[_worldMemory.length - 1];
        _worldMemory.pop();
      }
    }
  }

  // === QUERIES ===
  function getResonanceAt(x, y, radius){
    var total = 0;
    for(var id in _nodes){
      var n = _nodes[id];
      var dx = n.x - x, dy = n.y - y;
      var d = Math.sqrt(dx*dx + dy*dy);
      if(d < radius) total += n.resonance * (1 - d/radius);
    }
    return total;
  }

  function getWorldMemoryNear(x, y, radius){
    var result = [];
    for(var i = 0; i < _worldMemory.length; i++){
      var m = _worldMemory[i];
      var dx = m.x - x, dy = m.y - y;
      if(Math.sqrt(dx*dx + dy*dy) < radius) result.push(m);
    }
    return result;
  }

  function getKnowledge(id){ return _nodes[id] ? Object.keys(_nodes[id].knows).sort() : []; }

  function whoKnows(item){
    var r = [];
    for(var id in _nodes) if(_nodes[id].knows[item]) r.push(id);
    return r;
  }

  function getKnownItems(){
    var counts = {};
    for(var id in _nodes) for(var it in _nodes[id].knows) counts[it] = (counts[it] || 0) + 1;
    return counts;
  }

  function takeEvents(){ var r = _log; _log = []; return r; }

  // === SERIALIZATION (save/load, full round trip) ===
  // Key order is kept as-is so a loaded web iterates exactly like the saved one.
  function copyObj(o){
    var r = {};
    for(var k in (o || {})) r[k] = o[k];
    return r;
  }

  function serialize(){
    var nodes = [];
    for(var id in _nodes){
      var n = _nodes[id];
      nodes.push({id:n.id, x:n.x, y:n.y, type:n.type, resonance:n.resonance, mood:n.mood,
                  grief:n.grief, edges:n.edges, knows:Object.keys(n.knows).sort(),
                  learning:n.learning});
    }
    return JSON.stringify({
      version: 2,
      seed: _seed,
      seedState: _seedState,
      totalResonance: _totalResonance,
      nodes: nodes,
      events: _events,
      worldMemory: _worldMemory,
      sources: _sources,
      lost: Object.keys(_lost).sort(),
      log: _log
    });
  }

  function deserialize(json){
    var data;
    try{ data = JSON.parse(json); }catch(e){ return false; }
    if(!data || typeof data !== 'object') return false;
    _seed = data.seed === undefined ? null : data.seed;
    _seedState = data.seedState || 0;
    _totalResonance = data.totalResonance || 0;
    _worldMemory = data.worldMemory || [];
    _events = data.events || [];
    _sources = data.sources || [];
    _log = data.log || [];
    _lost = {};
    (data.lost || []).forEach(function(it){ _lost[it] = true; });
    _nodes = {};
    (data.nodes || []).forEach(function(s){
      var n = addNode(s.id, s.x, s.y, s.type);
      n.resonance = s.resonance || 0;
      n.mood = s.mood || 0;
      n.grief = s.grief || 0;
      n.edges = copyObj(s.edges);
      (s.knows || []).forEach(function(it){ n.knows[it] = true; });
      n.learning = copyObj(s.learning);
    });
    return true;
  }

  // === PUBLIC API ===
  return {
    initFromSeed: initFromSeed,
    hashSeed: hashSeed,
    addNode: addNode,
    removeNode: removeNode,
    updateEdge: updateEdge,
    emit: emit,
    propagate: propagate,
    addKnowledgeSource: addKnowledgeSource,
    observe: observe,
    teach: teach,
    getKnowledge: getKnowledge,
    whoKnows: whoKnows,
    getKnownItems: getKnownItems,
    isLost: function(item){ return !!_lost[item]; },
    takeEvents: takeEvents,
    addWorldMemory: addWorldMemory,
    updateWorldMemory: updateWorldMemory,
    getResonanceAt: getResonanceAt,
    getWorldMemoryNear: getWorldMemoryNear,
    getHiddenAccumulator: function(){ return _totalResonance; },
    serialize: serialize,
    deserialize: deserialize,
    getNodes: function(){ return _nodes; },
    getPendingRipples: function(){ return _events; },
    getWorldMemory: function(){ return _worldMemory; },
    getSeed: function(){ return _seed; },
    constants: {BOND_CARRY_MIN:BOND_CARRY_MIN, AMP_GAIN:AMP_GAIN, MAX_INTENSITY:MAX_INTENSITY, MAX_HOPS:MAX_HOPS,
                GRIEF_DECAY:GRIEF_DECAY, TEACH_RATE:TEACH_RATE, OBSERVE_RATE:OBSERVE_RATE}
  };
})();

if(typeof module !== 'undefined') module.exports = ResonanceWeb;
