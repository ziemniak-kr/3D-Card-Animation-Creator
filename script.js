// Global variables
let scene, camera, renderer, card;
let frontTexture, backTexture;
let isAnimating = false;
let recorder;
let startTime;
let animationDuration = 2000; // 2 seconds
let downloadUrl;

// DOM elements
const frontImageInput = document.getElementById('frontImage');
const backImageInput = document.getElementById('backImage');
const frontPreview = document.getElementById('frontPreview');
const backPreview = document.getElementById('backPreview');
const previewBtn = document.getElementById('previewBtn');
const recordBtn = document.getElementById('recordBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusMessage = document.getElementById('status');
const canvasContainer = document.getElementById('canvas-container');

// Initialize the 3D scene
function initScene() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // Create camera
    camera = new THREE.PerspectiveCamera(
        75, 
        canvasContainer.clientWidth / canvasContainer.clientHeight, 
        0.1, 
        1000
    );
    camera.position.z = 5;

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    canvasContainer.appendChild(renderer.domElement);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);

    // Handle window resize
    window.addEventListener('resize', () => {
        const width = canvasContainer.clientWidth;
        const height = canvasContainer.clientHeight;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    });
}

// Create card with uploaded textures
function createCard() {
    // Remove existing card if any
    if (card) {
        scene.remove(card);
    }

    // Card dimensions (standard playing card ratio)
    const width = 3.5;
    const height = 5;
    const depth = 0.01;
    const radius = 0.2; // Corner radius for rounding

    // Create a group to hold both sides of the card
    card = new THREE.Group();

    // Create a rounded rectangle shape
    const shape = new THREE.Shape();
    
    // Draw a rounded rectangle
    shape.moveTo(-width/2 + radius, -height/2);
    shape.lineTo(width/2 - radius, -height/2);
    shape.quadraticCurveTo(width/2, -height/2, width/2, -height/2 + radius);
    shape.lineTo(width/2, height/2 - radius);
    shape.quadraticCurveTo(width/2, height/2, width/2 - radius, height/2);
    shape.lineTo(-width/2 + radius, height/2);
    shape.quadraticCurveTo(-width/2, height/2, -width/2, height/2 - radius);
    shape.lineTo(-width/2, -height/2 + radius);
    shape.quadraticCurveTo(-width/2, -height/2, -width/2 + radius, -height/2);

    // Create geometry from shape
    const geometry = new THREE.ShapeGeometry(shape);
    
    // Fix UV mapping for proper texture display
    const uvAttribute = geometry.getAttribute('uv');
    if (uvAttribute) {
        for (let i = 0; i < uvAttribute.count; i++) {
            // Convert from (-width/2, -height/2) to (width/2, height/2) range to (0,1) UV range
            const x = (uvAttribute.getX(i) + width/2) / width;
            const y = (uvAttribute.getY(i) + height/2) / height;
            uvAttribute.setXY(i, x, y);
        }
        uvAttribute.needsUpdate = true;
    }
    
    // Configure textures
    if (frontTexture) {
        frontTexture.center.set(0.5, 0.5);
        frontTexture.wrapS = frontTexture.wrapT = THREE.ClampToEdgeWrapping;
    }
    
    if (backTexture) {
        backTexture.center.set(0.5, 0.5);
        backTexture.wrapS = backTexture.wrapT = THREE.ClampToEdgeWrapping;
    }
    
    // Create front mesh
    const frontMesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ 
            map: frontTexture,
            side: THREE.FrontSide
        })
    );
    frontMesh.position.z = depth / 2;
    
    // Create back mesh (flipped)
    const backMesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ 
            map: backTexture,
            side: THREE.FrontSide
        })
    );
    backMesh.position.z = -depth / 2;
    backMesh.rotation.y = Math.PI; // Flip to show the back texture
    
    // Add meshes to the group
    card.add(frontMesh);
    card.add(backMesh);
    
    scene.add(card);
}

// Handle image upload and preview
function handleImageUpload(input, previewElement, isfront) {
    const file = input.files[0];
    
    if (!file) return;
    
    // Validate file is an image
    if (!file.type.startsWith('image/')) {
        statusMessage.textContent = 'Please select a valid image file.';
        statusMessage.style.color = 'red';
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        // Show image preview
        const img = document.createElement('img');
        img.src = e.target.result;
        previewElement.innerHTML = '';
        previewElement.appendChild(img);
        
        // Create texture
        const textureLoader = new THREE.TextureLoader();
        const texture = textureLoader.load(e.target.result, function() {
            if (isfront) {
                frontTexture = texture;
            } else {
                backTexture = texture;
            }
            
            // Enable buttons if both images are loaded
            if (frontTexture && backTexture) {
                previewBtn.disabled = false;
                recordBtn.disabled = false;
                createCard();
                statusMessage.textContent = 'Both images loaded. Ready to preview or record!';
                statusMessage.style.color = 'green';
            }
        });
    };
    
    reader.readAsDataURL(file);
}

// Animation loop
function animate() {
    if (!isAnimating) return;
    
    requestAnimationFrame(animate);
    
    const elapsedTime = Date.now() - startTime;
    
    if (elapsedTime < animationDuration) {
        // Rotate card 360 degrees (2π radians) over animationDuration
        card.rotation.y = (elapsedTime / animationDuration) * 2 * Math.PI;
    } else {
        // Animation complete
        isAnimating = false;
        
        if (recorder) {
            // Stop recording
            recorder.stopRecording(function() {
                const blob = recorder.getBlob();
                downloadUrl = URL.createObjectURL(blob);
                
                // Enable download button
                downloadBtn.classList.remove('hidden');
                statusMessage.textContent = 'Recording complete! Click Download to save the video.';
                statusMessage.style.color = 'green';
            });
        }
    }
    
    renderer.render(scene, camera);
}

// Start animation preview
function startPreview() {
    if (!frontTexture || !backTexture) {
        statusMessage.textContent = 'Please upload both front and back images first.';
        statusMessage.style.color = 'red';
        return;
    }
    
    resetCardRotation();
    isAnimating = true;
    startTime = Date.now();
    statusMessage.textContent = 'Previewing animation...';
    statusMessage.style.color = 'blue';
    
    animate();
}

// Start recording animation
function startRecording() {
    if (!frontTexture || !backTexture) {
        statusMessage.textContent = 'Please upload both front and back images first.';
        statusMessage.style.color = 'red';
        return;
    }
    
    // Check if browser supports recording
    if (!navigator.mediaDevices || !renderer.domElement.captureStream) {
        statusMessage.textContent = 'Your browser does not support recording. Please try Chrome, Firefox, or Edge.';
        statusMessage.style.color = 'red';
        return;
    }
    
    resetCardRotation();
    
    try {
        // Get stream from canvas
        const stream = renderer.domElement.captureStream(30); // 30fps
        
        // Create recorder
        recorder = new RecordRTC(stream, {
            type: 'video',
            mimeType: 'video/webm',
            frameRate: 30,
            quality: 100,
        });
        
        // Start recording
        recorder.startRecording();
        
        isAnimating = true;
        startTime = Date.now();
        statusMessage.textContent = 'Recording animation...';
        statusMessage.style.color = 'blue';
        
        animate();
    } catch (error) {
        console.error('Recording error:', error);
        statusMessage.textContent = 'Error starting recording: ' + error.message;
        statusMessage.style.color = 'red';
    }
}

// Download recorded video
function downloadVideo() {
    if (!downloadUrl) {
        statusMessage.textContent = 'No video available for download.';
        statusMessage.style.color = 'red';
        return;
    }
    
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'card-animation.webm';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Reset card rotation
function resetCardRotation() {
    if (card) {
        card.rotation.y = 0;
        renderer.render(scene, camera);
    }
}

// Initialize application
function init() {
    initScene();
    
    // Event listeners
    frontImageInput.addEventListener('change', function() {
        handleImageUpload(this, frontPreview, true);
    });
    
    backImageInput.addEventListener('change', function() {
        handleImageUpload(this, backPreview, false);
    });
    
    previewBtn.addEventListener('click', startPreview);
    recordBtn.addEventListener('click', startRecording);
    downloadBtn.addEventListener('click', downloadVideo);
    
    // Initial render
    renderer.render(scene, camera);
}

// Start the application when the page loads
window.onload = init;