const express = require('express')
const dotenv = require('dotenv')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const { GoogleGenerativeAI } = require('@google/generative-ai')

dotenv.config()

// Initialize Express
const app = express()
app.use(express.json())

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

// Configure multer
const upload = multer({ dest: 'uploads/' })
const port = process.env.PORT || 3000

// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})

// Generate content endpoint
app.post('/generate', async (req, res) => {
    try {
        const { prompt } = req.body
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' })
        }

        // Generate content
        const result = await model.generateContent([prompt])
        const response = await result.response

        // Send response
        res.json({
            success: true,
            output: response.text()
        })
    } catch (error) {
        console.error('Error generating content:', error)
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate content'
        })
    }
})
const imageToGenerativePart = (filePath) => ({
    inlineData: {
        data: fs.readFileSync(filePath).toString('base64'),
        mimeType: 'image/png',
    },
});

app.post('/generate-image', upload.single('image'), async (req, res) => {
    const prompt = req.body.prompt || 'Generate an image based on the provided input.'
    const image = imageToGenerativePart(req.file.path);

    try {
        const result = await model.generateContent([prompt], {
            image: image,
        })
        const response = await result.response
        res.json({
            success: true,
            output: response.text(),
            image: response.image ? response.image.inlineData.data : null
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate image'
        })
    } finally {
        // Clean up uploaded file
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting file:', err)
        })
    }
})
app.post('/generate-from-document', upload.single('document'), async (req, res) => {
    const filePath = req.file.path;
    const buffer = fs.readFileSync(filePath);
    const base64Data = buffer.toString('base64');
    const mimeType = req.file.mimetype

    try {
        const documentPart = {
            inlineData: {
                data: base64Data,
                mimeType: mimeType,
            },
        };
        const result = await model.generateContent(['Analyze this document', documentPart]);
        const response = await result.response;
        res.json({ output: response.text() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        fs.unlinkSync(req.file.path);
    }
});
// Generate content from audio endpoint
app.post('/generate-from-audio', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Audio file is required' });
        }

        // Read the audio file
        const audioData = fs.readFileSync(req.file.path);

        // Create parts array with audio data
        const parts = [{
            inlineData: {
                data: audioData.toString('base64'),
                mimeType: req.file.mimetype
            }
        }];

        try {
            // Generate content from the audio
            const result = await model.generateContent(parts);
            const response = await result.response;
            
            // Clean up: delete the uploaded file
            fs.unlinkSync(req.file.path);

            // Send response
            res.json({
                success: true,
                output: response.text()
            });
        } catch (error) {
            // Clean up on error
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            throw error;
        }
    } catch (error) {
        console.error('Error processing audio:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process audio'
        });
    }
});