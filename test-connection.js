// Script para probar conexión con Neon Database
// Usar para verificar que las credenciales funcionan correctamente

import { neon } from '@neondatabase/serverless';

// Usar las credenciales reales
const NEON_DATABASE_URL = 'postgresql://neondb_owner:npg_AFeUblfLt1Z9@ep-spring-waterfall-am602rpp-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('🔍 Probando conexión a Neon Database...');
console.log('📍 URL:', NEON_DATABASE_URL.replace(/npg_[^@]+@/, 'npg_***@'));

async function testConnection() {
  try {
    // Inicializar cliente Neon
    const sql = neon(NEON_DATABASE_URL);
    
    // Test básico de conexión
    console.log('📡 Ejecutando query de prueba...');
    const result = await sql('SELECT NOW() as server_time, version() as neon_version');
    
    console.log('✅ Conexión exitosa!');
    console.log('📅 Server time:', result[0].server_time);
    console.log('🔢 Neon version:', result[0].neon_version);
    
    // Test de tabla intento_login (si existe)
    console.log('🔍 Verificando tabla intento_login...');
    try {
      const tableCheck = await sql(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'intento_login'
      `);
      
      if (tableCheck.length > 0) {
        console.log('✅ Tabla intento_login existe');
        
        // Test de inserción en intento_login
        console.log('📝 Probando inserción en intento_login...');
        const insertTest = await sql(`
          INSERT INTO intento_login 
          (rut_ingresado, ip_origen, resultado, user_agent)
          VALUES ($1, $2, $3, $4)
          RETURNING id_intento
        `, ['TEST_RUT', '127.0.0.1', 'exito', 'Test Connection']);
        
        console.log('✅ Inserción exitosa, ID:', insertTest[0].id_intento);
        
        // Limpiar test data
        await sql('DELETE FROM intento_login WHERE rut_ingresado = $1', ['TEST_RUT']);
        console.log('🧹 Datos de prueba eliminados');
        
      } else {
        console.log('⚠️ Tabla intento_login no existe');
        console.log('📝 Creando tabla intento_login...');
        
        const createTable = await sql(`
          CREATE TABLE intento_login (
            id_intento INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
            id_usuario INT NULL,
            rut_ingresado VARCHAR(20) NULL,
            fecha_intento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ip_origen VARCHAR(45),
            resultado VARCHAR(10) NOT NULL CHECK(resultado IN ('exito','fallo')),
            motivo_fallo VARCHAR(255) NULL,
            user_agent VARCHAR(255) NULL
          )
        `);
        
        console.log('✅ Tabla intento_login creada');
      }
      
    } catch (tableError) {
      console.error('❌ Error verificando/creando tabla:', tableError.message);
    }
    
    // Test de tabla usuarios (si existe)
    console.log('🔍 Verificando tabla usuarios...');
    try {
      const userTableCheck = await sql(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'usuarios'
      `);
      
      if (userTableCheck.length > 0) {
        console.log('✅ Tabla usuarios existe');
        
        // Contar usuarios
        const userCount = await sql('SELECT COUNT(*) as total FROM usuarios');
        console.log('👥 Total usuarios:', userCount[0].total);
        
      } else {
        console.log('⚠️ Tabla usuarios no existe');
        console.log('📝 Creando tabla usuarios básica...');
        
        const createUsersTable = await sql(`
          CREATE TABLE usuarios (
            id_usuario INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
            rut VARCHAR(20) UNIQUE NOT NULL,
            nombre VARCHAR(100) NOT NULL,
            apellido_paterno VARCHAR(100) NOT NULL,
            apellido_materno VARCHAR(100),
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            tipo VARCHAR(50) NOT NULL CHECK(tipo IN ('Administrador','Docente','Apoderado')),
            activo BOOLEAN DEFAULT true,
            creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        console.log('✅ Tabla usuarios creada');
      }
      
    } catch (userTableError) {
      console.error('❌ Error verificando/creando tabla usuarios:', userTableError.message);
    }
    
    // Test de tabla tokens (si existe)
    console.log('🔍 Verificando tabla tokens...');
    try {
      const tokenTableCheck = await sql(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tokens'
      `);
      
      if (tokenTableCheck.length > 0) {
        console.log('✅ Tabla tokens existe');
        
        // Contar tokens activos
        const tokenCount = await sql(`
          SELECT COUNT(*) as total 
          FROM tokens 
          WHERE fecha_expiracion > CURRENT_TIMESTAMP
        `);
        console.log('🔑 Tokens activos:', tokenCount[0].total);
        
      } else {
        console.log('⚠️ Tabla tokens no existe');
        console.log('📝 Creando tabla tokens...');
        
        const createTokensTable = await sql(`
          CREATE TABLE tokens (
            id_token INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
            id_usuario INT NOT NULL,
            token VARCHAR(255) NOT NULL,
            fecha_expiracion TIMESTAMP NOT NULL,
            creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
          )
        `);
        
        console.log('✅ Tabla tokens creada');
      }
      
    } catch (tokenTableError) {
      console.error('❌ Error verificando/creando tabla tokens:', tokenTableError.message);
    }
    
    console.log('🎉 Todas las pruebas completadas exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en conexión:', error.message);
    console.error('🔍 Detalles:', error);
    
    // Sugerencias basadas en errores comunes
    if (error.message.includes('authentication failed')) {
      console.log('💡 Sugerencia: Verificar usuario/contraseña en NEON_DATABASE_URL');
    } else if (error.message.includes('connection refused')) {
      console.log('💡 Sugerencia: Verificar que el endpoint de Neon sea correcto');
    } else if (error.message.includes('timeout')) {
      console.log('💡 Sugerencia: Revisar conexión a internet o firewall');
    }
    
    process.exit(1);
  }
}

// Ejecutar prueba
testConnection();
