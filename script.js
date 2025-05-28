document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const slideImage = document.getElementById('slideImage');
    const annotationCanvas = document.getElementById('annotationCanvas');
    const anCtx = annotationCanvas.getContext('2d');
    const scanningGuideCanvas = document.getElementById('scanningGuideCanvas');
    const sgCtx = scanningGuideCanvas.getContext('2d');

    const imageUpload = document.getElementById('imageUpload');
    const scenarioSelect = document.getElementById('scenarioSelect');
    const objectiveBtns = document.querySelectorAll('.objective-btn');
    
    // New Draggable Controls
    const coarseFocusWheel = document.getElementById('coarseFocusWheel');
    const fineFocusWheel = document.getElementById('fineFocusWheel');
    const illuminationKnob = document.getElementById('illuminationKnob');

    // Remaining Sliders
    const contrastSlider = document.getElementById('contrastControl');
    const fieldDiaphragmSlider = document.getElementById('fieldDiaphragm');
    
    const resetPositionBtn = document.getElementById('resetPosition');
    const toggleScanningGuideBtn = document.getElementById('toggleScanningGuide');

    const currentZoomVal = document.getElementById('currentZoomVal');
    const currentBlurVal = document.getElementById('currentBlurVal');
    const currentBrightnessVal = document.getElementById('currentBrightnessVal');
    const currentContrastVal = document.getElementById('currentContrastVal');
    const stageXVal = document.getElementById('stageXVal');
    const stageYVal = document.getElementById('stageYVal');
    const instructionText = document.getElementById('instructionText');
    const quizArea = document.getElementById('quizArea');

    const addAnnotationModeBtn = document.getElementById('addAnnotationMode');
    const annotationInstructions = document.getElementById('annotationInstructions');

    const tutorialSelect = document.getElementById('tutorialSelect');
    const startTutorialBtn = document.getElementById('startTutorialBtn');
    const tutorialTextEl = document.getElementById('tutorialText');
    const prevStepBtn = document.getElementById('prevStepBtn');
    const nextStepBtn = document.getElementById('nextStepBtn');

    const saveProgressBtn = document.getElementById('saveProgressBtn');
    const loadProgressBtn = document.getElementById('loadProgressBtn');
    const clearProgressBtn = document.getElementById('clearProgressBtn');
    const saveLoadStatus = document.getElementById('saveLoadStatus');
    
    const viewfinder = document.querySelector('.viewfinder');

    // --- State Variables ---
    let microscopeState = {
        currentScenarioId: null,
        uploadedImageName: null,
        zoom: 1,
        coarseFocus: 0, // Target range: 0 to 10
        fineFocus: 0,   // Target range: -2 to 2
        brightness: 1,  // Target range: 0.3 to 1.7
        contrast: 1,
        fieldDiaphragmOpenness: 1,
        imageX: 0,
        imageY: 0,
        annotations: [],
        tutorialState: {
            activeTutorialId: null,
            currentStepIndex: -1,
            isActive: false
        },
        isScanningGuideVisible: false
    };

    let annotationIdCounter = 0;
    let addingAnnotationMode = false;
    let isDragging = false;
    let dragStartX, dragStartY, initialImageX, initialImageY;

    // For draggable controls
    let activeDragControl = null; 
    let dragStartY_control = 0;
    let initialValue_control = 0;

    // --- DATA DEFINITIONS (Scenarios & Tutorials) ---
    const SCENARIOS_DATA = {
        "normal_blood": {
            name: "Normal Peripheral Blood Smear",
            imageSrc: "images/normal_smear.jpg",
            description: "Observe and identify normal red cells, white cells, and platelets.",
            initialSettings: { zoom: 1, coarseFocus: 2, fineFocus: 0, brightness: 1, contrast: 1, imageX:0, imageY:0, fieldDiaphragmOpenness: 1 },
            annotations: [
                { id: 0, x_percent: 25, y_percent: 30, question: "Identify this large cell with a multi-lobed nucleus.", correctAnswer: "Neutrophil", type: "identification" },
                { id: 1, x_percent: 60, y_percent: 70, question: "What are these small, purple, irregular fragments?", correctAnswer: "Platelets", type: "identification" },
                { id: 2, x_percent: 40, y_percent: 50, question: "Identify this cell with a large, round nucleus and scant cytoplasm.", correctAnswer: "Lymphocyte", type: "identification" },
                { id: 3, x_percent: 75, y_percent: 20, question: "What is the most numerous cell type here?", correctAnswer: "Red Blood Cell", type: "identification" },
            ],
            tutorialId: "basic_identification_tutorial"
        },
        "iron_deficiency_anemia": {
            name: "Iron Deficiency Anemia",
            imageSrc: "images/ida_smear.jpg",
            description: "Observe microcytic, hypochromic red blood cells.",
            initialSettings: { zoom: 2, coarseFocus: 4, fineFocus: 0, brightness: 1.1, contrast: 1, imageX:0, imageY:0, fieldDiaphragmOpenness: 1 },
            annotations: [
                { id: 0, x_percent: 30, y_percent: 40, question: "Describe the red blood cells in this field (size & color).", correctAnswer: "Microcytic hypochromic", type: "description" },
                { id: 1, x_percent: 55, y_percent: 65, question: "What condition is suggested by these RBC features?", correctAnswer: "Iron deficiency anemia", type: "diagnosis_hint" }
            ]
        }
    };

    const TUTORIALS_DATA = {
        "basic_microscopy_tutorial": {
            name: "Basic Microscope Operation",
            steps: [
                { text: "Welcome! Let's select an objective. Click 'Low (10x)'.", highlight: ".objective-btn[data-zoom='1']", actionElement: ".objective-btn[data-zoom='1']", actionType: "click" },
                { text: "Good. Now use the large Coarse Focus wheel (drag up/down) to bring the image into approximate focus.", highlight: "#coarseFocusWheel", actionType: "drag", stateKey: "coarseFocus"},
                { text: "Excellent. Use the smaller Fine Focus wheel for a sharp image.", highlight: "#fineFocusWheel", actionType: "drag", stateKey: "fineFocus" },
                { text: "Adjust the Illumination knob if the image is too dark/bright.", highlight: "#illuminationKnob", actionType: "drag", stateKey: "brightness" },
                { text: "To move around the slide, click and drag the image in the circular view.", highlight: ".viewfinder" },
                { text: "Tutorial complete!" }
            ]
        },
        "basic_identification_tutorial": {
            name: "Cell Identification (Normal Blood)",
            steps: [
                { text: "Pan to annotation point 0 (red circle). What cell is it?", highlight: "#quizArea", focusOnAnnotation: 0 },
                { text: "Now find point 1. What are these?", focusOnAnnotation: 1},
                { text: "Continue identifying other points."}
            ]
        }
    };

    // --- Initialization ---
    function initialize() {
        console.log("Initializing simulator...");
        setupCanvas();

        const initialImageSrc = slideImage.getAttribute('src');
        let initialImageLoadedOrErrored = false;
        console.log("Initial slideImage src attribute:", initialImageSrc);

        const onInitialImageReady = () => {
            if (initialImageLoadedOrErrored) return;
            initialImageLoadedOrErrored = true;
            console.log("Initial image confirmed loaded or errored. Proceeding with full init.");

            populateScenarioDropdown();
            populateTutorialDropdown();
            addEventListeners(); // Includes draggable controls init
            initializeDraggableControls();


            const progressLoadedSuccessfully = loadProgress();

            if (!progressLoadedSuccessfully || (progressLoadedSuccessfully && !microscopeState.currentScenarioId && !microscopeState.uploadedImageName)) {
                console.log("No scenario/custom image from progress, or placeholder is current; ensuring current view is rendered.");
                if(slideImage.naturalWidth > 0 && slideImage.naturalHeight > 0) {
                    resetMicroscopeViewToDefaults(microscopeState);
                } else {
                    console.warn("Initial image (placeholder) seems to have 0 dimensions. Path:", slideImage.src, "Natural W/H:", slideImage.naturalWidth, slideImage.naturalHeight);
                    instructionText.textContent = "Warning: Placeholder image might be missing or invalid.";
                    resetMicroscopeViewToDefaults();
                }
            }
            if(!instructionText.textContent.startsWith("Error") && !instructionText.textContent.startsWith("Warning")) {
                instructionText.textContent = "Select a scenario or upload an image. Pick a tutorial if you like.";
            }
            console.log("Initialization complete.");
        };

        console.log("Attaching onload/onerror for initial image:", initialImageSrc);
        slideImage.onload = () => {
            console.log("INITIAL image loaded via onload event:", slideImage.src, "Dims:", slideImage.naturalWidth, "x", slideImage.naturalHeight);
            if (slideImage.naturalWidth === 0 || slideImage.naturalHeight === 0) {
                console.error("INITIAL image loaded but zero dimensions. Path:", slideImage.src);
                instructionText.textContent = `Error: Image "${slideImage.src.split('/').pop()}" loaded with invalid dimensions.`;
            }
            onInitialImageReady();
        };
        slideImage.onerror = () => {
            console.error("ERROR: INITIAL image failed to load. Path:", slideImage.src);
            instructionText.textContent = `Error: Could not load initial image: "${slideImage.src.split('/').pop()}". Check path/file.`;
            onInitialImageReady();
        };

        if (slideImage.complete) {
            console.log("Initial image reported 'complete'. Natural W/H:", slideImage.naturalWidth, slideImage.naturalHeight, "Src:", slideImage.src);
            if (slideImage.naturalWidth > 0 && slideImage.naturalHeight > 0) {
                 console.log("Initial image 'complete' and has dimensions. Calling onInitialImageReady.");
                 onInitialImageReady();
            } else if (slideImage.src && slideImage.src !== window.location.href && !slideImage.src.startsWith('data:')) {
                 console.log("Initial image 'complete' but no/zero dimensions. Likely error, onerror should handle or has handled.");
            }
        } else {
            console.log("Initial image not 'complete'. Waiting for onload/onerror event.");
        }
    }

    function setupCanvas() {
        const viewfinderRect = viewfinder.getBoundingClientRect();
        annotationCanvas.width = viewfinderRect.width;
        annotationCanvas.height = viewfinderRect.height;
        scanningGuideCanvas.width = viewfinderRect.width;
        scanningGuideCanvas.height = viewfinderRect.height;
    }
    window.addEventListener('resize', setupCanvas);

    function populateScenarioDropdown() { /* ... same as before ... */ 
        scenarioSelect.innerHTML = '<option value="">-- Select Scenario --</option>';
        for (const id in SCENARIOS_DATA) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = SCENARIOS_DATA[id].name;
            scenarioSelect.appendChild(option);
        }
    }
    function populateTutorialDropdown() { /* ... same as before ... */ 
        tutorialSelect.innerHTML = '<option value="">-- Select Tutorial --</option>';
        for (const id in TUTORIALS_DATA) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = TUTORIALS_DATA[id].name;
            tutorialSelect.appendChild(option);
        }
    }

    function addEventListeners() {
        imageUpload.addEventListener('change', handleImageUpload);
        scenarioSelect.addEventListener('change', loadSelectedScenario);
        objectiveBtns.forEach(btn => btn.addEventListener('click', handleObjectiveChange));
        
        // Remaining Sliders
        contrastSlider.addEventListener('input', handleContrastChange);
        fieldDiaphragmSlider.addEventListener('input', handleFieldDiaphragmChange);

        resetPositionBtn.addEventListener('click', () => {
            microscopeState.imageX = 0; microscopeState.imageY = 0; updateFullView();
        });
        toggleScanningGuideBtn.addEventListener('click', toggleScanningGuide);

        viewfinder.addEventListener('mousedown', handleDragStart);
        document.addEventListener('mousemove', handleDragging);
        document.addEventListener('mouseup', handleDragEnd);
        slideImage.addEventListener('dragstart', (e) => e.preventDefault());

        addAnnotationModeBtn.addEventListener('click', toggleAddAnnotationMode);
        annotationCanvas.addEventListener('click', handleAnnotationCanvasClick);

        startTutorialBtn.addEventListener('click', startSelectedTutorial);
        prevStepBtn.addEventListener('click', () => advanceTutorialStep(-1));
        nextStepBtn.addEventListener('click', () => advanceTutorialStep(1));

        saveProgressBtn.addEventListener('click', saveProgress);
        loadProgressBtn.addEventListener('click', loadProgress);
        clearProgressBtn.addEventListener('click', clearProgress);
    }

    function updateFullView() {
        // Blur calculation based on Coarse and Fine Focus state
        // More realistic: optimal coarse focus point depends on current zoom objective.
        // Let's say ideal coarse focus for zoom=1 is 2, for zoom=2 is 4, zoom=4 is 8 etc.
        const idealCoarseForZoom = microscopeState.zoom * 2; // Example relationship
        let focusDifference = Math.abs(microscopeState.coarseFocus - idealCoarseForZoom);
        // Fine focus provides smaller adjustments around the coarse focus point
        let totalBlur = focusDifference + Math.abs(microscopeState.fineFocus * 0.5); // Fine focus has less impact
        totalBlur = Math.max(0, totalBlur / (microscopeState.zoom + 0.5)); // Higher zoom = less apparent blur for same focus error

        slideImage.style.transform = `translate(${microscopeState.imageX}px, ${microscopeState.imageY}px) scale(${microscopeState.zoom})`;
        slideImage.style.filter = `blur(${totalBlur.toFixed(2)}px) brightness(${microscopeState.brightness.toFixed(2)}) contrast(${microscopeState.contrast.toFixed(2)})`;

        const vignetteOpenness = microscopeState.fieldDiaphragmOpenness;
        const shadowSize = Math.max(0, 500 * (1 - vignetteOpenness));
        const shadowOpacity = 0.8 * (1 - vignetteOpenness);
        document.documentElement.style.setProperty('--vf-after-shadow-size', `${shadowSize}px`);
        document.documentElement.style.setProperty('--vf-after-shadow-opacity', `${shadowOpacity}`);

        currentZoomVal.textContent = microscopeState.zoom;
        currentBlurVal.textContent = totalBlur.toFixed(1);
        currentBrightnessVal.textContent = Math.round(microscopeState.brightness * 100);
        currentContrastVal.textContent = Math.round(microscopeState.contrast * 100);
        stageXVal.textContent = Math.round(microscopeState.imageX);
        stageYVal.textContent = Math.round(microscopeState.imageY);
        
        // Update sliders if they still exist
        if(contrastSlider) contrastSlider.value = microscopeState.contrast;
        if(fieldDiaphragmSlider) fieldDiaphragmSlider.value = microscopeState.fieldDiaphragmOpenness * 100;

        objectiveBtns.forEach(btn => {
            btn.classList.toggle('active', parseFloat(btn.dataset.zoom) === microscopeState.zoom);
        });
        
        // Update illumination knob indicator
        const knobIndicator = illuminationKnob.querySelector('.knob-indicator');
        if (knobIndicator) {
            const illumMin = 0.3, illumMax = 1.7; // Must match draggable control definition
            const range = illumMax - illumMin;
            const percentage = (microscopeState.brightness - illumMin) / range;
            const rotation = -135 + (Math.min(1, Math.max(0,percentage)) * 270); 
            knobIndicator.style.transform = `rotate(${rotation}deg)`;
        }

        renderAnnotations();
        if (microscopeState.isScanningGuideVisible) renderScanningGuide(); else sgCtx.clearRect(0,0,scanningGuideCanvas.width, scanningGuideCanvas.height);
    }
    
    // --- Control Handlers for Sliders (Contrast, Field Diaphragm) ---
    function handleContrastChange(event) {
        microscopeState.contrast = parseFloat(event.target.value);
        updateFullView();
        if (microscopeState.tutorialState.isActive) checkTutorialStepCondition(event.target, 'input');
    }
    function handleFieldDiaphragmChange(event) {
        microscopeState.fieldDiaphragmOpenness = parseFloat(event.target.value) / 100;
        updateFullView();
    }
    
    // --- Draggable Focus/Illumination Controls ---
    function initializeDraggableControls() {
        const controls = [
            { element: coarseFocusWheel, type: 'coarseFocus', stateKey: 'coarseFocus', sensitivity: 0.05, min: 0, max: 10, initialValue: 2 }, // Default initial for Coarse
            { element: fineFocusWheel, type: 'fineFocus', stateKey: 'fineFocus', sensitivity: 0.015, min: -2, max: 2, initialValue: 0 },
            { element: illuminationKnob, type: 'illumination', stateKey: 'brightness', sensitivity: 0.005, min: 0.3, max: 1.7, initialValue: 1 }
        ];

        controls.forEach(control => {
            // Set initial state value if not already set by loaded progress/scenario
            if(microscopeState[control.stateKey] === undefined || microscopeState[control.stateKey] === null ){ // Ensure initial values if not set
                 microscopeState[control.stateKey] = control.initialValue;
            }

            control.element.addEventListener('mousedown', (e) => {
                e.preventDefault();
                activeDragControl = control;
                dragStartY_control = e.clientY;
                initialValue_control = microscopeState[control.stateKey];
                document.addEventListener('mousemove', handleControlDrag);
                document.addEventListener('mouseup', stopControlDrag);
                control.element.style.cursor = 'ns-resize';
                document.body.style.cursor = 'ns-resize'; // Global cursor change
            });
        });
        updateFullView(); // Apply initial values for draggable controls
    }

    function handleControlDrag(e) {
        if (!activeDragControl) return;
        e.preventDefault();

        const dy = e.clientY - dragStartY_control;
        let newValue = initialValue_control - (dy * activeDragControl.sensitivity); 

        newValue = Math.max(activeDragControl.min, Math.min(activeDragControl.max, newValue));
        microscopeState[activeDragControl.stateKey] = newValue;
        
        updateFullView();
        if (microscopeState.tutorialState.isActive) {
            checkTutorialStepCondition(activeDragControl.element, 'drag'); // Custom event type 'drag'
        }
    }

    function stopControlDrag() {
        if (!activeDragControl) return;
        if(activeDragControl.element) activeDragControl.element.style.cursor = 'ns-resize';
        document.body.style.cursor = 'default'; // Reset global cursor

        activeDragControl = null;
        document.removeEventListener('mousemove', handleControlDrag);
        document.removeEventListener('mouseup', stopControlDrag);
    }

function handleImageUpload(event) {
    console.log("handleImageUpload triggered.");
    const file = event.target.files[0];
    const currentImageUploadInput = event.target; // Keep a reference to the input element that triggered the event

    if (file) {
        console.log("File selected:", file.name, "Type:", file.type, "Size:", file.size);

        if (!file.type.startsWith('image/')) {
            console.error("Selected file is not an image type:", file.type);
            instructionText.textContent = "Error: Selected file is not a recognized image format. Please choose a PNG, JPEG, or GIF.";
            currentImageUploadInput.value = ""; // Clear the input so the user can try again or select the same file
            return;
        }

        const reader = new FileReader();

        reader.onloadstart = () => {
            instructionText.textContent = "Loading image...";
            // You could also disable parts of the UI here if needed
        };

        reader.onprogress = (pEvent) => {
            // Optional: You could add a progress indicator if dealing with very large local files
            if (pEvent.lengthComputable) {
                const percentLoaded = Math.round((pEvent.loaded / pEvent.total) * 100);
                // console.log(`File reading progress: ${percentLoaded}%`);
            }
        };

        reader.onload = (e_reader) => { // Renamed to avoid confusion with slideImage.onload event
            console.log("FileReader.onload: File read into memory. Preparing to set slideImage.src.");

            // IMPORTANT: Clear any existing onload/onerror handlers on slideImage
            // This prevents old handlers (e.g., from initial load or a previous scenario) from interfering.
            slideImage.onload = null;
            slideImage.onerror = null;

            // Set up the NEW onload handler for slideImage *before* setting its src.
            slideImage.onload = () => {
                console.log("slideImage.onload: New image has been loaded by the browser. Natural Dims:", slideImage.naturalWidth, "x", slideImage.naturalHeight);

                // Check if the image loaded correctly and has dimensions
                if (slideImage.naturalWidth === 0 || slideImage.naturalHeight === 0) {
                    console.error("Uploaded image loaded but has zero dimensions. File:", file.name, "Src (start):", slideImage.src.substring(0, 100) + "...");
                    instructionText.textContent = `Error: Image "${file.name}" loaded but appears to be invalid or has zero dimensions.`;
                    // Don't clear input here yet, let onerror handle it if src was truly bad,
                    // or if it's a valid image that browser reports as 0x0, it's a deeper issue.
                    // However, we can't proceed with a 0-dimension image.
                    currentImageUploadInput.value = ""; // Clear input as this attempt failed.
                    return;
                }

                // Image is loaded and valid, now update the microscope state
                microscopeState.currentScenarioId = null; // Clear any active scenario
                microscopeState.uploadedImageName = file.name;
                microscopeState.annotations = []; // Clear annotations for the new image
                annotationIdCounter = 0; // Reset annotation counter

                // Reset the view to defaults for the new image.
                // This function should internally call updateFullView().
                resetMicroscopeViewToDefaults();

                instructionText.textContent = `Custom image "${file.name}" loaded successfully.`;
                console.log("Custom image fully processed, state updated, and view reset.");

                // CRITICAL for "upload twice" / "defined name" issue:
                // Clear the file input's value. This allows the 'change' event
                // to fire again if the user selects the exact same file.
                currentImageUploadInput.value = "";
                scenarioSelect.value = ""; // Reset scenario dropdown as we are on a custom image
            };

            // Set up the NEW onerror handler for slideImage
            slideImage.onerror = () => {
                console.error("slideImage.onerror: Error displaying the image from Data URL. File:", file.name);
                instructionText.textContent = "Error: Could not display the selected image. It might be corrupted or an unsupported format.";
                currentImageUploadInput.value = ""; // Clear the input on error too
            };

            // Now, set the slideImage.src. The handlers above are now in place.
            console.log("Setting slideImage.src with Data URL from FileReader.");
            slideImage.src = e_reader.target.result;
        };

        reader.onerror = () => {
            console.error("FileReader.onerror: Could not read the selected file. File:", file.name);
            instructionText.textContent = "Error: Could not read the selected file.";
            currentImageUploadInput.value = ""; // Clear the input
        };

        // Start reading the file as a Data URL
        reader.readAsDataURL(file);

    } else {
        console.log("handleImageUpload: No file selected (e.g., user cancelled the dialog).");
        // No need to clear input here, as 'change' won't fire again unless a new selection is made.
    }
}
    
    function handleObjectiveChange(event) { /* ... same as before ... */ 
        microscopeState.zoom = parseFloat(event.target.dataset.zoom);
        // microscopeState.coarseFocus = microscopeState.zoom * 2; // This behavior might change with draggable coarse focus
        microscopeState.fineFocus = 0; // Always reset fine focus on objective change
        updateFullView();
        if (microscopeState.tutorialState.isActive) checkTutorialStepCondition(event.target, 'click');
    }
    function handleDragStart(e) { /* ... same as before ... */ 
        if (addingAnnotationMode || !e.target.closest('.viewfinder') || (e.target !== viewfinder && e.target !== slideImage && e.target !== annotationCanvas && e.target !== scanningGuideCanvas)) return;
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        initialImageX = microscopeState.imageX;
        initialImageY = microscopeState.imageY;
        viewfinder.style.cursor = 'grabbing';
    }
    function handleDragging(e) { /* ... same as before ... */ 
        if (!isDragging) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        microscopeState.imageX = initialImageX + dx;
        microscopeState.imageY = initialImageY + dy;
        updateFullView();
    }
    function handleDragEnd() { /* ... same as before ... */ 
        if (isDragging) {
            isDragging = false;
            viewfinder.style.cursor = 'grab';
        }
    }
    function resetMicroscopeViewToDefaults(settings = {}) { /* ... same as before, ensure it sets microscopeState correctly ... */ 
        microscopeState.zoom = settings.zoom !== undefined ? settings.zoom : 1;
        microscopeState.coarseFocus = settings.coarseFocus !== undefined ? settings.coarseFocus : (microscopeState.zoom * 2); // Default coarse based on zoom
        microscopeState.fineFocus = settings.fineFocus !== undefined ? settings.fineFocus : 0;
        microscopeState.brightness = settings.brightness !== undefined ? settings.brightness : 1;
        microscopeState.contrast = settings.contrast !== undefined ? settings.contrast : 1;
        microscopeState.fieldDiaphragmOpenness = settings.fieldDiaphragmOpenness !== undefined ? settings.fieldDiaphragmOpenness : 1;
        microscopeState.imageX = settings.imageX !== undefined ? settings.imageX : 0;
        microscopeState.imageY = settings.imageY !== undefined ? settings.imageY : 0;
        updateFullView();
    }

    // --- Scenario, Annotation, Tutorial, Scanning Guide, Save/Load ---
    // These sections should largely remain the same, but ensure any tutorial steps
    // referencing old sliders are updated or their conditions are adapted.
    // For tutorial steps involving the new draggable controls, the `actionType` might be 'drag'
    // and `checkTutorialStepCondition` would need to handle this.

    function loadSelectedScenario() { /* ... same as before ... */ 
        const scenarioId = scenarioSelect.value;
        if (!scenarioId || !SCENARIOS_DATA[scenarioId]) {
            slideImage.src = "images/placeholder-slide.jpg";
            slideImage.onload = () => { // ensure placeholder is loaded before reset
                microscopeState.currentScenarioId = null;
                microscopeState.annotations = [];
                annotationIdCounter = 0;
                resetMicroscopeViewToDefaults();
                instructionText.textContent = "Select a scenario or upload an image.";
            }
            return;
        }
        loadScenario(scenarioId);
    }
    function loadScenario(scenarioId) { /* ... same as before, initialSettings for focus/brightness will now be used by draggable controls ... */ 
        const scenario = SCENARIOS_DATA[scenarioId];
        if (!scenario) return;
        microscopeState.currentScenarioId = scenarioId;
        microscopeState.uploadedImageName = null;
        slideImage.src = scenario.imageSrc;
        slideImage.onload = () => {
            if (slideImage.naturalWidth === 0) { /* error */ return; }
            // IMPORTANT: Apply scenario's initial settings to microscopeState for focus/brightness
            microscopeState.coarseFocus = scenario.initialSettings.coarseFocus !== undefined ? scenario.initialSettings.coarseFocus : (scenario.initialSettings.zoom * 2);
            microscopeState.fineFocus = scenario.initialSettings.fineFocus !== undefined ? scenario.initialSettings.fineFocus : 0;
            microscopeState.brightness = scenario.initialSettings.brightness !== undefined ? scenario.initialSettings.brightness : 1;
            resetMicroscopeViewToDefaults(scenario.initialSettings); // This will also apply zoom, pan etc.

            microscopeState.annotations = scenario.annotations.map(ann => ({ ...ann, id: ann.id !== undefined ? ann.id : annotationIdCounter++, userAnswer: '', feedback: '' }));
            // ... rest of annotation ID logic ...
            instructionText.textContent = scenario.description || "Scenario loaded.";
            renderAnnotations();
            if (scenario.tutorialId) tutorialSelect.value = scenario.tutorialId;
        };
        slideImage.onerror = () => { /* ... */ };
    }
    function toggleAddAnnotationMode() { /* ... same as before ... */ 
        addingAnnotationMode = !addingAnnotationMode;
        addAnnotationModeBtn.textContent = addingAnnotationMode ? 'Cancel Adding' : 'Add Quiz Point';
        addAnnotationModeBtn.classList.toggle('active', addingAnnotationMode);
        annotationInstructions.textContent = addingAnnotationMode ? 'Click on image to add point.' : '';
        annotationCanvas.style.pointerEvents = addingAnnotationMode ? 'auto' : 'none';
        viewfinder.style.cursor = addingAnnotationMode ? 'crosshair' : 'grab';
    }
    function handleAnnotationCanvasClick(e) { /* ... same as before ... */ 
        if (!addingAnnotationMode) return;
        const rect = annotationCanvas.getBoundingClientRect();
        const viewX = e.clientX - rect.left; const viewY = e.clientY - rect.top;
        if (!slideImage.naturalWidth || slideImage.naturalWidth === 0) return;
        const natWidth = slideImage.naturalWidth; const natHeight = slideImage.naturalHeight;
        const originalImageX = (viewX - microscopeState.imageX) / microscopeState.zoom;
        const originalImageY = (viewY - microscopeState.imageY) / microscopeState.zoom;
        const x_percent = (originalImageX / natWidth) * 100; const y_percent = (originalImageY / natHeight) * 100;
        const question = prompt("Question for this point:", "Identify:");
        if (question) {
            microscopeState.annotations.push({ id: annotationIdCounter++, x_percent, y_percent, question, correctAnswer: prompt("Correct answer (optional):"), type: "custom", userAnswer: '', feedback: '' });
            renderAnnotations();
        }
    }
    function renderAnnotations() { /* ... same as before ... */ 
        anCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
        quizArea.innerHTML = '';
        if (!slideImage.naturalWidth || slideImage.naturalWidth === 0) return; 
        const natWidth = slideImage.naturalWidth; const natHeight = slideImage.naturalHeight;
        microscopeState.annotations.forEach(ann => { /* ... drawing and quiz item creation ... */ 
            const originalImageX = (ann.x_percent / 100) * natWidth; const originalImageY = (ann.y_percent / 100) * natHeight;
            const viewX = (originalImageX * microscopeState.zoom) + microscopeState.imageX; const viewY = (originalImageY * microscopeState.zoom) + microscopeState.imageY;
            const pointRadius = Math.max(3, 8 / Math.sqrt(microscopeState.zoom) + 4); 
            if (viewX > -pointRadius*2 && viewX < annotationCanvas.width + pointRadius*2 && viewY > -pointRadius*2 && viewY < annotationCanvas.height + pointRadius*2) {
                anCtx.beginPath(); anCtx.arc(viewX, viewY, pointRadius, 0, 2 * Math.PI);
                anCtx.fillStyle = ann.feedback === 'Correct' ? 'rgba(0,255,0,0.6)' : (ann.feedback === 'Incorrect' ? 'rgba(255,0,0,0.6)' : 'rgba(255,165,0,0.7)');
                anCtx.fill(); anCtx.stroke(); /* ... text for ID ... */
                const quizItem = document.createElement('div'); quizItem.classList.add('quiz-item');
                quizItem.innerHTML = `...`; /* quiz HTML */
                quizArea.appendChild(quizItem);
                quizItem.querySelector('button').addEventListener('click', () => submitAnswer(ann.id));
                quizItem.querySelector('input').addEventListener('input', (e) => { ann.userAnswer = e.target.value; });
            }
        });
    }
    window.submitAnswer = function(annotationId) { /* ... same as before ... */ 
        const ann = microscopeState.annotations.find(a => a.id === annotationId); if (!ann) return;
        const answerInput = document.getElementById(`answer-${ann.id}`); ann.userAnswer = answerInput.value.trim();
        if (ann.correctAnswer !== undefined && ann.correctAnswer !== null && ann.correctAnswer !== '') { 
            ann.feedback = (ann.userAnswer.toLowerCase() === ann.correctAnswer.toLowerCase()) ? "Correct" : "Incorrect";
        } else { ann.feedback = "Submitted"; }
        renderAnnotations(); 
    }

    function startSelectedTutorial() { /* ... same as before ... */ 
        const tutorialId = tutorialSelect.value; if (tutorialId) startTutorial(tutorialId);
    }
    function startTutorial(tutorialId) { /* ... same as before ... */ 
        const tutorial = TUTORIALS_DATA[tutorialId]; if (!tutorial) return;
        microscopeState.tutorialState = { activeTutorialId: tutorialId, currentStepIndex: -1, isActive: true };
        advanceTutorialStep(1); tutorialTextEl.parentElement.style.display = 'block';
    }
    function advanceTutorialStep(direction) { /* ... same as before, check conditions for 'drag' type ... */ 
        const tutorial = TUTORIALS_DATA[microscopeState.tutorialState.activeTutorialId];
        if (!tutorial || !microscopeState.tutorialState.isActive) return;
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
        const newStepIndex = microscopeState.tutorialState.currentStepIndex + direction;
        if (newStepIndex >= 0 && newStepIndex < tutorial.steps.length) {
            microscopeState.tutorialState.currentStepIndex = newStepIndex;
            const step = tutorial.steps[newStepIndex];
            tutorialTextEl.innerHTML = `Step ${newStepIndex + 1}: ${step.text}`; 
            if (step.highlight) { const el = document.querySelector(step.highlight); if(el) el.classList.add('tutorial-highlight');}
            // ... focusOnAnnotation logic ...
            prevStepBtn.disabled = (newStepIndex === 0);
            nextStepBtn.disabled = (newStepIndex === tutorial.steps.length - 1 || ( (step.actionElement || step.actionType === 'drag') && !step.completed) );
            if((step.actionElement || step.actionType === 'drag') && !step.completed) nextStepBtn.disabled = true;
        } else if (newStepIndex >= tutorial.steps.length) endTutorial("Tutorial Completed!");
    }
    function checkTutorialStepCondition(targetElementOrStateKey, eventType) { /* ... Modify to handle 'drag' and stateKey ... */ 
        if (!microscopeState.tutorialState.isActive) return;
        const tutorial = TUTORIALS_DATA[microscopeState.tutorialState.activeTutorialId];
        const step = tutorial.steps[microscopeState.tutorialState.currentStepIndex];

        if (step && !step.completed) {
            let actionMatches = false;
            if (step.actionType === 'drag' && eventType === 'drag' && step.stateKey) {
                // For drag, we don't have a specific targetElement from the event,
                // we assume the drag happened if this function is called with eventType 'drag'.
                // The condition (if any) would check the microscopeState[step.stateKey]
                actionMatches = true; 
            } else if (step.actionElement) {
                const requiredElement = document.querySelector(step.actionElement);
                if ((targetElementOrStateKey.closest && targetElementOrStateKey.closest(step.actionElement)) || targetElementOrStateKey === requiredElement) {
                    if (step.actionType === eventType) actionMatches = true;
                }
            }

            if (actionMatches) {
                let conditionMet = true;
                if (step.condition && typeof step.condition === 'function') {
                    // Pass relevant value to condition: slider value or state value
                    const value = step.actionType === 'drag' && step.stateKey ? microscopeState[step.stateKey] : targetElementOrStateKey.value;
                    conditionMet = step.condition(value); 
                }
                if (conditionMet) {
                    step.completed = true; 
                    nextStepBtn.disabled = (microscopeState.tutorialState.currentStepIndex === tutorial.steps.length - 1);
                    document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight')); 
                }
            }
        }
    }
    function endTutorial(message = "Tutorial Ended.") { /* ... same as before ... */ 
        tutorialTextEl.textContent = message;
        microscopeState.tutorialState.isActive = false; /* ... reset state ... */
        Object.values(TUTORIALS_DATA).forEach(tut => tut.steps.forEach(s => s.completed = false));
    }
    function toggleScanningGuide() { /* ... same as before ... */ 
        microscopeState.isScanningGuideVisible = !microscopeState.isScanningGuideVisible;
        toggleScanningGuideBtn.textContent = microscopeState.isScanningGuideVisible ? "Hide Scan Guide" : "Show Scan Guide";
        updateFullView(); // To re-render guide or clear it
    }
    function renderScanningGuide() { /* ... same as before ... */ 
         if (!microscopeState.isScanningGuideVisible) return;
        sgCtx.clearRect(0, 0, scanningGuideCanvas.width, scanningGuideCanvas.height);
        sgCtx.strokeStyle = 'rgba(0, 255, 255, 0.5)'; 
        sgCtx.lineWidth = Math.max(0.5, 2 / microscopeState.zoom); 
        // ... drawing logic ...
    }
    function saveProgress() { /* ... same as before ... */ 
        try { localStorage.setItem('microscopeSimulatorProgress', JSON.stringify(microscopeState)); saveLoadStatus.textContent = 'Progress saved!';}
        catch(e) { saveLoadStatus.textContent = 'Error saving progress.'; }
        setTimeout(() => saveLoadStatus.textContent = '', 3000);
    }
    function loadProgress() { /* ... same as before, ensure it correctly sets microscopeState for focus/brightness from saved data ... */ 
        let loadedSpecificImage = false;
        try {
            const savedData = localStorage.getItem('microscopeSimulatorProgress');
            if (savedData) {
                const loadedState = JSON.parse(savedData);
                // Critical: Merge carefully, especially focus/brightness which are now primary state
                microscopeState = { ...getInitialState(), ...loadedState }; 
                
                isDragging = false; addingAnnotationMode = false; // Reset transient states
                
                if (microscopeState.currentScenarioId && SCENARIOS_DATA[microscopeState.currentScenarioId]) {
                    scenarioSelect.value = microscopeState.currentScenarioId;
                    loadScenario(microscopeState.currentScenarioId); // This will set focus/brightness from scenario
                    loadedSpecificImage = true;
                } else if (microscopeState.uploadedImageName) {
                    instructionText.textContent = `Previously used: ${microscopeState.uploadedImageName}. Re-upload to restore.`;
                    // Focus/brightness from savedState will be applied via resetMicroscopeViewToDefaults if not overridden by scenario
                    resetMicroscopeViewToDefaults(microscopeState); 
                } else {
                     slideImage.src = "images/placeholder-slide.jpg"; 
                     resetMicroscopeViewToDefaults(microscopeState); // Apply saved focus/brightness to placeholder
                }
                // ... tutorial state loading ...
                updateFullView(); // This will use the now-set microscopeState values for focus/brightness
                renderAnnotations();
                saveLoadStatus.textContent = 'Progress loaded!'; setTimeout(() => saveLoadStatus.textContent = '', 3000);
                return loadedSpecificImage || !!microscopeState.uploadedImageName;
            } else { saveLoadStatus.textContent = 'No saved progress.'; }
        } catch (e) { saveLoadStatus.textContent = 'Error loading progress.'; }
        return false;
    }
    function clearProgress() { /* ... same as before, ensure microscopeState reset is thorough ... */ 
        if (confirm("Clear saved progress?")) {
            localStorage.removeItem('microscopeSimulatorProgress');
            microscopeState = getInitialState(); 
            // ... reset UI elements ...
            slideImage.src = "images/placeholder-slide.jpg";
            slideImage.onload = () => { resetMicroscopeViewToDefaults(); annotationIdCounter = 0; renderAnnotations(); };
            saveLoadStatus.textContent = 'Progress cleared.';
        }
    }
    function getInitialState() { /* ... same as before, ensure focus/brightness defaults are sensible ... */ 
        return {
            currentScenarioId: null, uploadedImageName: null,
            zoom: 1, coarseFocus: 2, fineFocus: 0, brightness: 1, // Sensible defaults
            contrast: 1, fieldDiaphragmOpenness: 1,
            imageX: 0, imageY: 0, annotations: [],
            tutorialState: { activeTutorialId: null, currentStepIndex: -1, isActive: false },
            isScanningGuideVisible: false
        };
    }
    
    microscopeState = getInitialState();
    initialize();
});
