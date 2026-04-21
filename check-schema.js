// Script para verificar la estructura real de las tablas en Neon Database

import { neon } from '@neondatabase/serverless';

const NEON_DATABASE_URL = 'postgresql://neondb_owner:npg_AFeUblfLt1Z9@ep-spring-waterfall-am602rpp-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(NEON_DATABASE_URL);

console.log('=== VERIFICANDO ESTRUCTURA DE TABLAS ===\n');

async function checkSchema() {
  try {
    // 1. Ver todas las tablas
    console.log('1. Tablas en la base de datos:');
    const tables = await sql(`
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    tables.forEach(table => {
      console.log(`  - ${table.table_name} (${table.table_type})`);
    });
    
    // 2. Estructura de tabla usuarios
    console.log('\n2. Estructura de tabla usuarios:');
    try {
      const usuariosColumns = await sql(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'usuarios'
        ORDER BY ordinal_position
      `);
      
      usuariosColumns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        if (col.column_default) {
          console.log(`    default: ${col.column_default}`);
        }
      });
      
      // Ver datos de ejemplo
      console.log('\n   Primeros 3 usuarios:');
      const sampleUsers = await sql('SELECT * FROM usuarios LIMIT 3');
      sampleUsers.forEach(user => {
        console.log(`  - ID: ${user.id_usuario}, Email: ${user.email || 'N/A'}, Tipo: ${user.tipo || 'N/A'}`);
        console.log(`    Columnas: ${Object.keys(user).join(', ')}`);
      });
      
    } catch (error) {
      console.log('  Error: Tabla usuarios no existe');
    }
    
    // 3. Estructura de tabla intento_login
    console.log('\n3. Estructura de tabla intento_login:');
    try {
      const intentoColumns = await sql(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'intento_login'
        ORDER BY ordinal_position
      `);
      
      intentoColumns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        if (col.column_default) {
          console.log(`    default: ${col.column_default}`);
        }
      });
      
      // Ver datos de ejemplo
      console.log('\n   Primeros 3 intentos:');
      const sampleIntentos = await sql('SELECT * FROM intento_login LIMIT 3');
      sampleIntentos.forEach(intento => {
        console.log(`  - ID: ${intento.id_intento}, Rut: ${intento.rut_ingresado || 'N/A'}, Resultado: ${intento.resultado}`);
        console.log(`    Columnas: ${Object.keys(intento).join(', ')}`);
      });
      
    } catch (error) {
      console.log('  Error: Tabla intento_login no existe');
    }
    
    // 4. Estructura de tabla tokens
    console.log('\n4. Estructura de tabla tokens:');
    try {
      const tokensColumns = await sql(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tokens'
        ORDER BY ordinal_position
      `);
      
      tokensColumns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        if (col.column_default) {
          console.log(`    default: ${col.column_default}`);
        }
      });
      
    } catch (error) {
      console.log('  Error: Tabla tokens no existe');
    }
    
    // 5. Buscar posibles nombres de columnas para RUT
    console.log('\n5. Buscando columnas que podrían ser RUT:');
    const rutColumns = await sql(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND (column_name ILIKE '%rut%' OR column_name ILIKE '%documento%' OR column_name ILIKE '%ident%')
      ORDER BY table_name, column_name
    `);
    
    rutColumns.forEach(col => {
      console.log(`  - ${col.table_name}.${col.column_name}: ${col.data_type}`);
    });
    
    console.log('\n=== VERIFICACIÓN COMPLETADA ===');
    
  } catch (error) {
    console.error('Error verificando schema:', error.message);
  }
}

// Ejecutar verificación
checkSchema();
