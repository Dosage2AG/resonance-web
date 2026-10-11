// Plain node tests, no dependencies. Run: node test.js
var RW = require('./resonance-web.js');
var assert = require('assert');

var passed = 0, failed = 0;
function test(name, fn){
  try{ fn(); passed++; console.log('PASS ' + name); }
  catch(e){ failed++; console.log('FAIL ' + name + '\n  ' + (e && e.message)); }
}

// Seeded PRNG for the tests themselves (mulberry32)
function rng(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeWorld(name, n, rand, w){
  RW.initFromSeed(name);
  var cs = [];
  for(var i = 0; i < n; i++){
    var c = {id:'n' + i, x:rand() * 400, y:rand() * 400, vx:0, vy:0, mood:0, e:50, maxE:100, alive:true};
    cs.push(c);
    RW.addNode(c.id, c.x, c.y, 'creature');
  }
  for(var a = 0; a < n; a++) for(var b = a + 1; b < n; b++){
    if(w !== undefined) RW.updateEdge(cs[a].id, cs[b].id, w);
    else if(rand() < 0.3) RW.updateEdge(cs[a].id, cs[b].id, rand());
  }
  return cs;
}

test('grief never raises mood (300 deaths, seeded)', function(){
  var rand = rng(42);
  for(var round = 0; round < 10; round++){
    var cs = makeWorld('grief-' + round, 31, rand);
    for(var k = 0; k < 30; k++){
      var victim = cs[Math.floor(rand() * cs.length)];
      if(!victim.alive){ k--; continue; }
      victim.alive = false;
      RW.removeNode(victim.id);
      for(var t = 0; t < 20; t++){
        var before = cs.map(function(c){ return c.mood; });
        RW.propagate(cs);
        cs.forEach(function(c, i){
          if(c.alive) assert.ok(c.mood <= before[i], c.id + ' mood rose from ' + before[i] + ' to ' + c.mood);
        });
      }
    }
  }
  var src = require('fs').readFileSync(__dirname + '/resonance-web.js', 'utf8');
  assert.ok(src.indexOf('Math.random') === -1, 'engine still uses Math.random');
});

test('grief scales with bond strength and decays', function(){
  RW.initFromSeed('g2');
  var cs = ['dead', 'close', 'far'].map(function(id){ RW.addNode(id, 0, 0); return {id:id, x:0, y:0, mood:0, alive:true}; });
  RW.updateEdge('dead', 'close', 1);
  RW.updateEdge('dead', 'far', 0.2);
  cs[0].alive = false;
  RW.removeNode('dead');
  var g0 = RW.getNodes().close.grief;
  RW.propagate(cs);
  assert.ok(cs[1].mood < cs[2].mood && cs[2].mood < 0, 'strong bond should grieve more');
  assert.ok(RW.getNodes().close.grief < g0, 'grief should decay');
  for(var i = 0; i < 400; i++) RW.propagate(cs);
  assert.strictEqual(RW.getNodes().close.grief, 0);
});

test('strong bonds amplify ripples (gain above 1)', function(){
  RW.initFromSeed('amp');
  var cs = [{id:'a', x:0, y:0, alive:true, mood:0}, {id:'b', x:1000, y:0, alive:true, mood:0}];
  RW.addNode('a', 0, 0); RW.addNode('b', 1000, 0);
  RW.updateEdge('a', 'b', 1);
  RW.emit({x:0, y:0, intensity:0.5, polarity:1});
  RW.propagate(cs);
  var r = RW.getPendingRipples();
  assert.strictEqual(r.length, 1);
  assert.ok(r[0].intensity > 0.5, 'ripple through bond 1.0 should exceed the received 0.5, got ' + r[0].intensity);
});

test('bounded amplification over 10,000 steps (dense web, all bonds at 1)', function(){
  var rand = rng(7);
  var cs = makeWorld('bounded', 30, rand, 1);
  var cap = RW.constants.MAX_INTENSITY, maxCount = 0;
  for(var step = 0; step < 10000; step++){
    if(step % 3 === 0) RW.emit({x:rand() * 400, y:rand() * 400, intensity:1, polarity:rand() * 2 - 1});
    RW.propagate(cs);
    var r = RW.getPendingRipples();
    if(r.length > maxCount) maxCount = r.length;
    assert.ok(r.length <= 3 * cs.length, 'ripple count ' + r.length);
    for(var i = 0; i < r.length; i++){
      assert.ok(isFinite(r[i].intensity) && r[i].intensity <= cap, 'intensity ' + r[i].intensity);
    }
    if(step % 100 === 0){
      var nodes = RW.getNodes();
      for(var id in nodes){
        var n = nodes[id];
        assert.ok(isFinite(n.resonance) && isFinite(n.mood) && n.mood >= -1 && n.mood <= 1, 'node ' + id);
      }
      assert.ok(isFinite(RW.getHiddenAccumulator()));
    }
  }
  assert.ok(maxCount > 0);
});

test('knowledge comes only from observation or teaching, and dies with its last holder', function(){
  RW.initFromSeed('know');
  RW.addNode('watcher', 0, 0);
  RW.addNode('pupil', 500, 500);
  RW.addNode('stranger', 900, 900);
  RW.updateEdge('watcher', 'pupil', 0.8);
  RW.addKnowledgeSource('fire', 0, 0, 50);

  assert.deepStrictEqual(RW.getKnowledge('watcher'), [], 'nothing known before observing');
  for(var i = 0; i < 99; i++) RW.observe();
  assert.deepStrictEqual(RW.getKnowledge('watcher'), [], 'not yet: needs time');
  RW.observe();
  assert.deepStrictEqual(RW.getKnowledge('watcher'), ['fire']);
  var ev = RW.takeEvents();
  assert.ok(ev.some(function(e){ return e.type === 'learned' && e.nodeId === 'watcher' && e.via === 'observation'; }));

  for(i = 0; i < 100; i++) RW.observe();
  assert.deepStrictEqual(RW.getKnowledge('pupil'), ['fire'], 'pupil taught through bond');
  assert.ok(RW.takeEvents().some(function(e){ return e.type === 'learned' && e.nodeId === 'pupil' && e.via === 'teaching' && e.from === 'watcher'; }));
  assert.deepStrictEqual(RW.getKnowledge('stranger'), [], 'no bond, no proximity: never learns');
  assert.strictEqual(RW.teach('stranger', 'watcher', 'fire'), false, 'cannot teach what you do not know');

  RW.removeNode('watcher');
  assert.ok(!RW.isLost('fire'), 'one holder left');
  assert.ok(!RW.takeEvents().some(function(e){ return e.type === 'knowledge-lost'; }));
  RW.removeNode('pupil');
  assert.ok(RW.isLost('fire'));
  var lost = RW.takeEvents().filter(function(e){ return e.type === 'knowledge-lost'; });
  assert.deepStrictEqual(lost, [{type:'knowledge-lost', item:'fire', lastHolder:'pupil'}]);

  RW.addNode('newcomer', 0, 0);
  for(i = 0; i < 500; i++) RW.observe();
  assert.deepStrictEqual(RW.getKnowledge('newcomer'), [], 'lost knowledge cannot be relearned');
});

test('serialize -> deserialize -> serialize is byte-identical and keeps the web', function(){
  var rand = rng(99);
  var cs = makeWorld('save', 25, rand);
  RW.addKnowledgeSource('salt', 200, 200, 300);
  RW.addKnowledgeSource('song', 100, 100, 150);
  for(var s = 0; s < 150; s++){ RW.observe(); RW.emit({x:200, y:200, intensity:0.7, polarity:0.5}); RW.propagate(cs); }
  cs[3].alive = false; RW.removeNode(cs[3].id);
  RW.propagate(cs);

  var a = RW.serialize();
  var nodesBefore = Object.keys(RW.getNodes()).length;
  var edgesBefore = 0, nb = RW.getNodes();
  for(var id in nb) edgesBefore += Object.keys(nb[id].edges).length;
  assert.ok(nodesBefore === 24 && edgesBefore > 0);
  assert.ok(Object.keys(RW.getKnownItems()).length > 0, 'web should know something');

  RW.initFromSeed('wiped');
  assert.strictEqual(Object.keys(RW.getNodes()).length, 0);
  assert.ok(RW.deserialize(a));
  var b = RW.serialize();
  assert.strictEqual(b, a, 'second serialize differs');
  var na = RW.getNodes(), edgesAfter = 0;
  for(id in na) edgesAfter += Object.keys(na[id].edges).length;
  assert.strictEqual(Object.keys(na).length, nodesBefore);
  assert.strictEqual(edgesAfter, edgesBefore);

  // The loaded web keeps evolving exactly like the original would.
  function run(){ for(var k = 0; k < 50; k++){ RW.observe(); RW.propagate(cs); } return RW.serialize(); }
  var csCopy = JSON.parse(JSON.stringify(cs));
  var fromLoaded = run();
  RW.deserialize(a); cs.forEach(function(c, i){ Object.assign(c, csCopy[i]); });
  assert.strictEqual(run(), fromLoaded, 'loaded web diverged');
  assert.strictEqual(RW.deserialize('not json'), false);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if(failed) process.exit(1);
