//
// スカパージェイサッ子
//
import * as THREE from 'three';
import { OrbitControls } from 'three/adsons/controls/OrbitControls';
import { GUI } from 'three/adsons/libs/lil-gui';
import { Timer } from 'three/adsons/misc/Timer';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer';

const timer = new Timer();
const date = new Date();

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
document.body.appendChild(labelRenderer.domElement);

const textureLoader = new THREE.TextureLoader();

// Three.js のパネル設定とパラメータ
const params = {
  timeScale: 360,
  time: '',
  cameraTracking: true,
  axes: false,
  light: {
    declination: 0,
    azimuth: 0
  },
  jcsat17: {
    height: 0,
    latitude: 0,
    longitude: 0
  },
  iss: {
    height: 0,
    latitude: 0,
    longitude: 0
  },
  spaceVisible: true
};
timer.setTimescale(params.timeScale);

function panelSettings() {
  const gui = new GUI({ title: document.title });
  gui.add(params, 'time').name('日時').listen().disable();
  gui.add(params, 'timeScale', 1, 3600, 1).name('時間スケール')
    .onChange(value => { timer.setTimescale(value) });
  gui.add(params, 'cameraTracking').name('自転に追跡');
  gui.add(params, 'axes').name('軸の表示')
    .onChange(value => { showAxes(value) });
  gui.add(params, 'spaceVisible').name('星の表示')
    .onChange(value => { space.visible = value });
  const light = gui.addFolder('光源');
  light.add(params.light, 'declination', -23.4, 23.4, 0.1).name('赤緯')
    .onChange(value => { directionalLightPosiotion(value, params.light.azimuth); });
  light.add(params.light, 'azimuth', -180.0, 180.0, 0.1).name('方位')
    .onChange(value => { directionalLightPosiotion(params.light.declination, value); });
  const jcsat17 = gui.addFolder('JCSAT-17');
  jcsat17.add(params.jcsat17, 'height').name('高度(km)').listen().disable();
  jcsat17.add(params.jcsat17, 'latitude').name('緯度(°)').listen().disable();
  jcsat17.add(params.jcsat17, 'longitude').name('経度(°)').listen().disable();
  const iss = gui.addFolder('ISS');
  iss.add(params.iss, 'height').name('高度(km)').listen().disable();
  iss.add(params.iss, 'latitude').name('緯度(°)').listen().disable();
  iss.add(params.iss, 'longitude').name('経度(°)').listen().disable();
  gui.close();
}
panelSettings();

// Three.jsの軸の表示
const axesHelper = new THREE.AxesHelper(20000);
function showAxes(show) {
  if (show && axesHelper.parent !== scene) {
    scene.add(axesHelper);
  }
  else if (axesHelper.parent === scene) {
    scene.remove(axesHelper);
  }
}
function createLabel(text, x, y, z) {
  const div = document.createElement('div');
  div.className = 'label';
  div.textContent = text;
  div.style.backgroundColor = 'transparent';
  const label = new CSS2DObject(div);
  label.position.set(x, y, z);
  label.center.set(0.5, 0.5);
  return label;
}
const axes = {
  X: [21000, 0, 0],
  Y: [0, 21000, 0],
  Z: [0, 0, 21000]
};
for (let k in axes) {
  axesHelper.add(createLabel(k, axes[k][0], axes[k][1], axes[k][2]));
}
showAxes(params.axes);


// 座標変換関数
// satellite.posiotion to Three Axes
function toAxes(position) {
  return { x: position.x, y: position.z, z: -position.y };
}
// geodetic to Three.js Axes
function geodeticToAxes(height, latitude, longitude) {
  return toAxes(satellite.geodeticToEcf({
    height: height, latitude: latitude, longitude: longitude
  }));
}

// 四捨五入関数
function round(value, digits) {
  const d = 10 ** digits;
  return Math.round(value * d) / d;
}

// カメラとカメラ制御
class CameraControls {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      1000000,
    );
    this.controls = new OrbitControls(this.camera, labelRenderer.domElement);
    const gmst = satellite.gstime(date);
    const position = geodeticToAxes(
      100000,
      0,
      gmst + THREE.MathUtils.degToRad(139)
    );
    this.controls.position0 = new THREE.Vector3(position.x, position.y, position.z);
    this.controls.target0 = new THREE.Vector3(0, 0, 0);
    this.controls.zoom0 = 1.0;
    this.controls.maxDistance = 150000;
    this.controls.minDistance = 7000;
    this.controls.reset();
  }
  getCameraObj() {
    return this.camera;
  }
  tracking(delta) {
    const theta = delta / 86400 * Math.PI * 2;
    const x = this.camera.position.x;
    const z = this.camera.position.z;
    this.camera.position.x = x * Math.cos(-theta) - z * Math.sin(-theta);
    this.camera.position.z = x * Math.sin(-theta) + z * Math.cos(-theta);
  }
  update() {
    this.controls.update();
  }
  reset() {
    this.controls.reset();
  }
}
const cameraCtrl = new CameraControls();

// 光源
// 平行光源
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
scene.add(directionalLight);
// 並行光源の位置計算
function directionalLightPosiotion(declination, azimuth) {
  const theta = THREE.MathUtils.degToRad(declination);
  const phi = THREE.MathUtils.degToRad(azimuth);
  directionalLight.position.x = Math.cos(theta);
  directionalLight.position.y = Math.sin(theta);
  const x = directionalLight.position.x;
  directionalLight.position.x = x * Math.sin(phi);
  directionalLight.position.z = x * Math.cos(phi);
}
directionalLightPosiotion(0, 0);
// 環境光源
const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
scene.add(ambientLight);

// 星
class Space {
  constructor() {
    this.group = new THREE.Group();
    this.group.add(this.stars(500));
  }
  getPositions(count) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = THREE.MathUtils.randInt(150000, 500000);
      const theta = THREE.MathUtils.randFloat(0, Math.PI);
      const phi = THREE.MathUtils.randFloat(0, Math.PI * 2);
      positions[i * 3] = radius * Math.sin(theta) * Math.cos(phi);
      positions[i * 3 + 1] = radius * Math.cos(theta);
      positions[i * 3 + 2] = radius * Math.sin(theta) * Math.sin(phi);
    }
    return positions;
  }
  stars(count) {
    // https://www.irasutoya.com/2016/06/blog-post_817.html
    const texture = textureLoader.load('./small_star7_yellow.png');
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position', new THREE.Float32BufferAttribute(this.getPositions(count), 3)
    );
    var material = new THREE.PointsMaterial({ size: 5000, map: texture });
    return new THREE.Points(geometry, material);
  }
  getObj3d() {
    return this.group;
  }
}
const space = new Space().getObj3d()
scene.add(space);
space.visible = params.spaceVisible;

// 地球
class Earth {
  constructor() {
    this.group = new THREE.Group();
    this.group.add(this.earth());
  }
  earth() {
    // https://www.irasutoya.com/2013/02/blog-post_8574.html
    const texture = textureLoader.load('./sekaichizu1.png');
    const geometry = new THREE.SphereGeometry(6371, 32, 32);
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
  }
  house(latitude, longitude) {
    const position = geodeticToAxes(250, latitude, longitude);
    // https://www.irasutoya.com/2016/07/blog-post_793.html
    const texture = textureLoader.load('./building_house1.png');
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(500, 500, 500);
    sprite.position.set(position.x, position.y, position.z);
    return sprite;
  }
  rotation(gmst) {
    this.group.rotation.y = gmst;
  }
  addHouse(latitude, longitude) {
    const lat = THREE.MathUtils.degToRad(latitude);
    const long = THREE.MathUtils.degToRad(longitude);
    this.group.add(this.house(lat, long));
  }
  getObj3d() {
    return this.group;
  }
}
const earth = new Earth();
earth.addHouse(35.6895, 139.69171);
scene.add(earth.getObj3d());

// 軌道
class Tle {
  constructor(name, tleLine1, tleLine2) {
    this.name = name;
    this.satelliteRecord = satellite.twoline2satrec(tleLine1, tleLine2);
  }
  update(date) {
    const positionAndVelocity = satellite.propagate(this.satelliteRecord, date);
    const position = toAxes(positionAndVelocity.position);
    const gmst = satellite.gstime(date);
    const geodetic = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
    return {
      x: position.x,
      y: position.y,
      z: position.z,
      height: geodetic.height,
      latitude: geodetic.latitude,
      longitude: geodetic.longitude
    };
  }
}

// TLE uses data from https://celestrak.org/.
// JCSAT-17 TLE
class Jcsat17Tle extends Tle {
  constructor() {
    const tleLine1 = '1 45245U 20013A   24053.64424126 -.00000318  00000+0  00000+0 0  9990';
    const tleLine2 = '2 45245   5.6584 349.0000 0004675 336.7019 194.2255  1.00272432 14753';
    super('JCSAT-17', tleLine1, tleLine2);
  }
  update(date) {
    const position = super.update(date);
    // パネルに高度、緯度、経度を表示
    params.jcsat17.height = round(position.height, 1);
    params.jcsat17.latitude = round(satellite.degreesLat(position.latitude), 1);
    params.jcsat17.longitude = round(satellite.degreesLong(position.longitude), 1);
    return position;
  }
}

// ISS (ZARYA)
class IssTle extends Tle {
  constructor() {
    const tleLine1 = '1 25544U 98067A   24054.33494424  .00018013  00000+0  31983-3 0  9997';
    const tleLine2 = '2 25544  51.6411 164.5373 0002036 314.9686  82.1277 15.50270617440747';
    super('ISS (ZARYA)', tleLine1, tleLine2);
  }
  update(date) {
    const position = super.update(date);
    // パネルに高度、緯度、経度を表示
    params.iss.height = round(position.height, 1);
    params.iss.latitude = round(satellite.degreesLat(position.latitude), 1);
    params.iss.longitude = round(satellite.degreesLong(position.longitude), 1);
    return position;
  }
}

class SatContainer {
  static sats = [];
  static add(sat) {
    SatContainer.sats.push(sat);
  }
  static update(date) {
    for (let sat of SatContainer.sats) {
      sat.update(date);
    }
  }
}

// 衛星
class Sat {
  constructor(tle, texture = textureLoader.load('./space_jinkoueisei.png'), scale = 1000) {
    this.tle = tle;
    const material = new THREE.SpriteMaterial({ map: texture });
    this.sprite = new THREE.Sprite(material);
    this.sprite.scale.set(scale, scale, 1);
  }
  update(date) {
    const position = this.tle.update(date);
    // 衛星の位置設定
    this.sprite.position.set(position.x, position.y, position.z);
  }
  getObj3d() {
    return this.sprite;
  }
}

// ジェイサッ子
class Jeisakko {
  constructor(tle) {
    this.tle = tle;
    this.group = new THREE.Group();
    // 衛星
    this.group.add(this.spriteInit());
    // 衛星と地球の線
    this.group.add(this.lineInit());
  }
  spriteInit() {
    // https://www.skyperfectjsat.space/brand/michikachi/cm/
    this.texture1 = textureLoader.load('./jeisakko1.png');
    this.texture2 = textureLoader.load('./jeisakko2.png');
    const material = new THREE.SpriteMaterial();
    this.sprite = new THREE.Sprite(material);
    const scale = 1500;
    this.sprite.scale.set(scale, scale, 1);
    this.sprite.material.map = this.texture1;
    this.sprite.add(createLabel(
      this.tle.name,
      this.sprite.position.x, 
      this.sprite.position.y - 1,
      this.sprite.position.z
      ));
    return this.sprite;
  }
  spriteUpdate(position) {
    // 衛星の位置設定
    this.sprite.position.set(position.x, position.y, position.z);
    // 衛星のテクスチャの変更
    const p1 = position;
    const p2 = cameraCtrl.getCameraObj().position;
    const d1 = (p1.x ** 2 + p1.y ** 2 + p1.z ** 2) + (p2.x ** 2 + p2.y ** 2 + p2.z ** 2);
    const d2 = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2;
    // d2 < d1: カメラから見て、衛星が地球より手前にある
    if (d2 < d1 && this.sprite.material.map !== this.texture1) {
      this.sprite.material.map = this.texture1;
    }
    // d2 > d1: カメラから見て、衛星が地球より奥にある
    else if (d2 > d1 && this.sprite.material.map !== this.texture2) {
      this.sprite.material.map = this.texture2;
    }
  }
  lineInit() {
    const points = [];
    points.push(new THREE.Vector3(this.sprite.position.x, this.sprite.position.y, this.sprite.position.z));
    points.push(new THREE.Vector3(0, 0, 0));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x808080 });
    this.line = new THREE.Line(geometry, material);

    //scene.add(this.line);  // todo: group.add
    return this.line;
  }
  lineUpdate(position) {
    // ラインを衛星に追従させる
    const positions = this.line.geometry.attributes.position.array;
    positions[0] = position.x;
    positions[1] = position.y;
    positions[2] = position.z;
    this.line.geometry.attributes.position.needsUpdate = true;
  }
  update(date) {
    const position = this.tle.update(date);
    // 衛星の位置、テクスチャ変更
    this.spriteUpdate(position);
    // 衛星と地球の線
    this.lineUpdate(position);
  }
  getObj3d() {
    return this.group;
  }
}
const jeisakko = new Jeisakko(new Jcsat17Tle());
SatContainer.add(jeisakko);
scene.add(jeisakko.getObj3d());

// ISS
class Iss extends Sat {
  constructor(tle) {
    super(tle, textureLoader.load('./iss.png'), 1500);
  }
}
const iss = new Iss(new IssTle());
SatContainer.add(iss);
scene.add(iss.getObj3d());

// その他衛星
const tles = {
  'ALOS (DAICHI)' : [
    // ALOS (DAICHI)
    '1 28931U 06002A   24054.85954890  .00001926  00000+0  36670-3 0  9996',
    '2 28931  98.0235  10.5096 0002031 110.5210 249.6212 14.65171948964235'
  ],
  'QZS-1 (MICHIBIKI-1)': [
    // QZS-1 (MICHIBIKI-1)
    '1 37158U 10045A   24053.83766090 -.00000035  00000+0  00000+0 0  9994',
    '2 37158  43.0976 125.7389 0001594 153.3097 203.3186  0.87715799 48971'
  ],
  'QZS-2 (MICHIBIKI-2)': [
    // QZS-2 (MICHIBIKI-2)
    '1 42738U 17028A   24053.42871997 -.00000137  00000+0  00000+0 0  9993',
    '2 42738  40.7612 255.4098 0748088 270.1575 282.1365  1.00267160 24658'
  ],
  'QZS-3 (MICHIBIKI-3)': [
    // QZS-3 (MICHIBIKI-3)
    '1 42917U 17048A   24054.93313174 -.00000353  00000+0  00000+0 0  9999',
    '2 42917   0.0676 213.5175 0001334 115.0595 287.6737  1.00275216 23790'
  ],
  'QZS-3 (MICHIBIKI-3)': [
    // QZS-4 (MICHIBIKI-4)
    '1 42965U 17062A   24053.71455556 -.00000343  00000+0  00000+0 0  9993',
    '2 42965  40.5653 354.2547 0750364 269.4665 284.4449  1.00286785 23337'
  ],
  'QZS-1R': [
    // QZS-1R
    '1 49336U 21096A   24054.43287800 -.00000277  00000+0  00000+0 0  9995',
    '2 49336  35.7053  92.2720 0747386 269.1147  79.0900  1.00299827  8536'
  ],
};
for (let n in tles) {
  const sat = new Sat(new Tle(n, tles[n][0], tles[n][1]));
  SatContainer.add(sat);
  scene.add(sat.getObj3d());
}

function animate() {
  requestAnimationFrame(animate);
  timer.update();
  const delta = Math.floor(timer.getDelta() * 1000);

  date.setMilliseconds(date.getMilliseconds() + delta);
  const gmst = satellite.gstime(date);

  params.time = date.toISOString().split('.')[0] + 'Z';

  earth.rotation(gmst);

  SatContainer.update(date);

  if (params.cameraTracking) {
    cameraCtrl.tracking(delta / 1000);
  }
  cameraCtrl.update();

  renderer.render(scene, cameraCtrl.getCameraObj());
  labelRenderer.render(scene, cameraCtrl.getCameraObj());
}
animate();

function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);

  labelRenderer.setSize(width, height);

  cameraCtrl.getCameraObj().aspect = width / height;
  cameraCtrl.getCameraObj().updateProjectionMatrix();
}
window.addEventListener('resize', onWindowResize);
onWindowResize();
