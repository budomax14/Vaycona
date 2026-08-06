# Personal Canva-Style Design Editor

A working browser-based design editor built with React, Vite, Konva, and react-konva.

## Features

- Add and edit text
- Add resizable shapes
- Upload images
- Drag, resize, and rotate elements
- Change fonts, colors, opacity, alignment, and rounded corners
- Move layers forward or backward
- Undo and redo
- Save projects to browser local storage
- Reload saved projects
- Export the canvas as a high-resolution PNG

## Run it

1. Install Node.js 18 or newer.
2. Open this folder in VS Code.
3. Open the terminal and run:

```bash
npm install
npm run dev
```

4. Open the local address shown by Vite, usually:

```text
http://localhost:5173
```

## Build for production

```bash
npm run build
```

The production files will be created in the `dist` folder.

## Important note

Projects are currently saved only in the browser using localStorage. For online accounts, cloud storage, templates, and access across devices, connect the project to Supabase.
