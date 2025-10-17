# HTML Documentation

Beautiful, interactive HTML documentation for the NestJS Messaging Patterns project.

## 📄 Available Pages

- **[index.html](index.html)** - Main documentation homepage
- **[api-reference.html](api-reference.html)** - Complete API reference
- **[frontend-integration.html](frontend-integration.html)** - Frontend integration guide
- **[deployment.html](deployment.html)** - Deployment guide

## 🚀 Quick Start

### Option 1: Open Directly
Simply double-click any HTML file to open it in your browser.

### Option 2: Local Server
```bash
cd docs/html
npx http-server -p 8080
```
Then visit: http://localhost:8080

### Option 3: Serve from NestJS App
The main application already serves these files. Start the app and visit:
- http://localhost:3000/docs/index.html
- http://localhost:3000/docs/api-reference.html
- http://localhost:3000/docs/frontend-integration.html
- http://localhost:3000/docs/deployment.html

## ✨ Features

- 🎨 **Modern Design** - Beautiful gradient theme with smooth animations
- 🌓 **Dark/Light Mode** - Toggle theme with persistent storage
- 📱 **Responsive** - Works perfectly on all devices
- 🔍 **Search** - Client-side search functionality
- 📋 **Copy Code** - One-click copy for all code examples
- 💡 **Syntax Highlighting** - Beautiful code highlighting with Prism.js
- 🔗 **Deep Linking** - All sections have anchor links
- 🎯 **Interactive** - Try It buttons, tabs, collapsible sections
- ♿ **Accessible** - ARIA-friendly and keyboard navigable

## 📦 Deployment

### GitHub Pages
```bash
# Push docs/html to gh-pages branch
git subtree push --prefix docs/html origin gh-pages
```

### Netlify
```bash
# Deploy docs/html directory
netlify deploy --dir=docs/html --prod
```

### Vercel
```bash
cd docs/html
vercel --prod
```

### Static Host
Upload all files in `docs/html/` to any static hosting provider.

## 🎨 Customization

All styling is contained within each HTML file. To customize:

1. **Colors**: Edit CSS variables in `:root` section
2. **Theme**: Modify gradient values
3. **Typography**: Change font-family in body styles
4. **Layout**: Adjust grid/flexbox properties

## 🌐 Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers

## 📝 Technologies Used

- **Prism.js** - Syntax highlighting
- **Font Awesome** - Icons
- **Custom CSS** - Modern responsive design
- **Vanilla JavaScript** - Interactivity (no framework required)

## 📊 File Sizes

- index.html: 31 KB
- api-reference.html: 43 KB
- frontend-integration.html: 34 KB
- deployment.html: 35 KB

**Total: 143 KB**

All files are optimized and load quickly.
