const imageInput = document.getElementById("imageInput");
const uploadBtn = document.getElementById("uploadBtn");
const previewImage = document.getElementById("previewImage");

const contrastMapCanvas = document.getElementById("contrastMap");
const focusMapCanvas = document.getElementById("focusMap");
const blindMapCanvas = document.getElementById("blindMap");

uploadBtn.addEventListener("click", () => {
    imageInput.click();
});

imageInput.addEventListener("change", loadImage);

function loadImage(e) {

    const file = e.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function(event) {

        previewImage.src = event.target.result;

        previewImage.onload = () => {

            previewImage.style.display = "block";

            analyzeImage(previewImage);
        };
    };

    reader.readAsDataURL(file);
}

function analyzeImage(img) {

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let totalBrightness = 0;
    let highContrastPixels = 0;

    const colors = {};

    for (let i = 0; i < data.length; i += 4) {

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const brightness = (r * 299 + g * 587 + b * 114) / 1000;

        totalBrightness += brightness;

        const contrast =
            Math.max(r, g, b) - Math.min(r, g, b);

        if (contrast > 70) {
            highContrastPixels++;
        }

        const key =
            `${Math.round(r / 32) * 32},
             ${Math.round(g / 32) * 32},
             ${Math.round(b / 32) * 32}`;

        colors[key] = (colors[key] || 0) + 1;
    }

    const avgBrightness =
        totalBrightness / (data.length / 4);

    const contrastPercent =
        Math.min(100,
            Math.round(
                (highContrastPixels / (data.length / 4)) * 180
            )
        );

    const balance =
        Math.max(
            40,
            100 - Math.abs(avgBrightness - 128)
        );

    const readability =
        Math.min(
            100,
            Math.round((contrastPercent + balance) / 2)
        );

    const focus =
        Math.min(
            100,
            Math.round((contrastPercent * 0.7 + balance * 0.3))
        );

    const total =
        Math.round(
            (contrastPercent + balance + readability + focus) / 4
        );

    updateMetric("contrast", contrastPercent);
    updateMetric("balance", balance);
    updateMetric("readability", readability);
    updateMetric("focus", focus);

    document.getElementById("totalScore").innerText = total;

    evaluateWCAG(contrastPercent);

    generatePalette(colors);

    generateContrastMap(img);
    generateFocusMap(img);
    generateBlindMap(img);
}

function updateMetric(name, value) {

    document.getElementById(`${name}Value`).innerText =
        value + "%";

    document.getElementById(`${name}Bar`).style.width =
        value + "%";
}

function evaluateWCAG(contrast) {

    const aa = document.getElementById("wcagAA");
    const aaa = document.getElementById("wcagAAA");

    if (contrast >= 60) {
        aa.innerText = "Пройдено";
        aa.className = "wcag-status pass";
    } else {
        aa.innerText = "Не пройдено";
        aa.className = "wcag-status fail";
    }

    if (contrast >= 82) {
        aaa.innerText = "Пройдено";
        aaa.className = "wcag-status pass";
    } else {
        aaa.innerText = "Не пройдено";
        aaa.className = "wcag-status fail";
    }
}

function generatePalette(colors) {

    const palette = document.getElementById("palette");

    palette.innerHTML = "";

    const sorted =
        Object.entries(colors)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

    sorted.forEach(color => {

        const div = document.createElement("div");

        div.className = "color-box";

        const rgb = `rgb(${color[0]})`;

        div.style.background = rgb;

        div.innerHTML =
            `<div class="color-label">${rgb}</div>`;

        palette.appendChild(div);
    });
}

function generateContrastMap(img) {

    const ctx = contrastMapCanvas.getContext("2d");

    contrastMapCanvas.width = img.naturalWidth;
    contrastMapCanvas.height = img.naturalHeight;

    ctx.drawImage(img, 0, 0);

    const imageData =
        ctx.getImageData(
            0,
            0,
            contrastMapCanvas.width,
            contrastMapCanvas.height
        );

    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {

        const contrast =
            Math.max(data[i], data[i+1], data[i+2]) -
            Math.min(data[i], data[i+1], data[i+2]);

        data[i] = contrast * 2;
        data[i+1] = 0;
        data[i+2] = 255 - contrast;
    }

    ctx.putImageData(imageData, 0, 0);
}

function generateFocusMap(img) {

    const ctx = focusMapCanvas.getContext("2d");

    focusMapCanvas.width = img.naturalWidth;
    focusMapCanvas.height = img.naturalHeight;

    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(
        0,
        0,
        focusMapCanvas.width,
        focusMapCanvas.height
    );

    const data = imageData.data;

    const width = focusMapCanvas.width;

    const output = new Uint8ClampedArray(data.length);

    for (let i = 0; i < data.length; i += 4) {

        const x = (i / 4) % width;
        const y = Math.floor((i / 4) / width);

        if (x > 0 && y > 0 && x < width - 1 && y < focusMapCanvas.height - 1) {

            const idx = (y * width + x) * 4;

            const left = data[idx - 4];
            const right = data[idx + 4];
            const up = data[idx - width * 4];
            const down = data[idx + width * 4];

            const intensity =
                Math.abs(left - right) +
                Math.abs(up - down);

            const val = Math.min(255, intensity * 2);

            output[idx] = 255;
            output[idx + 1] = 0;
            output[idx + 2] = 255 - val;
            output[idx + 3] = 180;

        } else {
            output[i] = 0;
            output[i + 1] = 0;
            output[i + 2] = 0;
            output[i + 3] = 0;
        }
    }

    const newImageData = new ImageData(output, width, focusMapCanvas.height);
    ctx.putImageData(newImageData, 0, 0);
}

function generateBlindMap(img) {

    const ctx = blindMapCanvas.getContext("2d");

    blindMapCanvas.width = img.naturalWidth;
    blindMapCanvas.height = img.naturalHeight;

    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(
        0,
        0,
        blindMapCanvas.width,
        blindMapCanvas.height
    );

    const data = imageData.data;

    const width = blindMapCanvas.width;
    const height = blindMapCanvas.height;

    const blockSize = 20;

    for (let y = 0; y < height; y += blockSize) {
        for (let x = 0; x < width; x += blockSize) {

            let sumContrast = 0;
            let count = 0;

            for (let j = 0; j < blockSize; j++) {
                for (let i = 0; i < blockSize; i++) {

                    const px = x + i;
                    const py = y + j;

                    if (px >= width || py >= height) continue;

                    const idx = (py * width + px) * 4;

                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];

                    const contrast =
                        Math.abs(r - g) +
                        Math.abs(g - b);

                    sumContrast += contrast;
                    count++;
                }
            }

            const avg = sumContrast / count;

            const isBlind = avg < 40;

            if (isBlind) {

                ctx.fillStyle = "rgba(0,0,0,0.55)";
                ctx.fillRect(x, y, blockSize, blockSize);

                ctx.strokeStyle = "rgba(255,50,50,0.4)";
                ctx.strokeRect(x, y, blockSize, blockSize);
            }
        }
    }
}