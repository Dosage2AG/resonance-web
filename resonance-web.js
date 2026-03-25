// ===== ANIMA RESONANCE WEB — The Spider and Butterfly =====
// Shared module across all game versions. The game matrix engine.
// Every creature is a node. Every interaction creates edges.
// Every action ripples. The web remembers every vibration.
// Coined by Dosage2ag, 2026-03-21.

var ResonanceWeb = (function(){
  var _nodes = {};    // id -> {id, x, y, edges:{}, resonance:0, type:'creature'|'mark'|'site'}
  var _events = [];   // pending resonance events to propagate
  var _worldMemory = []; // persistent marks {x,y,type,strength,age,source}
  var _seed = null;   // world seed for cross-game connection
  var _totalResonance = 0; // hidden accumulator (guide page 48)

  // Seeded random for deterministic world generation
  var _seedState = 0;
  function seedRng(s){ _seedState = s; }
  function seededRandom(){
    _seedState = (_seedState * 1664525 + 1013904223) & 0x7fffffff;
    return _seedState / 0x7fffffff;
  }

  // === SEED SYSTEM ===
  // World name = procedural seed. Same name = same world across all games.
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
    return {
      seed: h,
      // Deterministic initial positions for creature clusters
      clusterCount: 3 + Math.floor(seededRandom() * 3), // 3-5 clusters
      clusters: [],
      // Generate cluster positions
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

  // === NODE MANAGEMENT ===
  function addNode(id, x, y, type){
    _nodes[id] = {id:id, x:x, y:y, edges:{}, resonance:0, type:type||'creature'};
    return _nodes[id];
  }

  function removeNode(id){
    // When a node is removed, send a shockwave through all its edges
    var node = _nodes[id];
    if(!node) return;
    var edgeIds = Object.keys(node.edges);
    for(var i = 0; i < edgeIds.length; i++){
      var targetId = edgeIds[i];
      var weight = node.edges[targetId];
      // Death shockwave — stronger edges carry more grief
      emit({x:node.x, y:node.y, intensity:weight*0.5, polarity:0, type:'death', sourceId:id});
      // Remove reverse edge
      if(_nodes[targetId] && _nodes[targetId].edges[id]){
        delete _nodes[targetId].edges[id];
      }
    }
    // Strongest memory becomes world memory (ancestral echo)
    if(node.resonance > 0.1){
      addWorldMemory(node.x, node.y, 'death', node.resonance * 0.3, id);
    }
    _totalResonance += node.resonance; // death feeds the accumulator
    delete _nodes[id];
  }

  function updateEdge(id1, id2, weight){
    if(!_nodes[id1] || !_nodes[id2]) return;
    _nodes[id1].edges[id2] = Math.min(1, weight);
    _nodes[id2].edges[id1] = Math.min(1, weight);
  }

  // === RESONANCE EVENTS ===
  function emit(event){
    // event: {x, y, intensity, polarity(-1 to 1), type, sourceId}
    _events.push({
      x: event.x, y: event.y,
      intensity: event.intensity || 0.5,
      polarity: event.polarity || 0, // -1=shadow, 0=neutral, 1=warmth
      type: event.type || 'tap',
      sourceId: event.sourceId || null,
      hops: 0,
      maxHops: 4
    });
  }

  function propagate(creatures){
    // Process all pending events
    var newEvents = [];
    for(var e = 0; e < _events.length; e++){
      var ev = _events[e];
      if(ev.intensity < 0.01 || ev.hops >= ev.maxHops) continue;

      // Find all creatures within range
      var range = 100 + ev.intensity * 200; // stronger = wider
      for(var i = 0; i < creatures.length; i++){
        var c = creatures[i];
        if(!c.alive || c.dying) continue;
        if(c.id === ev.sourceId) continue;
        var dx = c.x - ev.x, dy = c.y - ev.y;
        var d = Math.sqrt(dx*dx + dy*dy);
        if(d > range) continue;

        var falloff = 1 - d / range;
        var received = ev.intensity * falloff;

        // Node receives resonance
        var node = _nodes[c.id];
        if(node) node.resonance += received * 0.1;

        // Effect on creature based on polarity
        if(ev.polarity > 0.3){
          // Warmth resonance — comfort, attract, heal
          c.mood = Math.min(1, c.mood + received * 0.05);
          c.e = Math.min(c.maxE, c.e + received * 2);
        } else if(ev.polarity < -0.3){
          // Shadow resonance — scatter, stress, flee
          c.mood = Math.max(-1, c.mood - received * 0.08);
          var angle = Math.atan2(c.y - ev.y, c.x - ev.x);
          c.vx += Math.cos(angle) * received * 0.5;
          c.vy += Math.sin(angle) * received * 0.5;
        } else {
          // Neutral — awareness, slight mood shift
          c.mood += received * 0.02 * (Math.random() > 0.5 ? 1 : -1);
        }

        // Re-emit through bonds (the butterfly ripple)
        if(node && ev.hops < ev.maxHops - 1){
          var bondIds = Object.keys(node.edges);
          for(var b = 0; b < bondIds.length; b++){
            var bondWeight = node.edges[bondIds[b]];
            if(bondWeight > 0.2){
              var target = _nodes[bondIds[b]];
              if(target){
                newEvents.push({
                  x: target.x, y: target.y,
                  intensity: received * bondWeight * 0.5, // decay per hop
                  polarity: ev.polarity * 0.8, // polarity dilutes
                  type: ev.type,
                  sourceId: c.id,
                  hops: ev.hops + 1,
                  maxHops: ev.maxHops
                });
              }
            }
          }
        }
      }
    }
    _events = newEvents; // next tick processes the rippled events
    _totalResonance *= 0.999; // slow decay
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

  function getHiddenAccumulator(){ return _totalResonance; }

  // === SERIALIZATION (for seed system / save-load / cross-game) ===
  function serialize(){
    return JSON.stringify({
      seed: _seed,
      totalResonance: _totalResonance,
      worldMemory: _worldMemory,
      nodeCount: Object.keys(_nodes).length
    });
  }

  function deserialize(json){
    try{
      var data = JSON.parse(json);
      _seed = data.seed;
      _totalResonance = data.totalResonance || 0;
      _worldMemory = data.worldMemory || [];
      return true;
    }catch(e){ return false; }
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
    addWorldMemory: addWorldMemory,
    updateWorldMemory: updateWorldMemory,
    getResonanceAt: getResonanceAt,
    getWorldMemoryNear: getWorldMemoryNear,
    getHiddenAccumulator: getHiddenAccumulator,
    serialize: serialize,
    deserialize: deserialize,
    getNodes: function(){ return _nodes; },
    getWorldMemory: function(){ return _worldMemory; },
    getSeed: function(){ return _seed; }
  };
})();

// Export for use in all game versions
if(typeof module !== 'undefined') module.exports = ResonanceWeb;
