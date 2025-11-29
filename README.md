# Landmark Museum

A 3D virtual museum where you can explore landmarks of different countries, powered by OpenAI and Google Custom Search.

## Setup

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Configure API Keys**:
    - Edit `.env` and add your keys:
        - `VITE_OPENAI_API_KEY`: Your OpenAI API key.
        - `VITE_GOOGLE_SEARCH_API_KEY`: Your Google Custom Search API key.
        - `VITE_GOOGLE_SEARCH_CX`: Your Google Custom Search Engine ID.

## Running Locally

Start the development server:

```bash
npm run dev
```

Open your browser at `http://localhost:5173`.

## Controls

-   **Click** to capture mouse and start.
-   **WASD** or **Arrow Keys** to move.
-   **Space** to jump.
-   **Mouse** to look around.
-   **ESC** to release mouse.

## Project Structure

-   `src/main.js`: Entry point, sets up the 3D scene and loop.
-   `src/World.js`: Contains the game logic, API calls, and environment generation.
-   `src/PointerLockControls.js`: Handles camera controls.
