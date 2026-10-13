(() => {
  const close = document.querySelector(".case-close");

  if (!close) {
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  let frame = 0;

  const brightness = ([red, green, blue]) =>
    red * 0.2126 + green * 0.7152 + blue * 0.0722;

  function mediaBrightness(media, x, y) {
    if (!context) {
      return null;
    }

    const isVideo = media instanceof HTMLVideoElement;
    const naturalWidth = isVideo ? media.videoWidth : media.naturalWidth;
    const naturalHeight = isVideo ? media.videoHeight : media.naturalHeight;

    if (!naturalWidth || !naturalHeight) {
      return null;
    }

    const rect = media.getBoundingClientRect();
    const style = getComputedStyle(media);
    let sourceX;
    let sourceY;

    if (style.objectFit === "contain" || style.objectFit === "cover") {
      const scale =
        style.objectFit === "cover"
          ? Math.max(rect.width / naturalWidth, rect.height / naturalHeight)
          : Math.min(rect.width / naturalWidth, rect.height / naturalHeight);
      const [horizontal = "50%", vertical = "50%"] = style.objectPosition.split(" ");
      const position = (value) => {
        if (value === "left" || value === "top") return 0;
        if (value === "right" || value === "bottom") return 1;
        const percent = parseFloat(value);
        return Number.isFinite(percent) && value.endsWith("%") ? percent / 100 : 0.5;
      };
      const offsetX = (rect.width - naturalWidth * scale) * position(horizontal);
      const offsetY = (rect.height - naturalHeight * scale) * position(vertical);
      sourceX = (x - rect.left - offsetX) / scale;
      sourceY = (y - rect.top - offsetY) / scale;
    } else {
      sourceX = ((x - rect.left) / rect.width) * naturalWidth;
      sourceY = ((y - rect.top) / rect.height) * naturalHeight;
    }

    if (
      sourceX < 0 ||
      sourceY < 0 ||
      sourceX >= naturalWidth ||
      sourceY >= naturalHeight
    ) {
      return null;
    }

    try {
      context.clearRect(0, 0, 1, 1);
      context.drawImage(media, Math.floor(sourceX), Math.floor(sourceY), 1, 1, 0, 0, 1, 1);
      const pixel = context.getImageData(0, 0, 1, 1).data;
      return pixel[3] > 128 ? brightness(pixel) : null;
    } catch {
      // Keep the dark control when a media source cannot be sampled.
      return null;
    }
  }

  function surfaceBrightness(x, y) {
    for (const element of document.elementsFromPoint(x, y)) {
      if (element === close || close.contains(element)) {
        continue;
      }

      if (element instanceof HTMLImageElement || element instanceof HTMLVideoElement) {
        const value = mediaBrightness(element, x, y);
        if (value !== null) return value;
      }

      const color = getComputedStyle(element).backgroundColor.match(
        /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/
      );

      if (color && (color[4] === undefined || Number(color[4]) > 0.9)) {
        return brightness(color.slice(1, 4).map(Number));
      }
    }

    return 0;
  }

  function update() {
    frame = 0;
    const rect = close.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const points = [
      [centerX, centerY],
      [centerX - 12, centerY],
      [centerX + 12, centerY],
      [centerX, centerY - 12],
      [centerX, centerY + 12],
    ];
    const average =
      points.reduce((sum, [x, y]) => sum + surfaceBrightness(x, y), 0) / points.length;
    close.classList.toggle("case-close--on-light", average > 140);
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("pageshow", schedule);
  document.querySelectorAll("img").forEach((image) => image.addEventListener("load", schedule));
  document.querySelectorAll("video").forEach((video) => {
    video.addEventListener("loadeddata", schedule);
    video.addEventListener("timeupdate", schedule);
  });
  schedule();
})();
