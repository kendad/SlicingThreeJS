import './style.css'

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';

//all our models will be scaled in a 2x2x2 configuration to fit into the screen
const modelTargetSize:number = 2;

const canvas = document.getElementById("webgl") as HTMLCanvasElement;

//SVG for displaying a dotted line when draggin the mouse across the screen
const sliceLine = document.getElementById("slice-line") as HTMLElement;

//SCENE SETUP
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45,window.innerWidth/window.innerHeight,0.1,100);
camera.position.set(0,1,5);

const renderer = new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setSize(window.innerWidth,window.innerHeight);


//Orbit Controls
const controls = new OrbitControls(camera,canvas);
controls.enableDamping=true;

//The Main ROOT group where all the models and its sliced counterparts are added
const modelRoot =new THREE.Group();
scene.add(modelRoot);

//Ambient + Directional Lighting to go with MeshStandardMaterial
const dirLight = new THREE.DirectionalLight(0xffffff,2);
dirLight.position.set(5,5,5);
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0xffffff,0.5));

//MODEL LOADER
const modelSelect = document.getElementById("model-select") as HTMLSelectElement;
const gltfLoader = new GLTFLoader();

//Function to load and center the model
const loadModel = (url:string)=>{

    //load the model
    gltfLoader.load(url,(gltf)=>{
        const model = gltf.scene;

        // Calculate the Bounding Box around the model
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size); // This gets the width, height, and depth of the model

        // Determine the Scale Factor
        // We find the largest dimension (x, y, or z) and scale based on that.
        const maxDimension = Math.max(size.x, size.y, size.z);
        const scale = modelTargetSize / maxDimension;
        
        //scale the model accordingly
        model.scale.set(scale, scale, scale);

        // Re-calculate the bounding box and center the model AFTER scaling
        box.setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);

        //add the model to the scene
        modelRoot.add(model);

        //reset camera and controls
        camera.position.set(0,1,5);
        camera.lookAt(0,0,0);

        controls.target.set(0,0,0);
        controls.update();
    });
}

//load the initialModel
loadModel(modelSelect.value);

//render LOOP
const render=()=>{
    controls.update();
    renderer.render(scene,camera);
    requestAnimationFrame(render);
}
render();
