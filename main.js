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

// https://github.com/davincikab/mapbox_3d_models

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
const defaultTimeScale = 360;
const params = {
  timeScale: defaultTimeScale,
  cameraTracking: true,
  axes: false,
  jcsat17: {
    height: 0,
    latitude: 0,
    longitude: 0
  },
  spaceVisible: true
};
timer.setTimescale(params.timeScale);

function panelSettings() {
  const gui = new GUI({ title: document.title });
  gui.add(params, 'timeScale', 1, 3600, 1).name('時間スケール')
    .onChange(value => { timer.setTimescale(value) });
  gui.add(params, 'cameraTracking').name('自転に追跡');
  gui.add(params, 'axes').name('軸の表示')
    .onChange(value => { showAxes(value) });
  gui.add(params, 'spaceVisible').name('星の表示')
    .onChange(value => { space.visible = value });
  const jcsat17 = gui.addFolder('JCSAT-17');
  jcsat17.add(params.jcsat17, 'height').name('高度(km)').listen().disable();
  jcsat17.add(params.jcsat17, 'latitude').name('緯度(°)').listen().disable();
  jcsat17.add(params.jcsat17, 'longitude').name('経度(°)').listen().disable();
  gui.close();
}
panelSettings();

// Three.jsの軸の表示
function showAxes(show) {
  for (const label of axesLabels.children) {
    label.visible = show;
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
function createAxes() {
  const group = new THREE.Group();
  const d = 20000;
  const axes = {
    X: {
      line: [new THREE.Vector3(-d * 0.9, 0, 0), new THREE.Vector3(d / 2, 0, 0)],
      color: 0xff0000,
      label: [d * 1.05, 0, 0]
    },
    Y: {
      line: [new THREE.Vector3(0, 0, d * 0.9), new THREE.Vector3(0, 0, -d / 2)],
      color: 0x00ff00,
      label: [0, 0, - d * 1.05]
    },
    Z: {
      line: [new THREE.Vector3(0, -d * 0.9, 0), new THREE.Vector3(0, d / 2, 0)],
      color: 0x0000ff,
      label: [0, d * 1.05, 0]
    }
  };
  for (const t in axes) {
    group.add(new THREE.ArrowHelper(
      axes[t].line[1], axes[t].line[0], d * 1.9, axes[t].color, d * 0.1, d * 0.05
    ));
    group.add(createLabel(t, axes[t].label[0], axes[t].label[1], axes[t].label[2]));
  }
  return group;
}
const axesLabels = createAxes();
scene.add(axesLabels);
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
    this.camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), theta);
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
function getSunDirection(date) {
  // https://en.wikipedia.org/wiki/Position_of_the_Sun
  // https://icesat-2.gsfc.nasa.gov/sites/default/files/page_files/ICESat2_ATL03g_ATBD_r002.pdf
  const T = (satellite.jday(date) - 2451545.0) / 36525;
  // 平均黄経 mean longitude of the Sun
  const L = 280.460 + 36000.77005361 * T;
  // 平均近点角 mean anomaly of the Sun
  const gRad = THREE.MathUtils.degToRad(
    357.528 + 35999.05034 * T
  );
  // 黄経 ecliptic longitude
  const lambdaRad = THREE.MathUtils.degToRad(
    L + 1.914666471 * Math.sin(gRad) + 0.019994643 * Math.sin(2 * gRad)
  );
  // 黄道傾斜 Obliquity of the ecliptic
  const epsilonRad = THREE.MathUtils.degToRad(
    23.439291 - 0.0130042 * T
  );
  // 赤経(α) Right ascension
  // const rightAscensionRad = Math.atan2(Math.cos(epsilonRad) * Math.sin(lambdaRad), Math.cos(lambdaRad));
  // const rightAscension = THREE.MathUtils.radToDeg(rightAscensionRad);
  // 赤緯(δ) Declination
  // const declinationRad = Math.asin(Math.sin(epsilonRad) * Math.sin(lambdaRad));
  // const declination = THREE.MathUtils.radToDeg(declinationRad);
  // 地球と太陽との距離、単位は天文単位 distance of the Sun from the Earth, in astronomical units
  // const R = 1.000140612 - 0.016708617 * Math.cos(gRad) - 0.000139589 * Math.cos(2 * gRad);
  return {
    // rightAscension: rightAscension,
    // declination: declination,
    x: Math.cos(lambdaRad),
    y: Math.cos(epsilonRad) * Math.sin(lambdaRad),
    z: Math.sin(epsilonRad) * Math.sin(lambdaRad)
  };
}

// 平行光源
const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
scene.add(directionalLight);
// 並行光源の位置計算
function updateSunDirection(date) {
  const position = toAxes(getSunDirection(date));
  directionalLight.position.set(position.x, position.y, position.z);
}
updateSunDirection(date);
// 環境光源
const ambientLight = new THREE.AmbientLight(0xffffff, 0.05);
scene.add(ambientLight);

// 星
class Space {
  constructor() {
    this.group = new THREE.Group();
    this.group.add(this.stars(500));
  }
  getPositions(count) {
    const positions = new Float32Array(count * 3);
    const y = new THREE.Vector3(0, 1, 0),
      z = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < count; i++) {
      const radius = THREE.MathUtils.randInt(150000, 500000);
      const theta = THREE.MathUtils.randFloat(-Math.PI, Math.PI);
      const phi = THREE.MathUtils.randFloat(-Math.PI / 2, Math.PI / 2);
      const p = new THREE.Vector3(radius, 0, 0);
      p.applyAxisAngle(z, phi);
      p.applyAxisAngle(y, theta);
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
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
    this.earthRadius = 6371;
    this.segments = 72;
    this.group = new THREE.Group();
    this.group.add(this.earth());
  }
  earth() {
    // https://www.irasutoya.com/2013/02/blog-post_8574.html
    const geometry = new THREE.SphereGeometry(this.earthRadius, this.segments, this.segments / 2);
    const material = new THREE.MeshLambertMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    textureLoader.load('./sekaichizu1.png',
      function (texture) {
        mesh.material.map = texture;
        mesh.material.needsUpdate = true;
      }
    );
    return mesh;
  }
  circleLine(latitude, longitude, distance) {
    const P = new THREE.Vector3(this.earthRadius, 0, 0);
    const segments = this.segments * 2;
    const points = [];
    const x = new THREE.Vector3(1, 0, 0),
      y = new THREE.Vector3(0, 1, 0),
      z = new THREE.Vector3(0, 0, 1);
    P.applyAxisAngle(z, distance / this.earthRadius);
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const p = new THREE.Vector3().copy(P);
      p.applyAxisAngle(x, a);
      p.applyAxisAngle(z, latitude);
      p.applyAxisAngle(y, longitude);
      points.push(p);
    }
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({
        color: 0x808080,
        transparent: true,
        opacity: 0.5
      })
    );
  }
  addCircleLine(latitude, longitude, distance) {
    const lat = THREE.MathUtils.degToRad(latitude);
    const long = THREE.MathUtils.degToRad(longitude);
    this.group.add(this.circleLine(lat, long, distance));
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
// 東京の緯度経度
earth.addHouse(35.6895, 139.69171);
// 東京から1000km
earth.addCircleLine(35.6894, 139.6917, 1000);
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

// JCSAT-17 TLE
// TLE uses data from https://celestrak.org/.
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

class SatContainer {
  static sats = [];
  static add(sat) {
    SatContainer.sats.push(sat);
  }
  static update(date) {
    for (const sat of SatContainer.sats) {
      sat.update(date);
    }
  }
}

// 衛星
class Sat {
  constructor(tle, texture, scale = 1000, labelShow = false) {
    this.tle = tle;
    this.group = new THREE.Group();
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
    console.log(this.sprite.material.map);
    this.sprite.scale.set(scale, scale, 1);
    if (labelShow) {
      this.sprite.add(createLabel(
        this.tle.name,
        this.sprite.position.x,
        this.sprite.position.y - 1,
        this.sprite.position.z
      ));
    }
    this.group.add(this.sprite);
    this.line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        [
          new THREE.Vector3(this.sprite.position.x, this.sprite.position.y, this.sprite.position.z),
          new THREE.Vector3(0, 0, 0)
        ]
      ),
      new THREE.LineBasicMaterial({ color: 0x808080 })
    );
    this.group.add(this.line);
  }
  update(date) {
    const position = this.tle.update(date);
    // 衛星の位置設定
    this.sprite.position.set(position.x, position.y, position.z);
    const positions = this.line.geometry.attributes.position.array;
    positions[0] = position.x;
    positions[1] = position.y;
    positions[2] = position.z;
    this.line.geometry.attributes.position.needsUpdate = true;
  }
  getObj3d() {
    return this.group;
  }
}

// ジェイサッ子
class Jeisakko extends Sat {
  constructor(tle) {
    // https://www.skyperfectjsat.space/brand/michikachi/cm/
    const texture1 = textureLoader.load('./jeisakko1.png');
    const texture2 = textureLoader.load('./jeisakko2.png');

    super(tle, texture1, 2000, true);
    this.texture1 = texture1;
    this.texture2 = texture2;
  }
  update(date) {
    super.update(date);

    // 衛星のテクスチャの変更
    const p1 = this.sprite.position;
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
}
const jeisakko = new Jeisakko(new Jcsat17Tle());
SatContainer.add(jeisakko);
scene.add(jeisakko.getObj3d());

// その他衛星
fetch('tles.json')
  .then(response => response.json())
  .then(data => {
    const textures = {};
    for (const t in data.textures) {
      textures[t] = textureLoader.load(data.textures[t]);
    }
    for (const n in data.tles) {
      let texture = textures['default'];
      if (n in textures) {
        texture = textures[n];
      }
      const sat = new Sat(new Tle(n, data.tles[n][0], data.tles[n][1]), texture);
      SatContainer.add(sat);
      scene.add(sat.getObj3d());
    }
  });

let animatePause = false;
const info = document.getElementById("info");
const tzOffset = date.getTimezoneOffset() * 60000;
function animate() {
  requestAnimationFrame(animate);

  var delta = 0;
  if (animatePause) {
    timer.reset();
  }
  else {
    timer.update();

    delta = Math.floor(timer.getDelta() * 1000);
  }
  date.setMilliseconds(date.getMilliseconds() + delta);
  const gmst = satellite.gstime(date);

  const time = date.toISOString().split('.')[0] + 'Z';
  const localTime = new Date(date - tzOffset).toISOString().split('.')[0];
  info.innerHTML = `<table><tr><td>UTC</td><td>${time}</td></tr><tr><td>LT</td><td>${localTime}</td></tr></table>`;

  updateSunDirection(date);

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

function onKeydown(event) {
  if (event.isComposing || event.keyCode === 229) {
    return;
  }
  if (event.keyCode === 32) {
    animatePause = !animatePause;
    return;
  }
}
window.addEventListener('keydown', onKeydown);

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
