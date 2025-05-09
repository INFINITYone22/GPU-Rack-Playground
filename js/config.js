// GPU Rack Playground/js/config.js

export const RACK_CONFIG = {
    name: "NVIDIA GB200 NVL72 Rack (Simulated)",
    superchipsPerRack: 36, // An NVL72 configuration typically links 36 GB200 Superchips
    gpusPerSuperchip: 2,   // Each GB200 Superchip has 2 Blackwell GPUs
    get totalGpus() {
        return this.superchipsPerRack * this.gpusPerSuperchip; // Should be 72 for NVL72
    },
};

export const GPU_CONFIG = {
    modelName: "Blackwell B200 GPU (Simulated)",
    memoryGB: 192,             // Blackwell B200 has 192GB HBM3e
    // This is a highly simplified abstract measure of processing power.
    // We'll define how this translates to "work" in the simulation logic.
    // It could represent TFLOPs, or a capacity to process 'X' tokens per cycle.
    baseProcessingUnits: 100, // Abstract units of processing power
    // NVLink 5th Gen provides 1.8TB/s per GPU
    nvlinkBandwidthGbps: 1800 * 8, // 1.8TB/s converted to Gbps
    modelLoadMemoryBandwidthFactor: 0.2, // GB per tick, e.g. 0.2 GB/tick = 2GB/sec @ 100ms tick
    basePowerConsumptionWatts: 100, // Adjusted for B200
    maxPowerConsumptionWatts: 1000, // Adjusted for B200 (can be up to 1200W, 1000W is a sim value)
    // Thermal Throttling Parameters
    thermalThrottlingThresholdLoad: 85, // % load above which GPU starts to overheat
    thermalThrottlingSeverity: 0.25,    // Performance reduction factor (0.25 = 25% slower)
    ticksToOverheat: 150,               // Ticks at high load before throttling starts
    ticksToCooldown: 200,               // Ticks at lower load before throttling stops
    cooldownLoadThreshold: 50,          // Load % below which cooling down is effective
};

export const PRECISION_CONFIG = {
    'FP32': { 
        name: 'FP32 (Full Precision)',
        bytesPerParameter: 4, 
        computePerformanceFactor: 1.0, // Baseline
        // Higher precision might imply slightly slower loading of quantized models if dequantization is complex,
        // but for raw parameter loading, it's mostly about bytes. Let's simplify:
        // loadTimeFactor: 1.0 
    },
    'FP16': { 
        name: 'FP16 (Half Precision)',
        bytesPerParameter: 2, 
        computePerformanceFactor: 0.9, // Typically faster, so demand per token effectively less, or more throughput
                                        // Let's model it as making compute demand per token lower.
        // loadTimeFactor: 0.9 
    },
    'BF16': {
        name: 'BF16 (BFloat16)',
        bytesPerParameter: 2,
        computePerformanceFactor: 0.85, // Similar to FP16, good for training
        // loadTimeFactor: 0.85
    },
    'INT8': { 
        name: 'INT8 (8-bit Integer)',
        bytesPerParameter: 1, 
        computePerformanceFactor: 0.6, // Significantly faster for inference
        // loadTimeFactor: 0.7 
    },
    'FP4': {
        name: 'FP4 (4-bit Float)',
        bytesPerParameter: 0.5, // 4 bits = 0.5 bytes
        computePerformanceFactor: 0.3, // Very high performance for inference (less demand)
    },
    'INT4': {
        name: 'INT4 (4-bit Integer)',
        bytesPerParameter: 0.5, // 4 bits = 0.5 bytes
        computePerformanceFactor: 0.25, // Potentially even higher performance for inference
    }
};

export const SCHEDULING_MODES = {
    FIFO: "First-In, First-Out",
    SJF_ESTIMATED: "Shortest Job First (Total Tokens)",
    // LJF_ESTIMATED: "Longest Job First (Total Tokens)" // Example for future
};

export const SIMULATION_SETTINGS = {
    // How often the main simulation loop tries to run (in milliseconds)
    // requestAnimationFrame will ultimately control the render timing.
    simulationTickMs: 100,
    timeScaleFactor: 1.0, // 1.0 = normal speed, >1 = faster, <1 = slower
    gpuErrorsEnabled: true, // NEW: Master toggle for all GPU errors
    thermalThrottlingEnabled: true, // NEW: Master toggle for thermal throttling
    // Option for "perfect" theoretical performance vs. one with simulated bottlenecks
    defaultSchedulingMode: 'FIFO', // Active scheduling mode
    performanceMode: 'theoretical', // or 'realistic'
    realisticPerformanceFactor: 0.75, // e.g., 75% of theoretical due to various overheads
    interconnectBottleneckFactor: 0.2, // e.g., high communication can increase effective token cost by up to 20% in realistic mode
    tokensPerBatch: 1024, // Example: number of tokens processed in one go by a "job"
    maxConcurrentJobsPerGpu: 4, // How many "tasks" a GPU can (pretend to) work on
    errorChancePerTick: 0.0005, // 0.05% chance per tick for a working GPU to error
    gpuRecoveryTimeTicks: 200, // How many ticks a GPU stays in error (e.g., 200 ticks * 100ms/tick = 20 seconds)
    chartHistoryLength: 100, // Number of historical data points for charts
    // modelLoadTimeFactor: 0.05 // Ticks per GB of model to load. Lower is faster.
    // Replaced by modelLoadMemoryBandwidthFactor in GPU_CONFIG for more nuanced loading time
};

// --- Workload Configuration ---
// Defines different types of jobs that can be run.
// memoryFootprintGB and computeDemandPerToken will be CALCULATED based on parameters & precision.
export const WORKLOAD_CONFIG = {
    'default': {
        name: "Inference: Small LLM (7B, FP16)",
        jobCategory: 'inference',
        parametersBillion: 7,
        precision: 'FP16', // Key from PRECISION_CONFIG
        baseOpsPerToken: 2, // Base operations needed per token (scaled by params & precision)
        communicationIntensityFactor: 0.1, // How much this workload is affected by interconnect bottlenecks
    },
    'highDemandInference': {
        name: "Inference: Large LLM (70B, FP16)",
        jobCategory: 'inference',
        parametersBillion: 70,
        precision: 'FP16',
        baseOpsPerToken: 2, // Larger models inherently demand more for the same "base op" definition
        communicationIntensityFactor: 0.3,
    },
    'lowLatencyInference': {
        name: "Inference: Small LLM (7B, INT8)",
        jobCategory: 'inference',
        parametersBillion: 7,
        precision: 'INT8',
        baseOpsPerToken: 2,
        communicationIntensityFactor: 0.05,
    },
    'imageGen': {
        name: "Inference: Image Gen (15B, FP16)",
        jobCategory: 'inference',
        parametersBillion: 15,
        precision: 'FP16',
        baseOpsPerToken: 100, // Image generation is very compute-intensive per "token" (or step)
        communicationIntensityFactor: 0.2,
    },
    'trainingLargeModel': {
        name: "Training: Foundational LLM (175B, BF16)",
        jobCategory: 'training',
        parametersBillion: 175,
        precision: 'BF16', // Common for training
        baseOpsPerToken: 6, // Training is roughly 3x inference ops (fwd + bwd pass)
        communicationIntensityFactor: 0.5,
        targetEpochs: 3,
        initialLoss: 5.0,
        lossReductionPerEpoch: 0.7
    },
    'fineTuningSmallModel': {
        name: "Training: Fine-tune LLM (7B, FP16)",
        jobCategory: 'training',
        parametersBillion: 7,
        precision: 'FP16',
        baseOpsPerToken: 6,
        communicationIntensityFactor: 0.2,
        targetEpochs: 5,
        initialLoss: 2.5,
        lossReductionPerEpoch: 0.3
    },
    'modelLoadingTest': { // Kept for specific testing if needed, but less relevant now.
        name: "Util: Model Load Test (1B, FP32)", // Minimal compute, focus on load
        jobCategory: 'inference',
        parametersBillion: 1,
        precision: 'FP32',
        baseOpsPerToken: 0.01, // Very low compute
        communicationIntensityFactor: 0,
    }
}; 