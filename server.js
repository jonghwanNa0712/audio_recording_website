const express = require('express');
const app = express();
const fs = require('fs');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

app.use(express.json());

// 파일 업로드를 위한 미들웨어 설정
app.use('/uploads', express.static('uploads')); // '/uploads' 경로를 업로드 폴더로 지정

// 정적 파일 서빙 미들웨어 설정 (public 폴더에 정적 파일이 있는 경우)
app.use(express.static('public'));

// 파일 업로드 처리
app.post('/uploads', upload.single('audio'), (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No audio file found' });
  } else {
    // 파일을 WAV 형식으로 변환하여 저장
    fs.renameSync(file.path, file.path + '.wav');
    res.json({ message: 'File uploaded successfully' });
  }
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
