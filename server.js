const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is working!' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});