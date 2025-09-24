# Draggable Image Canvas

A React component that provides an interactive canvas for managing and manipulating images with drag-and-drop functionality, clipboard support, and modern UI.

## Features

- 🖼️ **Multiple Image Upload Methods**
  - File selection dialog
  - Drag and drop from file explorer
  - Clipboard paste (Ctrl+V) - perfect for screenshots!

- 🎯 **Interactive Image Management**
  - Drag images around the canvas freely
  - Visual feedback with hover effects and selection indicators
  - Automatic z-index management (selected images come to front)

- 📋 **Clipboard Integration**
  - Copy images to clipboard for use in other applications
  - Paste images directly from clipboard (great for screenshots)

- 💾 **Image Operations**
  - Download individual images
  - Remove images with delete button
  - Reset all image positions to grid layout

- 🎨 **Modern UI**
  - Beautiful gradient background
  - Glassmorphism design elements
  - Smooth animations and transitions
  - Responsive design

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Clone or download this project
2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

### Adding Images

1. **File Selection**: Click the "파일 선택" (File Select) button to choose images from your computer
2. **Drag & Drop**: Drag image files directly from your file explorer onto the canvas
3. **Clipboard Paste**: Take a screenshot or copy an image, then press `Ctrl+V` to paste it directly onto the canvas

### Managing Images

- **Move Images**: Click and drag any image to reposition it on the canvas
- **Delete Images**: Hover over an image and click the red X button in the top-right corner
- **Copy to Clipboard**: Click the "복사" (Copy) button to copy the image to your clipboard
- **Download**: Click the "저장" (Save) button to download the image to your computer
- **Reset Positions**: Click "위치 초기화" (Reset Positions) to arrange all images in a grid layout

### Keyboard Shortcuts

- `Ctrl+V`: Paste image from clipboard

## Technical Details

### Built With

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

### Key Features Implementation

- **Drag and Drop**: Custom mouse event handling with offset calculation
- **Clipboard API**: Modern clipboard integration for image copying and pasting
- **File API**: File reading and processing for uploads
- **Canvas API**: Image manipulation and blob creation for clipboard operations

### Browser Compatibility

- Modern browsers with ES2020 support
- Clipboard API support required for clipboard features
- File API support required for file uploads

## Project Structure

```
src/
├── components/
│   └── DraggableImageCanvas.tsx  # Main component
├── App.tsx                       # App wrapper
├── App.css                       # Custom animations
├── main.tsx                      # Entry point
└── index.css                     # Global styles
```

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - feel free to use this project for personal or commercial purposes.
