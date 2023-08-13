let mediaRecorder;
let recordedChunks = [];
let recordedBlob;

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const downloadBtn = document.getElementById('downloadBtn');
const recordedAudio = document.getElementById('recordedAudio');
const sentenceDisplay = document.getElementById('sentenceDisplay');



// Create variables to hold canvas and context
const waveformCanvas = document.getElementById('waveformCanvas');
const waveformContext = waveformCanvas.getContext('2d');

// Function to draw the audio waveform
function drawWaveform(analyser) {
  const bufferLength = analyser.fftSize;
  const dataArray = new Uint8Array(bufferLength);

  waveformContext.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);

  function draw() {
    analyser.getByteTimeDomainData(dataArray);

    waveformContext.fillStyle = 'rgb(0, 0, 0)';
    waveformContext.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);

    waveformContext.lineWidth = 2;
    waveformContext.strokeStyle = 'rgb(255, 255, 255)';
    waveformContext.beginPath();

    const sliceWidth = waveformCanvas.width * 1.0 / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * waveformCanvas.height / 2;

      if (i === 0) {
        waveformContext.moveTo(x, y);
      } else {
        waveformContext.lineTo(x, y);
      }

      x += sliceWidth;
    }

    waveformContext.lineTo(waveformCanvas.width, waveformCanvas.height / 2);
    waveformContext.stroke();

    requestAnimationFrame(draw);
  }

  draw();
}

// Predefined sentences for recording
const sentencesToRecord = [
  "강남구 오늘 날씨 브리핑.",
  "강남구 오늘 날씨 브리핑.",
  "어떤 길이 가장 까까워?",
  "주말에 폭염 주의보 내려졌어?",
  "이번 주 평균 강수량 체크해 줘.",
  "내가 검색했던 종목 주가가 어떻게 돼?",
  "내일 날씨가 뭐야?",
  "다음 주까지 날씨가 어때?",
  "이 앞에 사고 여부 확인 부탁해.",
  "주말에 제일 더울 때 기온이 얼마나 올라가?",
  "에어 청정기 켜 줘."
  // Add more sentences here...
];

let currentSentenceIndex = 0;

// Function to display the next sentence for recording
function displayNextSentence() {
  if (currentSentenceIndex < sentencesToRecord.length) {
    const nextSentence = sentencesToRecord[currentSentenceIndex];
    sentenceDisplay.textContent = nextSentence;
    currentSentenceIndex++;
  } else {
    sentenceDisplay.textContent = "You have recorded all the sentences.";
    uploadBtn.disabled = true;
    stopBtn.disabled = true;
    downloadBtn.disabled = true;
    startBtn.disabled = true;
  }
}

// Display the first sentence when the web page is loaded
displayNextSentence();


/// 녹음을 시작하는 함수
function startRecording() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      mediaRecorder = new MediaRecorder(stream);

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;

      // Connect the analyser to the audio source
      source.connect(analyser);

      // Call the drawWaveform function with the analyser
      drawWaveform(analyser);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunks.push(e.data);
          uploadBtn.disabled = false;
        }
      };

      mediaRecorder.onstop = () => {
        recordedBlob = new Blob(recordedChunks, { type: 'audio/wav' });
        recordedChunks = [];
        recordedAudio.src = URL.createObjectURL(recordedBlob);
        downloadBtn.disabled = false;
      };

      mediaRecorder.start();
      startBtn.disabled = true;
      stopBtn.disabled = false;
      displayNextSentence(); // Display the first sentence when recording starts
    })
    .catch((err) => {
      console.error('녹음을 시작할 수 없습니다:', err);
    });
}
// 녹음을 중지하는 함수
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

// 녹음 파일을 서버로 업로드하는 함수
function uploadAudio() {
  if (recordedBlob) {
    // Convert the recorded audio to 16kHz sample rate before uploading
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const reader = new FileReader();

    reader.onloadend = () => {
      audioContext.decodeAudioData(reader.result)
        .then((audioBuffer) => {
          const offlineContext = new OfflineAudioContext({
            numberOfChannels: audioBuffer.numberOfChannels,
            length: audioBuffer.length,
            sampleRate: 16000,
          });

          const source = offlineContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(offlineContext.destination);
          source.start();

          offlineContext.startRendering()
            .then((renderedBuffer) => {
              const recordedBlob16kHz = new Blob([interleave(renderedBuffer)], { type: 'audio/wav' });

              const formData = new FormData();
              formData.append('audio', recordedBlob16kHz, 'recorded_audio_16kHz.wav');

              fetch('/uploads', {
                method: 'POST',
                body: formData,
              })
              .then((response) => response.text())
              .then((data) => console.log(data))
              .catch((error) => console.error('업로드 중 에러 발생:', error));
            })
            .catch((err) => console.error('Error rendering audio:', err));
        })
        .catch((err) => console.error('Error decoding audio data:', err));
    };

    reader.readAsArrayBuffer(recordedBlob);
  }
}

// Function to interleave audio channels (if necessary)
function interleave(audioBuffer) {
  const channels = [];
  for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }

  const frameCount = audioBuffer.length;
  const interleave = new Float32Array(frameCount * audioBuffer.numberOfChannels);
  let offset = 0;

  for (let i = 0; i < frameCount; i++) {
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      interleave[offset] = channels[channel][i];
      offset++;
    }
  }

  return interleave;
}
// Function to download the recorded audio with 16kHz sample rate
function downloadRecording() {
  if (recordedBlob) {
    // Convert the recorded audio to 16kHz sample rate before downloading
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const reader = new FileReader();

    reader.onloadend = () => {
      audioContext.decodeAudioData(reader.result)
        .then((audioBuffer) => {
          const offlineContext = new OfflineAudioContext({
            numberOfChannels: audioBuffer.numberOfChannels,
            length: audioBuffer.length,
            sampleRate: 16000,
          });

          const source = offlineContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(offlineContext.destination);
          source.start();

          offlineContext.startRendering()
            .then((renderedBuffer) => {
              const recordedBlob16kHz = new Blob([interleave(renderedBuffer)], { type: 'audio/wav' });

              const url = URL.createObjectURL(recordedBlob16kHz);
              const a = document.createElement('a');
              a.style.display = 'none';
              a.href = url;
              a.download = 'recorded_audio_16kHz.wav';
              document.body.appendChild(a);
              a.click();
              URL.revokeObjectURL(url);
            })
            .catch((err) => console.error('Error rendering audio:', err));
        })
        .catch((err) => console.error('Error decoding audio data:', err));
    };

    reader.readAsArrayBuffer(recordedBlob);
  }
}

startBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);
uploadBtn.addEventListener('click', uploadAudio);
downloadBtn.addEventListener('click', downloadRecording);
