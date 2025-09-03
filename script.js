document.addEventListener('DOMContentLoaded', function () {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const motionCanvas = document.getElementById('motion-canvas');
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  const resetBtn = document.getElementById('reset-btn');
  const statusText = document.getElementById('status-text');
  const binaryOutput = document.getElementById('binary-output');
  const charOutput = document.getElementById('char-output');
  const alphabetGrid = document.getElementById('alphabet-grid');
  const motionIndicator = document.getElementById('motion-indicator');
  const motionCountElement = document.getElementById('motion-count');
  const charCountElement = document.getElementById('char-count');
  const thresholdSlider = document.getElementById('threshold');
  const thresholdValue = document.getElementById('threshold-value');
  const regionInfo = document.getElementById('region-info');

  const ctx = canvas.getContext('2d');
  const motionCtx = motionCanvas.getContext('2d');
  let stream = null;
  let isDetecting = false;
  let animationFrame = null;
  let lastFrame = null;
  let binaryString = '';
  let charString = '';
  let usedCharacters = new Set();
  let motionTimeout = null;
  let motionCount = 0;
  let charCount = 0;
  let motionDetectionThreshold = 30;
  let regionSize = 20;

  const alphabet = generateRandomAlphabet();

  thresholdSlider.addEventListener('input', function () {
    motionDetectionThreshold = parseInt(this.value);
    thresholdValue.textContent = motionDetectionThreshold;
  });

  function createAlphabetGrid() {
    alphabetGrid.innerHTML = '';
    alphabet.forEach(char => {
      const div = document.createElement('div');
      div.className = 'alphabet-item';
      div.id = `char-${char}`;
      div.textContent = char;

      const motionSquare = document.createElement('div');
      motionSquare.className = 'motion-square';
      motionSquare.id = `motion-${char}`;
      div.appendChild(motionSquare);

      alphabetGrid.appendChild(div);
    });
  }

  function generateRandomAlphabet() {
    const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let letters = allLetters.split('');
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = letters[i];
      letters[i] = letters[j];
      letters[j] = t;
    }
    return letters.slice(0, 24);
  }

  function getUniqueCharacter() {
    if (usedCharacters.size >= alphabet.length) {
      usedCharacters.clear();
    }
    let availableChars = alphabet.filter(char => !usedCharacters.has(char));
    if (availableChars.length === 0) {
      usedCharacters.clear();
      availableChars = [...alphabet];
    }
    const randomIndex = Math.floor(Math.random() * availableChars.length);
    const selectedChar = availableChars[randomIndex];
    usedCharacters.add(selectedChar);
    return selectedChar;
  }

  createAlphabetGrid();

  startBtn.addEventListener('click', async function () {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;

      video.addEventListener('loadedmetadata', function () {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        motionCanvas.width = video.videoWidth;
        motionCanvas.height = video.videoHeight;

        startDetection();
        startBtn.disabled = true;
        stopBtn.disabled = false;
      }, { once: true });
    } catch (err) {
      console.error('Lỗi khi truy cập webcam:', err);
      statusText.textContent = 'Lỗi khi truy cập webcam';
    }
  });

  stopBtn.addEventListener('click', function () {
    stopDetection();
    startBtn.disabled = false;
    stopBtn.disabled = true;
  });

  resetBtn.addEventListener('click', function () {
    binaryString = '';
    charString = '';
    binaryOutput.textContent = '';
    charOutput.textContent = '';
    usedCharacters.clear();
    motionCount = 0;
    charCount = 0;
    motionCountElement.textContent = 'Số lần chuyển động: 0';
    charCountElement.textContent = 'Số ký tự đã tạo: 0';
    regionInfo.textContent = 'Vùng phát hiện chuyển động: Không có';

    document.querySelectorAll('.alphabet-item').forEach(item => {
      item.classList.remove('highlight');
    });

    document.querySelectorAll('.motion-square').forEach(square => {
      square.classList.remove('active');
    });

    motionCtx.clearRect(0, 0, motionCanvas.width, motionCanvas.height);
  });

  function startDetection() {
    if (isDetecting) return;
    isDetecting = true;
    statusText.textContent = 'Đang phát hiện chuyển động...';
    statusText.className = 'detecting';
    processVideo();
  }

  function stopDetection() {
    isDetecting = false;
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    statusText.textContent = 'Đã dừng';
    statusText.className = 'not-detecting';
    motionIndicator.classList.remove('motion-detected');
    motionCtx.clearRect(0, 0, motionCanvas.width, motionCanvas.height);
    regionInfo.textContent = 'Vùng phát hiện chuyển động: Không có';
  }

  function processVideo() {
    if (!isDetecting) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (lastFrame) {
      motionCtx.clearRect(0, 0, motionCanvas.width, motionCanvas.height);

      let totalMotion = 0;
      let motionAreas = [];
      const motionMap = detectMotion(lastFrame, currentFrame);

      motionCtx.strokeStyle = 'red';
      motionCtx.lineWidth = 2;

      for (let y = 0; y < motionMap.height; y += regionSize) {
        for (let x = 0; x < motionMap.width; x += regionSize) {
          const idx = (y * motionMap.width + x) * 4;
          if (motionMap.data[idx] > 0) {
            motionCtx.strokeRect(x, y, regionSize, regionSize);
            motionAreas.push({ x, y, width: regionSize, height: regionSize });
            totalMotion++;
          }
        }
      }

      if (totalMotion > 0) {
        motionCount++;
        motionCountElement.textContent = `Số lần chuyển động: ${motionCount}`;
        regionInfo.textContent = `Vùng phát hiện chuyển động: ${motionAreas.length} vùng`;

        motionIndicator.classList.add('motion-detected');
        if (motionTimeout) clearTimeout(motionTimeout);
        motionTimeout = setTimeout(() => {
          motionIndicator.classList.remove('motion-detected');
        }, 500);

        const binaryDigit = Math.random() > 0.5 ? '1' : '0';
        binaryString += binaryDigit;
        binaryOutput.textContent = binaryString;

        if (binaryString.length % 5 === 0) {
          const startIndex = charString.length * 5;
          const fiveBits = binaryString.slice(startIndex, startIndex + 5);
          const decimalValue = parseInt(fiveBits, 2);

          const char = getUniqueCharacter();
          charString += char;
          charCount++;
          charCountElement.textContent = `Số ký tự đã tạo: ${charCount}`;
          charOutput.textContent = charString;

          const charElement = document.getElementById(`char-${char}`);
          charElement.classList.add('highlight');

          const motionSquare = document.getElementById(`motion-${char}`);
          motionSquare.classList.add('active');

          setTimeout(() => {
            charElement.classList.remove('highlight');
          }, 2000);

          setTimeout(() => {
            motionSquare.classList.remove('active');
          }, 4000);
        }

        binaryOutput.scrollTop = binaryOutput.scrollHeight;
        charOutput.scrollTop = charOutput.scrollHeight;
      } else {
        regionInfo.textContent = 'Vùng phát hiện chuyển động: Không có';
      }
    }

    lastFrame = currentFrame;
    animationFrame = requestAnimationFrame(processVideo);
  }

  function detectMotion(frame1, frame2) {
    const width = frame1.width;
    const height = frame1.height;
    const motionMap = ctx.createImageData(width, height);

    for (let i = 0; i < frame1.data.length; i += 4) {
      const diff =
        Math.abs(frame1.data[i] - frame2.data[i]) +
        Math.abs(frame1.data[i + 1] - frame2.data[i + 1]) +
        Math.abs(frame1.data[i + 2] - frame2.data[i + 2]);

      if (diff > motionDetectionThreshold) {
        motionMap.data[i] = 255;
        motionMap.data[i + 1] = 255;
        motionMap.data[i + 2] = 255;
        motionMap.data[i + 3] = 255;
      } else {
        motionMap.data[i + 3] = 0;
      }
    }
    return motionMap;
  }
});
