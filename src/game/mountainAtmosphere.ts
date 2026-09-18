import * as THREE from 'three';

/**
 * Creates an atmospheric downhill mountain skydome with dynamic sun disc,
 * horizon haze, and cloud layers.
 */
export function createMountainAtmosphere(skyColorHex: string, fogColorHex: string, sunColorHex: string): THREE.Group {
  const atmosGroup = new THREE.Group();

  // 1. Inverted Atmospheric Skydome
  const skyGeom = new THREE.SphereGeometry(750, 32, 24);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(skyColorHex) },
      bottomColor: { value: new THREE.Color(fogColorHex) },
      offset: { value: 30 },
      exponent: { value: 0.65 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        float p = max(pow(max(h, 0.0), exponent), 0.0);
        gl_FragColor = vec4(mix(bottomColor, topColor, p), 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });

  const skyDome = new THREE.Mesh(skyGeom, skyMat);
  atmosGroup.add(skyDome);

  // 2. Distant Sun Disc with Glow
  const sunGroup = new THREE.Group();
  sunGroup.position.set(240, 480, 200);

  const sunCoreGeom = new THREE.CircleGeometry(42, 32);
  const sunCoreMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(sunColorHex).lerp(new THREE.Color(0xffffff), 0.7),
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const sunCore = new THREE.Mesh(sunCoreGeom, sunCoreMat);
  sunCore.lookAt(0, 0, 0);
  sunGroup.add(sunCore);

  const sunCoronaGeom = new THREE.CircleGeometry(110, 32);
  const sunCoronaMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(sunColorHex),
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const sunCorona = new THREE.Mesh(sunCoronaGeom, sunCoronaMat);
  sunCorona.lookAt(0, 0, 0);
  sunGroup.add(sunCorona);

  atmosGroup.add(sunGroup);

  // 3. Floating Alpine Cloud Layer
  const cloudCount = 18;
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const clouds: THREE.Mesh[] = [];

  for (let c = 0; c < cloudCount; c++) {
    const cloudGeom = new THREE.DodecahedronGeometry(45 + Math.random() * 35, 1);
    const cloudMesh = new THREE.Mesh(cloudGeom, cloudMat);
    const angle = (c / cloudCount) * Math.PI * 2;
    const rad = 420 + Math.random() * 220;
    cloudMesh.position.set(
      Math.cos(angle) * rad,
      180 + Math.random() * 110,
      Math.sin(angle) * rad
    );
    cloudMesh.scale.set(2.4 + Math.random(), 0.5 + Math.random() * 0.3, 1.8 + Math.random());
    clouds.push(cloudMesh);
    atmosGroup.add(cloudMesh);
  }

  atmosGroup.userData.clouds = clouds;
  return atmosGroup;
}
