# GPU Rack Playground - GB200 NVL72 Interactive Simulator

GPU Rack Playground is an interactive, real-time web-based simulation of an NVIDIA GB200 NVL72 GPU rack. It aims to provide a visually engaging and educational "game-like" experience to understand the dynamics of AI model training and inference workloads on modern GPU hardware.

## Features

*   **Real-time Simulation:** Visualizes GPU utilization, memory, power consumption, and job processing.
*   **GB200 NVL72 Inspired:** Configuration based on a 72-GPU rack setup.
*   **Dynamic Job Characteristics:** Supports jobs with varying model sizes (number of parameters) and numerical precisions (FP32, FP16, BF16, INT8, FP4, INT4).
*   **Workload Simulation:**
    *   Model loading phase.
    *   Token processing with configurable compute demands.
    *   Training jobs track epochs and loss.
*   **GPU Effects:**
    *   Thermal throttling with overheating and cooldown cycles.
    *   Simulated GPU errors and recovery periods.
    *   Master toggles to enable/disable error and thermal effects.
*   **Performance Metrics:**
    *   Overall tokens/second, average GPU load, total power, memory usage.
    *   Historical performance chart for tokens/second.
*   **Job Scheduling:**
    *   FIFO (First-In, First-Out) and SJF (Shortest Job First - Estimated) scheduling modes.
*   **Interactive Controls:**
    *   Start, stop, and reset the simulation.
    *   Adjust simulation speed (time scale).
    *   Performance mode (theoretical vs. realistic with bottleneck simulation).
    *   Manually trigger GPU errors.
    *   Add custom jobs with user-defined parameters (model size, precision, tokens, etc.).
*   **Detailed GPU Inspection:** Click on a GPU card to open a modal with detailed stats and active job information.
*   **Visual Feedback:**
    *   Progress bars for GPU load and memory.
    *   Visual cues for job categories (training/inference) on GPU cards.
    *   Animated token processing visualization.
    *   Visual indication of GPU status (idle, busy, error, throttled).

## How to Run

1.  Ensure you have Python installed (for the simple HTTP server).
2.  Clone or download the repository.
3.  Navigate to the project's root directory in your terminal.
4.  Run the `run_simulator.bat` file (for Windows). This will start a local HTTP server.
    *   For other operating systems, you can achieve the same by running `python -m http.server 8000` (or any desired port) in the project root.
5.  Open your web browser and go to `http://localhost:8000` (or the port you used).

## Technologies Used

*   HTML5
*   CSS3
*   JavaScript (ES6 Modules)

## Author & Copyright

*   **Author:** Rohith Garapati
*   **GitHub:** [INFINITYone22](https://github.com/INFINITYone22)
*   **Copyright:** (c) 2025 Rohith Garapati. All Rights Reserved. (See LICENSE file for details)

---

This project is a simulation for educational and illustrative purposes.
While inspired by real-world hardware, it uses simplified models and abstractions. 