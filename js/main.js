// GPU Rack Playground - main.js
// Entry point for the application

import * as Sim from './simulation.js';
import * as UI from './ui.js';
import * as Config from './config.js'; // Import Config here to access SIMULATION_SETTINGS
// Config is used by simulation.js and ui.js

console.log("GB200 NVL72 GPU Rack Simulator Initialized!");

// DOM Elements
const startSimButton = document.getElementById('start-sim-btn');
const stopSimButton = document.getElementById('stop-sim-btn');
const resetSimButton = document.getElementById('reset-sim-btn');
const perfModeSelect = document.getElementById('perf-mode-select'); // New control
const timeScaleSlider = document.getElementById('time-scale-slider');
const timeScaleValueDisplay = document.getElementById('time-scale-value');
const simulationArea = document.getElementById('simulation-area');
const statsArea = document.getElementById('stats-area');

// Settings Panel Elements
const realisticPerfFactorGroup = document.getElementById('realistic-perf-factor-group');
const realisticPerfFactorSlider = document.getElementById('realistic-perf-factor-slider');
const realisticPerfFactorValueDisplay = document.getElementById('realistic-perf-factor-value');
const gpuProcessingUnitsInput = document.getElementById('gpu-processing-units-input');
const gpuMemoryGbInput = document.getElementById('gpu-memory-gb-input');
const gpuLoadSpeedSlider = document.getElementById('gpu-load-speed-slider');
const gpuLoadSpeedValueDisplay = document.getElementById('gpu-load-speed-value');
const maxConcurrentJobsInput = document.getElementById('max-concurrent-jobs-input');
const errorChanceSlider = document.getElementById('error-chance-slider');
const errorChanceValueDisplay = document.getElementById('error-chance-value');
const gpuRecoveryTicksInput = document.getElementById('gpu-recovery-ticks-input');
const interconnectBottleneckSlider = document.getElementById('interconnect-bottleneck-slider');
const interconnectBottleneckValueDisplay = document.getElementById('interconnect-bottleneck-value');

// Thermal Throttling Settings Elements
const thermalThresholdSlider = document.getElementById('thermal-threshold-slider');
const thermalThresholdValueDisplay = document.getElementById('thermal-threshold-value');
const thermalSeveritySlider = document.getElementById('thermal-severity-slider');
const thermalSeverityValueDisplay = document.getElementById('thermal-severity-value');
const ticksToOverheatInput = document.getElementById('ticks-to-overheat-input');
const ticksToCooldownInput = document.getElementById('ticks-to-cooldown-input');
const cooldownLoadThresholdSlider = document.getElementById('cooldown-load-threshold-slider');
const cooldownLoadThresholdValueDisplay = document.getElementById('cooldown-load-threshold-value');
const schedulingModeSelect = document.getElementById('scheduling-mode-select');
const triggerGpuErrorButton = document.getElementById('trigger-gpu-error-btn');

// Master Toggles
const enableGpuErrorsToggle = document.getElementById('enable-gpu-errors-toggle');
const enableThermalThrottlingToggle = document.getElementById('enable-thermal-throttling-toggle');

// Custom Job Form Elements
const customJobFormArea = document.getElementById('custom-job-form-area');
const customJobNameInput = document.getElementById('custom-job-name');
const customJobCategorySelect = document.getElementById('custom-job-category');
const customJobParamsInput = document.getElementById('custom-job-params');
const customJobPrecisionSelect = document.getElementById('custom-job-precision');
const customJobBaseOpsInput = document.getElementById('custom-job-base-ops');
const customJobCommIntensitySlider = document.getElementById('custom-job-comm-intensity');
const customJobCommIntensityValueDisplay = document.getElementById('custom-job-comm-intensity-value');
const customJobTokensInput = document.getElementById('custom-job-tokens');
const customJobTrainingFieldsDiv = document.getElementById('custom-job-training-fields');
const customJobEpochsInput = document.getElementById('custom-job-epochs');
const customJobInitialLossInput = document.getElementById('custom-job-initial-loss');
const customJobLossReductionInput = document.getElementById('custom-job-loss-reduction');
const addCustomJobButton = document.getElementById('add-custom-job-btn');

// State
let isSimulationRunning = false;
let simulationLoopId = null;

// --- Core Simulation Loop ---
function gameLoop() {
    if (!isSimulationRunning) return;

    // 1. Update simulation state
    Sim.update();

    // 2. Update UI based on new state
    UI.render(); // Pass elements if ui.js doesn't store them globally

    simulationLoopId = requestAnimationFrame(gameLoop);
}

// --- Event Listeners ---
startSimButton.addEventListener('click', () => {
    if (!isSimulationRunning) {
        console.log("Starting simulation...");
        isSimulationRunning = true;
        // Sim.initialize(); // Moved to init() and resetButton
        // UI.initializeUI(simulationArea, statsArea); // Moved to init() and resetButton
        
        // Ensure controls are set correctly for a running state
        perfModeSelect.disabled = true;
        
        stopSimButton.disabled = false;
        startSimButton.disabled = true;
        resetSimButton.disabled = true; 
        gameLoop();
    }
});

stopSimButton.addEventListener('click', () => {
    if (isSimulationRunning) {
        console.log("Stopping simulation...");
        isSimulationRunning = false;
        if (simulationLoopId) {
            cancelAnimationFrame(simulationLoopId);
            simulationLoopId = null;
        }
        perfModeSelect.disabled = false;
        startSimButton.disabled = false;
        stopSimButton.disabled = true;
        resetSimButton.disabled = false; 
    }
});

resetSimButton.addEventListener('click', () => {
    if (!isSimulationRunning) {
        console.log("Resetting simulation...");
        Sim.initialize(); 
        UI.resetUI(); // This calls UI.initializeUI internally
        UI.render();  // Render the reset state immediately
        
        // Set button states for reset state
        startSimButton.disabled = false;
        stopSimButton.disabled = true;
        resetSimButton.disabled = true; // Or true, depending on desired flow after reset
        perfModeSelect.disabled = false; 
    }
});

perfModeSelect.addEventListener('change', (event) => {
    const newMode = event.target.value;
    Config.SIMULATION_SETTINGS.performanceMode = newMode;
    console.log(`Performance mode changed to: ${newMode}`);
    realisticPerfFactorGroup.style.display = newMode === 'realistic' ? 'block' : 'none';
    if (!isSimulationRunning) {
        UI.render();
    }
});

timeScaleSlider.addEventListener('input', (event) => {
    const newScale = parseFloat(event.target.value);
    Config.SIMULATION_SETTINGS.timeScaleFactor = newScale;
    timeScaleValueDisplay.textContent = `${newScale.toFixed(1)}x`;
    
    // Whether the simulation is running or not, we could update the stats to show the new time scale
    // This provides immediate visual feedback to the user about the change
    if (!isSimulationRunning) {
        UI.render(); // Re-render to show the new time scale in stats if sim is stopped
    }
    // Note: If simulation is running, the timeScaleFactor will be picked up
    // in the next tick via the gameLoop -> Sim.update() -> UI.render() cycle
});

// --- Settings Panel Event Listeners ---
realisticPerfFactorSlider.addEventListener('input', (event) => {
    const value = parseFloat(event.target.value);
    Config.SIMULATION_SETTINGS.realisticPerformanceFactor = value;
    realisticPerfFactorValueDisplay.textContent = value.toFixed(2);
});

gpuProcessingUnitsInput.addEventListener('change', (event) => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value) && value >= 10) {
        Config.GPU_CONFIG.baseProcessingUnits = value;
        console.log(`GPU Base Processing Units set to: ${value}`);
        // Consider if a reset or UI refresh is needed for immediate effect on existing GPUs
    } else {
        event.target.value = Config.GPU_CONFIG.baseProcessingUnits; // Revert if invalid
    }
});

gpuMemoryGbInput.addEventListener('change', (event) => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value) && value >= 16) { // Min sensible memory
        Config.GPU_CONFIG.memoryGB = value;
        console.log(`GPU Memory GB set to: ${value}`);
        // This change mainly affects new jobs. Existing jobs retain their memory.
        // A full reset would be needed to re-initialize GPU elements with new total capacity in UI if not handled by render.
        // UI.render() should pick up Config.GPU_CONFIG.memoryGB for display in cards.
        if (!isSimulationRunning) UI.render();
    } else {
        event.target.value = Config.GPU_CONFIG.memoryGB;
    }
});

gpuLoadSpeedSlider.addEventListener('input', (event) => {
    const value = parseFloat(event.target.value);
    Config.GPU_CONFIG.modelLoadMemoryBandwidthFactor = value;
    gpuLoadSpeedValueDisplay.textContent = value.toFixed(2);
});

maxConcurrentJobsInput.addEventListener('change', (event) => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value) && value >= 1) {
        Config.SIMULATION_SETTINGS.maxConcurrentJobsPerGpu = value;
        console.log(`Max Concurrent Jobs per GPU set to: ${value}`);
    } else {
        event.target.value = Config.SIMULATION_SETTINGS.maxConcurrentJobsPerGpu;
    }
});

errorChanceSlider.addEventListener('input', (event) => {
    const value = parseFloat(event.target.value);
    Config.SIMULATION_SETTINGS.errorChancePerTick = value;
    errorChanceValueDisplay.textContent = value.toFixed(4);
});

gpuRecoveryTicksInput.addEventListener('change', (event) => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value) && value >= 0) {
        Config.SIMULATION_SETTINGS.gpuRecoveryTimeTicks = value;
        console.log(`GPU Recovery Time set to: ${value} ticks`);
    } else {
        event.target.value = Config.SIMULATION_SETTINGS.gpuRecoveryTimeTicks;
    }
});

interconnectBottleneckSlider.addEventListener('input', (event) => {
    const value = parseFloat(event.target.value);
    Config.SIMULATION_SETTINGS.interconnectBottleneckFactor = value;
    interconnectBottleneckValueDisplay.textContent = value.toFixed(2);
});

// Thermal Throttling Listeners
thermalThresholdSlider.addEventListener('input', (event) => {
    const value = parseInt(event.target.value, 10);
    Config.GPU_CONFIG.thermalThrottlingThresholdLoad = value;
    thermalThresholdValueDisplay.textContent = `${value}%`;
});

thermalSeveritySlider.addEventListener('input', (event) => {
    const value = parseFloat(event.target.value);
    Config.GPU_CONFIG.thermalThrottlingSeverity = value;
    thermalSeverityValueDisplay.textContent = value.toFixed(2);
});

ticksToOverheatInput.addEventListener('change', (event) => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value) && value > 0) Config.GPU_CONFIG.ticksToOverheat = value;
    else event.target.value = Config.GPU_CONFIG.ticksToOverheat;
});

ticksToCooldownInput.addEventListener('change', (event) => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value) && value > 0) Config.GPU_CONFIG.ticksToCooldown = value;
    else event.target.value = Config.GPU_CONFIG.ticksToCooldown;
});

cooldownLoadThresholdSlider.addEventListener('input', (event) => {
    const value = parseInt(event.target.value, 10);
    Config.GPU_CONFIG.cooldownLoadThreshold = value;
    cooldownLoadThresholdValueDisplay.textContent = `${value}%`;
});

schedulingModeSelect.addEventListener('change', (event) => {
    Config.SIMULATION_SETTINGS.defaultSchedulingMode = event.target.value;
    console.log(`Job Scheduling Mode set to: ${event.target.value}`);
    // No immediate re-render needed, will take effect on next Sim.update()
});

triggerGpuErrorButton.addEventListener('click', () => {
    if (Sim.triggerRandomGpuError()) {
        // Optionally, give visual feedback that it was triggered, though console logs it.
        // UI.render(); // Render immediately to show the new error state
        // The simulation loop will pick it up and render, so this might not be strictly necessary
        // unless an immediate UI update before the next gameLoop tick is desired.
        console.log("Attempted to trigger a random GPU error.");
    } else {
        alert("Could not trigger GPU error (no healthy GPUs or other issue).");
    }
});

// Listener for Custom Job Communication Intensity Slider
if (customJobCommIntensitySlider) {
    customJobCommIntensitySlider.addEventListener('input', (event) => {
        customJobCommIntensityValueDisplay.textContent = parseFloat(event.target.value).toFixed(2);
    });
}

// Listener for Custom Job Category to show/hide training fields
if (customJobCategorySelect) {
    customJobCategorySelect.addEventListener('change', (event) => {
        if (event.target.value === 'training') {
            customJobTrainingFieldsDiv.style.display = 'block';
        } else {
            customJobTrainingFieldsDiv.style.display = 'none';
        }
    });
}

// Listener for Add Custom Job Button
if (addCustomJobButton) {
    addCustomJobButton.addEventListener('click', () => {
        const jobParams = {
            name: customJobNameInput.value.trim(),
            jobCategory: customJobCategorySelect.value,
            parametersBillion: customJobParamsInput.value,
            precision: customJobPrecisionSelect.value,
            baseOpsPerToken: customJobBaseOpsInput.value,
            communicationIntensityFactor: customJobCommIntensitySlider.value,
            totalTokens: customJobTokensInput.value,
        };

        if (jobParams.jobCategory === 'training') {
            jobParams.targetEpochs = customJobEpochsInput.value;
            jobParams.initialLoss = customJobInitialLossInput.value;
            jobParams.lossReductionPerEpoch = customJobLossReductionInput.value;
        }

        // Basic Validation (can be expanded)
        if (!jobParams.parametersBillion || parseFloat(jobParams.parametersBillion) <= 0) {
            alert("Please enter a valid number of parameters (Billions)."); return;
        }
        if (!jobParams.precision) { alert("Please select a precision."); return; }
        if (!jobParams.baseOpsPerToken || parseFloat(jobParams.baseOpsPerToken) <= 0) {
            alert("Please enter a valid number for Base Ops/Token."); return;
        }
        if (!jobParams.totalTokens || parseInt(jobParams.totalTokens, 10) <= 0) {
            alert("Please enter a valid number for Total Tokens."); return;
        }
        if (jobParams.jobCategory === 'training') {
            if(!jobParams.targetEpochs || parseInt(jobParams.targetEpochs, 10) <=0) {
                alert("Please enter valid Target Epochs for training job."); return;
            }
        }

        Sim.addCustomJobToQueue(jobParams);
        console.log("Attempted to add custom job:", jobParams);
        if (!isSimulationRunning) {
            UI.render(); // Update UI if simulation is paused
        }
        // Optionally clear or reset form fields here
        // customJobNameInput.value = ''; 
        // customJobParamsInput.value = '7'; // Reset to default
        // etc.
    });
}

// --- Initialization ---
function populatePrecisions() {
    if (!customJobPrecisionSelect) return;
    customJobPrecisionSelect.innerHTML = '';
    for (const key in Config.PRECISION_CONFIG) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = Config.PRECISION_CONFIG[key].name;
        customJobPrecisionSelect.appendChild(option);
    }
    // Set a default selection if needed
    if (customJobPrecisionSelect.options.length > 0) {
        const defaultPrecision = 'FP16'; // or BF16, etc.
        if (Config.PRECISION_CONFIG[defaultPrecision]) {
            customJobPrecisionSelect.value = defaultPrecision;
        }
    }
}

function populateSchedulingModes() {
    schedulingModeSelect.innerHTML = ''; // Clear existing options
    for (const modeKey in Config.SCHEDULING_MODES) {
        const option = document.createElement('option');
        option.value = modeKey;
        option.textContent = Config.SCHEDULING_MODES[modeKey];
        schedulingModeSelect.appendChild(option);
    }
}

function init() {
    console.log("Application fully loaded.");
    populatePrecisions(); // Populate custom job precision dropdown
    populateSchedulingModes(); // Populate scheduling modes dropdown

    // Initialize simulation and UI to default state on page load
    Sim.initialize();
    UI.initializeUI(simulationArea, statsArea);
    // UI.render(); // Render the initial state -- This will be called after settings init

    // Set initial button states
    startSimButton.disabled = false; // Ready to start
    stopSimButton.disabled = true;
    resetSimButton.disabled = true; // Can be enabled if resetting initial state is desired, but typically after a stop.

    // Initialize Settings Panel Controls
    perfModeSelect.value = Config.SIMULATION_SETTINGS.performanceMode;
    perfModeSelect.disabled = false; // Initially enabled
    realisticPerfFactorGroup.style.display = Config.SIMULATION_SETTINGS.performanceMode === 'realistic' ? 'block' : 'none';

    timeScaleSlider.value = Config.SIMULATION_SETTINGS.timeScaleFactor;
    timeScaleValueDisplay.textContent = `${Config.SIMULATION_SETTINGS.timeScaleFactor.toFixed(1)}x`;

    realisticPerfFactorSlider.value = Config.SIMULATION_SETTINGS.realisticPerformanceFactor;
    realisticPerfFactorValueDisplay.textContent = Config.SIMULATION_SETTINGS.realisticPerformanceFactor.toFixed(2);

    gpuProcessingUnitsInput.value = Config.GPU_CONFIG.baseProcessingUnits;
    gpuMemoryGbInput.value = Config.GPU_CONFIG.memoryGB;
    gpuLoadSpeedSlider.value = Config.GPU_CONFIG.modelLoadMemoryBandwidthFactor;
    gpuLoadSpeedValueDisplay.textContent = Config.GPU_CONFIG.modelLoadMemoryBandwidthFactor.toFixed(2);
    
    maxConcurrentJobsInput.value = Config.SIMULATION_SETTINGS.maxConcurrentJobsPerGpu;
    errorChanceSlider.value = Config.SIMULATION_SETTINGS.errorChancePerTick;
    errorChanceValueDisplay.textContent = Config.SIMULATION_SETTINGS.errorChancePerTick.toFixed(4);
    gpuRecoveryTicksInput.value = Config.SIMULATION_SETTINGS.gpuRecoveryTimeTicks;
    interconnectBottleneckSlider.value = Config.SIMULATION_SETTINGS.interconnectBottleneckFactor;
    interconnectBottleneckValueDisplay.textContent = Config.SIMULATION_SETTINGS.interconnectBottleneckFactor.toFixed(2);

    // Initialize Thermal Throttling Settings
    thermalThresholdSlider.value = Config.GPU_CONFIG.thermalThrottlingThresholdLoad;
    thermalThresholdValueDisplay.textContent = `${Config.GPU_CONFIG.thermalThrottlingThresholdLoad}%`;
    thermalSeveritySlider.value = Config.GPU_CONFIG.thermalThrottlingSeverity;
    thermalSeverityValueDisplay.textContent = Config.GPU_CONFIG.thermalThrottlingSeverity.toFixed(2);
    ticksToOverheatInput.value = Config.GPU_CONFIG.ticksToOverheat;
    ticksToCooldownInput.value = Config.GPU_CONFIG.ticksToCooldown;
    cooldownLoadThresholdSlider.value = Config.GPU_CONFIG.cooldownLoadThreshold;
    cooldownLoadThresholdValueDisplay.textContent = `${Config.GPU_CONFIG.cooldownLoadThreshold}%`;
    // schedulingModeSelect.value = Config.SIMULATION_SETTINGS.defaultSchedulingMode; // This is already set a few lines below, keep it there.

    // Initialize Master Toggles
    enableGpuErrorsToggle.checked = Config.SIMULATION_SETTINGS.gpuErrorsEnabled;
    enableThermalThrottlingToggle.checked = Config.SIMULATION_SETTINGS.thermalThrottlingEnabled;

    // Initialize Settings Panel Controls (continued)
    schedulingModeSelect.value = Config.SIMULATION_SETTINGS.defaultSchedulingMode;

    // Initialize Custom Job Form Defaults (if any beyond HTML values)
    if (customJobCommIntensitySlider) customJobCommIntensityValueDisplay.textContent = parseFloat(customJobCommIntensitySlider.value).toFixed(2);
    if (customJobCategorySelect && customJobTrainingFieldsDiv) { // Ensure elements exist
         customJobTrainingFieldsDiv.style.display = customJobCategorySelect.value === 'training' ? 'block' : 'none';
    }

    updateDependentControlsStates(); // Set initial state of dependent controls
    UI.render(); // Render the initial state AFTER all settings are initialized
}

// Wait for the DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', init);

// Event listeners for master toggles
enableGpuErrorsToggle.addEventListener('change', (event) => {
    Config.SIMULATION_SETTINGS.gpuErrorsEnabled = event.target.checked;
    updateDependentControlsStates();
    console.log(`GPU Errors Enabled set to: ${event.target.checked}`);
    if (!event.target.checked) { // If errors are being disabled
        Sim.clearAllGpuErrorsAndRecover();
    }
    // Potentially re-render UI if GPU cards need to change appearance immediately (e.g. hide error states if disabled)
    if (!isSimulationRunning) UI.render(); 
});

enableThermalThrottlingToggle.addEventListener('change', (event) => {
    Config.SIMULATION_SETTINGS.thermalThrottlingEnabled = event.target.checked;
    updateDependentControlsStates();
    console.log(`Thermal Throttling Enabled set to: ${event.target.checked}`);
    if (!event.target.checked) { // If thermal throttling is being disabled
        // The logic to disable thermal throttling is handled in simulation.js by checking the
        // Config.SIMULATION_SETTINGS.thermalThrottlingEnabled flag in GPU.processTick().
        // GPUs will not enter or progress thermal states if this flag is false.
        // Thus, the console log below is misleading and will be removed.
        // console.log("Thermal throttling disabled. Implement the logic to disable thermal throttling in the simulation.");
    }
    // Potentially re-render UI if GPU cards need to change appearance immediately
    if (!isSimulationRunning) UI.render(); 
});

// Helper function to enable/disable dependent controls
function updateDependentControlsStates() {
    const errorsEnabled = Config.SIMULATION_SETTINGS.gpuErrorsEnabled;
    errorChanceSlider.disabled = !errorsEnabled;
    gpuRecoveryTicksInput.disabled = !errorsEnabled;
    triggerGpuErrorButton.disabled = !errorsEnabled;
    // If errors are disabled, also visually update the slider display if it implies value is 0 or N/A
    // For now, just disabling is fine. UI could show errorChanceValueDisplay as 'N/A' if !errorsEnabled.

    const thermalsEnabled = Config.SIMULATION_SETTINGS.thermalThrottlingEnabled;
    thermalThresholdSlider.disabled = !thermalsEnabled;
    thermalSeveritySlider.disabled = !thermalsEnabled;
    ticksToOverheatInput.disabled = !thermalsEnabled;
    ticksToCooldownInput.disabled = !thermalsEnabled;
    cooldownLoadThresholdSlider.disabled = !thermalsEnabled;
} 