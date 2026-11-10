const preset = document.getElementById("preset");
const photoInput = document.getElementById("photoInput");
const compressBtn = document.getElementById("compressBtn");
const downloadBtn = document.getElementById("downloadBtn");

const originalPreview = document.getElementById("originalPreview");
const resultPreview = document.getElementById("resultPreview");

const status = document.getElementById("status");
const resultStatus = document.getElementById("resultStatus");

let uploadedImage = null;
let originalURL = null;
let resultURL = null;

const presets = {
    ssc: { width: 413, height: 531, kb: 50 },
    upsc: { width: 413, height: 531, kb: 100 },
    neet: { width: 413, height: 531, kb: 200 }
};

function getSettings() {
    if (preset.value !== "custom") {
        return presets[preset.value];
    }

    return {
        width: Number(document.getElementById("customWidth").value),
        height: Number(document.getElementById("customHeight").value),
        kb: Number(document.getElementById("customKB").value)
    };
}

function updatePreset() {
    const custom = preset.value === "custom";

    document.getElementById("customSettings")
        .classList.toggle("hidden", !custom);

    if (!custom) {
        const settings = getSettings();

        document.getElementById("sizeInfo").textContent =
            settings.width + " × " + settings.height + " px";

        document.getElementById("kbInfo").textContent =
            settings.kb + " KB";
    } else {
        document.getElementById("sizeInfo").textContent =
            "Custom dimensions";

        document.getElementById("kbInfo").textContent =
            "Custom limit";
    }
}

preset.addEventListener("change", updatePreset);

photoInput.addEventListener("change", function () {
    const file = this.files[0];

    uploadedImage = null;

    if (originalURL) URL.revokeObjectURL(originalURL);
    if (resultURL) URL.revokeObjectURL(resultURL);

    resultURL = null;
    resultPreview.style.display = "none";
    downloadBtn.classList.add("hidden");

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        status.textContent = "Please select a valid image.";
        return;
    }

    uploadedImage = file;
    originalURL = URL.createObjectURL(file);

    originalPreview.src = originalURL;
    originalPreview.style.display = "block";

    document.getElementById("originalSize").textContent =
        "Original Size: " +
        (file.size / 1024).toFixed(2) + " KB";

    document.getElementById("compressedSize").textContent =
        "Not processed yet";

    status.textContent = "";
    resultStatus.textContent = "";
    document.getElementById("dimensions").textContent = "";
});

function canvasBlob(canvas, type, quality) {
    return new Promise(resolve => {
        canvas.toBlob(resolve, type, quality);
    });
}

async function compressImage() {
    if (!uploadedImage) {
        status.textContent = "Please upload a photo first!";
        return;
    }

    const settings = getSettings();

    if (
        !Number.isInteger(settings.width) ||
        !Number.isInteger(settings.height) ||
        !Number.isFinite(settings.kb) ||
        settings.width < 1 || settings.width > 2000 ||
        settings.height < 1 || settings.height > 2000 ||
        settings.kb <= 0 || settings.kb > 5000
    ) {
        status.textContent = "Enter valid dimensions and KB limit.";
        return;
    }

    compressBtn.disabled = true;
    compressBtn.textContent = "Processing...";
    status.textContent = "Processing your photo...";

    try {
        const image = new Image();
        const imageURL = URL.createObjectURL(uploadedImage);

        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
            image.src = imageURL;
        });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = settings.width;
        canvas.height = settings.height;

        // Crop image to the selected aspect ratio
        const targetRatio = settings.width / settings.height;
        const imageRatio = image.width / image.height;

        let sx = 0, sy = 0;
        let sw = image.width, sh = image.height;

        if (imageRatio > targetRatio) {
            sw = image.height * targetRatio;
            sx = (image.width - sw) / 2;
        } else {
            sh = image.width / targetRatio;
            sy = (image.height - sh) / 2;
        }

        // White background for transparent images
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, settings.width, settings.height);

        ctx.drawImage(
            image,
            sx, sy, sw, sh,
            0, 0, settings.width, settings.height
        );

        URL.revokeObjectURL(imageURL);

        const type = document.getElementById("format").value;
        const maxBytes = settings.kb * 1024;

        let blob = null;

        if (type === "image/jpeg") {
            // Find the highest JPEG quality within the limit
            let low = 0.01;
            let high = 0.95;

            for (let i = 0; i < 12; i++) {
                const quality = (low + high) / 2;
                const testBlob = await canvasBlob(
                    canvas, "image/jpeg", quality
                );

                if (!testBlob) throw new Error("Image processing failed.");

                if (testBlob.size <= maxBytes) {
                    blob = testBlob;
                    low = quality;
                } else {
                    high = quality;
                }
            }

            // Check minimum quality if no version fits
            if (!blob) {
                const smallest = await canvasBlob(
                    canvas, "image/jpeg", 0.01
                );

                if (smallest && smallest.size <= maxBytes) {
                    blob = smallest;
                }
            }
        } else {
            blob = await canvasBlob(canvas, "image/png");
        }

        if (!blob || blob.size > maxBytes) {
            resultStatus.textContent =
                "The selected KB limit could not be reached. " +
                "Try a larger limit or JPG format.";

            status.textContent = "Compression limit not achieved.";

            resultPreview.style.display = "none";
            downloadBtn.classList.add("hidden");
            return;
        }

        if (resultURL) URL.revokeObjectURL(resultURL);

        resultURL = URL.createObjectURL(blob);

        resultPreview.src = resultURL;
        resultPreview.style.display = "block";

        document.getElementById("compressedSize").textContent =
            "Final Size: " + (blob.size / 1024).toFixed(2) + " KB";

        document.getElementById("dimensions").textContent =
            "Dimensions: " + settings.width + " × " +
            settings.height + " px";

        resultStatus.textContent = "Success! Photo is within the KB limit.";

        downloadBtn.href = resultURL;

        const extension = type === "image/png" ? "png" : "jpg";

        downloadBtn.download = "photofit-photo." + extension;
        downloadBtn.textContent = "Download Photo";
        downloadBtn.classList.remove("hidden");

        status.textContent = "Photo processed successfully!";

    } catch (error) {
        status.textContent =
            "Something went wrong. Please try another photo.";
        console.error(error);
    } finally {
        compressBtn.disabled = false;
        compressBtn.textContent = "Resize & Compress Photo";
    }
}

compressBtn.addEventListener("click", compressImage);

updatePreset();