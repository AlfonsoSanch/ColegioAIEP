// Script para verificar la estructura y datos de la tabla personas

import { neon } from '@neondatabase/serverless';

const NEON_DATABASE_URL = 'postgresql://neondb_owner:npg_AFeUblfLt1Z9@ep-spring-waterfall-am602rpp-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(NEON_DATABASE_URL);

console.log('=== ESTRUCTURA TABLA PERSONAS ===\n');

async function checkPersonas() {
  try {
    // Estructura de tabla personas
    const columns = await sql(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'personas'
      ORDER BY ordinal_position
    `);
    
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      if (col.column_default) {
        console.log(`    default: ${col.column_default}`);
      }
    });
    
    // Muestra de personas
    console.log('\n=== MUESTRA DE PERSONAS ===');
    const personas = await sql('SELECT * FROM personas LIMIT 5');
    personas.forEach(p => {
      console.log(`  - ID: ${p.id_persona}, RUT: ${p.rut}, Nombre: ${p.nombre || 'N/A'} ${p.apellido_paterno || ''}`);
      console.log(`    Columnas: ${Object.keys(p).join(', ')}`);
    });
    
    // Relación usuarios-personas
    console.log('\n=== RELACIÓN USUARIOS-PERSONAS ===');
    const relacion = await sql(`
      SELECT u.id_usuario, u.id_persona, p.rut, p.nombre, p.apellido_paterno, p.email
      FROM usuarios u
      LEFT JOIN personas p ON u.id_persona = p.id_persona
      LIMIT 5
    `);
    
    relacion.forEach(rel => {
      console.log(`  - Usuario ID: ${rel.id_usuario} -> Persona ID: ${rel.id_persona}`);
      console.log(`    RUT: ${rel.rut}, Nombre: ${rel.nombre} ${rel.apellido_paterno || ''}`);
      console.log(`    Email: ${rel.email || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkPersonas();
