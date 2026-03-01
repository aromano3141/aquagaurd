# AquaGuard

**Smart Water Leak Detection System**

AquaGuard is an advanced, AI-driven platform for real-time leak detection and isolation in Water Distribution Networks (WDNs). It empowers water utilities and engineers with actionable intelligence to identify, localize, and manage leaks efficiently, reducing non-revenue water loss and conserving critical resources.

## Features & Functionalities

- **Graph Neural Network (GNN) Leak Detection**: Utilizes advanced spatial-temporal graph modeling to understand water network topology and identify anomalies indicative of leaks.
- **Topological Random Forest Regressors**: Employs Flow-to-Pressure ratio feature engineering across reference sensors to pinpoint the exact location of the leak.
- **Interactive Network Visualization**: A React-based frontend providing 3D/2D topological maps of the distribution network, highlighting active leaks, sensors, and structural nodes.
- **Custom Sandbox Simulation**: Upload custom `.inp` (EPANET) files to simulate your own networks, place hypothetical sensors, and run the detection pipeline to evaluate sensor placement strategies.
- **Economic & Environmental Impact Metrics**: Automatically calculates real-time savings (water volume, monetary cost, and CO2 emissions) based on resolved leaks.

## Research & Credits

This project bridges state-of-the-art academic research with practical software engineering. We credit and build upon the following research and open-source tools:

- **GNNLeakDetection / Explainable Fuzzy GNNs**: The core GNN anomaly detection methodology is inspired by research on *"Explainable Fuzzy GNNs for Leak Detection in Water Distribution Networks"*. We utilize a Graph Autoencoder architecture (GATv2Conv + LSTM) to reconstruct node features, flagging high reconstruction errors as leaks.
- **L-TOWN & BattLeDIM Benchmark**: The system is rigorously tested against the **L-TOWN** dataset, a robust benchmark network originating from the *BattLeDIM (Battle of the Leakage Detection and Isolation Methods)* competition. Ground truth leakage matrices and SCADA simulation data from this benchmark are used for training and validation.
- **WNTR (Water Network Tool for Resilience)**: Built upon the EPA's EPANET engine, `wntr` is heavily utilized in our backend for parsing `.inp` files, modeling graph topology, and extracting node/link attributes.
- **PyTorch Geometric**: Powers the deep learning graph layers used in our spatial-temporal anomaly detection.
- **Gemini & Anti-Gravity**: Advanced AI coding agents were leveraged throughout the development lifecycle to rapidly prototype, debug complex graph neural networks, and accelerate the cross-stack engineering process.

## Tech Stack

- **Backend**: Python, FastAPI, PyTorch, PyTorch Geometric, Scikit-Learn, WNTR, Pandas.
- **Frontend**: React 19, Vite, Tailwind CSS 4, React Query, Plotly.js for interactive topology rendering.
- **Package Management**: `uv` (Backend), `pnpm` (Frontend).

## Getting Started

### Prerequisites
- Python >= 3.11
- Node.js & pnpm
- [uv](https://github.com/astral-sh/uv) (Extremely fast Python package installer recommended)

### Backend Setup
```bash
# Go to project root
cd aquaguard

# Install dependencies and sync virtual environment using uv
uv sync

# Run the FastAPI server
uv run uvicorn app.main:app --reload
```
The API will be available at `http://localhost:8000` (Swagger UI at `http://localhost:8000/docs`).

### Frontend Setup
```bash
# Go to frontend directory
cd frontend

# Install dependencies
pnpm install

# Start Vite development server
pnpm run dev
```
The dashboard will be available at `http://localhost:5173`.

## How It Generalizes

While heavily benchmarked on the L-TOWN network, AquaGuard is built to be **network-agnostic**. The embedded Sandbox feature allows users to upload any standard EPANET `.inp` file. The backend automatically parses the topology, generating the corresponding graph structures (nodes, edges, node features) required by the dynamic GNN payload without hardcoding specific network constraints, enabling scalable deployments for municipalities of any size.
