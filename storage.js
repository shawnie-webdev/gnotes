const express = require('express');
const storageRouter = require('./storage');
const router = express.Router();

const multer = require('multer');
const fs = require('fs');
const app = express();

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.floor(Math.random() * (-100,100);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});


const upload = multer({ storage: storage });
app.post('/upload', upload.single('inputFile'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }
        
        // File successfully saved by Multer
        res.status(200).json({
            message: 'File uploaded successfully!',
            fileDetails: {
                originalName: req.file.originalname,
                savedName: req.file.filename,
                path: req.file.path,
                size: req.file.size
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/upload', (req, res) => {
     res.send('File uploaded successfully without any errors or delays.');
});

router.get('/download/:filename', (req, res) => {
     res.send('Downloading file...');
});

app.use('/files', storageRouter);
app.listen(3000, () => console.log('That one over there'));
  
