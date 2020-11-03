import * as THREE from './three/build/three.module.js';
import { ColladaLoader } from './three/examples/jsm/loaders/ColladaLoader.js';
import { EffectComposer } from './three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from './three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from './three/examples/jsm/postprocessing/ShaderPass.js';

import { VerticalBlurShader } from './three/examples/jsm/shaders/VerticalBlurShader.js';
import { HorizontalBlurShader } from './three/examples/jsm/shaders/HorizontalBlurShader.js';

let myname;
let isReady = false;

const cube_geometry = new THREE.BoxGeometry();
const cube_material = new THREE.MeshPhongMaterial( { color: 
new THREE.Color("rgb(173, 171, 114)") } );

let otherPlayers = {}, objects = [];

const socket = io('https://AskewServer.fuzzyastrocat.repl.co');

let currentNightCycle = 0,
    desiredNightCycle = 0;

socket.on('giveReady', () => {
  if(myname === undefined) return;
  socket.emit("ready", myname);
})

socket.on("nightCycle", n => {
  desiredNightCycle = n;
})

socket.on("incomingChat", msg => {
  if (!hasStarted) return;

  const elem = document.createElement("div");
  elem.innerText = msg;
  const chatarea = document.getElementById("chat-content");
  chatarea.appendChild(elem);
  chatarea.scrollTop = chatarea.scrollHeight;

  if (chatarea.children.length > 20) {
    chatarea.removeChild(chatarea.childNodes[0]);
  }
})

socket.on("players", players => {
  for(let plr in otherPlayers){
    if(plr === socket.id) continue;
    if(plr in players) continue;

    if(otherPlayers[plr].object.parent) {
      otherPlayers[plr].object.parent.remove(otherPlayers[plr].object);
      if(otherPlayers[plr].object.geometry) otherPlayers[plr].object.geometry.dispose();
      if(otherPlayers[plr].object.material) otherPlayers[plr].object.material.dispose();
    }

    if(otherPlayers[plr].tool.object.parent) {
      otherPlayers[plr].tool.object.parent.remove(otherPlayers[plr].tool.object);
    }

    otherPlayers[plr].label.parentNode.removeChild(otherPlayers[plr].label);
  }

  for(let plr in players){
    if(plr === socket.id) continue;
    if(plr in otherPlayers) {
      players[plr].object = otherPlayers[plr].object;
      // players[plr].object.position.set(players[plr].x, players[plr].up, players[plr].y)
      // players[plr].object.rotation.y = players[plr].r;

      if(players[plr].tool.type !== otherPlayers[plr].tool.type) {
        if(otherPlayers[plr].tool.object) otherPlayers[plr].tool.object.parent.remove(otherPlayers[plr].tool.object);

        const newTool = cloneify(itemTypes[players[plr].tool.type].modelData);
        newTool.position.set(players[plr].tool.pos.x, players[plr].tool.pos.y, players[plr].tool.pos.z);
        newTool.rotation.x = players[plr].tool.rot.x;
        newTool.rotation.y = players[plr].tool.rot.y;
        newTool.rotation.z = players[plr].tool.rot.z;
        players[plr].object.add(newTool);
        players[plr].tool.object = newTool;
      } else players[plr].tool.object = otherPlayers[plr].tool.object;

      players[plr].label = otherPlayers[plr].label;
    }

    else {
      const newCube = new THREE.Mesh(cube_geometry,cube_material);
      newCube.position.set(players[plr].x, players[plr].up, players[plr].y);
      newCube.rotation.y = players[plr].r;
      newCube.castShadow = true;
      scene.add(newCube);

      const newTool = cloneify(itemTypes[players[plr].tool.type].modelData);
      newTool.position.set(players[plr].tool.pos.x, players[plr].tool.pos.y, players[plr].tool.pos.z);
      newTool.rotation.x = players[plr].tool.rot.x;
      newTool.rotation.y = players[plr].tool.rot.y;
      newTool.rotation.z = players[plr].tool.rot.z;
      newCube.add(newTool);

      players[plr].object = newCube;
      players[plr].tool.object = newTool;

      const pos = toScreenPosition(newCube, camera);
      players[plr].label = createPlayerName(players[plr].name, Math.round(pos.x) + 'px', Math.round(pos.y) + 'px');
    }
  }

  otherPlayers = players;
  delete otherPlayers[socket.id];
})

let has_received_objs = false;

socket.on('objects', objs => {
  has_received_objs = true;
  for(let object of objects){
    if(object.object.parent) object.object.parent.remove(object.object);
  }

  objects = [];

  for(let object of objs){
    const newObject = cloneify(itemTypes[object.type].modelData);
    newObject.position.copy(object.pos);
    // rot has some "order" property so we do it this way
    newObject.rotation.x = object.rot.x;
    newObject.rotation.y = object.rot.y;
    newObject.rotation.z = object.rot.z;
    scene.add(newObject);

    objects.push({...itemTypes[object.type], object: newObject, targetPosition: object.pos, targetRotation: object.rot})
  }
})

socket.on('nonDestructObj', objs => {
  for(let index = 0; index < objs.length; index ++){
    if(!objects[index]) continue;
    objects[index].targetPosition = objs[index].pos;
    objects[index].targetRotation = objs[index].rot;
  }
})

socket.on('object', (index, object) => {
  if(!objects[index]) return;
  objects[index].targetPosition = object.pos;
  objects[index].targetRotation = object.rot;
})

socket.on('newObject', object => {
  const newObject = cloneify(itemTypes[object.type].modelData);
  newObject.position.copy(object.pos);

  newObject.rotation.x = object.rot.x;
  newObject.rotation.y = object.rot.y;
  newObject.rotation.z = object.rot.z;
  scene.add(newObject);

  objects.push({...itemTypes[object.type], object: newObject, targetPosition: object.pos, targetRotation: object.rot})
})

socket.on('delete', i => {
  const obj = objects[i];

  if(obj.object.geometry) obj.object.geometry.dispose();
  if(obj.object.material) obj.object.material.dispose();
  obj.object.parent.remove(obj.object);

  objects.splice(i, 1);
})

socket.on("addItem", (item, amount) => {
  addItems(item, amount);
})

const scene = new THREE.Scene();
scene.background = new THREE.Color ("rgb(247, 241, 223)");

scene.fog = new THREE.FogExp2(new THREE.Color("rgb(247, 241, 223)"), 0.03);

const cam = { factor: 11, ratio: window.innerHeight / window.innerWidth };
cam.width  = cam.factor;
cam.height = cam.factor * cam.ratio;
const camera = new THREE.OrthographicCamera(-cam.width, cam.width, cam.height, -cam.height, 0.1, 50);

const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const cube = new THREE.Mesh( cube_geometry, cube_material );
cube.position.set(0, 0.7, 0);
cube.castShadow = true;
scene.add( cube );

const itemTypes = {
  'pick': {
    placeable: false,
    holdable: true,

    scale: 0.1,

    model: './models/pick.dae',
    image: './images/item_pick.png'
  },

  'steel': {
    placeable: false,
    holdable: false,

    model: undefined,
    image: './images/item_steel.png'
  },

  'ash': {
    placeable: false,
    holdable: false,

    model: undefined,
    image: './images/item_ash.png'
  },

  'wood': {
    placeable: false,
    holdable: false,

    model: undefined,
    image: './images/item_wood.png'
  },

  'stone': {
    placeable: false,
    holdable: false,

    model: undefined,
    image: './images/item_stone.png'
  },

  'workbench': {
    placeable: true,
    holdable: false,

    scale: 0.6,

    model: './models/workbench.dae',
    image: './images/item_workbench.png',
  },

  'steelwall': {
    placeable: true,
    holdable: false,

    model: './models/steelwall.dae',
    image: './images/item_steelwall.png',
  },

  'wall': {
    placeable: true,
    holdable: false,

    model: './models/wall.dae',
    image: './images/item_wall.png',
  },

  'roof': {
    placeable: true,
    holdable: false,

    walkthrough: true,
    scale: 0.7,

    model: './models/roof.dae',
    image: './images/item_roof.png'
  },

  'fire': {
    placeable: true,
    holdable: false,

    scale: 0.3,

    model: './models/fire.dae',
    image: './images/item_fire.png',
  },

  'oven': {
    placeable: true,
    holdable: false,

    scale: 0.3,

    model: './models/oven.dae',
    image: './images/item_oven.png',
  },

  'saw': {
    placeable: false,
    holdable: true,

    scale: 0.1,

    model: './models/saw.dae',
    image: './images/item_saw.png',
    onHit: () => {}
  },

  'bush': {
    placeable: false,
    holdable: false,

    scale: 0.5,

    model: './models/bush.dae',
    image: undefined,
  },

  'tree': {
    placeable: false,
    holdable: false,

    scale: 2,

    model: './models/tree.dae',
    image: undefined,
  },

  'rock': {
    placeable: false,
    holdable: false,

    model: './models/rock.dae',
    image: undefined,
  }
}

for(let key in itemTypes){
  itemTypes[key].name = key;
}

// https://stackoverflow.com/questions/27409074/converting-3d-position-to-2d-screen-position-r69
function toScreenPosition(obj, camera)
{
    var vector = new THREE.Vector3();

    var widthHalf = 0.5*renderer.getContext().canvas.width;
    var heightHalf = 0.5*renderer.getContext().canvas.height;

    obj.updateMatrixWorld();
    vector.setFromMatrixPosition(obj.matrixWorld);
    vector.project(camera);

    vector.x = ( vector.x * widthHalf ) + widthHalf;
    vector.y = - ( vector.y * heightHalf ) + heightHalf;

    return { 
        x: vector.x,
        y: vector.y
    };

};


// https://stackoverflow.com/questions/22360936/will-three-js-object3d-clone-create-a-deep-copy-of-the-BoxGeometry
// Funnily enough, the 0-upvote answer is the only one that worked.

THREE.Object3D.prototype.deepClone = function (recursive) {
  return new this.constructor().deepCopy(this, recursive);
},
THREE.Object3D.prototype.deepCopy = function(source, recursive) {
  if (recursive === undefined) recursive = true;

  this.name = source.name;

  this.up.copy( source.up );

  this.position.copy( source.position );
  this.quaternion.copy( source.quaternion );
  this.scale.copy( source.scale );

  this.matrix.copy( source.matrix );
  this.matrixWorld.copy( source.matrixWorld );
  if(source.material){
    //changed
    this.material = source.material.clone()
  }
  if(source.geometry){
    //changed
    this.geometry = source.geometry.clone()
  }
  
  // lighting, my edits
  this.intensity = source.intensity;
  this.color = source.color;
  this.distance = source.distance;

  this.matrixAutoUpdate = source.matrixAutoUpdate;
  this.matrixWorldNeedsUpdate = source.matrixWorldNeedsUpdate;

  this.layers.mask = source.layers.mask;
  this.visible = source.visible;

  this.castShadow = source.castShadow;
  this.receiveShadow = source.receiveShadow;

  this.frustumCulled = source.frustumCulled;
  this.renderOrder = source.renderOrder;

  this.userData = JSON.parse( JSON.stringify( source.userData ) );

  if (recursive === true) {
    for (let i = 0; i < source.children.length; i ++) {
      let child = source.children[i];
      this.add(child.deepClone()); //changed
    }
  }

  return this;
}

const cloneify = obj => {
  return obj.deepClone(true);
};

let activeTool, placingItem;
const loadingManager = new THREE.LoadingManager(() => {
  let saw = cloneify(itemTypes.saw.modelData);
  saw.rotation.set(0, Math.PI / 8, Math.PI / 8);
  saw.position.set(0.7, 0.1, 0.43);

  activeTool = saw;

  socket.emit("tool", "saw", {x: 0.7, y: 0.1, z: 0.43}, {x: 0, y: Math.PI / 8, z: Math.PI / 8});

  cube.add(saw);

  animate();
});

const loader = new ColladaLoader(loadingManager);
let numLoaded = 0;
for(let item in itemTypes){
  if(itemTypes[item].model){
    loader.load(itemTypes[item].model, collada => {
      let chldrn = [];
      collada.scene.traverse(o => chldrn.push(o));
      collada.scene.children = chldrn.filter(c => c !== collada.scene);
      itemTypes[item].modelData = collada.scene;
      const scale = itemTypes[item].scale ? (typeof itemTypes[item].scale === "object" ? itemTypes[item].scale : new Array(3).fill(itemTypes[item].scale) ) : [1, 1, 1];
      itemTypes[item].modelData.scale.set(...scale);

      itemTypes[item].modelData.traverse(o => {
        if(o.intensity !== undefined) {
          o.intensity = 0.3;
          o.color = new THREE.Color("rgb(252, 219, 3)");
          o.distance = 20;
        }
      })

      const ghost = cloneify(itemTypes[item].modelData);
      ghost.position.set(2, 0, 0);
      ghost.traverse(o => { if(o.intensity !== undefined) o.intensity = 0; if(!o.material) return; o.material.transparent = true; o.material.opacity = 0; o.visible = false; });
      cube.add(ghost); // Ghost placement version

      itemTypes[item].ghost = ghost;

      numLoaded ++;
      if(numLoaded === Object.values(itemTypes).filter(x => x.model).length){
        isReady = true;
      }
    })
  }
}

const geo = new THREE.PlaneBufferGeometry(2000, 2000);
const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color("rgb(247, 239, 215)"), side: THREE.DoubleSide });
const plane = new THREE.Mesh(geo, mat);
plane.position.set(0, 0, 0);
plane.rotation.set(Math.PI / -2, 0, 0)
plane.receiveShadow = true;
scene.add(plane);
 
const overheadLight = new THREE.DirectionalLight(new THREE.Color("rgb(247, 241, 223)"), 0.5);

overheadLight.shadow.camera.left = -18;
overheadLight.shadow.camera.bottom = -18;
overheadLight.shadow.camera.right = 18;
overheadLight.shadow.camera.top = 18;

overheadLight.position.set(0, 1, 0);
overheadLight.castShadow = true;
scene.add(overheadLight);
scene.add(overheadLight.target);

const ambientLight = new THREE.AmbientLight(0xDDDDFF, 0.1);
scene.add(ambientLight);

let camRotVel = 0;
camera.position.set(-8, 8, 8);
camera.lookAt(0, 0, 0);


const itembar = new Array(10).fill().map((_, i) => document.getElementById("itembar-" + i)),
      itembar_number = new Array(10).fill().map((_, i) => document.getElementById("itembar-number-" + i)),
      itemClickListeners = new Array(10);
const items = new Array(10).fill().map(_ => ({name: false, amount: 0}));

function addItems(name, number){
  let item = items.find(i => i.name === name),
      index = item ? items.indexOf(item) : false;
  if(!item) {
    index = items.indexOf(items.find(i => !i.name));

    itembar[index].innerHTML = "<img src='" + itemTypes[name].image + "'></img>";
    itemClickListeners[index] = itemTypes[name].placeable ? () => {
      setTimeout(() => {placingItem = name; addItems(placingItem, -1)}, 10);
    } : ( itemTypes[name].holdable ? () => {
      if(activeTool.geometry) activeTool.geometry.dispose();
      if(activeTool.material) activeTool.material.dispose();
      activeTool.parent.remove(activeTool);

      let newtool = cloneify(itemTypes[name].modelData);

      newtool.rotation.set(0, Math.PI / 8, Math.PI / 8);
      newtool.position.set(0.7, 0.1, 0.43);

      activeTool = newtool;
      cube.add(activeTool);

      socket.emit("tool", name, activeTool.position, activeTool.rotation);
    } : () => {} );
    itembar[index].addEventListener("click", itemClickListeners[index]);
    items[index].name = name;
    items[index].amount = 0;

    item = items[index];
  }

  item.amount += number;
  itembar_number[index].innerHTML = "&nbsp;&nbsp;x" + item.amount;

  if(item.amount <= 0){
    items[index].name = false;
    itembar[index].innerHTML = "";
    itembar_number[index].innerHTML = "";
    itembar[index].removeEventListener("click", itemClickListeners[index]);
    itemClickListeners[index] = undefined;
  }

  updateRecipes();
}

function getItemNo(name){
  const item = items.find(i => i.name === name);
  return item ? item.amount : false;
}

const recipes = {
  "workbench": {"wood": 20},
  "wall": {"wood": 30, "workbench": "+"},
  "fire": {"wood": 50, "stone": 5},
  "roof": {"wood": 20, "workbench": "+"},
  "oven": {"ash": 5, "stone": 15, "workbench": "+"},
  "steel": {"stone": 5, "oven": "+"},
  "steelwall": {"steel": 10, "workbench": "+"},
  "pick": {"wood": 20, "workbench": "+"}
},
      activeRecipes = {};

function updateRecipes(){
  for(let recipe in recipes){
    let can = true;
    for(let resource in recipes[recipe]){
      if (recipes[recipe][resource] === "+") {
        if (!nearbyObjects.find(o => o.name === resource)) {
          can = false;
          break;
        }
      }
      else if(getItemNo(resource) < recipes[recipe][resource]) {
        can = false;
        break;
      }
    }

    if(can && !activeRecipes[recipe]){
      const objbardiv = document.createElement('div');
      objbardiv.className = "objbar";
      objbardiv.id = "objbar-" + recipe;
      objbardiv.innerHTML = "<img src='" + itemTypes[recipe].image + "'></img>";
      objbardiv.addEventListener("click", evt => {
        socket.emit("craft", recipe);

        for(let resource in recipes[recipe]){
          if (recipes[recipe][resource] === "+") continue;
          addItems(resource, -recipes[recipe][resource]);
        }

        addItems(recipe, 1);
      });
      document.body.appendChild(objbardiv);
      activeRecipes[recipe] = true;
    } else if (!can && activeRecipes[recipe]){
      document.getElementById("objbar-" + recipe).remove()
      delete activeRecipes[recipe];
    }
  }

  let x = 15, y = 15;
  for(let elem of document.getElementsByClassName("objbar")){
    elem.style.top = y + "px";
    elem.style.left = x + "px";
    y += 70;
    if (y > 350) {
      y = 15;
      x += 70;
    }
  }
}

const composer = new EffectComposer( renderer );
composer.addPass( new RenderPass( scene, camera ) );

const hblur = new ShaderPass( HorizontalBlurShader );
composer.addPass( hblur );

const vblur = new ShaderPass( VerticalBlurShader );
vblur.renderToScreen = true;
composer.addPass( vblur );

const playerSpeed = {x: 0, y: 0},
      targetSpeed = {x: 0, y: 0};

const raycaster = new THREE.Raycaster();

let tick = 0;

let hasStarted = false;
let uniform = 0.5;

let nearbyObjects = [];

function updateBlurUniforms() {
  hblur.uniforms.h.value = uniform / (window.innerWidth / 2);
  vblur.uniforms.v.value = uniform / (window.innerHeight / 2);
}

updateBlurUniforms();

let then = 0;
const responsiveFactor = 5; // "twitchiness"
function animate(now) {
  if(myname !== undefined && !has_received_objs && tick % 80 === 0 && isReady) { // if the server was sleeping
    socket.emit("ready", myname);
  }

	requestAnimationFrame( animate );

  now *= 0.001;
  const delta = (now - then) * responsiveFactor;
  then = now;
	
  if (hasStarted) { 
    if (uniform > 0.05) {
      uniform /= 1.05;
      updateBlurUniforms();
      composer.render();
    }
    else renderer.render( scene, camera );
  }
  else {
    if (uniform < 0.5) {
      uniform *= 1.05;
      updateBlurUniforms();
    }
    composer.render();
  }
  
  overheadLight.color.r = 0.968 * (1 - currentNightCycle) + 0.207 * currentNightCycle;
  overheadLight.color.g = 0.945 * (1 - currentNightCycle) + 0.098 * currentNightCycle;
  overheadLight.color.b = 0.875 * (1 - currentNightCycle) + 0.510 * currentNightCycle;

  currentNightCycle += (desiredNightCycle - currentNightCycle) / 50;

  scene.fog.color.r = overheadLight.color.r;
  scene.fog.color.g = overheadLight.color.g;
  scene.fog.color.b = overheadLight.color.b;


  if(placingItem){
    itemTypes[placingItem].ghost.traverse(o => { if(!o.material) return; o.visible = true; o.material.opacity = (0.35 - o.material.opacity) / 4; });
  }

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersects = raycaster.intersectObjects(objects.map(o => o.object).concat([cube]), true).map(i => i.object);

  for(let { object } of objects){
    let isIntersecting = false;
    object.traverse(o => {
      if(intersects.includes(o)) isIntersecting = true;
    })

    if(isIntersecting) {
      object.traverse(o => {
        if(!o.material) return;
        o.material.transparent = true;
        o.material.opacity += (0.1 - o.material.opacity) / 4;
      })
    } else {
      object.traverse(o => {
        if(!o.material) return;
        o.material.opacity += (1 - o.material.opacity) / 4;
      })
    }
  }

  playerSpeed.x += (targetSpeed.x - playerSpeed.x) / 8;
  playerSpeed.y += (targetSpeed.y - playerSpeed.y) / 8;
  
  let blockingBush = false; // I keep this name for nostalgia
  let i = 0;
  const oldobjs = nearbyObjects;
  nearbyObjects = [];
  for(let object of objects){
    if (object.object.position.distanceTo(cube.position) < 3) {
      nearbyObjects.push(object);
    }

    if(!object.walkthrough && object.object.position.distanceTo(cube.position) < 1.5 && playerSpeed.x * (object.object.position.x - cube.position.x) + playerSpeed.y * (object.object.position.z - cube.position.z) > 0) {
      blockingBush = i;
      break;
    }
    i ++;
  }

  if(oldobjs.length !== nearbyObjects.length || oldobjs.find(x => !nearbyObjects.find(e => e === x))) {
    updateRecipes();
  }

  const isMoving = targetSpeed.x || targetSpeed.y;

  if(!isMoving) cube.position.y += (Math.sin(tick / 35) / 7 + 0.8 - cube.position.y) / 8;
  else cube.position.y += (Math.sin(tick / 5) / 9 + 0.8 - cube.position.y) / 8

  if(!mouseIsPressed) activeTool.position.add(new THREE.Vector3((0.7 + 0.1 * Math.cos(tick / 35) - activeTool.position.x) / 8, (0.1 + 0.1 * Math.sin(tick / 30) - activeTool.position.y) / 8, (0.43 - activeTool.position.z) / 8));
  else activeTool.position.add(new THREE.Vector3((0.7 + 0.2 * Math.sin(tick / 5) - activeTool.position.x) / 8, (0.1 + 0.2 * Math.sin(tick / 5) - activeTool.position.y) / 8, (0.43 - 0.1 * Math.sin(tick / 5) - activeTool.position.z) / 8));


  if(isDown["q"]){
    camRotVel -= delta;
  }
  if(isDown["e"]){
    camRotVel += delta;
  }

  camera.position.x -= cube.position.x;
  camera.position.z -= cube.position.z;

  if (camRotVel < -0.7 * delta) camRotVel = -0.7 * delta;
  if (camRotVel > 0.7 * delta) camRotVel = 0.7 * delta;

  camera.position.applyAxisAngle(THREE.Object3D.DefaultUp, camRotVel);

  camRotVel /= 1.1;

  if(blockingBush === false){
    cube.position.x += playerSpeed.x; 
    cube.position.z += playerSpeed.y;
  } else if (mouseIsPressed && tick % 20 === 0){
    socket.emit("hit", blockingBush);
  }

  camera.position.x += cube.position.x;
  camera.position.z += cube.position.z;

  camera.lookAt(new THREE.Vector3(cube.position.x, 0.8, cube.position.z));


  targetSpeed.x = 0;
  targetSpeed.y = 0;

  if(isDown["ArrowUp"] || isDown["w"]){
    targetSpeed.y -= 1 * delta;
  } else if (isDown["ArrowDown"] || isDown["s"]) {
    targetSpeed.y += 1 * delta;
  } /* else if(isDown["ArrowRight"] || isDown["d"]){
    targetSpeed.x += 0.1;
  } else if (isDown["ArrowLeft"] || isDown["a"]) {
    targetSpeed.x -= 0.1;
  } */

  if(isDown["ArrowRight"] || isDown["d"]){
    cube.rotation.y -= 1 * delta;
  }
  if(isDown["ArrowLeft"] || isDown["a"]){
    cube.rotation.y += 1 * delta;
  }

  const x = targetSpeed.x, y = targetSpeed.y, ang = -cube.rotation.y + Math.PI / 2;
  targetSpeed.x = x * Math.cos(ang) - y * Math.sin(ang);
  targetSpeed.y = x * Math.sin(ang) + y * Math.cos(ang);

  /* if(targetSpeed.x || targetSpeed.y) {
    let rotation = Math.atan2(- targetSpeed.y, targetSpeed.x);

    if(rotation - cube.rotation.y > Math.PI) rotation -= 2 * Math.PI;
    if(cube.rotation.y - rotation > Math.PI) rotation += 2 * Math.PI;

    cube.rotation.y += (rotation - cube.rotation.y) / 8
  }*/
  

  overheadLight.position.set(cube.position.x, 5, cube.position.z);
  overheadLight.target.position.copy(cube.position);

  tick ++;

  if(tick % 10 === 0){
    socket.emit("positionUpdate", cube.position.x, cube.position.z, cube.position.y, cube.rotation.y, activeTool.position, {x: activeTool.rotation._x, y: activeTool.rotation._y, z: activeTool.rotation._z});
  }

  for(const id in otherPlayers){
    const {x, y, up, r, object} = otherPlayers[id];
    object.position.add(new THREE.Vector3((x - object.position.x) / 8, (up - object.position.y) / 8, (y - object.position.z) / 8));
    object.rotation.y += (r - object.rotation.y) / 8;

    const {pos, rot} = otherPlayers[id].tool,
          tool = otherPlayers[id].tool.object;

    // fix NaN's
    tool.rotation.x = tool.rotation.x || 0;
    tool.rotation.y = tool.rotation.y || 0;
    tool.rotation.z = tool.rotation.z || 0;

    tool.position.x = tool.position.x || 0;
    tool.position.y = tool.position.y || 0;
    tool.position.z = tool.position.z || 0;

    tool.position.add(new THREE.Vector3((pos.x - tool.position.x) / 8, (pos.y - tool.position.y) / 8, (pos.z - tool.position.z) / 8));

    tool.rotation.x += (rot.x - tool.rotation.x) / 8;
    tool.rotation.y += (rot.y - tool.rotation.y) / 8;
    tool.rotation.z += (rot.z - tool.rotation.z) / 8;

    const screenpos = toScreenPosition(object, camera);
    otherPlayers[id].label.style.left = screenpos.x + 'px';
    otherPlayers[id].label.style.top  = screenpos.y + 'px';
  }

  for(const obj of objects){
    const object = obj.object;
    object.position.add(new THREE.Vector3((obj.targetPosition.x - object.position.x) / 8, (obj.targetPosition.y - object.position.y) / 8, (obj.targetPosition.z - object.position.z) / 8));
  }
}

const isDown = {};
let   mouseIsPressed = false;

let justBlurred = false;

// once "hasStarted"
function addListeners() {
  const chatinput = document.getElementById("template-chat");
  chatinput.style.display = "block";

  const allChats = document.getElementById("chat");
  document.addEventListener("keydown", evt => {
    if(evt.key === "Enter") {
      if(!justBlurred) chatinput.focus();
      else justBlurred = false;
    }
    if (document.activeElement === chatinput) return;
    if (evt.key == 'h') {
      console.log(allChats.style.display);
      console.log(chatinput.style.display);
      allChats.style.display = allChats.style.display === "none" ? "block" : "none";
      chatinput.style.display = chatinput.style.display === "none" ? "block" : "none";
    }
    isDown[evt.key] = true;
  })

  chatinput.addEventListener("keydown", evt => {
    var keyCode = evt.keyCode || evt.which;
    if (keyCode == '13'){
      if(chatinput.value !== "")
        socket.emit("chat", myname + ": " + chatinput.value);
      chatinput.value = "";
      
      chatinput.blur();
      justBlurred = true;
      return false;
    }
  })

  document.addEventListener("keyup", evt => {
    delete isDown[evt.key];
  })

  // For some reason "click" is not registering rightclick
  document.addEventListener("contextmenu", evt => {
    evt.preventDefault();

    if(!placingItem) return false;

    addItems(placingItem, 1);
    itemTypes[placingItem].ghost.traverse(o => { if(!o.material) return; o.visible = false; o.material.opacity = 0; });
    placingItem = false;
    
    return false;
  })

  let isRightClicking = false;
  document.addEventListener("mousedown", evt => {
    if(!placingItem) {
      mouseIsPressed = true;
      isRightClicking = evt.button === 2;
    } else {
      if(evt.button === 0){ // left
        socket.emit("build", placingItem, cube.position.clone().add(new THREE.Vector3(2 * Math.cos(cube.rotation.y), 0, 2 * Math.sin(-cube.rotation.y))), {x: itemTypes[placingItem].modelData.rotation._x, y: itemTypes[placingItem].modelData.rotation._y, z: itemTypes[placingItem].modelData.rotation._z});
      }

      itemTypes[placingItem].ghost.traverse(o => { if(!o.material) return; o.visible = false; o.material.opacity = 0; });
      placingItem = false;
    }
  })

  document.addEventListener("mouseup", evt => {
    mouseIsPressed = false;
    camDragging = false;
  })

  let camDragging = false;
  document.addEventListener("mousemove", evt => {
    if (mouseIsPressed && isRightClicking) {
      if (camDragging === false) {
        camDragging = evt.clientX;
        return
      }

      camRotVel += 2 * (camDragging - evt.clientX) / window.innerWidth;    

      camDragging = evt.clientX;
    }
  })

}


function createPlayerName(name, x, y) {
  const elem = document.createElement('div');
  elem.classList.add("playerName");
  elem.innerText = name;
  elem.style.top = y;
  elem.style.left = x;
  document.body.appendChild(elem);
  return elem;
}


const playfn = evt => {
  for (let item of document.getElementsByClassName("beginningFadeable")) {
    item.style.top = "150vh";
    item.style.opacity = "0";
  }

  for (let item of document.getElementsByClassName("itembar")) {
    item.style.display = "block";
  }

  addItems("saw", 1);

  const craftButton = document.getElementById("openCrafting");
  craftButton.style.display = "block";
  let isOpen = false;
  craftButton.addEventListener("click", () => {
    for (let elem of document.getElementsByClassName("playerName")) {
      if(isOpen) elem.style.opacity = "1";
      else elem.style.opacity = "0";
    }

    hasStarted = !hasStarted;
    craftButton.innerText = isOpen ? "<" : "X";

    if(!isOpen) {
      for(let button of document.getElementsByClassName("crafting-button")) {
        button.style.display = "block";
      }
    }

    else {
      for(let element of document.getElementsByClassName("crafting-display")) {
        element.style.opacity = "0";
      }

      for(let button of document.getElementsByClassName("crafting-button")) {
        button.style.display = "none";
      }
    }

    isOpen = !isOpen;
  })

  for(let button of document.getElementsByClassName("crafting-button")) {
    button.addEventListener("click", () => {
      for(let button of document.getElementsByClassName("crafting-button")) {
        button.style.display = "none";
      }

      for(let element of document.getElementsByClassName("crafting-category-" + button.innerText)) {
        element.style.opacity = "1";
      }
    });
  }

  addListeners();

  hasStarted = true;

  myname = document.getElementById("userInput").value;
  createPlayerName(myname, '50vw', '50vh');
};

document.getElementById("playButton").addEventListener("click", playfn) 

document.getElementById("userInput").addEventListener("keyup", evt => {
  if ((evt.keyCode || evt.which) == '13') {
    playfn();
    document.getElementById("userInput").blur();
  }
})



window.addEventListener('resize', onWindowResize);

function onWindowResize(){
  cam.ratio = window.innerHeight / window.innerWidth;

  cam.width  = cam.factor;
  cam.height = cam.factor * cam.ratio;
  
  camera.left = -cam.width;
  camera.right = cam.width;
  camera.top = cam.height;
  camera.bottom = -cam.height;

  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}