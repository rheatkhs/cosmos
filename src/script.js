import * as THREE from 'three';
import * as dat from 'dat.gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';

import bgTexture1 from '/images/1.jpg';
import bgTexture2 from '/images/2.jpg';
import bgTexture3 from '/images/3.jpg';
import bgTexture4 from '/images/4.jpg';
import sunTexture from '/images/sun.jpg';
import mercuryTexture from '/images/mercurymap.jpg';
import mercuryBump from '/images/mercurybump.jpg';
import venusTexture from '/images/venusmap.jpg';
import venusBump from '/images/venusmap.jpg';
import venusAtmosphere from '/images/venus_atmosphere.jpg';
import earthTexture from '/images/earth_daymap.jpg';
import earthNightTexture from '/images/earth_nightmap.jpg';
import earthAtmosphere from '/images/earth_atmosphere.jpg';
import earthMoonTexture from '/images/moonmap.jpg';
import earthMoonBump from '/images/moonbump.jpg';
import marsTexture from '/images/marsmap.jpg';
import marsBump from '/images/marsbump.jpg';
import jupiterTexture from '/images/jupiter.jpg';
import ioTexture from '/images/jupiterIo.jpg';
import europaTexture from '/images/jupiterEuropa.jpg';
import ganymedeTexture from '/images/jupiterGanymede.jpg';
import callistoTexture from '/images/jupiterCallisto.jpg';
import saturnTexture from '/images/saturnmap.jpg';
import satRingTexture from '/images/saturn_ring.png';
import uranusTexture from '/images/uranus.jpg';
import uraRingTexture from '/images/uranus_ring.png';
import neptuneTexture from '/images/neptune.jpg';
import plutoTexture from '/images/plutomap.jpg';

// ******  SETUP  ******
console.log("Create the scene");
const scene = new THREE.Scene();

console.log("Create a perspective projection camera");
var camera = new THREE.PerspectiveCamera( 45, window.innerWidth/window.innerHeight, 0.1, 1000 );
camera.position.set(-175, 115, 5);

console.log("Create the renderer");
const renderer = new THREE.WebGL1Renderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.toneMapping = THREE.ACESFilmicToneMapping;

console.log("Create an orbit control");
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.75;
controls.screenSpacePanning = false;

console.log("Set up texture loader");
const cubeTextureLoader = new THREE.CubeTextureLoader();
const loadTexture = new THREE.TextureLoader();

// ******  POSTPROCESSING setup ******
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// ******  OUTLINE PASS  ******
const outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
outlinePass.edgeStrength = 3;
outlinePass.edgeGlow = 1;
outlinePass.visibleEdgeColor.set(0xffffff);
outlinePass.hiddenEdgeColor.set(0x190a05);
composer.addPass(outlinePass);

// ******  BLOOM PASS  ******
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1, 0.4, 0.85);
bloomPass.threshold = 1;
bloomPass.radius = 0.9;
composer.addPass(bloomPass);

// ****** AMBIENT LIGHT ******
console.log("Add the ambient light");
var lightAmbient = new THREE.AmbientLight(0x222222, 6); 
scene.add(lightAmbient);

// ******  Star background  ******
scene.background = cubeTextureLoader.load([

  bgTexture3,
  bgTexture1,
  bgTexture2,
  bgTexture2,
  bgTexture4,
  bgTexture2
]);

// ****** SETTINGS FOR INTERACTIVE CONTROLS  ******
const settings = {
  accelerationOrbit: 1,
  acceleration: 1,
  sunIntensity: 1.9
};

// mouse movement
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
}

// ******  SELECT PLANET  ******
let selectedPlanet = null;
let isMovingTowardsPlanet = false;
let targetCameraPosition = new THREE.Vector3();
let offset;

// Spaceship Flight Mode state
let isFlightMode = false;
let flightSpeed = 0;
const maxSpeed = 3.0;
const boostMaxSpeed = 8.0;
const acceleration = 0.05;
const drag = 0.96;

let pitchSpeed = 0;
let yawSpeed = 0;
let rollSpeed = 0;
const rotAcceleration = 0.0015;
const rotDrag = 0.88;

const keysPressed = {
  w: false,
  s: false,
  a: false,
  d: false,
  q: false,
  e: false,
  Shift: false,
  ArrowUp: false,
  ArrowDown: false
};

let isMouseDown = false;
let prevMousePosition = { x: 0, y: 0 };

// ====== HYPERSPACE WARP STATE ======
let isWarping = false;
let warpProgress = 0;
let warpStartPos = new THREE.Vector3();
let warpEndPos = new THREE.Vector3();
let warpTargetPlanetObj = null;
let warpOriginalBloomRadius = 0.9;
let warpOriginalBloomStrength = 1.0;
let warpApproachDir = new THREE.Vector3();
let streakScale = 1.0;

let flightLockedTarget = null;

function lockFlightTarget(name) {
  const planetMap = {
    'Sun': { name: 'Sun', planet: sun },
    'Mercury': mercury,
    'Venus': venus,
    'Earth': earth,
    'Mars': mars,
    'Jupiter': jupiter,
    'Saturn': saturn,
    'Uranus': uranus,
    'Neptune': neptune,
    'Pluto': pluto
  };

  const target = planetMap[name];
  if (target) {
    flightLockedTarget = target;
    const el = document.getElementById('flight-target');
    if (el) el.innerText = name.toUpperCase();
    
    const warpBtn = document.getElementById('btn-warp-hud');
    if (warpBtn) warpBtn.disabled = false;
  }
}

// ====== HYPERSPACE PARTICLE SYSTEM ======
const warpParticleCount = 800;
const warpGeometry = new THREE.BufferGeometry();
const warpPositions = new Float32Array(warpParticleCount * 6);
const warpOriginalLengths = new Float32Array(warpParticleCount);

for (let i = 0; i < warpParticleCount; i++) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 5 + Math.random() * 60;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  const z = Math.random() * -300;
  
  const lineLength = 5 + Math.random() * 25;
  warpOriginalLengths[i] = lineLength;
  
  // Vertex 1 (Start)
  warpPositions[i * 6 + 0] = x;
  warpPositions[i * 6 + 1] = y;
  warpPositions[i * 6 + 2] = z;
  
  // Vertex 2 (End)
  warpPositions[i * 6 + 3] = x;
  warpPositions[i * 6 + 4] = y;
  warpPositions[i * 6 + 5] = z - lineLength;
}

warpGeometry.setAttribute('position', new THREE.BufferAttribute(warpPositions, 3));
const warpMaterial = new THREE.LineBasicMaterial({
  color: 0x00f0ff,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  linewidth: 1
});

const warpLines = new THREE.LineSegments(warpGeometry, warpMaterial);
warpLines.visible = false;
scene.add(warpLines);

function onDocumentMouseDown(event) {
  if (isFlightMode) return;
  if (event.target !== renderer.domElement) {
    return;
  }
  event.preventDefault();

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  var intersects = raycaster.intersectObjects(raycastTargets);

  if (intersects.length > 0) {
    const clickedObject = intersects[0].object;
    const clickedPlanet = identifyPlanet(clickedObject);
    if (clickedPlanet) {
      if (isWarping) return;
      closeInfoNoZoomOut();
      selectedPlanet = clickedPlanet;
      triggerWarpJump();
    }
  }
}

function identifyPlanet(clickedObject) {
  // Logic to identify which planet was clicked based on the clicked object, different offset for camera distance
        if (clickedObject.material === mercury.planet.material) {
          offset = 10;
          return mercury;
        } else if (clickedObject.material === venus.Atmosphere.material) {
          offset = 25;
          return venus;
        } else if (clickedObject.material === earth.Atmosphere.material) {
          offset = 25;
          return earth;
        } else if (clickedObject.material === mars.planet.material) {
          offset = 15;
          return mars;
        } else if (clickedObject.material === jupiter.planet.material) {
          offset = 50;
          return jupiter;
        } else if (clickedObject.material === saturn.planet.material) {
          offset = 50;
          return saturn;
        } else if (clickedObject.material === uranus.planet.material) {
          offset = 25;
          return uranus;
        } else if (clickedObject.material === neptune.planet.material) {
          offset = 20;
          return neptune;
        } else if (clickedObject.material === pluto.planet.material) {
          offset = 10;
          return pluto;
        } 

  return null;
}

// ******  SHOW PLANET INFO AFTER SELECTION  ******
function showPlanetInfo(planet) {
  var info = document.getElementById('planetInfo');
  var name = document.getElementById('planetName');
  var summary = document.getElementById('planetSummary');

  name.innerText = planet;
  
  if (planet === 'Sun') {
    summary.innerText = "The star at the center of the Solar System, around which the Earth and other planets orbit.";
    document.getElementById('val-radius').innerText = "696,340 km";
    document.getElementById('val-tilt').innerText = "7.25°";
    document.getElementById('val-rotation').innerText = "25-35 days";
    document.getElementById('val-orbit').innerText = "N/A";
    document.getElementById('val-distance').innerText = "0 km (Center)";
    document.getElementById('val-moons').innerText = "8 (Planets)";
  } else {
    summary.innerText = planetData[planet].info;
    document.getElementById('val-radius').innerText = planetData[planet].radius;
    document.getElementById('val-tilt').innerText = planetData[planet].tilt;
    document.getElementById('val-rotation').innerText = planetData[planet].rotation;
    document.getElementById('val-orbit').innerText = planetData[planet].orbit;
    document.getElementById('val-distance').innerText = planetData[planet].distance;
    document.getElementById('val-moons').innerText = planetData[planet].moons;
  }

  info.classList.add('active');

  // Highlight active item in bottom dock
  document.querySelectorAll('.dock-item').forEach(btn => {
    if (btn.querySelector('.dock-label').innerText.trim().toLowerCase() === planet.toLowerCase()) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}
let isZoomingOut = false;
let zoomOutTargetPosition = new THREE.Vector3(-175, 115, 5);
// close 'x' button function
function closeInfo() {
  var info = document.getElementById('planetInfo');
  info.classList.remove('active');
  settings.accelerationOrbit = 1;
  if (!isFlightMode) {
    isZoomingOut = true;
    controls.target.set(0, 0, 0);
  }

  // Remove highlights from bottom dock
  document.querySelectorAll('.dock-item').forEach(btn => {
    btn.classList.remove('active');
  });
}
window.closeInfo = closeInfo;
// close info when clicking another planet
function closeInfoNoZoomOut() {
  var info = document.getElementById('planetInfo');
  info.classList.remove('active');
  settings.accelerationOrbit = 1;
}
// ******  SUN  ******
let sunMat;

const sunSize = 697/40; // 40 times smaller scale than earth
const sunGeom = new THREE.SphereGeometry(sunSize, 32, 20);
sunMat = new THREE.MeshStandardMaterial({
  emissive: 0xFFF88F,
  emissiveMap: loadTexture.load(sunTexture),
  emissiveIntensity: settings.sunIntensity
});
const sun = new THREE.Mesh(sunGeom, sunMat);
scene.add(sun);

//point light in the sun
const pointLight = new THREE.PointLight(0xFDFFD3 , 1200, 400, 1.4);
scene.add(pointLight);


// ******  PLANET CREATION FUNCTION  ******
const orbitLines = [];

function createPlanet(planetName, size, position, tilt, texture, bump, ring, atmosphere, moons){

  let material;
  if (texture instanceof THREE.Material){
    material = texture;
  } 
  else if(bump){
    material = new THREE.MeshPhongMaterial({
    map: loadTexture.load(texture),
    bumpMap: loadTexture.load(bump),
    bumpScale: 0.7
    });
  }
  else {
    material = new THREE.MeshPhongMaterial({
    map: loadTexture.load(texture)
    });
  } 

  const name = planetName;
  const geometry = new THREE.SphereGeometry(size, 32, 20);
  const planet = new THREE.Mesh(geometry, material);
  const planet3d = new THREE.Object3D;
  const planetSystem = new THREE.Group();
  planetSystem.add(planet);
  let Atmosphere;
  let Ring;
  planet.position.x = position;
  planet.rotation.z = tilt * Math.PI / 180;

  // add orbit path
  const orbitPath = new THREE.EllipseCurve(
    0, 0,            // ax, aY
    position, position, // xRadius, yRadius
    0, 2 * Math.PI,   // aStartAngle, aEndAngle
    false,            // aClockwise
    0                 // aRotation
);

  const pathPoints = orbitPath.getPoints(100);
  const orbitGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
  const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.03 });
  const orbit = new THREE.LineLoop(orbitGeometry, orbitMaterial);
  orbit.rotation.x = Math.PI / 2;
  planetSystem.add(orbit);
  orbitLines.push(orbit);

  //add ring
  if(ring)
  {
    const RingGeo = new THREE.RingGeometry(ring.innerRadius, ring.outerRadius,30);
    const RingMat = new THREE.MeshStandardMaterial({
      map: loadTexture.load(ring.texture),
      side: THREE.DoubleSide
    });
    Ring = new THREE.Mesh(RingGeo, RingMat);
    planetSystem.add(Ring);
    Ring.position.x = position;
    Ring.rotation.x = -0.5 *Math.PI;
    Ring.rotation.y = -tilt * Math.PI / 180;
  }
  
  //add atmosphere
  if(atmosphere){
    const atmosphereGeom = new THREE.SphereGeometry(size+0.1, 32, 20);
    const atmosphereMaterial = new THREE.MeshPhongMaterial({
      map:loadTexture.load(atmosphere),
      transparent: true,
      opacity: 0.4,
      depthTest: true,
      depthWrite: false
    })
    Atmosphere = new THREE.Mesh(atmosphereGeom, atmosphereMaterial)
    
    Atmosphere.rotation.z = 0.41;
    planet.add(Atmosphere);
  }

  //add moons
  if(moons){
    moons.forEach(moon => {
      let moonMaterial;
      
      if(moon.bump){
        moonMaterial = new THREE.MeshStandardMaterial({
          map: loadTexture.load(moon.texture),
          bumpMap: loadTexture.load(moon.bump),
          bumpScale: 0.5
        });
      } else{
        moonMaterial = new THREE.MeshStandardMaterial({
          map: loadTexture.load(moon.texture)
        });
      }
      const moonGeometry = new THREE.SphereGeometry(moon.size, 32, 20);
      const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
      const moonOrbitDistance = size * 1.5;
      moonMesh.position.set(moonOrbitDistance, 0, 0);
      planetSystem.add(moonMesh);
      moon.mesh = moonMesh;
    });
  }
  //add planet system to planet3d object and to the scene
  planet3d.add(planetSystem);
  scene.add(planet3d);
  return {name, planet, planet3d, Atmosphere, moons, planetSystem, Ring};
}


// ******  LOADING OBJECTS METHOD  ******
function loadObject(path, position, scale, callback) {
  const loader = new GLTFLoader();

  loader.load(path, function (gltf) {
      const obj = gltf.scene;
      obj.position.set(position, 0, 0);
      obj.scale.set(scale, scale, scale);
      scene.add(obj);
      if (callback) {
        callback(obj);
      }
  }, undefined, function (error) {
      console.error('An error happened', error);
  });
}

// ******  ASTEROIDS  ******
const asteroids = [];
function loadAsteroids(path, numberOfAsteroids, minOrbitRadius, maxOrbitRadius) {
  const loader = new GLTFLoader();
  loader.load(path, function (gltf) {
      gltf.scene.traverse(function (child) {
          if (child.isMesh) {
              for (let i = 0; i < numberOfAsteroids / 12; i++) { // Divide by 12 because there are 12 asteroids in the pack
                  const asteroid = child.clone();
                  const orbitRadius = THREE.MathUtils.randFloat(minOrbitRadius, maxOrbitRadius);
                  const angle = Math.random() * Math.PI * 2;
                  const x = orbitRadius * Math.cos(angle);
                  const y = 0;
                  const z = orbitRadius * Math.sin(angle);
                  child.receiveShadow = true;
                  asteroid.position.set(x, y, z);
                  asteroid.scale.setScalar(THREE.MathUtils.randFloat(0.8, 1.2));
                  scene.add(asteroid);
                  asteroids.push(asteroid);
              }
          }
      });
  }, undefined, function (error) {
      console.error('An error happened', error);
  });
}


// Earth day/night effect shader material
const earthMaterial = new THREE.ShaderMaterial({
  uniforms: {
    dayTexture: { type: "t", value: loadTexture.load(earthTexture) },
    nightTexture: { type: "t", value: loadTexture.load(earthNightTexture) },
    sunPosition: { type: "v3", value: sun.position }
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vSunDirection;

    uniform vec3 sunPosition;

    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vNormal = normalize(modelMatrix * vec4(normal, 0.0)).xyz;
      vSunDirection = normalize(sunPosition - worldPosition.xyz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D dayTexture;
    uniform sampler2D nightTexture;

    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vSunDirection;

    void main() {
      float intensity = max(dot(vNormal, vSunDirection), 0.0);
      vec4 dayColor = texture2D(dayTexture, vUv);
      vec4 nightColor = texture2D(nightTexture, vUv)* 0.2;
      gl_FragColor = mix(nightColor, dayColor, intensity);
    }
  `
});


// ******  MOONS  ******
// Earth
const earthMoon = [{
  size: 1.6,
  texture: earthMoonTexture,
  bump: earthMoonBump,
  orbitSpeed: 0.001 * settings.accelerationOrbit,
  orbitRadius: 10
}]

// Mars' moons with path to 3D models (phobos & deimos)
const marsMoons = [
  {
    modelPath: '/images/mars/phobos.glb',
    scale: 0.1,
    orbitRadius: 5,
    orbitSpeed: 0.002 * settings.accelerationOrbit,
    position: 100,
    mesh: null
  },
  {
    modelPath: '/images/mars/deimos.glb',
    scale: 0.1,
    orbitRadius: 9,
    orbitSpeed: 0.0005 * settings.accelerationOrbit,
    position: 120,
    mesh: null
  }
];

// Jupiter
const jupiterMoons = [
  {
    size: 1.6,
    texture: ioTexture,
    orbitRadius: 20,
    orbitSpeed: 0.0005 * settings.accelerationOrbit
  },
  {
    size: 1.4,
    texture: europaTexture,
    orbitRadius: 24,
    orbitSpeed: 0.00025 * settings.accelerationOrbit
  },
  {
    size: 2,
    texture: ganymedeTexture,
    orbitRadius: 28,
    orbitSpeed: 0.000125 * settings.accelerationOrbit
  },
  {
    size: 1.7,
    texture: callistoTexture,
    orbitRadius: 32,
    orbitSpeed: 0.00006 * settings.accelerationOrbit
  }
];

// ******  PLANET CREATIONS  ******
const mercury = new createPlanet('Mercury', 2.4, 40, 0, mercuryTexture, mercuryBump);
const venus = new createPlanet('Venus', 6.1, 65, 3, venusTexture, venusBump, null, venusAtmosphere);
const earth = new createPlanet('Earth', 6.4, 90, 23, earthMaterial, null, null, earthAtmosphere, earthMoon);
const mars = new createPlanet('Mars', 3.4, 115, 25, marsTexture, marsBump)
// Load Mars moons
marsMoons.forEach(moon => {
  loadObject(moon.modelPath, moon.position, moon.scale, function(loadedModel) {
    moon.mesh = loadedModel;
    mars.planetSystem.add(moon.mesh);
    moon.mesh.traverse(function (child) {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  });
});

const jupiter = new createPlanet('Jupiter', 69/4, 200, 3, jupiterTexture, null, null, null, jupiterMoons);
const saturn = new createPlanet('Saturn', 58/4, 270, 26, saturnTexture, null, {
  innerRadius: 18, 
  outerRadius: 29, 
  texture: satRingTexture
});
const uranus = new createPlanet('Uranus', 25/4, 320, 82, uranusTexture, null, {
  innerRadius: 6, 
  outerRadius: 8, 
  texture: uraRingTexture
});
const neptune = new createPlanet('Neptune', 24/4, 340, 28, neptuneTexture);
const pluto = new createPlanet('Pluto', 1, 350, 57, plutoTexture)

  // ******  PLANETS DATA  ******
  const planetData = {
    'Mercury': {
        radius: '2,439.7 km',
        tilt: '0.034°',
        rotation: '58.6 Earth days',
        orbit: '88 Earth days',
        distance: '57.9 million km',
        moons: '0',
        info: 'The smallest planet in our solar system and nearest to the Sun.'
    },
    'Venus': {
        radius: '6,051.8 km',
        tilt: '177.4°',
        rotation: '243 Earth days',
        orbit: '225 Earth days',
        distance: '108.2 million km',
        moons: '0',
        info: 'Second planet from the Sun, known for its extreme temperatures and thick atmosphere.'
    },
    'Earth': {
        radius: '6,371 km',
        tilt: '23.5°',
        rotation: '24 hours',
        orbit: '365 days',
        distance: '150 million km',
        moons: '1 (Moon)',
        info: 'Third planet from the Sun and the only known planet to harbor life.'
    },
    'Mars': {
        radius: '3,389.5 km',
        tilt: '25.19°',
        rotation: '1.03 Earth days',
        orbit: '687 Earth days',
        distance: '227.9 million km',
        moons: '2 (Phobos and Deimos)',
        info: 'Known as the Red Planet, famous for its reddish appearance and potential for human colonization.'
    },
    'Jupiter': {
        radius: '69,911 km',
        tilt: '3.13°',
        rotation: '9.9 hours',
        orbit: '12 Earth years',
        distance: '778.5 million km',
        moons: '95 known moons (Ganymede, Callisto, Europa, Io are the 4 largest)',
        info: 'The largest planet in our solar system, known for its Great Red Spot.'
    },
    'Saturn': {
        radius: '58,232 km',
        tilt: '26.73°',
        rotation: '10.7 hours',
        orbit: '29.5 Earth years',
        distance: '1.4 billion km',
        moons: '146 known moons',
        info: 'Distinguished by its extensive ring system, the second-largest planet in our solar system.'
    },
    'Uranus': {
        radius: '25,362 km',
        tilt: '97.77°',
        rotation: '17.2 hours',
        orbit: '84 Earth years',
        distance: '2.9 billion km',
        moons: '27 known moons',
        info: 'Known for its unique sideways rotation and pale blue color.'
    },
    'Neptune': {
        radius: '24,622 km',
        tilt: '28.32°',
        rotation: '16.1 hours',
        orbit: '165 Earth years',
        distance: '4.5 billion km',
        moons: '14 known moons',
        info: 'The most distant planet from the Sun in our solar system, known for its deep blue color.'
    },
    'Pluto': {
        radius: '1,188.3 km',
        tilt: '122.53°',
        rotation: '6.4 Earth days',
        orbit: '248 Earth years',
        distance: '5.9 billion km',
        moons: '5 (Charon, Styx, Nix, Kerberos, Hydra)',
        info: 'Originally classified as the ninth planet, Pluto is now considered a dwarf planet.'
    }
};


// Array of planets and atmospheres for raycasting
const raycastTargets = [
  mercury.planet, venus.planet, venus.Atmosphere, earth.planet, earth.Atmosphere, 
  mars.planet, jupiter.planet, saturn.planet, uranus.planet, neptune.planet, pluto.planet
];

// ******  SHADOWS  ******
renderer.shadowMap.enabled = true;
pointLight.castShadow = true;

//properties for the point light
pointLight.shadow.mapSize.width = 1024;
pointLight.shadow.mapSize.height = 1024;
pointLight.shadow.camera.near = 10;
pointLight.shadow.camera.far = 20;

//casting and receiving shadows
earth.planet.castShadow = true;
earth.planet.receiveShadow = true;
earth.Atmosphere.castShadow = true;
earth.Atmosphere.receiveShadow = true;
earth.moons.forEach(moon => {
moon.mesh.castShadow = true;
moon.mesh.receiveShadow = true;
});
mercury.planet.castShadow = true;
mercury.planet.receiveShadow = true;
venus.planet.castShadow = true;
venus.planet.receiveShadow = true;
venus.Atmosphere.receiveShadow = true;
mars.planet.castShadow = true;
mars.planet.receiveShadow = true;
jupiter.planet.castShadow = true;
jupiter.planet.receiveShadow = true;
jupiter.moons.forEach(moon => {
  moon.mesh.castShadow = true;
  moon.mesh.receiveShadow = true;
  });
saturn.planet.castShadow = true;
saturn.planet.receiveShadow = true;
saturn.Ring.receiveShadow = true;
uranus.planet.receiveShadow = true;
neptune.planet.receiveShadow = true;
pluto.planet.receiveShadow = true;




function animate(){

  //rotating planets around the sun and itself
  sun.rotateY(0.001 * settings.acceleration);
  mercury.planet.rotateY(0.001 * settings.acceleration);
  mercury.planet3d.rotateY(0.004 * settings.accelerationOrbit);
  venus.planet.rotateY(0.0005 * settings.acceleration)
  venus.Atmosphere.rotateY(0.0005 * settings.acceleration);
  venus.planet3d.rotateY(0.0006 * settings.accelerationOrbit);
  earth.planet.rotateY(0.005 * settings.acceleration);
  earth.Atmosphere.rotateY(0.001 * settings.acceleration);
  earth.planet3d.rotateY(0.001 * settings.accelerationOrbit);
  mars.planet.rotateY(0.01 * settings.acceleration);
  mars.planet3d.rotateY(0.0007 * settings.accelerationOrbit);
  jupiter.planet.rotateY(0.005 * settings.acceleration);
  jupiter.planet3d.rotateY(0.0003 * settings.accelerationOrbit);
  saturn.planet.rotateY(0.01 * settings.acceleration);
  saturn.planet3d.rotateY(0.0002 * settings.accelerationOrbit);
  uranus.planet.rotateY(0.005 * settings.acceleration);
  uranus.planet3d.rotateY(0.0001 * settings.accelerationOrbit);
  neptune.planet.rotateY(0.005 * settings.acceleration);
  neptune.planet3d.rotateY(0.00008 * settings.accelerationOrbit);
  pluto.planet.rotateY(0.001 * settings.acceleration)
  pluto.planet3d.rotateY(0.00006 * settings.accelerationOrbit)

// Animate Earth's moon
if (earth.moons) {
  earth.moons.forEach(moon => {
    const time = performance.now();
    const tiltAngle = 5 * Math.PI / 180;

    const moonX = earth.planet.position.x + moon.orbitRadius * Math.cos(time * moon.orbitSpeed);
    const moonY = moon.orbitRadius * Math.sin(time * moon.orbitSpeed) * Math.sin(tiltAngle);
    const moonZ = earth.planet.position.z + moon.orbitRadius * Math.sin(time * moon.orbitSpeed) * Math.cos(tiltAngle);

    moon.mesh.position.set(moonX, moonY, moonZ);
    moon.mesh.rotateY(0.01);
  });
}
// Animate Mars' moons
if (marsMoons){
marsMoons.forEach(moon => {
  if (moon.mesh) {
    const time = performance.now();

    const moonX = mars.planet.position.x + moon.orbitRadius * Math.cos(time * moon.orbitSpeed);
    const moonY = moon.orbitRadius * Math.sin(time * moon.orbitSpeed);
    const moonZ = mars.planet.position.z + moon.orbitRadius * Math.sin(time * moon.orbitSpeed);

    moon.mesh.position.set(moonX, moonY, moonZ);
    moon.mesh.rotateY(0.001);
  }
});
}

// Animate Jupiter's moons
if (jupiter.moons) {
  jupiter.moons.forEach(moon => {
    const time = performance.now();
    const moonX = jupiter.planet.position.x + moon.orbitRadius * Math.cos(time * moon.orbitSpeed);
    const moonY = moon.orbitRadius * Math.sin(time * moon.orbitSpeed);
    const moonZ = jupiter.planet.position.z + moon.orbitRadius * Math.sin(time * moon.orbitSpeed);

    moon.mesh.position.set(moonX, moonY, moonZ);
    moon.mesh.rotateY(0.01);
  });
}

// Rotate asteroids
asteroids.forEach(asteroid => {
  asteroid.rotation.y += 0.0001;
  asteroid.position.x = asteroid.position.x * Math.cos(0.0001 * settings.accelerationOrbit) + asteroid.position.z * Math.sin(0.0001 * settings.accelerationOrbit);
  asteroid.position.z = asteroid.position.z * Math.cos(0.0001 * settings.accelerationOrbit) - asteroid.position.x * Math.sin(0.0001 * settings.accelerationOrbit);
});

// ****** OUTLINES ON PLANETS ******
raycaster.setFromCamera(mouse, camera);

// Check for intersections
var intersects = raycaster.intersectObjects(raycastTargets);

// Reset all outlines
outlinePass.selectedObjects = [];

if (intersects.length > 0) {
  const intersectedObject = intersects[0].object;

  // If the intersected object is an atmosphere, find the corresponding planet
  if (intersectedObject === earth.Atmosphere) {
    outlinePass.selectedObjects = [earth.planet];
  } else if (intersectedObject === venus.Atmosphere) {
    outlinePass.selectedObjects = [venus.planet];
  } else {
    // For other planets, outline the intersected object itself
    outlinePass.selectedObjects = [intersectedObject];
  }
}
// ******  ZOOM IN/OUT  ******
if (isWarping) {
  warpProgress += 0.007; // ~2.4 seconds duration at 60fps
  if (warpProgress > 1.0) warpProgress = 1.0;

  // Orient camera to face the target planet
  const targetPos = new THREE.Vector3();
  if (warpTargetPlanetObj.name === 'Sun') {
    targetPos.set(0, 0, 0);
  } else {
    warpTargetPlanetObj.planet.getWorldPosition(targetPos);
  }
  
  camera.lookAt(targetPos);

  // Position warp lines system to center on camera and orient in camera's direction
  warpLines.position.copy(camera.position);
  warpLines.quaternion.copy(camera.quaternion);

  // Phase 1: Initiating/charging warp (0.0 to 0.15 progress)
  if (warpProgress <= 0.15) {
    const t = warpProgress / 0.15;
    
    // Stretch lines
    streakScale = THREE.MathUtils.lerp(1.0, 15.0, t);
    warpMaterial.opacity = THREE.MathUtils.lerp(0.0, 1.0, t);
    
    // Bending FOV
    camera.fov = THREE.MathUtils.lerp(45, 105, t);
    camera.updateProjectionMatrix();
    
    // Increase Bloom intensity
    bloomPass.strength = THREE.MathUtils.lerp(1.0, 4.5, t);
    bloomPass.radius = THREE.MathUtils.lerp(0.9, 1.5, t);
    
    // Slow initial movement
    camera.position.lerpVectors(warpStartPos, warpEndPos, warpProgress * 0.2);
  }
  // Phase 2: Main Cruise warp speed (0.15 to 0.85 progress)
  else if (warpProgress > 0.15 && warpProgress <= 0.85) {
    streakScale = 15.0;
    warpMaterial.opacity = 1.0;
    camera.fov = 105;
    camera.updateProjectionMatrix();
    bloomPass.strength = 4.5;
    bloomPass.radius = 1.5;
    
    const t = (warpProgress - 0.15) / 0.7;
    const easedT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    camera.position.lerpVectors(warpStartPos, warpEndPos, easedT);
  }
  // Phase 3: Transition Peak and deceleration (0.85 to 0.92 progress)
  else if (warpProgress > 0.85 && warpProgress <= 0.92) {
    const t = (warpProgress - 0.85) / 0.07;
    
    camera.position.lerpVectors(warpStartPos, warpEndPos, 0.95 + t * 0.05);
    
    const overlay = document.getElementById('warpOverlay');
    if (overlay && !overlay.classList.contains('active-flash')) {
      overlay.classList.add('active-flash');
    }
  }
  // Phase 4: Decelerating exit (0.92 to 1.0 progress)
  else {
    const t = (warpProgress - 0.92) / 0.08;
    
    const overlay = document.getElementById('warpOverlay');
    if (overlay && overlay.classList.contains('active-flash')) {
      overlay.classList.remove('active-flash');
    }
    
    streakScale = THREE.MathUtils.lerp(15.0, 1.0, t);
    warpMaterial.opacity = THREE.MathUtils.lerp(1.0, 0.0, t);
    
    camera.fov = THREE.MathUtils.lerp(105, 45, t);
    camera.updateProjectionMatrix();
    
    bloomPass.strength = THREE.MathUtils.lerp(4.5, warpOriginalBloomStrength, t);
    bloomPass.radius = THREE.MathUtils.lerp(1.5, warpOriginalBloomRadius, t);
  }

  // Update particle vertices to streak past
  const posAttribute = warpGeometry.attributes.position;
  const positions = posAttribute.array;
  
  let currentWarpSpeed = 2.0;
  if (warpProgress > 0.15 && warpProgress <= 0.85) {
    currentWarpSpeed = 22.0;
  } else if (warpProgress > 0.85) {
    currentWarpSpeed = 2.0;
  }
  
  for (let i = 0; i < warpParticleCount; i++) {
    positions[i * 6 + 2] += currentWarpSpeed; 
    
    if (positions[i * 6 + 2] > 20) {
      const lineLength = 5 + Math.random() * 25;
      const newZ = -300 - Math.random() * 50;
      positions[i * 6 + 2] = newZ;
    }
    
    const length = warpOriginalLengths[i] * streakScale;
    positions[i * 6 + 5] = positions[i * 6 + 2] - length;
  }
  posAttribute.needsUpdate = true;

  // Update HUD coordinate values during warp
  const flightCoordXEl = document.getElementById('flight-coord-x');
  if (flightCoordXEl) flightCoordXEl.innerText = camera.position.x.toFixed(1);
  const flightCoordYEl = document.getElementById('flight-coord-y');
  if (flightCoordYEl) flightCoordYEl.innerText = camera.position.y.toFixed(1);
  const flightCoordZEl = document.getElementById('flight-coord-z');
  if (flightCoordZEl) flightCoordZEl.innerText = camera.position.z.toFixed(1);

  if (warpProgress >= 1.0) {
    isWarping = false;
    warpLines.visible = false;
    
    camera.fov = 45;
    camera.updateProjectionMatrix();
    
    bloomPass.strength = warpOriginalBloomStrength;
    bloomPass.radius = warpOriginalBloomRadius;
    
    camera.position.copy(warpEndPos);
    
    if (isFlightMode) {
      controls.enabled = false;
    } else {
      selectedPlanet = warpTargetPlanetObj;
      isMovingTowardsPlanet = false;
      
      controls.enabled = true;
      controls.target.copy(targetPos);
      controls.update();
      
      showPlanetInfo(warpTargetPlanetObj.name);
    }
  }
} else if (!isFlightMode) {
  if (isMovingTowardsPlanet) {
    // Smoothly move the camera towards the target position
    camera.position.lerp(targetCameraPosition, 0.03);

    // Check if the camera is close to the target position
    if (camera.position.distanceTo(targetCameraPosition) < 1) {
        isMovingTowardsPlanet = false;
        showPlanetInfo(selectedPlanet.name);
    }
  } else if (isZoomingOut) {
    camera.position.lerp(zoomOutTargetPosition, 0.05);

    if (camera.position.distanceTo(zoomOutTargetPosition) < 1) {
        isZoomingOut = false;
    }
  }
  controls.update();
} else {
  // 1. Process movement speed
  const currentMax = keysPressed.Shift ? boostMaxSpeed : maxSpeed;
  if (keysPressed.w) {
    flightSpeed = THREE.MathUtils.lerp(flightSpeed, currentMax, acceleration);
  } else if (keysPressed.s) {
    flightSpeed = THREE.MathUtils.lerp(flightSpeed, -currentMax * 0.4, acceleration);
  } else {
    flightSpeed *= drag;
    if (Math.abs(flightSpeed) < 0.001) flightSpeed = 0;
  }

  // 2. Process Pitch, Yaw, Roll rotations
  // Keyboard steering inputs
  if (keysPressed.ArrowUp) {
    pitchSpeed = THREE.MathUtils.lerp(pitchSpeed, 0.012, rotAcceleration * 10);
  } else if (keysPressed.ArrowDown) {
    pitchSpeed = THREE.MathUtils.lerp(pitchSpeed, -0.012, rotAcceleration * 10);
  }
  
  if (keysPressed.a) {
    yawSpeed = THREE.MathUtils.lerp(yawSpeed, 0.015, rotAcceleration * 10);
  } else if (keysPressed.d) {
    yawSpeed = THREE.MathUtils.lerp(yawSpeed, -0.015, rotAcceleration * 10);
  }

  if (keysPressed.q) {
    rollSpeed = THREE.MathUtils.lerp(rollSpeed, 0.015, rotAcceleration * 10);
  } else if (keysPressed.e) {
    rollSpeed = THREE.MathUtils.lerp(rollSpeed, -0.015, rotAcceleration * 10);
  }

  // Apply rotation dampening (drag)
  pitchSpeed *= rotDrag;
  yawSpeed *= rotDrag;
  rollSpeed *= rotDrag;

  // Apply rotations
  camera.rotateX(pitchSpeed);
  camera.rotateY(yawSpeed);
  camera.rotateZ(rollSpeed);

  // 3. Translate camera along its local direction vector
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  camera.position.addScaledVector(direction, flightSpeed);

  // 4. Update Cockpit HUD UI values
  const speedDisplay = (Math.abs(flightSpeed) * 200).toFixed(1);
  const flightSpeedEl = document.getElementById('flight-speed');
  if (flightSpeedEl) flightSpeedEl.innerText = speedDisplay + ' km/s';
  
  const maxReference = keysPressed.Shift ? boostMaxSpeed : maxSpeed;
  const thrustPercent = Math.round((Math.max(0, flightSpeed) / maxReference) * 100);
  
  const flightThrustEl = document.getElementById('flight-thrust');
  if (flightThrustEl) flightThrustEl.innerText = thrustPercent + '%';
  
  const flightThrustBarEl = document.getElementById('flight-thrust-bar');
  if (flightThrustBarEl) flightThrustBarEl.style.width = thrustPercent + '%';

  const flightCoordXEl = document.getElementById('flight-coord-x');
  if (flightCoordXEl) flightCoordXEl.innerText = camera.position.x.toFixed(1);
  
  const flightCoordYEl = document.getElementById('flight-coord-y');
  if (flightCoordYEl) flightCoordYEl.innerText = camera.position.y.toFixed(1);
  
  const flightCoordZEl = document.getElementById('flight-coord-z');
  if (flightCoordZEl) flightCoordZEl.innerText = camera.position.z.toFixed(1);
}

requestAnimationFrame(animate);
composer.render();
}
loadAsteroids('/asteroids/asteroidPack.glb', 1000, 130, 160);
loadAsteroids('/asteroids/asteroidPack.glb', 3000, 352, 370);
animate();

// ****** CUSTOM UI EVENT LISTENERS & BINDINGS ******

// Settings panel toggling
window.toggleSettingsPanel = function() {
  const panel = document.getElementById('settingsPanel');
  panel.classList.toggle('active');
};

// Slider inputs binding
document.getElementById('orbit-speed').addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  settings.accelerationOrbit = val;
  document.getElementById('orbit-speed-val').innerText = val.toFixed(1) + 'x';
});

document.getElementById('rotation-speed').addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  settings.acceleration = val;
  document.getElementById('rotation-speed-val').innerText = val.toFixed(1) + 'x';
});

document.getElementById('sun-intensity').addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  settings.sunIntensity = val;
  if (sunMat) {
    sunMat.emissiveIntensity = val;
  }
  document.getElementById('sun-intensity-val').innerText = val.toFixed(1);
});

document.getElementById('toggle-orbits').addEventListener('change', (e) => {
  const visible = e.target.checked;
  orbitLines.forEach(line => {
    line.visible = visible;
  });
});

// Expose global planet selection navigation dock helper
window.selectPlanetByName = function(name) {
  if (isWarping) return;

  if (name === 'Sun') {
    closeInfoNoZoomOut();
    selectedPlanet = { name: 'Sun', planet: sun };
    triggerWarpJump();
    return;
  }

  // Find planet object matching name
  const planetMap = {
    'Mercury': mercury,
    'Venus': venus,
    'Earth': earth,
    'Mars': mars,
    'Jupiter': jupiter,
    'Saturn': saturn,
    'Uranus': uranus,
    'Neptune': neptune,
    'Pluto': pluto
  };

  const target = planetMap[name];
  if (target) {
    closeInfoNoZoomOut();
    selectedPlanet = target;
    triggerWarpJump();
  }
};

// Stop event propagation on UI panels to prevent camera orbiting/raycasting
const uiContainers = ['.app-header', '.settings-panel', '.planet-card', '.bottom-dock'];
uiContainers.forEach(selector => {
  const el = document.querySelector(selector);
  if (el) {
    ['mousedown', 'touchstart', 'pointerdown', 'click', 'mousemove', 'touchmove', 'pointermove'].forEach(eventType => {
      el.addEventListener(eventType, (e) => {
        e.stopPropagation();
      });
    });
  }
});

window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('mousedown', onDocumentMouseDown, false);
window.addEventListener('resize', function(){
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
  composer.setSize(window.innerWidth,window.innerHeight);
});

// ====== SPACESHIP FLIGHT CONTROL LISTENERS ======

// Toggle function
window.toggleFlightMode = function() {
  isFlightMode = !isFlightMode;
  const btn = document.getElementById('btn-flight-mode');
  
  if (isFlightMode) {
    document.body.classList.add('in-flight-mode');
    if (btn) {
      btn.classList.add('active-flight');
      btn.innerHTML = '<i class="ri-close-line"></i> EXIT_FLIGHT';
    }
    controls.enabled = false;
    
    // Close active details card
    closeInfo();

    // Reset Flight locks
    flightLockedTarget = null;
    const el = document.getElementById('flight-target');
    if (el) el.innerText = 'NONE';
    const warpBtn = document.getElementById('btn-warp-hud');
    if (warpBtn) warpBtn.disabled = true;
  } else {
    document.body.classList.remove('in-flight-mode');
    if (btn) {
      btn.classList.remove('active-flight');
      btn.innerHTML = '<i class="ri-rocket-line"></i> FLIGHT_MODE';
    }
    controls.enabled = true;
    
    // Smooth reset of OrbitControls target in front of camera
    const lookTarget = new THREE.Vector3();
    camera.getWorldDirection(lookTarget);
    lookTarget.multiplyScalar(50).add(camera.position);
    controls.target.copy(lookTarget);
    controls.update();
  }
};

// Keyboard inputs keydown
window.addEventListener('keydown', (e) => {
  if (!isFlightMode) return;
  
  const key = e.key.toLowerCase();
  
  // Numerical target selection (1-9, 0)
  if (key >= '0' && key <= '9') {
    const targetMap = {
      '1': 'Sun',
      '2': 'Mercury',
      '3': 'Venus',
      '4': 'Earth',
      '5': 'Mars',
      '6': 'Jupiter',
      '7': 'Saturn',
      '8': 'Uranus',
      '9': 'Neptune',
      '0': 'Pluto'
    };
    const name = targetMap[key];
    if (name) {
      lockFlightTarget(name);
    }
  }

  // Spacebar to trigger warp
  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault(); // Prevent page scroll
    if (flightLockedTarget && !isWarping) {
      triggerWarpJump();
    }
  }

  if (key === 'w') keysPressed.w = true;
  if (key === 's') keysPressed.s = true;
  if (key === 'a') keysPressed.a = true;
  if (key === 'd') keysPressed.d = true;
  if (key === 'q') keysPressed.q = true;
  if (key === 'e') keysPressed.e = true;
  if (e.key === 'Shift') keysPressed.Shift = true;
  
  if (e.key === 'ArrowUp') keysPressed.ArrowUp = true;
  if (e.key === 'ArrowDown') keysPressed.ArrowDown = true;
});

// Keyboard inputs keyup
window.addEventListener('keyup', (e) => {
  if (!isFlightMode) return;
  
  const key = e.key.toLowerCase();
  if (key === 'w') keysPressed.w = false;
  if (key === 's') keysPressed.s = false;
  if (key === 'a') keysPressed.a = false;
  if (key === 'd') keysPressed.d = false;
  if (key === 'q') keysPressed.q = false;
  if (key === 'e') keysPressed.e = false;
  if (e.key === 'Shift') keysPressed.Shift = false;
  
  if (e.key === 'ArrowUp') keysPressed.ArrowUp = false;
  if (e.key === 'ArrowDown') keysPressed.ArrowDown = false;
});

// Mouse dragging controls for flight steering
window.addEventListener('mousedown', (e) => {
  if (!isFlightMode || e.target !== renderer.domElement) return;
  isMouseDown = true;
  prevMousePosition = { x: e.clientX, y: e.clientY };
});

window.addEventListener('mousemove', (e) => {
  if (!isFlightMode || !isMouseDown) return;
  
  const deltaX = e.clientX - prevMousePosition.x;
  const deltaY = e.clientY - prevMousePosition.y;
  
  // Update pitch/yaw speeds based on mouse dragging offsets
  pitchSpeed -= deltaY * 0.00015;
  yawSpeed -= deltaX * 0.00015;
  
  prevMousePosition = { x: e.clientX, y: e.clientY };
});

window.addEventListener('mouseup', () => {
  isMouseDown = false;
});

// Touch controls support for mobile flight steering
window.addEventListener('touchstart', (e) => {
  if (!isFlightMode || e.target !== renderer.domElement) return;
  if (e.touches.length > 0) {
    isMouseDown = true;
    prevMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  if (!isFlightMode || !isMouseDown) return;
  if (e.touches.length > 0) {
    const deltaX = e.touches[0].clientX - prevMousePosition.x;
    const deltaY = e.touches[0].clientY - prevMousePosition.y;
    
    pitchSpeed -= deltaY * 0.0002;
    yawSpeed -= deltaX * 0.0002;
    
    prevMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
}, { passive: true });

window.addEventListener('touchend', () => {
  isMouseDown = false;
});

// ====== TRIGGER HYPERSPACE WARP JUMP FUNCTION ======
window.triggerWarpJump = function() {
  if (isWarping) return;
  
  // Identify the target planet
  let targetObj = null;
  if (isFlightMode) {
    targetObj = flightLockedTarget;
  } else {
    // Observer mode: warp to selectedPlanet
    targetObj = selectedPlanet;
  }
  
  if (!targetObj) {
    alert("Please select a target destination before activating warp drive.");
    return;
  }
  
  // Set up warp parameters
  warpTargetPlanetObj = targetObj;
  isWarping = true;
  warpProgress = 0;
  warpStartPos.copy(camera.position);
  
  // Get planet position
  const planetPos = new THREE.Vector3();
  if (targetObj.name === 'Sun') {
    planetPos.set(0, 0, 0);
  } else {
    targetObj.planet.getWorldPosition(planetPos);
  }
  
  // Calculate approach offset distance based on planet type
  let warpOffset = 30;
  if (targetObj.name === 'Sun') warpOffset = 40;
  else if (targetObj.name === 'Mercury' || targetObj.name === 'Pluto') warpOffset = 10;
  else if (targetObj.name === 'Venus' || targetObj.name === 'Earth' || targetObj.name === 'Uranus') warpOffset = 25;
  else if (targetObj.name === 'Mars') warpOffset = 15;
  else if (targetObj.name === 'Jupiter' || targetObj.name === 'Saturn') warpOffset = 50;
  else if (targetObj.name === 'Neptune') warpOffset = 20;
  
  // Find direction towards the planet
  warpApproachDir.subVectors(planetPos, camera.position).normalize();
  
  // If distance is extremely small or camera is exactly at the position, pick a default direction
  if (warpApproachDir.lengthSq() < 0.001) {
    warpApproachDir.set(0, 0, 1);
  }
  
  // Warp destination position
  warpEndPos.copy(planetPos).addScaledVector(warpApproachDir, -warpOffset);
  
  // Prepare particle systems
  warpLines.visible = true;
  warpMaterial.opacity = 0;
  streakScale = 1.0;
  
  // Store original bloom values
  warpOriginalBloomRadius = bloomPass.radius;
  warpOriginalBloomStrength = bloomPass.strength;
  
  // Hide details card and settings panel during warp if open
  const planetInfoEl = document.getElementById('planetInfo');
  if (planetInfoEl) planetInfoEl.classList.remove('active');
  const settingsPanelEl = document.getElementById('settingsPanel');
  if (settingsPanelEl) settingsPanelEl.classList.remove('active');
};
