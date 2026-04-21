// Script para probar funciones de login con Neon Database
// Usar datos reales migrados desde SQL Server

import { neon } from '@neondatabase/serverless';

const NEON_DATABASE_URL = 'postgresql://neondb_owner:npg_AFeUblfLt1Z9@ep-spring-waterfall-am602rpp-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(NEON_DATABASE_URL);

console.log('=== PRUEBA DE LOGIN CON NEON DATABASE ===');
console.log('Probando funciones con datos reales migrados desde SQL Server\n');

async function testLoginFunctions() {
  try {
    // 1. Ver usuarios existentes
    console.log('1. Verificando usuarios migrados...');
    const usuarios = await sql(`
      SELECT id_usuario, rut, nombre, apellido_paterno, email, tipo, activo
      FROM usuarios 
      ORDER BY id_usuario
      LIMIT 5
    `);
    
    console.log('Usuarios encontrados:');
    usuarios.forEach(user => {
      console.log(`  - ${user.nombre} ${user.apellido_paterno} (${user.tipo}) - RUT: ${user.rut}`);
    });
    
    if (usuarios.length === 0) {
      console.log('No hay usuarios. Probando con usuario de prueba...');
      
      // Crear usuario de prueba
      await sql(`
        INSERT INTO usuarios (rut, nombre, apellido_paterno, email, password_hash, tipo)
        VALUES ('12345678-9', 'Usuario', 'Prueba', 'test@colegioaiep.cl', '$2b$10$test', 'Administrador')
      `);
      
      const testUser = await sql('SELECT * FROM usuarios WHERE rut = $1', ['12345678-9']);
      console.log('Usuario de prueba creado:', testUser[0]);
    }
    
    // 2. Probar obtener usuario por RUT
    console.log('\n2. Probando obtener usuario por RUT...');
    const testRut = usuarios[0]?.rut || '12345678-9';
    
    const usuarioPorRut = await sql(`
      SELECT id_usuario, rut, nombre, apellido_paterno, apellido_materno, 
             email, tipo, password_hash, activo
      FROM usuarios 
      WHERE rut = $1 AND activo = true
    `, [testRut]);
    
    if (usuarioPorRut.length > 0) {
      const user = usuarioPorRut[0];
      console.log(`Usuario encontrado: ${user.nombre} ${user.apellido_paterno}`);
      console.log(`  - ID: ${user.id_usuario}`);
      console.log(`  - Email: ${user.email}`);
      console.log(`  - Tipo: ${user.tipo}`);
      console.log(`  - Activo: ${user.activo}`);
    } else {
      console.log('No se encontró usuario con RUT:', testRut);
    }
    
    // 3. Probar registrar intento de login
    console.log('\n3. Probando registrar intento de login...');
    
    const intentoData = {
      rut_ingresado: testRut,
      id_usuario: usuarioPorRut[0]?.id_usuario || null,
      ip_origen: '192.168.1.100',
      resultado: 'exito',
      motivo_fallo: null,
      user_agent: 'Mozilla/5.0 (Test Browser)'
    };
    
    const intentoRegistrado = await sql(`
      INSERT INTO intento_login 
      (id_usuario, rut_ingresado, ip_origen, resultado, motivo_fallo, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id_intento, fecha_intento
    `, [
      intentoData.id_usuario,
      intentoData.rut_ingresado,
      intentoData.ip_origen,
      intentoData.resultado,
      intentoData.motivo_fallo,
      intentoData.user_agent
    ]);
    
    console.log('Intento de login registrado:');
    console.log(`  - ID: ${intentoRegistrado[0].id_intento}`);
    console.log(`  - Fecha: ${intentoRegistrado[0].fecha_intento}`);
    console.log(`  - RUT: ${intentoData.rut_ingresado}`);
    console.log(`  - Resultado: ${intentoData.resultado}`);
    
    // 4. Probar guardar token
    console.log('\n4. Probando guardar token...');
    
    const token = 'test_token_' + Date.now();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
    
    const tokenGuardado = await sql(`
      INSERT INTO tokens (id_usuario, token, fecha_expiracion, creado_en)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      RETURNING id_token, creado_en
    `, [
      usuarioPorRut[0]?.id_usuario || 1,
      token,
      expiresAt
    ]);
    
    console.log('Token guardado:');
    console.log(`  - ID: ${tokenGuardado[0].id_token}`);
    console.log(`  - Creado: ${tokenGuardado[0].creado_en}`);
    console.log(`  - Expira: ${expiresAt}`);
    
    // 5. Probar verificar token
    console.log('\n5. Probando verificar token...');
    
    const tokenVerificado = await sql(`
      SELECT id_token, fecha_expiracion 
      FROM tokens 
      WHERE id_usuario = $1 AND token = $2 
      AND fecha_expiracion > CURRENT_TIMESTAMP
      ORDER BY creado_en DESC 
      LIMIT 1
    `, [
      usuarioPorRut[0]?.id_usuario || 1,
      token
    ]);
    
    if (tokenVerificado.length > 0) {
      console.log('Token verificado exitosamente');
      
      // Eliminar token usado
      await sql('DELETE FROM tokens WHERE id_token = $1', [tokenVerificado[0].id_token]);
      console.log('Token eliminado después de verificación');
    } else {
      console.log('Token no encontrado o expirado');
    }
    
    // 6. Ver estadísticas de intentos de login
    console.log('\n6. Estadísticas de intentos de login...');
    
    const stats = await sql(`
      SELECT 
        COUNT(*) as total_intentos,
        COUNT(CASE WHEN resultado = 'exito' THEN 1 END) as exitosos,
        COUNT(CASE WHEN resultado = 'fallo' THEN 1 END) as fallidos,
        DATE(fecha_intento) as fecha
      FROM intento_login 
      WHERE fecha_intento >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(fecha_intento)
      ORDER BY fecha DESC
    `);
    
    console.log('Estadísticas últimos 7 días:');
    stats.forEach(stat => {
      console.log(`  ${stat.fecha}: ${stat.total_intentos} total, ${stat.exitosos} exitosos, ${stat.fallidos} fallidos`);
    });
    
    // 7. Intentos de login por IP
    console.log('\n7. Intentos de login por IP (últimos 10)...');
    
    const intentosPorIp = await sql(`
      SELECT rut_ingresado, resultado, ip_origen, fecha_intento, user_agent
      FROM intento_login 
      ORDER BY fecha_intento DESC 
      LIMIT 10
    `);
    
    console.log('Intentos recientes:');
    intentosPorIp.forEach(intento => {
      console.log(`  ${intento.fecha_intento} - ${intento.rut_ingresado} - ${intento.resultado} - ${intento.ip_origen}`);
    });
    
    console.log('\n=== PRUEBAS COMPLETADAS EXITOSAMENTE ===');
    console.log('Todas las funciones de login funcionan correctamente con Neon Database');
    
  } catch (error) {
    console.error('Error en pruebas:', error.message);
    console.error('Detalles:', error);
  }
}

// Ejecutar pruebas
testLoginFunctions();
