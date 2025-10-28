# Home Canvas

**Drag, drop, and visualize any product in your personal space using the power of Gemini.**

Home Canvas is a web application that demonstrates the power of generative AI for e-commerce and interior design. It allows users to upload a photo of their own space (a "scene") and virtually place products into it. The application uses the Gemini API to create a photorealistic composite image, complete with accurate lighting, shadows, and perspective.

Beyond simple placement, Home Canvas also includes features for AI-powered scene analysis and text-based image editing, making it a comprehensive toolkit for creative visualization.

## ✨ Features

*   **Virtual Product Placement:** Seamlessly place product images into any scene.
*   **AI-Powered Composition:** Leverages the `gemini-2.5-flash-image` model to create photorealistic composite images, automatically adjusting for lighting, shadows, and perspective.
*   **Custom Products & Scenes:** Upload your own product images and background scenes for limitless possibilities.
*   **AI Scene Analysis:** Get a detailed description of your scene with the click of a button, powered by `gemini-2.5-flash`.
*   **AI Image Editing:** Edit your scene using simple text prompts (e.g., "make the lighting more dramatic"), powered by `gemini-2.5-flash-image`.
*   **Interactive Controls:** Adjust product scale and use an intuitive drag-and-drop or click-to-place interface.
*   **State History:** Easily step backward and forward through your scene edits with Undo/Redo functionality.

## 🛠️ How It Works

The application employs a multi-step, multi-modal process to achieve its high-quality results.

1.  **Image Pre-processing:** User-uploaded images (products and scenes) are resized and padded to a standard `1024x1024` square on the client-side. This ensures consistent input for the AI models, improving reliability.

2.  **Location Analysis (`gemini-2.5-flash-lite`):** When a user places a product, the app draws a red marker on the scene image. This marked image is sent to a vision model to generate a *semantic description* of the placement location (e.g., "on the wooden floor in the sunlight, next to the sofa leg"). This provides crucial context for the next step.

3.  **Image Generation (`gemini-2.5-flash-image`):** The original product image, the clean (unmarked) scene image, and a detailed prompt are sent to the powerful `gemini-2.5-flash-image` model. The prompt includes the semantic location description from the previous step and instructions about the product's scale. The model then generates the final composite image.

4.  **Image Post-processing:** The generated square image is cropped back to the original scene's aspect ratio on the client-side, removing the padding and delivering the final result to the user.

5.  **Editing & Analysis:** The "Analyze Scene" and "Edit Scene" features send the current scene image directly to the appropriate Gemini model (`gemini-2.5-flash` for analysis, `gemini-2.5-flash-image` for editing) along with a text prompt to generate the desired output.

## 🚀 Getting Started

This project is a static web application built with React, TypeScript, and Tailwind CSS.

### Prerequisites

*   A modern web browser.
*   A Google Gemini API key.

### Running the App

1.  Clone this repository.
2.  Set up your Google Gemini API key. The application is configured to read the key from the `process.env.API_KEY` environment variable.
3.  Serve the `index.html` file using a local web server.

The application uses an `importmap` in `index.html` to load dependencies like React and `@google/genai` directly from a CDN, so no `npm install` step is required for the frontend.

## 📁 File Structure

```
.
├── assets/
│   ├── armchair.jpg
│   ├── object.jpeg
│   └── pottedplant.jpg
├── components/
│   ├── AddProductModal.tsx
│   ├── AnalysisModal.tsx
│   ├── DebugModal.tsx
│   ├── Header.tsx
│   ├── ImageUploader.tsx
│   ├── ObjectCard.tsx
│   ├── ProductSelector.tsx
│   ├── Spinner.tsx
│   └── TouchGhost.tsx
├── services/
│   └── geminiService.ts   # All Gemini API calls and image processing logic
├── App.tsx                # Main application component
├── index.css              # Custom CSS
├── index.html             # Application entry point
├── index.tsx              # React root
├── metadata.json
├── README.md
└── types.ts               # TypeScript types
```
