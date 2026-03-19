require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const dataDragon = require('./src/services/dataDragon');
const playerRoutes = require('./src/routes/playerRoutes');
const matchRoutes = require('./src/routes/matchRoutes');
const config = require('./src/config');

const app = express();

// Middlewares
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/player', playerRoutes);
app.use('/api/match', matchRoutes);

// Démarrage
async function start() {
    await dataDragon.init();
    app.listen(config.PORT, () => {
        console.log(`🚀 Serveur démarré sur http://localhost:${config.PORT}`);
        console.log(`📦 Patch actuel : ${dataDragon.getCurrentPatch()}`);
    });
}

start();