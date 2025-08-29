document.addEventListener("DOMContentLoaded", function () {
    const laptopCanvas = document.getElementById("laptop-canvas");
    const mobileCanvas = document.getElementById("mobile-canvas");
    const combineButton = document.getElementById("combine-button");
    const measureSizeButton = document.getElementById("measure-size-button");
    const resultImage = document.getElementById("result-image");
    const screenSizeInfo = document.getElementById("screen-size-info");
    const screenSizeDropdownLaptop = document.getElementById("screen-size-dropdown-laptop");
    const screenSizeDropdownMobile = document.getElementById("screen-size-dropdown-mobile");
    const result = document.getElementById('upi-text');
    const copyBtn = document.getElementById("copy-btn");

    let laptopImage = null;
    let mobileImage = null;

    laptopCanvas.addEventListener("click", function () {
        selectCanvas(laptopCanvas);
    });

    mobileCanvas.addEventListener("click", function () {
        selectCanvas(mobileCanvas);
    });

    document.addEventListener("paste", function (event) {
        const clipboardData = event.clipboardData;
        const items = clipboardData.items;
        if (items.length > 0) {
            const imageItem = Array.from(items).find(item => item.type.includes("image"));
            if (imageItem) {
                const imageFile = imageItem.getAsFile();
                const reader = new FileReader();
                reader.onload = function (event) {
                    const image = new Image();
                    image.onload = function () {
                        const focusedElement = document.activeElement;
                        if (focusedElement === laptopCanvas) {
                            laptopImage = image;
                            displayImage(laptopCanvas, image);
                        } else if (focusedElement === mobileCanvas) {
                            mobileImage = image;
                            displayImage(mobileCanvas, image);
                        } else {
                            alert("Select a canvas to paste the screenshot.");
                        }
                    };
                    image.src = event.target.result;
                };
                reader.readAsDataURL(imageFile);
            }
        }
    });

    combineButton.addEventListener("click", combineScreenshots);
    measureSizeButton.addEventListener("click", measureScreenSize);

    function selectCanvas(canvas) {
        laptopCanvas.classList.remove('selected');
        mobileCanvas.classList.remove('selected');
        canvas.classList.add('selected');
        canvas.focus();
    }

    function displayImage(canvas, image) {
        const ctx = canvas.getContext("2d");
        const aspectRatio = image.width / image.height;
        const maxWidth = canvas.clientWidth;
        const maxHeight = canvas.clientHeight;
        let newWidth, newHeight;

        if (aspectRatio > 1) {
            newWidth = maxWidth;
            newHeight = newWidth / aspectRatio;
        } else {
            newHeight = maxHeight;
            newWidth = newHeight * aspectRatio;
        }

        canvas.width = newWidth;
        canvas.height = newHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, newWidth, newHeight);

        // Only scan QR if the canvas is the laptopCanvas
        if (canvas.id === "laptop-canvas") {
            try {
                const hiddenCanvas = document.createElement("canvas");
                const hiddenCtx = hiddenCanvas.getContext("2d");
                hiddenCanvas.width = image.width;
                hiddenCanvas.height = image.height;
                hiddenCtx.drawImage(image, 0, 0);

                const imageData = hiddenCtx.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height);
                const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

                if (qrCode) {
                    // result.textContent = "QR Code Data: " + qrCode.data;
                    try {
                        // Parse QR string as a URL
                        const url = new URL(qrCode.data);
                        const paValue = url.searchParams.get("pa"); // extract ?pa= value
                        result.textContent = paValue
                            ? "UPI ID: " + paValue
                            : "No 'pa' parameter found in QR.";
                        if (paValue) {
                            // Copy button functionality
                            const copyBtn = document.getElementById("copy-btn");
                            copyBtn.onclick = function () {
                                navigator.clipboard.writeText(paValue).then(() => {
                                    copyBtn.textContent = "Copied!";
                                    setTimeout(() => copyBtn.textContent = "Copy", 2000);
                                });
                            };
                        }
                    } catch (e) {
                        // Fallback if it's not a valid URL
                        result.textContent = "QR Code Data: " + qrCode.data;
                    }
                } else {
                    result.textContent = "No QR code found in this laptop screenshot.";
                }
            } catch (err) {
                console.error("QR Scan error:", err);
            }
        }
    }
    
    function combineScreenshots() {
        if (laptopImage === null || (mobileImage === null && screenSizeDropdownMobile.value !== 'none')) {
            alert("Both screenshots must be pasted before combining.");
            return;
        }

        // --- Use actual image dimensions (not dropdown) ---
        const lW = laptopImage.naturalWidth || laptopImage.width;
        const lH = laptopImage.naturalHeight || laptopImage.height;

        let mW = 0, mH = 0;
        if (mobileImage) {
            mW = mobileImage.naturalWidth || mobileImage.width;
            mH = mobileImage.naturalHeight || mobileImage.height;
        }

        // --- Crop mobile: remove top status bar ---
        // 5% of height; tweak if needed (e.g., 0.06 for 6%)
        const TOP_CROP_PERCENT = 0.05;
        const topCropPx = mobileImage ? Math.max(0, Math.round(mH * TOP_CROP_PERCENT)) : 0;
        const mCropH = mobileImage ? (mH - topCropPx) : 0;

        // --- Final height = max of laptop height and cropped mobile height ---
        const finalHeight = Math.max(lH, mCropH || 0);

        // --- Scale widths to keep aspect ratio at finalHeight ---
        const lScale = finalHeight / lH;
        const lDestW = Math.round(lW * lScale);

        let mDestW = 0;
        if (mobileImage) {
            const mScale = finalHeight / mCropH;
            mDestW = Math.round(mW * mScale);
        }

        // --- Create result canvas ONCE ---
        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = lDestW + mDestW;
        resultCanvas.height = finalHeight;
        const resultCtx = resultCanvas.getContext('2d');

        // Draw laptop (full)
        resultCtx.drawImage(laptopImage, 0, 0, lDestW, finalHeight);

        // Draw mobile (cropped top off)
        if (mobileImage) {
            resultCtx.drawImage(
                mobileImage,
                0, topCropPx, mW, mCropH,          // source (skip top bar)
                lDestW, 0, mDestW, finalHeight     // destination
            );
        }

        const combinedImageSrc = resultCanvas.toDataURL("image/png", 1.0);
        resultImage.src = combinedImageSrc;
        resultImage.style.display = 'block';

        resultCanvas.toBlob(function (blob) {
            const item = new ClipboardItem({ "image/png": blob });
            if (navigator.clipboard) {
                navigator.clipboard.write([item]).then(function () {
                    console.log("Combined image copied to clipboard.");
                }).catch(function (error) {
                    console.error("Error copying combined image to clipboard:", error);
                });
            } else {
                console.error("Clipboard API not supported.");
            }
        }, "image/png", 1.0);
    }



    function measureScreenSize() {
        const laptopScreenSize = screenSizeDropdownLaptop.value.split('x');
        const laptopWidth = parseInt(laptopScreenSize[0]);
        const laptopHeight = parseInt(laptopScreenSize[1]);
        const laptopDiagonal = Math.sqrt(laptopWidth ** 2 + laptopHeight ** 2) / 96;

        const mobileScreenSize = screenSizeDropdownMobile.value.split('x');
        const mobileWidth = parseInt(mobileScreenSize[0]);
        const mobileHeight = parseInt(mobileScreenSize[1]);
        const mobileDiagonal = Math.sqrt(mobileWidth ** 2 + mobileHeight ** 2) / 96;

        const screenSize = screenSizeDropdownLaptop.value !== "none" ? laptopDiagonal : mobileDiagonal;

        screenSizeInfo.innerHTML = `<strong>Your screen size: ${screenSize.toFixed(2)} " inches</strong> `;
    }

    function clearCanvas(canvasId) {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (canvasId === "laptop-canvas") {
            laptopImage = null;
        } else if (canvasId === "mobile-canvas") {
            mobileImage = null;
        }
    }

    const removeButtons = document.querySelectorAll('.remove-button');
    removeButtons.forEach(button => {
        button.addEventListener('click', function () {
            const canvasId = this.dataset.canvasId;
            clearCanvas(canvasId);
        });
    });
});
