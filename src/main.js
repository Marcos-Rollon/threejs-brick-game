import * as THREE from "three"; // Render engine
import * as CANNON from "cannon"; // Physics engine

// Some util globals for threejs
let camera, scene, renderer;
// Globals for cannon js
let world;

let stack = [];
let overhangs = [];
const boxHeight = 1;
const backLimit = -8;
const frontLimit = 8;

let gameStarted = false;
const originalBoxSize = 3;
const startinSpeed = 0.15;
const speedGrowFactor = 0.02;

let blockIsForward = true;
const scoreBoardElement = document.getElementById("score-board");
const bestScoreElement = document.getElementById("best-score");
const startScreenElement = document.getElementById("start-screen");
let userScore = 0;
let bestScore = 0;

window.addEventListener("load", (_)=>init());
window.addEventListener("click", ()=> {
    // Start the game
    if(!gameStarted){
        renderer.setAnimationLoop(animation);
        gameStarted = true;
        startScreenElement.style.display = "none";
    }
    else{
        const topLayer = stack[stack.length - 1];
        const prevLayer = stack[stack.length - 2];
        const direction = topLayer.direction;

        const delta = topLayer.threejs.position[direction] 
        - prevLayer.threejs.position[direction];

        const overhangSize = Math.abs(delta);
        const size = direction == "x" ? topLayer.width : topLayer.depth;
        const overlap = size - overhangSize;
        const newWidth = direction == "x" ? overlap : topLayer.width;
        const newDepth = direction == "z" ? overlap : topLayer.depth;

        if(overlap > 0){
            // Cut layer
            cutBox(topLayer, overlap, size, delta);

            // Calculate overhang part
            const overhangShift = (overlap / 2 + overhangSize / 2) * Math.sign(delta);
            const overhangX = direction == "x" 
                ? topLayer.threejs.position.x + overhangShift
                : topLayer.threejs.position.x;
            const overhangZ = direction == "z"
                ? topLayer.threejs.position.z + overhangShift
                : topLayer.threejs.position.z
            const overhangWidth = direction == "x" ? overhangSize : newWidth;
            const overhangDepth = direction == "z" ? overhangSize : newDepth;

            addOverhang(overhangX, overhangZ, overhangWidth, overhangDepth);

            // generate next layer
            const nextX = direction == "x" ? topLayer.threejs.position.x : backLimit;
            const nextZ = direction == "z" ? topLayer.threejs.position.z : backLimit;
            const nextDirection = direction == "x" ? "z" : "x";

            addLayer(nextX, nextZ, newWidth, newDepth, nextDirection);
            userScore++;
            scoreBoardElement.innerHTML = userScore;
        }else{
            resetGame();
        }


    }
});

function animation(){
    // Move the top layer
    const topLayer = stack[stack.length -1];
    const relevantPosition = topLayer.threejs.position[topLayer.direction];
    if(relevantPosition > frontLimit || relevantPosition < backLimit - 0.01){
        blockIsForward = !blockIsForward;
    }
    let speedAbs = startinSpeed * (1 + (stack.length-2)* speedGrowFactor)
    let speed = blockIsForward ? speedAbs : -speedAbs;

    // Update both threejs model and cannon js model

    topLayer.threejs.position[topLayer.direction] += speed;
    topLayer.cannonjs.position[topLayer.direction] += speed;

    // Change camera position
    // 4 is the initial camera height
    if(camera.position.y < boxHeight * (stack.length - 2)+4){
        camera.position.y += speed;
    }
    updatePhysics();
    renderer.render(scene, camera);
}

function updatePhysics(){
    world.step(1/60) // step the physics word

    overhangs.forEach(element =>{
        element.threejs.position.copy(element.cannonjs.position);
        element.threejs.quaternion.copy(element.cannonjs.quaternion);
    });
}

function init(){
    scoreBoardElement.innerHTML = userScore;
    // Init for cannon js
    world = new CANNON.World();
    world.gravity.set(0,-10,0); // gravity on the Y axis and down
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 40;

    // Create scene
    scene = new THREE.Scene();

    // Add first and second cubes
    addLayer(0,0, originalBoxSize, originalBoxSize, "x");
    addLayer(backLimit, 0, originalBoxSize, originalBoxSize, "x",)

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff,0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(10,20,0); // Is not the position of the light source, is the DIRECTION
    scene.add(directionalLight);

    // Add camera
    const aspectRatio = window.innerWidth/window.innerHeight;
    const width = 10;
    const height = width/ aspectRatio;
    // Since is an ortographic camera, we need to define the left, right, top and bottom planes
    camera = new THREE.OrthographicCamera(
        width / -2, // left
        width / 2, // right
        height / 2, // top
        height / -2, // bott
        1, // near plane
        100, // far plane
    );
    // In ortographic cameras the numbers don't matter as much as their proportions
    camera.position.set(4,4,4);
    camera.lookAt(0,0,0);

    // Create the renderer and put in on screen
    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.render(scene, camera);

    // Add to html
    document.body.appendChild( renderer.domElement );
}

function addLayer(x, z, width, depth, direction){
    const y = boxHeight * stack.length; // new box one layer higher
    const layer = generateBox(x,y,z,width, depth, false);
    layer.direction = direction;
    stack.push(layer);
}

function addOverhang(x, z , width, depth){
    const y = boxHeight * (stack.length - 1) // add new box on same layer
    const overhang = generateBox(x,y,z, width, depth, true);
    overhangs.push(overhang);
}

function generateBox(x,y,z,width,depth, falls){
    // THREE JS
    // Create and add a cube
    const geometry = new THREE.BoxGeometry(width , boxHeight, depth);
    const color = new THREE.Color(`hsl(${30+stack.length *4}, 100%, 50%)`);
    //const material = new THREE.MeshBasicMaterial({color: color}); // Does not take light into consideration
    const material = new THREE.MeshLambertMaterial({color: color}); // The most basic material that takes light into consideration
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x,y,z);
    scene.add(mesh);

    // CANNON JS
    // In cannon we define the box as the DISTANCE FROM THE CENTER TO HIS SIDES
    const shape = new CANNON.Box(new CANNON.Vec3(width/2, boxHeight/2, depth/2));
    let mass = falls ? 5 : 0; // If the mass is 0 gravity will not affect then but others will collide with then
    const body = new CANNON.Body({mass, shape});
    body.position.set(x,y,z);
    world.addBody(body);

    return {
        threejs: mesh,
        cannonjs: body,
        width,
        depth,
    }
}

function cutBox(topLayer, overlap, size, delta){
    const direction = topLayer.direction;
    const newWidth = direction == "x" ? overlap : topLayer.width;
    const newDepth = direction == "z" ? overlap : topLayer.depth;

    // Update metadata
    topLayer.width = newWidth;
    topLayer.depth = newDepth;

    // Update threejs model
    topLayer.threejs.scale[direction] = overlap / size;
    topLayer.threejs.position[direction] -= delta / 2; 

    // Update Cannon JS model
    topLayer.cannonjs.position[direction]-= delta/2;

    // Replace shape to smaller one (in cannon js you can't just scale a shape)
    const shape = new CANNON.Box( new CANNON.Vec3(newWidth/2, boxHeight/2, newDepth/2));
    topLayer.cannonjs.shapes = [];
    topLayer.cannonjs.addShape(shape);
}

function resetGame(){
    startScreenElement.style.display = "flex";
    if(userScore > bestScore) bestScore = userScore;
    userScore = 0;
    bestScoreElement.innerHTML = bestScore;
    scoreBoardElement.innerHTML = userScore;
    stack = [];
    overhangs = [];
    gameStarted = false;
    blockIsForward = true;
    for (let i = scene.children.length - 1; i >= 0; i--) {
        if(scene.children[i].type === "Mesh"){
            scene.children[i].geometry.dispose();
            scene.children[i].material.dispose();
            scene.remove(scene.children[i]);
        }
    }
    world.bodies.forEach(body =>{
        world.remove(body);
    })
    camera.position.set(4,4,4);
    renderer.setAnimationLoop(null);
    // Add first and second cubes
    addLayer(0,0, originalBoxSize, originalBoxSize, "x");
    addLayer(backLimit, 0, originalBoxSize, originalBoxSize, "x",)
}