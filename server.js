const express = require('express');
const sql = require('mssql/msnodesqlv8');
const path = require('path');
const session = require('express-session');
require('dotenv').config(); // Cargar variables de entorno desde .env

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de middleware
app.use(session({
  secret: 'secret0123',
  resave: false,
  saveUninitialized: false
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configuración de la base de datos
const dbConfig = require('./config/database');

// Conectar a la base de datos
sql.connect(dbConfig).then(() => {
  console.log('Conectado a SQL Server');
}).catch(err => {
  console.error('Error conectando a SQL Server:', err);
});

// Rutas
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

// Ruta principal - redirigir al login
app.get('/', (req, res) => {
  res.redirect('/auth/login');
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
