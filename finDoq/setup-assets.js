const fs = require('fs');
const path = require('path');

// Create necessary directories
const directories = [
    'frontend/assets',
    'frontend/assets/icons',
    'frontend/assets/images'
];

directories.forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`Created directory: ${fullPath}`);
    }
});

// Create placeholder for file.png if it doesn't exist
const filePath = path.join(__dirname, 'frontend/assets/icons/file.png');
if (!fs.existsSync(filePath)) {
    // Simple Base64 encoded file icon
    const fileIconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAABtElEQVR4nO2ZP0/CQBjGH2LUFQYXJ+Pi4Goc3IyLi4vfAfoNjAMmYsLEhITEiYGJr+BgTJw0cdLExZiYOLbrH6oxtVQrtFe4es/0ct3l+b33ubveXQkhISEh/wYAEoBrAHMABMCcvZMAyA1ZXq69VqkzZ+3Sog3XnnGA9lpNOIHaWU5A66wgoKVXEtj8pnmB81UJaE0oWAK1OgLfT02AXu7oxsOjzS9g/bTN2laqzM4eALOekd3Shrz95dZk+35Jln9e94cxDpt2JsARTq8byESZ9E6gfhoh8tITytYbMB3O0Xd3pz/GvZuJb0+hnftzAVLOEFbO0OQ3N8oR2V9EYOD2bEGou7v5EO24ubZHySBs7ASnBO4YxR2mMltpnbPLBoD7/nAa8dxYMiPnDB2/OcL7vL60z/IIvHMG6REoR1jyjPjFER69dPqMQDnC0sP9OcrkY6M4wsvLvZUCGvGJEQUFvC4UnAnUVnmNuHN7ViegoHdWEFDQO2u2cYAYbZxtRL+3cTo2gY2+Un+f0NprtU1c5t9Mo834Q0ulTu40V+pJgQFAjogVLZY0WCxZYFGrwbMQEhLyX/gCAZciUJ5cM+MAAAAASUVORK5CYII=';
    const fileIconBuffer = Buffer.from(fileIconBase64, 'base64');
    fs.writeFileSync(filePath, fileIconBuffer);
    console.log(`Created placeholder file icon: ${filePath}`);
}

// Create placeholder for upload.png if it doesn't exist
const uploadPath = path.join(__dirname, 'frontend/assets/icons/upload.png');
if (!fs.existsSync(uploadPath)) {
    // Simple Base64 encoded upload icon
    const uploadIconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAACKElEQVR4nO2ZTWsUQRCGH1dFUQQVRA0eBEFQEEE8efMP/AHiQbx58+ZR/AX+AW/evHkRBC+KiB8gIhFUkuBHEg2KMSSuR6vZEJfszszOzk53YB5omKW7uqfend6urioIBAKBvQzQAi4Az4BVYBtQYtvAKvAUmAVawL6m/W4BF4FF4JeHwUX8BD4AlxqaQpPAe5KzANxp0vg14FcVwwv8BC5XMP4U8K1G43P8AM6UMX5yF4zPMV/G+PYuGp9joUj4Z4F2zaaAaeAR8ApYA76z00/gK/Aa6ABXgDGnr7a3kP1IYbwCHoAp4DEw5/Td9Ta+USB8p8ToEWAKWLLGvgGOW32PGeNXygzoiolkxl/N6X/UtLkaPJG4SL/PGD+e0/+EabNiGvYZ4CVTR9+bsB8M+neZhstZBjhM53x4C/QirpkJeRddq9xjGu4HJoDfniestoi7pn4TWDPvRpw2l0zDWpYBDsvW9067FnDfGjNvlbsts3h9iaAXWCrRdtXUt515bxRt6jjcM/V1Z9Epg+P22WXti2lsE0tM3C3/+vUeGSJ6VnnB3nfMDxymbTGDEFvMyZgjbcb2HBXH+Hr+UKKsYR9ScT+wlar65FnMLirnQNW87MsZ43tDMDzHzTrnwGKJ0uiocLzuQsZ3iv6BE8DXITEeknUyvyoxJQZ5+y1V5cEQGLhc5/FiAnjT0IK9VvUDhlnMqyptcrlOryuZ3QYCgUAgkJh/Lm9C73m1RIcAAAAASUVORK5CYII=';
    const uploadIconBuffer = Buffer.from(uploadIconBase64, 'base64');
    fs.writeFileSync(uploadPath, uploadIconBuffer);
    console.log(`Created placeholder upload icon: ${uploadPath}`);
}

// Create placeholder for pattern.png if it doesn't exist
const patternPath = path.join(__dirname, 'frontend/assets/images/pattern.png');
if (!fs.existsSync(patternPath)) {
    // Simple Base64 encoded pattern image
    const patternBase64 = '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';
    const patternBuffer = Buffer.from(patternBase64, 'base64');
    fs.writeFileSync(patternPath, patternBuffer);
    console.log(`Created placeholder pattern image: ${patternPath}`);
}

console.log('Asset files setup complete!');
