// GPU Rack Playground/js/ui.js
import * as Sim from './simulation.js';
import * as Config from './config.js';

let simArea = null;
let statsDisplay = null;
let gpuElements = {}; // To store references to GPU div elements
let gpuDetailModal = null;
let modalGpuIdEl = null;
let modalGpuStatusEl = null;
let modalGpuLoadEl = null;
let modalGpuMemoryEl = null;
let modalGpuPowerEl = null;
let modalGpuThrottledEl = null;
let modalGpuErrorDetailsEl = null;
let modalGpuThermalDetailsEl = null;
let modalActiveJobsListEl = null;
let modalCloseBtn = null;

// --- Initialization ---
export function initializeUI(simulationAreaElement, statsAreaElement) {
    simArea = simulationAreaElement;
    statsDisplay = statsAreaElement;

    // Initialize Modal Elements
    gpuDetailModal = document.getElementById('gpu-detail-modal');
    modalGpuIdEl = document.getElementById('modal-gpu-id');
    modalGpuStatusEl = document.getElementById('modal-gpu-status');
    modalGpuLoadEl = document.getElementById('modal-gpu-load');
    modalGpuMemoryEl = document.getElementById('modal-gpu-memory');
    modalGpuPowerEl = document.getElementById('modal-gpu-power');
    modalGpuThrottledEl = document.getElementById('modal-gpu-throttled');
    modalGpuErrorDetailsEl = document.getElementById('modal-gpu-error-details');
    modalGpuThermalDetailsEl = document.getElementById('modal-gpu-thermal-details');
    modalActiveJobsListEl = document.getElementById('modal-active-jobs-list');
    modalCloseBtn = document.querySelector('.modal-close-btn');

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', hideGpuModal);
    }
    // Add event listener to modal overlay to close when clicked outside content
    if (gpuDetailModal) {
        gpuDetailModal.addEventListener('click', (event) => {
            if (event.target === gpuDetailModal) { // Only if the click is on the overlay itself
                hideGpuModal();
            }
        });
    }

    simArea.innerHTML = ''; // Clear placeholder
    statsDisplay.innerHTML = ''; // Clear placeholder

    // Create a container for the GPU rack
    const rackContainer = document.createElement('div');
    rackContainer.id = 'gpu-rack-container';
    simArea.appendChild(rackContainer);

    // Create visual elements for each GPU
    const gpuStates = Sim.getGpuStates(); // Get initial states to know how many GPUs
    gpuStates.forEach(gpuState => {
        const gpuDiv = document.createElement('div');
        gpuDiv.id = gpuState.id;
        gpuDiv.className = 'gpu-card idle'; // Will be updated by render based on gpuState.status
        gpuDiv.innerHTML = `
            <div class="gpu-id">${gpuState.id}</div>
            <div class="gpu-status-text">Status: idle</div>
            <div class="gpu-error-info"></div> <!-- For error messages -->
            <div class="gpu-thermal-info"></div> <!-- For thermal throttling messages -->
            <div class="gpu-token-animation-area"></div> <!-- For token animations -->
            <div class="gpu-metric">
                <span>Load: </span><span class="gpu-load-value">0%</span>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill load-fill"></div>
                </div>
            </div>
            <div class="gpu-metric">
                <span>Mem: </span><span class="gpu-memory-value">0 / ${Config.GPU_CONFIG.memoryGB} GB</span>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill memory-fill"></div>
                </div>
            </div>
            <div class="gpu-jobs-display">Jobs: 0</div>
            <div class="gpu-tokens-tick-container">
                <span>Tokens/tick: </span><span class="gpu-tokens-tick-value">0</span>
            </div>
            <div class="gpu-job-details-area"></div>
        `;
        rackContainer.appendChild(gpuDiv);
        gpuElements[gpuState.id] = gpuDiv; // Store reference

        // Add click listener for modal
        gpuDiv.addEventListener('click', () => {
            showGpuModal(gpuState.id);
        });
    });

    console.log(`UI Initialized with ${Object.keys(gpuElements).length} GPU elements.`);
}

export function resetUI() {
    // Re-initialize if simArea and statsDisplay are known
    if (simArea && statsDisplay) {
        initializeUI(simArea, statsDisplay);
    }
    // Clear any dynamic stats or job lists if they exist
    if (statsDisplay) {
         statsDisplay.innerHTML = '<p>Performance Metrics Reset. (Logic Reset)</p>';
    }
}


// --- Rendering ---
function renderTokensPerSecondChart(historyData, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = ''; // Clear previous chart

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    
    const padding = { top: 10, right: 5, bottom: 5, left: 25 }; // Adjusted left for Y-axis values
    const totalWidth = container.clientWidth || 280; // Fallback width if clientWidth is 0
    const totalHeight = 100; // Fixed height for the chart

    svg.setAttribute("width", totalWidth.toString());
    svg.setAttribute("height", totalHeight.toString());
    svg.setAttribute("viewBox", `0 0 ${totalWidth} ${totalHeight}`);
    svg.style.backgroundColor = "#2c313a"; // Match card background
    svg.style.borderRadius = "4px";

    if (historyData.length < 2) {
        const noDataText = document.createElementNS(svgNS, "text");
        noDataText.setAttribute("x", (totalWidth / 2).toString());
        noDataText.setAttribute("y", (totalHeight / 2).toString());
        noDataText.setAttribute("fill", "#5c6370");
        noDataText.setAttribute("text-anchor", "middle");
        noDataText.setAttribute("font-size", "10px");
        noDataText.textContent = "Collecting data...";
        svg.appendChild(noDataText);
        container.appendChild(svg);
        return;
    }

    const chartWidth = totalWidth - padding.left - padding.right;
    const chartHeight = totalHeight - padding.top - padding.bottom;

    const maxVal = Math.max(...historyData, 0); // Ensure maxVal is at least 0
    const minVal = 0; // Assuming tokens/sec doesn't go negative

    // Y-axis max value text
    if (maxVal > 0) {
        const maxYText = document.createElementNS(svgNS, "text");
        maxYText.setAttribute("x", (padding.left - 3).toString());
        maxYText.setAttribute("y", padding.top.toString());
        maxYText.setAttribute("fill", "#abb2bf");
        maxYText.setAttribute("font-size", "8px");
        maxYText.setAttribute("text-anchor", "end");
        maxYText.setAttribute("dominant-baseline", "hanging");
        maxYText.textContent = maxVal.toFixed(0);
        svg.appendChild(maxYText);
    }
    // Y-axis min value text (0)
    const minYText = document.createElementNS(svgNS, "text");
    minYText.setAttribute("x", (padding.left - 3).toString());
    minYText.setAttribute("y", (padding.top + chartHeight).toString());
    minYText.setAttribute("fill", "#abb2bf");
    minYText.setAttribute("font-size", "8px");
    minYText.setAttribute("text-anchor", "end");
    minYText.setAttribute("dominant-baseline", "alphabetic");
    minYText.textContent = "0";
    svg.appendChild(minYText);

    const points = historyData.map((val, index) => {
        const x = padding.left + (index / (historyData.length - 1)) * chartWidth;
        const y = padding.top + chartHeight - ((val - minVal) / (maxVal - minVal + 1e-6)) * chartHeight; // Add epsilon for maxVal=minVal case
        return `${x},${y}`;
    }).join(' ');

    const polyline = document.createElementNS(svgNS, "polyline");
    polyline.setAttribute("points", points);
    polyline.setAttribute("fill", "none");
    polyline.setAttribute("stroke", "#61afef"); // Accent color for line
    polyline.setAttribute("stroke-width", "1.5");
    svg.appendChild(polyline);

    container.appendChild(svg);
}

export function render() {
    if (!simArea || !statsDisplay) return;

    // Update GPU elements
    const gpuStates = Sim.getGpuStates();
    gpuStates.forEach(gpuState => {
        const gpuDiv = gpuElements[gpuState.id];
        if (gpuDiv) {
            // Base class is always gpu-card, status class (idle, busy, error) is added/changed
            gpuDiv.className = `gpu-card ${gpuState.status} ${gpuState.isThrottled ? 'throttled' : ''}`;
            gpuDiv.querySelector('.gpu-status-text').textContent = `Status: ${gpuState.status.toUpperCase()}`;

            const errorInfoEl = gpuDiv.querySelector('.gpu-error-info');
            if (gpuState.isError) {
                const recoveryProgress = Math.floor((gpuState.ticksInErrorState / gpuState.gpuRecoveryTimeTicks) * 100);
                errorInfoEl.textContent = `Recovering: ${recoveryProgress}% (${gpuState.ticksInErrorState}/${gpuState.gpuRecoveryTimeTicks} ticks)`;
                errorInfoEl.style.display = 'block';
            } else {
                errorInfoEl.textContent = '';
                errorInfoEl.style.display = 'none';
            }
            
            const thermalInfoEl = gpuDiv.querySelector('.gpu-thermal-info');
            if (!Config.SIMULATION_SETTINGS.thermalThrottlingEnabled) {
                thermalInfoEl.textContent = 'Thermals: N/A (Disabled)';
                thermalInfoEl.style.display = 'block';
                // Ensure text color is neutral if it was previously set to warning/error color
                thermalInfoEl.style.color = '#abb2bf'; // Standard text color
            } else if (gpuState.isThrottled) {
                thermalInfoEl.textContent = `THROTTLED (Cooling: ${gpuState.ticksCoolingDown}/${Config.GPU_CONFIG.ticksToCooldown} | Heat: ${gpuState.ticksAtHighLoad}/${Config.GPU_CONFIG.ticksToOverheat})`;
                thermalInfoEl.style.display = 'block';
                thermalInfoEl.style.color = '#e5c07b'; // Warning yellow
            } else if (gpuState.ticksAtHighLoad > 0) {
                thermalInfoEl.textContent = `Heating up: ${gpuState.ticksAtHighLoad}/${Config.GPU_CONFIG.ticksToOverheat}`;
                thermalInfoEl.style.display = 'block';
                thermalInfoEl.style.color = '#e5c07b'; // Warning yellow
            } else if (gpuState.ticksCoolingDown > 0) {
                 thermalInfoEl.textContent = `Cooling: ${gpuState.ticksCoolingDown}/${Config.GPU_CONFIG.ticksToCooldown}`;
                 thermalInfoEl.style.display = 'block';
                 thermalInfoEl.style.color = '#e5c07b'; // Warning yellow
            } else {
                thermalInfoEl.textContent = '';
                thermalInfoEl.style.display = 'none';
            }
            
            const tokenAnimationArea = gpuDiv.querySelector('.gpu-token-animation-area');
            // Update Load, Memory, Jobs, Tokens, Job Details (only if not in error)
            if (!gpuState.isError) {
                gpuDiv.querySelector('.gpu-load-value').textContent = `${gpuState.currentLoad}%`;
                const loadFill = gpuDiv.querySelector('.load-fill');
                loadFill.style.width = `${gpuState.currentLoad}%`;

                const memoryPercentage = (gpuState.memoryUsedGB / Config.GPU_CONFIG.memoryGB) * 100;
                gpuDiv.querySelector('.gpu-memory-value').textContent = `${gpuState.memoryUsedGB.toFixed(1)} / ${Config.GPU_CONFIG.memoryGB} GB`;
                const memoryFill = gpuDiv.querySelector('.memory-fill');
                memoryFill.style.width = `${memoryPercentage}%`;

                gpuDiv.querySelector('.gpu-jobs-display').textContent = `Jobs: ${gpuState.activeJobsCount}`;

                const tokensTickValueEl = gpuDiv.querySelector('.gpu-tokens-tick-value');
                tokensTickValueEl.textContent = gpuState.tokensProcessedThisTick > 0 ? gpuState.tokensProcessedThisTick.toFixed(1) : '0';
                if (gpuState.tokensProcessedThisTick > 0 && tokenAnimationArea.children.length < 20) { // Limit tokens
                    const tokenDiv = document.createElement('div');
                    tokenDiv.className = 'token-animation';
                    tokenAnimationArea.appendChild(tokenDiv);
                    setTimeout(() => {
                        if (tokenDiv.parentNode === tokenAnimationArea) { // Check if still child before removing
                           tokenAnimationArea.removeChild(tokenDiv);
                        }
                    }, 900); // Match animation duration
                }

                const jobDetailsArea = gpuDiv.querySelector('.gpu-job-details-area');
                if (gpuState.activeJobsDetails.length > 0) {
                    jobDetailsArea.innerHTML = gpuState.activeJobsDetails.map(job => {
                        const jobTypeInitial = job.jobCategory === 'training' ? 'T' : 'I';
                        const precisionName = Config.PRECISION_CONFIG[job.precision] ? Config.PRECISION_CONFIG[job.precision].name.split(' ')[0] : job.precision;
                        let detailStr = `<div class="job-detail job-category-${job.jobCategory.toLowerCase()}">
                            <span class="job-type-indicator">[${jobTypeInitial}]</span>
                            JID: ${job.id} (${job.parametersBillion}B ${precisionName}, ${job.statusDetail}`;
                        if (job.statusDetail === 'loading model') {
                            detailStr += ` ${job.modelLoadProgress.toFixed(0)}%`;
                        } else if (job.jobCategory === 'training' && job.statusDetail === 'processing') {
                            detailStr += `, E: ${job.currentEpoch}/${job.targetEpochs}, L: ${job.currentLoss !== undefined ? job.currentLoss.toFixed(3) : 'N/A'}`;
                        }
                        detailStr += `)</div>`;
                        return detailStr;
                    }).join('');
                } else {
                    jobDetailsArea.innerHTML = '<div class="job-detail">No active jobs</div>';
                }
            } else { // GPU is in error state - clear/hide job-specific details
                gpuDiv.querySelector('.gpu-load-value').textContent = `0%`;
                gpuDiv.querySelector('.load-fill').style.width = `0%`;
                gpuDiv.querySelector('.gpu-memory-value').textContent = `0 / ${Config.GPU_CONFIG.memoryGB} GB`;
                gpuDiv.querySelector('.memory-fill').style.width = `0%`;
                gpuDiv.querySelector('.gpu-jobs-display').textContent = `Jobs: 0`;
                gpuDiv.querySelector('.gpu-tokens-tick-value').textContent = `0`;
                gpuDiv.querySelector('.gpu-job-details-area').innerHTML = '<p class="gpu-is-error">GPU OFFLINE</p>';
            }
        }
    });

    // Update overall stats display
    const overallStats = Sim.getOverallStats();
    const tokensHistory = Sim.getTokensPerSecondHistory(); // Get history data

    statsDisplay.innerHTML = `
        <h2>Performance Stats</h2>
        <p>Time: ${overallStats.simulationTime}s <span class="time-scale-indicator">(${overallStats.timeScaleFactor}x speed)</span></p>
        <p>Performance Mode: <strong>${Config.SIMULATION_SETTINGS.performanceMode.toUpperCase()}</strong></p>
        <p>Active GPUs: ${overallStats.activeGpus} / ${overallStats.totalGpus} (Error: ${overallStats.errorGpus})</p>
        <p>Avg. GPU Load: ${overallStats.avgGpuLoad}%</p>
        <p>Total Memory: ${overallStats.totalMemoryUsedGB} / ${overallStats.totalMemoryCapacityGB} GB</p>
        <p>Total System Power: ${overallStats.totalSystemPowerWatts} W</p>
        <p>Tokens/sec (current): ${overallStats.tokensPerSecond}</p>
        <p>Pending Jobs: ${overallStats.pendingJobsCount}</p>
        <p>Completed Jobs: ${overallStats.completedJobsCount}</p>
        <hr>
        <div id="performance-chart-area">
             <h4>Tokens/sec History (Last ${Config.SIMULATION_SETTINGS.chartHistoryLength} ticks)</h4>
             <div id="tokens-chart-container"></div>
        </div>
        <hr>
        <h4>Pending Jobs Queue:</h4>
        <div id="pending-jobs-list"></div>
        <h4>Completed Jobs Log:</h4>
        <div id="completed-jobs-list"></div>
    `;

    renderTokensPerSecondChart(tokensHistory, "tokens-chart-container");

    // Update pending jobs list
    const pendingJobsList = document.getElementById('pending-jobs-list');
    const pendingJobs = Sim.getPendingJobs();
    if (pendingJobs.length > 0) {
        pendingJobsList.innerHTML = '<ul>' + pendingJobs.map(job => 
            `<li>[${job.jobCategory.substring(0,1).toUpperCase()}] ${job.id} (${job.type}): ${job.tokensRemaining} tokens left - ${job.statusDetail}</li>`
        ).join('') + '</ul>';
    } else {
        pendingJobsList.innerHTML = '<p>No pending jobs.</p>';
    }

    // Update completed jobs list
    const completedJobsList = document.getElementById('completed-jobs-list');
    const completedJobs = Sim.getCompletedJobs().slice(-15).reverse(); // Show last 15, newest first
     if (completedJobs.length > 0) {
        completedJobsList.innerHTML = '<ul>' + completedJobs.map(job => {
            let detail = `<li class="job-status-${job.status}">[${job.jobCategory.substring(0,1).toUpperCase()}] ${job.id} (${job.type}): <strong>${job.statusDetail}</strong>`;
            if (job.status === 'completed') {
                detail += ` in ${job.duration}s.`;
                if (job.jobCategory === 'training') {
                    detail += ` Final Epoch: ${job.finalEpoch}, Final Loss: ${job.finalLoss}.`;
                }
            } else if (job.status === 'failed') {
                 detail += ` at ${job.endTime}s.`;
            }
            detail += `</li>`;
            return detail;
        }).join('') + '</ul>';
    } else {
        completedJobsList.innerHTML = '<p>No completed jobs yet.</p>';
    }
}

// --- Modal Functions ---
export function showGpuModal(gpuId) {
    if (!gpuDetailModal) return;

    const gpuState = Sim.getGpuStates().find(g => g.id === gpuId);
    if (!gpuState) {
        console.error(`GPU state for ${gpuId} not found for modal.`);
        return;
    }

    modalGpuIdEl.textContent = `GPU Details: ${gpuState.id}`;
    modalGpuStatusEl.textContent = gpuState.status.toUpperCase();
    modalGpuLoadEl.textContent = `${gpuState.currentLoad}%`;
    modalGpuMemoryEl.textContent = `${gpuState.memoryUsedGB.toFixed(1)} / ${Config.GPU_CONFIG.memoryGB} GB`;
    modalGpuPowerEl.textContent = `${gpuState.currentPowerConsumption}W`;
    modalGpuThrottledEl.textContent = gpuState.isThrottled ? `YES (Cooling: ${gpuState.ticksCoolingDown}/${Config.GPU_CONFIG.ticksToCooldown}, Heating: ${gpuState.ticksAtHighLoad}/${Config.GPU_CONFIG.ticksToOverheat})` : 'NO';
    
    if (gpuState.isError) {
        modalGpuErrorDetailsEl.textContent = `Error Active. Recovering: ${Math.floor((gpuState.ticksInErrorState / gpuState.gpuRecoveryTimeTicks) * 100)}%`;
    } else {
        modalGpuErrorDetailsEl.textContent = 'No errors.';
    }

    let thermalText = 'N/A';
    if (gpuState.isThrottled) {
        thermalText = `Currently Throttled. Severity: ${Config.GPU_CONFIG.thermalThrottlingSeverity * 100}% reduction.`;
    } else if (gpuState.ticksAtHighLoad > 0) {
        thermalText = `Heating Up: ${gpuState.ticksAtHighLoad}/${Config.GPU_CONFIG.ticksToOverheat} ticks at high load.`;
    } else if (gpuState.ticksCoolingDown > 0) {
        thermalText = `Cooling Down: ${gpuState.ticksCoolingDown}/${Config.GPU_CONFIG.ticksToCooldown} ticks.`;
    } else {
        thermalText = 'Nominal';
    }
    modalGpuThermalDetailsEl.textContent = thermalText;

    if (gpuState.activeJobsDetails.length > 0) {
        modalActiveJobsListEl.innerHTML = gpuState.activeJobsDetails.map(job => {
            const jobTypeInitial = job.jobCategory === 'training' ? 'T' : 'I';
            const precisionName = Config.PRECISION_CONFIG[job.precision] ? Config.PRECISION_CONFIG[job.precision].name.split(' ')[0] : job.precision;
            let detailStr = `<li class="job-category-${job.jobCategory.toLowerCase()}">
                <span class="job-type-indicator">[${jobTypeInitial}]</span>
                <strong>${job.id}</strong> (${job.parametersBillion}B ${precisionName}): ${job.statusDetail}`;
            if (job.statusDetail === 'loading model') {
                detailStr += ` ${job.modelLoadProgress.toFixed(0)}%`;
            } else if (job.statusDetail === 'processing') {
                detailStr += `, Tokens Rem: ${job.tokensRemaining.toFixed(0)}`;
                if (job.jobCategory === 'training') {
                    detailStr += `, Epoch: ${job.currentEpoch}/${job.targetEpochs}, Loss: ${job.currentLoss !== undefined ? job.currentLoss.toFixed(3) : 'N/A'}`;
                }
            }
            detailStr += `</li>`;
            return detailStr;
        }).join('');
    } else {
        modalActiveJobsListEl.innerHTML = '<li>No active jobs on this GPU.</li>';
    }

    gpuDetailModal.classList.remove('modal-hidden');
    gpuDetailModal.classList.add('modal-visible');
}

export function hideGpuModal() {
    if (!gpuDetailModal) return;
    gpuDetailModal.classList.remove('modal-visible');
    gpuDetailModal.classList.add('modal-hidden');
    // Optionally clear content if sensitive or large
    // modalGpuIdEl.textContent = 'GPU Details';
    // modalActiveJobsListEl.innerHTML = '<p>Loading details...</p>'; // Reset to placeholder
} 