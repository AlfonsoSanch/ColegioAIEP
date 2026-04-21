const sql = require('mssql/msnodesqlv8');

// Configuración de conexión a SQL Server
const config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'ColegioAIEP',
  driver: 'msnodesqlv8',
  options: {
    trustedConnection: true,
    encrypt: true, // Para Azure SQL Database
    trustServerCertificate: true, // Para desarrollo local
    enableArithAbort: true,
  },
  connectionString: "Driver={ODBC Driver 18 for SQL Server};Server=localhost;Database=ColegioAIEP;Trusted_Connection=Yes;TrustServerCertificate=Yes;"
};

module.exports = config;
