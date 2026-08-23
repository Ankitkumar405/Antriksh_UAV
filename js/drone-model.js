/* ============================================================
   3D UAV MODEL
   Procedural flying-wing model built to match the operator's
   real airframe: swept white wing panels with blue edge trim,
   a single dorsal fin, and a pusher motor+prop on a raised
   pylon at the root. No external model file needed.
   ============================================================ */

function initDroneModel(containerId) {
  const container = document.getElementById(containerId);
  if (!container || typeof THREE === "undefined") return null;

  const width = container.clientWidth, height = container.clientHeight;
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
  camera.position.set(5.2, 3.1, 5.6);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // ---- lighting: neutral studio setup so white foam reads clean ----
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xfff2df, 1.1);
  key.position.set(4, 6, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fbfff, 0.5);
  rim.position.set(-5, 2, -4);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xc9a36a, 0.3);
  fill.position.set(0, -3, 4);
  scene.add(fill);

  const white = new THREE.MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.55, metalness: 0.02 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x1c3a7a, roughness: 0.4, metalness: 0.05 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c2228, roughness: 0.35, metalness: 0.3 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb9c0c8, roughness: 0.25, metalness: 0.85 });

  const rig = new THREE.Group();
  scene.add(rig);

  // ---- broad tapered main wing, mirrored for left/right ----
  function buildWingPanel() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(-0.28, 0.45);
    shape.lineTo(0.35, 2.55);
    shape.lineTo(0.72, 2.8);
    shape.lineTo(1.86, 1.35);
    shape.lineTo(2.28, 0.32);
    shape.lineTo(1.95, -0.12);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, 0);
    const mesh = new THREE.Mesh(geo, white);
    mesh.castShadow = true;

    // blue trim follows the leading edge and outer tip of the foam panel
    const trimShape = new THREE.Shape();
    trimShape.moveTo(0, -0.04);
    trimShape.lineTo(-0.25, 0.43);
    trimShape.lineTo(0.32, 2.55);
    trimShape.lineTo(0.72, 2.82);
    trimShape.lineTo(1.87, 1.37);
    trimShape.lineTo(2.3, 0.31);
    trimShape.lineTo(2.18, 0.26);
    trimShape.lineTo(1.78, 1.3);
    trimShape.lineTo(0.68, 2.66);
    trimShape.lineTo(0.42, 2.48);
    trimShape.lineTo(-0.1, 0.42);
    trimShape.lineTo(0.08, -0.04);
    trimShape.closePath();
    const trimGeo = new THREE.ExtrudeGeometry(trimShape, { depth: 0.1, bevelEnabled: false });
    trimGeo.rotateX(Math.PI / 2);
    const trim = new THREE.Mesh(trimGeo, blue);

    const group = new THREE.Group();
    group.add(mesh, trim);
    return group;
  }

  const rightWing = buildWingPanel();
  const leftWing = buildWingPanel();
  leftWing.scale.x = -1;
  rig.add(rightWing, leftWing);

  // ---- raised rear tailplane visible above the main wing ----
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0);
  tailShape.lineTo(-0.22, 0.42);
  tailShape.lineTo(0.35, 1.35);
  tailShape.lineTo(0.88, 1.55);
  tailShape.lineTo(1.15, 0.98);
  tailShape.lineTo(0.72, 0.12);
  tailShape.closePath();
  const tailGeo = new THREE.ExtrudeGeometry(tailShape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
  tailGeo.rotateX(Math.PI / 2);
  const tailRight = new THREE.Mesh(tailGeo, white);
  const tailLeft = tailRight.clone();
  tailLeft.scale.x = -1;
  tailRight.position.set(0, 0.17, -1.15);
  tailLeft.position.set(0, 0.17, -1.15);
  rig.add(tailRight, tailLeft);

  // ---- center pod (root box where the panels meet) ----
  const podGeo = new THREE.BoxGeometry(0.34, 0.09, 1.1);
  const pod = new THREE.Mesh(podGeo, white);
  pod.position.set(0, 0, -0.15);
  rig.add(pod);

  // ---- single dorsal fin, upright at the root, swept back ----
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.05, 0.85);
  finShape.lineTo(0.55, 0.78);
  finShape.lineTo(0.72, 0.05);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.045, bevelEnabled: false });
  finGeo.rotateY(Math.PI / 2);
  finGeo.translate(0, 0, 0.15);
  const fin = new THREE.Mesh(finGeo, white);
  fin.position.set(0, 0.07, -0.55);
  rig.add(fin);

  // ---- pusher motor pylon + motor + prop, mid-pod, raised ----
  const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.16), dark);
  pylon.position.set(0, 0.17, -0.05);
  rig.add(pylon);

  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.16, 20), metal);
  motor.rotation.z = Math.PI / 2;
  motor.position.set(0, 0.29, -0.05);
  rig.add(motor);

  const propHub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12), dark);
  propHub.rotation.z = Math.PI / 2;
  propHub.position.set(0.09, 0.29, -0.05);
  rig.add(propHub);

  const propGroup = new THREE.Group();
  propGroup.position.set(0.1, 0.29, -0.05);
  [0, Math.PI].forEach((rotY) => {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.62, 0.05), dark);
    blade.rotation.x = rotY;
    propGroup.add(blade);
  });
  rig.add(propGroup);

  rig.rotation.y = -0.45;
  rig.rotation.x = 0.06;
  rig.scale.setScalar(0.78);

  // gentle contact shadow
  const shadowGeo = new THREE.CircleGeometry(2.3, 40);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = -0.55;
  scene.add(shadowMesh);

  // ---- orbit-lite controls: drag to rotate, wheel to zoom ----
  let dragging = false, lastX = 0, lastY = 0;
  let autoSpin = true;
  const dom = renderer.domElement;
  dom.style.cursor = "grab";
  dom.addEventListener("pointerdown", (e) => { dragging = true; autoSpin = false; lastX = e.clientX; lastY = e.clientY; dom.style.cursor = "grabbing"; });
  window.addEventListener("pointerup", () => { dragging = false; dom.style.cursor = "grab"; });
  window.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    rig.rotation.y += (e.clientX - lastX) * 0.008;
    rig.rotation.x = Math.max(-0.5, Math.min(0.6, rig.rotation.x + (e.clientY - lastY) * 0.006));
    lastX = e.clientX; lastY = e.clientY;
  });
  dom.addEventListener("wheel", (e) => {
    e.preventDefault();
    camera.position.multiplyScalar(1 + e.deltaY * 0.001);
    const d = camera.position.length();
    camera.position.setLength(Math.max(3.2, Math.min(9, d)));
  }, { passive: false });

  function animate() {
    requestAnimationFrame(animate);
    if (autoSpin) rig.rotation.y += 0.0035;
    propGroup.rotation.x += autoSpin ? 0.15 : 0.35;
    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener("resize", onResize);

  return { resume: () => (autoSpin = true) };
}
