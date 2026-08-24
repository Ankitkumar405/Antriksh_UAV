/* Shared interactive viewer for the uploaded RC aircraft model. */

function initDroneModel(containerId) {
  const container = document.getElementById(containerId);
  if (!container || typeof THREE === "undefined" || typeof THREE.GLTFLoader === "undefined") return null;

  const width = container.clientWidth;
  const height = container.clientHeight;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, width / height, 0.01, 100);
  camera.position.set(4.8, 2.8, 5.2);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xfff7eb, 0x202830, 1.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 6, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9dbfff, 1.1);
  rim.position.set(-5, 3, -4);
  scene.add(rim);

  const rig = new THREE.Group();
  scene.add(rig);
  let autoSpin = true;
  const loader = new THREE.GLTFLoader();
  loader.load("rc_aircraft_3d_model.glb", (gltf) => {
    const aircraft = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(aircraft);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const modelScale = 3.8 / Math.max(size.x, size.y, size.z);
    aircraft.scale.setScalar(modelScale);
    aircraft.position.copy(center).multiplyScalar(-modelScale);
    aircraft.rotation.x = -Math.PI / 2;
    aircraft.rotation.y = Math.PI / 2;
    aircraft.traverse((part) => {
      if (part.isMesh) {
        part.castShadow = true;
        part.receiveShadow = true;
        if (part.material) part.material.needsUpdate = true;
      }
    });
    rig.add(aircraft);
    container.dataset.modelLoaded = "true";
  }, undefined, (error) => {
    container.dataset.modelLoaded = "error";
    console.warn("Could not load RC aircraft model:", error);
  });

  rig.rotation.y = -0.5;
  rig.rotation.x = 0.18;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const dom = renderer.domElement;
  dom.style.cursor = "grab";
  dom.addEventListener("pointerdown", (event) => {
    dragging = true;
    autoSpin = false;
    lastX = event.clientX;
    lastY = event.clientY;
    dom.setPointerCapture(event.pointerId);
    dom.style.cursor = "grabbing";
  });
  dom.addEventListener("pointerup", () => {
    dragging = false;
    dom.style.cursor = "grab";
  });
  dom.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    rig.rotation.y += (event.clientX - lastX) * 0.008;
    rig.rotation.x = Math.max(-0.5, Math.min(0.65, rig.rotation.x + (event.clientY - lastY) * 0.006));
    lastX = event.clientX;
    lastY = event.clientY;
  });
  dom.addEventListener("wheel", (event) => {
    event.preventDefault();
    camera.position.multiplyScalar(1 + event.deltaY * 0.001);
    camera.position.setLength(Math.max(3.3, Math.min(8, camera.position.length())));
  }, { passive: false });

  function animate() {
    requestAnimationFrame(animate);
    if (autoSpin) rig.rotation.y += 0.003;
    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    const nextWidth = container.clientWidth;
    const nextHeight = container.clientHeight;
    if (!nextWidth || !nextHeight) return;
    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(nextWidth, nextHeight);
  }
  window.addEventListener("resize", onResize);
  return { resume: () => { autoSpin = true; } };
}
