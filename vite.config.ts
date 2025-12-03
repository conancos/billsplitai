import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carga las variables de entorno desde el directorio actual
  // El tercer argumento '' permite cargar variables que no empiecen por VITE_
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: '0.0.0.0', // Crucial para probar desde el móvil en tu red local
    },
    define: {
      // Mapea tu variable GEMINI_API_KEY del .env a process.env.API_KEY para que la app funcione
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    // He eliminado la sección 'resolve.alias' que usaba 'path' y '__dirname'
    // porque causan conflictos con 'type': 'module' y tu proyecto usa rutas relativas.
  };
});