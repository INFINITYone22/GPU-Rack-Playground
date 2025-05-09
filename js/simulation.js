// GPU Rack Playground/js/simulation.js
import * as Config from './config.js';

// --- Simulation State ---
let gpus = []; // Array to hold all GPU objects
let pendingJobs = []; // Queue for jobs waiting for a GPU
let completedJobs = []; // List of jobs that have finished processing
let nextJobId = 0;
let simulationTime = 0; // Total simulation time elapsed
let tokensPerSecondHistory = []; // For performance chart

// --- GPU Class ---
// Represents a single GPU in the rack
class GPU {
    constructor(id) {
        this.id = `gpu-${id}`;
        this.config = Config.GPU_CONFIG;
        this.status = 'idle'; // 'idle', 'busy', 'error'
        this.currentLoad = 0;
        this.memoryUsedGB = 0;
        this.activeJobs = [];
        this.tokensProcessedThisTick = 0;
        this.totalTokensProcessed = 0;
        this.ticksInErrorState = 0; // For error recovery duration
        this.currentPowerConsumption = this.config.basePowerConsumptionWatts; // Initial power
        // Thermal state
        this.isThrottled = false;
        this.ticksAtHighLoad = 0;
        this.ticksCoolingDown = 0;
    }

    canFitJob(job) {
        return this.status === 'idle' && 
               (this.memoryUsedGB + job.memoryFootprintGB) <= this.config.memoryGB &&
               this.activeJobs.length < Config.SIMULATION_SETTINGS.maxConcurrentJobsPerGpu;
    }

    addJob(job) {
        if (this.canFitJob(job)) {
            this.activeJobs.push(job);
            this.memoryUsedGB += job.memoryFootprintGB;
            this.status = 'busy';
            job.assignedGpuId = this.id;
            job.startTime = simulationTime;

            // Model Loading Simulation
            if (job.memoryFootprintGB > 0 && this.config.modelLoadMemoryBandwidthFactor > 0) {
                job.modelLoadTimeTicks = Math.ceil(job.memoryFootprintGB / this.config.modelLoadMemoryBandwidthFactor);
                job.statusDetail = 'loading model';
                job.modelLoadProgress = 0;
            } else {
                job.modelLoadTimeTicks = 0;
                job.statusDetail = 'processing'; // No loading needed or instant
                job.modelLoadProgress = 100;
            }
            return true;
        }
        return false;
    }

    removeJob(jobId) {
        const jobIndex = this.activeJobs.findIndex(j => j.id === jobId);
        if (jobIndex > -1) {
            const job = this.activeJobs[jobIndex];
            this.memoryUsedGB -= job.memoryFootprintGB;
            this.activeJobs.splice(jobIndex, 1);
            if (this.activeJobs.length === 0) {
                this.status = 'idle';
                this.currentLoad = 0;
            }
            return job;
        }
        return null;
    }

    processTick() {
        this.tokensProcessedThisTick = 0;
        this.currentPowerConsumption = this.config.basePowerConsumptionWatts;

        if (this.status === 'error') {
            if (!Config.SIMULATION_SETTINGS.gpuErrorsEnabled) {
                // Errors globally disabled, recover this GPU immediately
                this.status = 'idle';
                this.ticksInErrorState = 0;
                this.currentLoad = 0;
                this.currentPowerConsumption = this.config.basePowerConsumptionWatts;
                this.isThrottled = false; // Reset thermal state as well
                this.ticksAtHighLoad = 0;
                this.ticksCoolingDown = 0;
                console.log(`GPU ${this.id} recovered (processTick) as errors globally disabled.`);
                // GPU is now idle, proceed with normal tick processing for an idle GPU
            } else {
                // Original error countdown logic
                this.ticksInErrorState += Config.SIMULATION_SETTINGS.timeScaleFactor;
                this.currentLoad = 0;
                this.currentPowerConsumption = this.config.basePowerConsumptionWatts * 0.5;
                
                if (this.ticksInErrorState >= Config.SIMULATION_SETTINGS.gpuRecoveryTimeTicks) {
                    this.status = 'idle';
                    this.ticksInErrorState = 0;
                    console.log(`GPU ${this.id} recovered from error and is now idle.`);
                }
                // GPU is still in error or just recovered, reset thermal and skip further processing for this tick
                this.isThrottled = false;
                this.ticksAtHighLoad = 0;
                this.ticksCoolingDown = 0;
                return; 
            }
        }

        // If it was an error but errors got disabled, status is now 'idle'. Normal processing continues.

        if (Config.SIMULATION_SETTINGS.gpuErrorsEnabled) {
            if ((this.status === 'idle' || this.status === 'busy')) {
                if (Math.random() < Config.SIMULATION_SETTINGS.errorChancePerTick * Config.SIMULATION_SETTINGS.timeScaleFactor) {
                    console.warn(`GPU ${this.id} encountered an error!`);
                    this.status = 'error';
                    this.ticksInErrorState = 0;
                    this.currentLoad = 0;
                    this.currentPowerConsumption = this.config.basePowerConsumptionWatts * 0.5;
                    
                    const jobsToFail = [...this.activeJobs];
                    this.activeJobs = [];
                    
                    jobsToFail.forEach(failedJob => {
                        const jobWorkloadConfig = Config.WORKLOAD_CONFIG[failedJob.type];
                        this.memoryUsedGB -= failedJob.memoryFootprintGB;
                        if (this.memoryUsedGB < 0) this.memoryUsedGB = 0;

                        failedJob.status = 'failed';
                        failedJob.statusDetail = 'failed (GPU error)';
                        failedJob.endTime = simulationTime;
                        completedJobs.push(failedJob);
                        console.log(`Job ${failedJob.id} (Type: ${failedJob.type}) on GPU ${this.id} failed due to GPU error.`);
                    });
                    this.isThrottled = false;
                    this.ticksAtHighLoad = 0;
                    this.ticksCoolingDown = 0;
                    return;
                }
            }
        }

        // Calculate current processing work and load (before thermal effects)
        let baseEffectiveProcessingUnits = this.config.baseProcessingUnits;
        if (Config.SIMULATION_SETTINGS.performanceMode === 'realistic') {
            baseEffectiveProcessingUnits *= Config.SIMULATION_SETTINGS.realisticPerformanceFactor;
        }
        baseEffectiveProcessingUnits *= Config.SIMULATION_SETTINGS.timeScaleFactor;
        
        let totalDemandMetThisTick = 0;
        let actualProcessingJobsCount = 0;

        this.activeJobs.forEach(job => {
            if (job.statusDetail === 'loading model') {
                job.modelLoadProgress += (1 / job.modelLoadTimeTicks) * 100 * Config.SIMULATION_SETTINGS.timeScaleFactor;
                if (job.modelLoadProgress >= 100) {
                    job.modelLoadProgress = 100;
                    job.statusDetail = 'processing';
                    job.processingStartTime = simulationTime; // Mark when actual processing can start
                    console.log(`Job ${job.id} finished loading on ${this.id}`);
                }
            } else if (job.statusDetail === 'processing' && job.tokensRemaining > 0) {
                actualProcessingJobsCount++;
            }
        });
        
        if (actualProcessingJobsCount === 0 && !this.activeJobs.some(j => j.statusDetail === 'loading model')) {
            // No jobs actively processing or loading, ensure load is 0 unless some other work is happening
            this.currentLoad = this.activeJobs.length > 0 ? 5 : 0; // Minimal load if jobs exist but all are loading
            // If truly no jobs or all jobs are done loading and have 0 tokens, this path won't be hit often due to job removal.
        } else if (actualProcessingJobsCount === 0 && this.activeJobs.some(j => j.statusDetail === 'loading model')) {
            this.currentLoad = 5; // Minimal load for loading activity if no token processing jobs are active.
        } else if (actualProcessingJobsCount > 0) {
            const processingPowerPerJobForLoadCalc = baseEffectiveProcessingUnits / actualProcessingJobsCount;
            let potentialDemandMetThisTick = 0;
            for (const job of this.activeJobs) {
                if (job.statusDetail !== 'processing' || job.tokensRemaining <= 0) continue;
                const workload = Config.WORKLOAD_CONFIG[job.type];
                let effectiveComputeDemandPerToken = job.computeDemandPerToken;
                if (Config.SIMULATION_SETTINGS.performanceMode === 'realistic' && workload.communicationIntensityFactor > 0) {
                    const bottleneckPenalty = workload.communicationIntensityFactor * Config.SIMULATION_SETTINGS.interconnectBottleneckFactor;
                    effectiveComputeDemandPerToken *= (1 + bottleneckPenalty);
                }
                // Calculate potential demand for load calculation before throttling
                const rawPotentialTokensForLoad = processingPowerPerJobForLoadCalc / Math.max(1, effectiveComputeDemandPerToken);
                const tokensForLoadThisJob = Math.min(job.tokensRemaining, rawPotentialTokensForLoad);
                potentialDemandMetThisTick += effectiveComputeDemandPerToken * tokensForLoadThisJob; // Changed from Math.floor version
            }
            // If baseEffectiveProcessingUnits is 0 (e.g. timeScaleFactor is 0), load should be 0.
            if (baseEffectiveProcessingUnits > 0) {
                this.currentLoad = Math.min(100, (potentialDemandMetThisTick / baseEffectiveProcessingUnits) * 100);
            } else {
                this.currentLoad = 0;
            }
        } else {
             this.currentLoad = 0; // Default to 0 if no conditions met (e.g. all jobs loaded but 0 tokens)
        }

        // Thermal Throttling Logic (applied after load calculation)
        let currentTickEffectiveProcessingUnits = baseEffectiveProcessingUnits;

        if (Config.SIMULATION_SETTINGS.thermalThrottlingEnabled) {
            if (this.isThrottled) {
                currentTickEffectiveProcessingUnits *= (1 - this.config.thermalThrottlingSeverity);
                if (this.currentLoad < this.config.cooldownLoadThreshold) {
                    this.ticksCoolingDown += Config.SIMULATION_SETTINGS.timeScaleFactor;
                    this.ticksAtHighLoad = 0;
                    if (this.ticksCoolingDown >= this.config.ticksToCooldown) {
                        this.isThrottled = false;
                        this.ticksCoolingDown = 0;
                        console.log(`GPU ${this.id} cooled down and is no longer throttled.`);
                    }
                } else {
                    this.ticksCoolingDown = 0;
                }
            } else { // Not currently throttled
                if (this.currentLoad > this.config.thermalThrottlingThresholdLoad) {
                    this.ticksAtHighLoad += Config.SIMULATION_SETTINGS.timeScaleFactor;
                    this.ticksCoolingDown = 0;
                    if (this.ticksAtHighLoad >= this.config.ticksToOverheat) {
                        this.isThrottled = true;
                        this.ticksAtHighLoad = 0;
                        console.warn(`GPU ${this.id} is now thermally throttled due to high load!`);
                    }
                } else {
                    this.ticksAtHighLoad = 0;
                    if(this.ticksCoolingDown > 0 && this.currentLoad >= this.config.cooldownLoadThreshold) {
                         this.ticksCoolingDown = 0;
                    }
                }
            }
        } else { // Thermal throttling is disabled
            this.isThrottled = false;
            this.ticksAtHighLoad = 0;
            this.ticksCoolingDown = 0;
            // currentTickEffectiveProcessingUnits remains baseEffectiveProcessingUnits (no throttling applied)
        }

        // Actual Token Processing using (potentially throttled) processing units
        if (actualProcessingJobsCount > 0) {
            const processingPowerPerJob = currentTickEffectiveProcessingUnits / actualProcessingJobsCount;
        for (const job of this.activeJobs) {
                if (job.statusDetail !== 'processing' || job.tokensRemaining <= 0) continue;
            const workload = Config.WORKLOAD_CONFIG[job.type];
                let effectiveComputeDemandPerToken = job.computeDemandPerToken;
                if (Config.SIMULATION_SETTINGS.performanceMode === 'realistic' && workload.communicationIntensityFactor > 0) {
                    const bottleneckPenalty = workload.communicationIntensityFactor * Config.SIMULATION_SETTINGS.interconnectBottleneckFactor;
                    effectiveComputeDemandPerToken *= (1 + bottleneckPenalty);
                }
                
                const rawPotentialTokens = processingPowerPerJob / Math.max(1, effectiveComputeDemandPerToken);
                const tokensToProcessThisJobTick = Math.min(
                job.tokensRemaining,
                    rawPotentialTokens // Changed from Math.floor version
                );

                if (tokensToProcessThisJobTick > 0) {
                    job.tokensRemaining -= tokensToProcessThisJobTick;
                    this.tokensProcessedThisTick += tokensToProcessThisJobTick;
                    job.totalTokensProcessedByGPU += tokensToProcessThisJobTick;

                    if (job.jobCategory === 'training') {
                        const tokensPerEpoch = job.totalTokens / job.targetEpochs;
                        // Check if an epoch was completed with this tick's processing
                        if (Math.floor(job.totalTokensProcessedByGPU / tokensPerEpoch) > job.currentEpoch) {
                            job.currentEpoch = Math.floor(job.totalTokensProcessedByGPU / tokensPerEpoch);
                            job.currentLoss = Math.max(0, job.initialLoss - (job.currentEpoch * job.lossReductionPerEpoch));
                             console.log(`Job ${job.id} on ${this.id} completed epoch ${job.currentEpoch}, loss: ${job.currentLoss.toFixed(3)}`);
                        }
                    }
                }
            if (job.tokensRemaining <= 0) {
                job.endTime = simulationTime;
                job.status = 'completed';
                    job.statusDetail = 'completed';
                completedJobs.push(job);
                }
            }
        }

        // Update power consumption (after load and throttling status are determined)
        if (this.status === 'busy' && this.currentLoad > 0) {
            const loadFraction = this.currentLoad / 100;
            this.currentPowerConsumption = this.config.basePowerConsumptionWatts + 
                                       (this.config.maxPowerConsumptionWatts - this.config.basePowerConsumptionWatts) * loadFraction;
            if(this.isThrottled) this.currentPowerConsumption *= 0.9; // Slightly less power when throttled but still active
        } else if (this.status === 'idle') {
            this.currentPowerConsumption = this.config.basePowerConsumptionWatts;
        }
        // If error, power is already set in error handling logic.
    }
}

// --- Job Class ---
// Represents a piece of work to be done
class Job {
    constructor(jobDetails) { // jobDetails is an object
        this.id = `job-${nextJobId++}`;
        
        if (jobDetails.type && !jobDetails.isCustom) { // Predefined job type
            this.type = jobDetails.type;
            const workloadConfig = Config.WORKLOAD_CONFIG[this.type];
            if (!workloadConfig) {
                console.error(`Invalid predefined job type: ${this.type}. Defaulting to 'default'.`);
                this.type = 'default';
            }
            const finalWorkloadConfig = Config.WORKLOAD_CONFIG[this.type];

            this.jobCategory = finalWorkloadConfig.jobCategory || 'inference';
            this.parametersBillion = finalWorkloadConfig.parametersBillion || 1;
            this.precision = finalWorkloadConfig.precision || 'FP16';
            this.baseOpsPerToken = finalWorkloadConfig.baseOpsPerToken || 1;
            this.communicationIntensityFactor = finalWorkloadConfig.communicationIntensityFactor || 0;
            this.totalTokens = jobDetails.totalTokens || 10000; // Allow overriding totalTokens for predefined types

            if (this.jobCategory === 'training') {
                this.targetEpochs = finalWorkloadConfig.targetEpochs || 1;
                this.initialLoss = finalWorkloadConfig.initialLoss || 0;
                this.lossReductionPerEpoch = finalWorkloadConfig.lossReductionPerEpoch || 0;
            }

        } else if (jobDetails.isCustom) { // Custom job from UI
            this.type = jobDetails.name || `custom-${this.id}`; // Use provided name or generate one
            this.jobCategory = jobDetails.jobCategory;
            this.parametersBillion = jobDetails.parametersBillion;
            this.precision = jobDetails.precision;
            this.baseOpsPerToken = jobDetails.baseOpsPerToken;
            this.communicationIntensityFactor = jobDetails.communicationIntensityFactor;
            this.totalTokens = jobDetails.totalTokens;

            if (this.jobCategory === 'training') {
                this.targetEpochs = jobDetails.targetEpochs || 1;
                this.initialLoss = jobDetails.initialLoss || 0;
                this.lossReductionPerEpoch = jobDetails.lossReductionPerEpoch || 0;
            }
        } else {
            console.error("Invalid jobDetails for Job constructor. Must have type or isCustom.");
            // Set some safe defaults to prevent crashing other parts
            this.type = 'error-job';
            this.jobCategory = 'inference';
            this.parametersBillion = 1;
            this.precision = 'FP16';
            this.baseOpsPerToken = 1;
            this.communicationIntensityFactor = 0;
            this.totalTokens = 100;
        }

        const precisionConfig = Config.PRECISION_CONFIG[this.precision];
        const finalPrecisionConfig = precisionConfig ? precisionConfig : Config.PRECISION_CONFIG['FP16']; // Fallback if precision was invalid
        if (!precisionConfig) {
            console.warn(`Invalid precision '${this.precision}' for job ${this.id}. Defaulting to FP16 characteristics.`);
            this.precision = 'FP16'; // Correct the job's precision property if it was bad
        }

        // Calculate memory footprint
        const totalBytes = (this.parametersBillion * 1e9) * finalPrecisionConfig.bytesPerParameter;
        this.memoryFootprintGB = totalBytes / (1024 * 1024 * 1024);

        // Calculate compute demand per token
        this.computeDemandPerToken = this.baseOpsPerToken * this.parametersBillion * finalPrecisionConfig.computePerformanceFactor;
        if (this.computeDemandPerToken <= 0) {
            console.warn(`Calculated computeDemandPerToken for ${this.id} is ${this.computeDemandPerToken}. Setting to a small default 0.1.`);
            this.computeDemandPerToken = 0.1;
        }

        this.tokensRemaining = this.totalTokens;
        this.totalTokensProcessedByGPU = 0;
        this.assignedGpuId = null;
        this.status = 'pending';
        this.statusDetail = 'pending queue';
        this.modelLoadTimeTicks = 0;
        this.modelLoadProgress = 0;

        if (this.jobCategory === 'training') {
            // this.targetEpochs, this.initialLoss, this.lossReductionPerEpoch already set above
            this.currentEpoch = 0;
            this.currentLoss = this.initialLoss;
        }

        this.submissionTime = simulationTime;
        this.startTime = null;
        this.processingStartTime = null;
        this.endTime = null;
    }
}


// --- Public API for the simulation ---
export function initialize() {
    console.log("Initializing simulation logic...");
    gpus = [];
    for (let i = 0; i < Config.RACK_CONFIG.totalGpus; i++) {
        gpus.push(new GPU(i));
    }

    pendingJobs = [];
    completedJobs = [];
    nextJobId = 0;
    simulationTime = 0;
    tokensPerSecondHistory = []; // Clear history on init

    // Add a few initial jobs for testing - using the new Job constructor format
    addJobToQueue({ type: 'default', totalTokens: Config.SIMULATION_SETTINGS.tokensPerBatch * 10 });
    addJobToQueue({
        type: 'trainingLargeModel',
        totalTokens: Config.SIMULATION_SETTINGS.tokensPerBatch * Config.WORKLOAD_CONFIG.trainingLargeModel.targetEpochs * 2
    });
    addJobToQueue({
        type: 'fineTuningSmallModel',
        totalTokens: Config.SIMULATION_SETTINGS.tokensPerBatch * Config.WORKLOAD_CONFIG.fineTuningSmallModel.targetEpochs
    });
    addJobToQueue({ type: 'lowLatencyInference', totalTokens: Config.SIMULATION_SETTINGS.tokensPerBatch * 5 });

    console.log(`Simulation initialized with ${gpus.length} GPUs.`);
    console.log("Initial pending jobs:", pendingJobs.map(j => ({id: j.id, type: j.type, tokens: j.totalTokens})) );
}

export function update() {
    simulationTime += (Config.SIMULATION_SETTINGS.simulationTickMs / 1000) * Config.SIMULATION_SETTINGS.timeScaleFactor;

    // 1. Assign pending jobs to available GPUs based on scheduling mode
    if (pendingJobs.length > 0) {
        let assignableJobs = [...pendingJobs]; // Create a mutable copy

        if (Config.SIMULATION_SETTINGS.defaultSchedulingMode === 'SJF_ESTIMATED') {
            assignableJobs.sort((a, b) => a.totalTokens - b.totalTokens);
        }
        // For FIFO, no sort is needed as jobs are pushed to pendingJobs and iterated in order.
        // Other modes like LJF could be added here.

        for (const gpu of gpus) {
            if (gpu.status === 'idle' || (gpu.activeJobs.length < Config.SIMULATION_SETTINGS.maxConcurrentJobsPerGpu)) {
                let bestJobToAssign = null;
                let bestJobIndex = -1;

                // Find the first suitable job from the (potentially sorted) assignableJobs list
                for (let i = 0; i < assignableJobs.length; i++) {
                    const jobToEvaluate = assignableJobs[i];
                    // gpu.canFitJob now expects a Job object.
                    // The job objects in pendingJobs (and thus assignableJobs) are already full Job instances.
                    if (gpu.canFitJob(jobToEvaluate)) { 
                        bestJobToAssign = jobToEvaluate;
                        bestJobIndex = i;
                        break;
                    }
                }

                if (bestJobToAssign) {
                    // Remove from original pendingJobs array by ID, then add to GPU
                    pendingJobs = pendingJobs.filter(j => j.id !== bestJobToAssign.id);
                    // Also remove from our current iteration copy if needed, though direct filter on pendingJobs is key
                    assignableJobs.splice(bestJobIndex, 1); 

                    gpu.addJob(bestJobToAssign);
                    bestJobToAssign.status = 'running';
                    console.log(`Assigned ${bestJobToAssign.id} (${bestJobToAssign.type}) to ${gpu.id} (Mode: ${Config.SIMULATION_SETTINGS.defaultSchedulingMode})`);
                }
            }
            if (pendingJobs.length === 0) break; // All jobs assigned or no suitable GPU for remaining
        }
    }

    // 2. Process work on each GPU
    gpus.forEach(gpu => {
        gpu.processTick();
    });

    // 3. Handle completed jobs
    const justCompletedGpuIds = new Set();
    gpus.forEach(gpu => {
        const jobsOnGpuCompletedThisTick = gpu.activeJobs.filter(job => job.status === 'completed');
        jobsOnGpuCompletedThisTick.forEach(completedJob => {
            gpu.removeJob(completedJob.id);
            justCompletedGpuIds.add(gpu.id);
            console.log(`Job ${completedJob.id} completed on ${gpu.id}. Duration: ${(completedJob.endTime - completedJob.startTime).toFixed(2)}s`);
        });
    });
    if (justCompletedGpuIds.size > 0) {
         console.log("Completed jobs:", completedJobs.map(j => ({id: j.id, type: j.type, duration: (j.endTime - j.startTime).toFixed(2)})));
    }

    // After all processing, update history for charts
    const currentStats = getOverallStats(); // Get current stats to pull tokens/sec
    tokensPerSecondHistory.push(currentStats.tokensPerSecond);
    if (tokensPerSecondHistory.length > Config.SIMULATION_SETTINGS.chartHistoryLength) {
        tokensPerSecondHistory.shift(); // Remove oldest data point
    }

    // 4. (Later) Update other simulation aspects: network traffic, power, etc.
}

export function addJobToQueue(jobDetails) { // Changed from (type, totalTokens)
    const newJob = new Job(jobDetails);
    pendingJobs.push(newJob);
    console.log(`Added new job to queue: ${newJob.id} (${newJob.type}, ${newJob.totalTokens} tokens, Params: ${newJob.parametersBillion}B, Precision: ${newJob.precision})`);
    return newJob;
}

// NEW function for adding custom jobs from the UI
export function addCustomJobToQueue(jobParams) {
    const jobDetails = {
        isCustom: true,
        name: jobParams.name || 'Custom Job',
        jobCategory: jobParams.jobCategory,
        parametersBillion: parseFloat(jobParams.parametersBillion),
        precision: jobParams.precision,
        baseOpsPerToken: parseFloat(jobParams.baseOpsPerToken),
        communicationIntensityFactor: parseFloat(jobParams.communicationIntensityFactor),
        totalTokens: parseInt(jobParams.totalTokens, 10),
        // Training specific, only if category is training
        targetEpochs: jobParams.jobCategory === 'training' ? parseInt(jobParams.targetEpochs, 10) : undefined,
        initialLoss: jobParams.jobCategory === 'training' ? parseFloat(jobParams.initialLoss) : undefined,
        lossReductionPerEpoch: jobParams.jobCategory === 'training' ? parseFloat(jobParams.lossReductionPerEpoch) : undefined,
    };
    return addJobToQueue(jobDetails); // Reuse the modified addJobToQueue
}

// --- Getter functions for UI or other modules ---
export function getGpuStates() {
    return gpus.map(gpu => ({
        id: gpu.id,
        status: gpu.status,
        currentLoad: parseFloat(gpu.currentLoad.toFixed(1)),
        memoryUsedGB: gpu.memoryUsedGB,
        currentPowerConsumption: parseFloat(gpu.currentPowerConsumption.toFixed(1)),
        isThrottled: gpu.isThrottled,
        ticksAtHighLoad: Math.floor(gpu.ticksAtHighLoad),
        ticksCoolingDown: Math.floor(gpu.ticksCoolingDown),
        activeJobsCount: gpu.activeJobs.length,
        activeJobsDetails: gpu.activeJobs.map(job => ({
            id: job.id,
            type: job.type,
            statusDetail: job.statusDetail,
            tokensRemaining: job.tokensRemaining,
            modelLoadProgress: job.modelLoadProgress,
            jobCategory: job.jobCategory,
            parametersBillion: job.parametersBillion,
            precision: job.precision,
            currentEpoch: job.jobCategory === 'training' ? job.currentEpoch : undefined,
            targetEpochs: job.jobCategory === 'training' ? job.targetEpochs : undefined,
            currentLoss: job.jobCategory === 'training' && job.currentLoss !== undefined ? parseFloat(job.currentLoss.toFixed(3)) : undefined
        })),
        tokensProcessedThisTick: gpu.tokensProcessedThisTick,
        totalTokensProcessed: gpu.totalTokensProcessed,
        isError: gpu.status === 'error',
        ticksInErrorState: gpu.status === 'error' ? Math.floor(gpu.ticksInErrorState) : 0,
        gpuRecoveryTimeTicks: Config.SIMULATION_SETTINGS.gpuRecoveryTimeTicks
    }));
}

export function getPendingJobs() {
    return pendingJobs.map(job => ({
        id: job.id,
        type: job.type,
        jobCategory: job.jobCategory,
        parametersBillion: job.parametersBillion,
        precision: job.precision,
        statusDetail: job.statusDetail,
        totalTokens: job.totalTokens,
        tokensRemaining: job.tokensRemaining,
        status: job.status
    }));
}

export function getCompletedJobs() {
     return completedJobs.map(job => ({
        id: job.id,
        type: job.type,
        jobCategory: job.jobCategory,
        parametersBillion: job.parametersBillion,
        precision: job.precision,
        status: job.status, // This will now include 'failed'
        statusDetail: job.statusDetail, // e.g., 'completed', 'failed (GPU error)'
        duration: job.endTime && job.startTime ? parseFloat((job.endTime - job.startTime).toFixed(2)) : null,
        submissionTime: parseFloat(job.submissionTime.toFixed(2)),
        startTime: job.startTime ? parseFloat(job.startTime.toFixed(2)) : null,
        endTime: job.endTime ? parseFloat(job.endTime.toFixed(2)) : null,
        finalEpoch: job.jobCategory === 'training' ? job.currentEpoch : undefined,
        finalLoss: job.jobCategory === 'training' && job.currentLoss !== undefined ? parseFloat(job.currentLoss.toFixed(3)) : undefined
    }));
}

export function getOverallStats() {
    const activeGpus = gpus.filter(g => g.status === 'busy' && g.status !== 'error').length;
    const errorGpus = gpus.filter(g => g.status === 'error').length;
    const totalLoad = gpus.reduce((sum, gpu) => sum + (gpu.status === 'error' ? 0 : gpu.currentLoad), 0);
    const avgLoad = gpus.length > 0 && (gpus.length - errorGpus > 0) ? totalLoad / (gpus.length - errorGpus) : 0; // Avg load of non-error GPUs
    const totalTokensThisTick = gpus.reduce((sum, gpu) => sum + (gpu.status === 'error' ? 0 : gpu.tokensProcessedThisTick), 0);
    const totalSystemPower = gpus.reduce((sum, gpu) => sum + gpu.currentPowerConsumption, 0); // Added
    
    // Note: tokensProcessedThisTick is already scaled by timeScaleFactor in processTick()
    // This gives us the visual tokens per second (what appears in the UI)
    const tokensPerSecond = totalTokensThisTick / (Config.SIMULATION_SETTINGS.simulationTickMs / 1000);

    return {
        simulationTime: parseFloat(simulationTime.toFixed(2)),
        activeGpus: activeGpus,
        errorGpus: errorGpus, // Added for stats
        totalGpus: gpus.length,
        avgGpuLoad: parseFloat(avgLoad.toFixed(1)) || 0, // Ensure NaN is not shown if no active non-error GPUs
        totalMemoryUsedGB: gpus.reduce((sum, gpu) => sum + gpu.memoryUsedGB, 0),
        totalMemoryCapacityGB: gpus.length * Config.GPU_CONFIG.memoryGB,
        totalSystemPowerWatts: parseFloat(totalSystemPower.toFixed(0)), // Added
        pendingJobsCount: pendingJobs.length,
        completedJobsCount: completedJobs.length,
        tokensProcessedThisTick: totalTokensThisTick,
        tokensPerSecond: parseFloat(tokensPerSecond.toFixed(0)),
        timeScaleFactor: parseFloat(Config.SIMULATION_SETTINGS.timeScaleFactor.toFixed(1))
    };
}

export function getTokensPerSecondHistory() {
    return [...tokensPerSecondHistory]; // Return a copy
}

export function triggerRandomGpuError() {
    if (!Config.SIMULATION_SETTINGS.gpuErrorsEnabled) { // Check master toggle
        console.warn("Manual Error Trigger: GPU errors are currently disabled in settings.");
        if(typeof alert !== 'undefined') alert("GPU errors are disabled in settings. Cannot trigger manual error.");
        return false;
    }

    const healthyGpus = gpus.filter(gpu => gpu.status !== 'error');
    if (healthyGpus.length === 0) {
        console.warn("Manual Error Trigger: No healthy GPUs available to fail.");
        return false;
    }

    const randomIndex = Math.floor(Math.random() * healthyGpus.length);
    const gpuToFail = healthyGpus[randomIndex];

    console.warn(`MANUAL TRIGGER: GPU ${gpuToFail.id} is now being forced into an error state!`);
    gpuToFail.status = 'error';
    gpuToFail.ticksInErrorState = 0;
    gpuToFail.currentLoad = 0;
    gpuToFail.currentPowerConsumption = gpuToFail.config.basePowerConsumptionWatts * 0.5;
    gpuToFail.isThrottled = false; // Reset thermal state too
    gpuToFail.ticksAtHighLoad = 0;
    gpuToFail.ticksCoolingDown = 0;

    const jobsToFail = [...gpuToFail.activeJobs];
    gpuToFail.activeJobs = []; 

    jobsToFail.forEach(failedJob => {
        const jobWorkloadConfig = Config.WORKLOAD_CONFIG[failedJob.type];
        gpuToFail.memoryUsedGB -= failedJob.memoryFootprintGB;
        if (gpuToFail.memoryUsedGB < 0) gpuToFail.memoryUsedGB = 0;

        failedJob.status = 'failed';
        failedJob.statusDetail = 'failed (manual trigger)'; // Specific status detail
        failedJob.endTime = simulationTime;
        completedJobs.push(failedJob);
        console.log(`Job ${failedJob.id} on ${gpuToFail.id} failed due to manual trigger.`);
    });
    return true;
}

// NEW function to clear all current GPU errors and recover them
export function clearAllGpuErrorsAndRecover() {
    gpus.forEach(gpu => {
        if (gpu.status === 'error') {
            gpu.status = 'idle';
            gpu.ticksInErrorState = 0;
            gpu.currentLoad = 0;
            gpu.currentPowerConsumption = gpu.config.basePowerConsumptionWatts;
            gpu.isThrottled = false; // Reset thermal state as well
            gpu.ticksAtHighLoad = 0;
            gpu.ticksCoolingDown = 0;
            // Active jobs on this GPU should have been failed when it originally errored.
            // If any remained, they would be orphaned. The current logic should prevent this.
            console.log(`GPU ${gpu.id} force recovered as GPU errors were globally disabled.`);
        }
    });
    // Optionally, call UI.render() from main.js after this if not already handled by a subsequent gameLoop tick
} 