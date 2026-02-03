# Landmark Museum 🏛️

A dynamic, immersive 3D virtual museum experience built with **Three.js**, powered by generative AI. 

![Landmark Museum](https://images.unsplash.com/photo-1554907984-15263bfd63bd?q=80&w=2070&auto=format&fit=crop)

## 🌟 Overview

Landmark Museum is an interactive web application that allows users to explore a virtual gallery showcasing famous landmarks from around the world. Unlike traditional static galleries, this project leverages **OpenAI's GPT models** to generate educational content on the fly and the **Wikipedia/Wikimedia Commons APIs** to fetch relevant imagery.

The result is an infinite museum where every visit can be unique, driven by user curiosity.

## ✨ Key Features

-   **First-Person Exploration**: Fully immersive 3D environment with WASD movement and pointer-lock camera controls.
-   **Generative AI Content**: Enter any country name, and the museum curates an exhibit of its top 4 landmarks with AI-generated descriptions.
-   **Dynamic Asset Loading**: Real-time fetching of images for each landmark from Wikimedia (Wikipedia/Wikimedia Commons APIs).
-   **Interactive 3D UI**: Diegetic user interface elements integrated directly into the 3D world (search panel, plaques).
-   **Polished Environment**: A rich, atmospheric setting featuring marble floors, architectural details, and dynamic lighting.

## 🛠️ Tech Stack

-   **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
-   **3D Engine**: [Three.js](https://threejs.org/)
-   **Build Tool**: [Vite](https://vitejs.dev/)
-   **AI Integration**: OpenAI API
-   **Data Fetching**: Wikipedia / Wikimedia Commons APIs

## 🏗️ Architecture

The codebase follows a modular, component-based architecture for maintainability and scalability:

-   **`src/World.js`**: The main controller that orchestrates the scene, physics, and game loop.
-   **`src/services/LandmarkService.js`**: Handles all external API interactions (OpenAI + Wikimedia), abstracting data fetching logic.
-   **`src/managers/UIManager.js`**: Manages the 2D overlay and 3D canvas-based user interfaces.
-   **`src/components/Environment.js`**: Encapsulates the procedural generation of the museum's geometry and lighting.

## 🚀 Getting Started

### Prerequisites

-   Node.js (v14 or higher)
-   An OpenAI API Key

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/landmark-museum.git
    cd landmark-museum
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment**:
    No additional environment variables are required for image fetching (OpenAI key is entered in the UI).

4.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    Open `http://localhost:5173` in your browser.

### Docker

You can also run the application using Docker:

1.  **Build the image**:
    ```bash
    docker build -t landmark-museum .
    ```

2.  **Run the container**:
    ```bash
    docker run -p 8080:80 landmark-museum
    ```
    Open `http://localhost:8080` in your browser.

**Or pull from GitHub Container Registry:**

```bash
docker pull ghcr.io/chris.dobey/landmark-museum:latest
docker run -p 8080:80 ghcr.io/chris.dobey/landmark-museum:latest
```

### Deployment (Coolify/VPS)

If you are deploying to a VPS using **Coolify**:
1.  **Keep Nginx**: The Dockerfile uses Nginx to serve the static files. This is required because Coolify's proxy handles routing *to* your container, but your container still needs a web server to serve the actual content.
2.  **Environment Variables**: No environment variables are required for image fetching. (OpenAI key is entered in the UI.)

## 🎮 Controls

| Key | Action |
| :--- | :--- |
| **W / A / S / D** | Move Forward / Left / Backward / Right |
| **Mouse** | Look Around |
| **Space** | Jump |
| **Click** | Interact / Lock Cursor |
| **Esc** | Unlock Cursor |

## 🔮 Future Improvements

-   [ ] Multiplayer support for shared exhibitions.
-   [ ] VR compatibility (WebXR).
-   [ ] Audio guides using Text-to-Speech.
-   [ ] Procedurally generated room layouts based on content.

---

*Created by Chris Dobey*
