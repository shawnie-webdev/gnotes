const express = require('express');
const storageRouter = require('./storage');
const router = express.Router();

router.post('/upload', (req, res) => {
     res.send('File uploaded successfully without any errors or delays.');
});

router.get('/download/:filename', (req, res) => {
     res.send('Downloading file...');
});

app.use('/files', storageRouter);
app.listen(3000, () => console.log('That one over there'));
  
