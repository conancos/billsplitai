# 🧾 BillSplit AI

> **Divide cuentas sin dolor de cabeza.** 
> Una aplicación inteligente que escanea recibos y permite dividir gastos simplemente chateando. Para cuando cada uno tenga que pagarse lo suyo: 🥩 🍨 🥃

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-live-green.svg)
![AI](https://img.shields.io/badge/AI-Gemini_Pro-purple.svg)
![FreeUse](https://img.shields.io/badge/OPEN_USE-Daily_Free_Limit-lime)

## 📱 ¿Qué es esto?

**BillSplit AI** resuelve el eterno problema de "¿Cuánto te debo?" al final de una cena. En lugar de usar calculadoras a esas horas y con alguna copa encima, simplemente:

1. 📸 **Sube una foto** del ticket.
2. 🤖 **La IA lee** todos los artículos y precios.
3. 💬 **Dile quién comió qué** (ej: *"Pepe y Ana compartieron los nachos"*).
4. 💸 **Obtén el total** de cada uno calculado automáticamente con impuestos y propinas.

## ✨ Características Principales

*   **Escaneo con Visión IA**: Utiliza `gemini-3-pro-preview` para transcribir tickets físicos a datos digitales en segundos.
*   **Comandos en Lenguaje Natural**: Asigna costos hablando como una persona normal. La IA entiende contextos como "compartir", "mitad y mitad" o "todo lo de beber".
*   **Cálculo en Tiempo Real**: Los impuestos y propinas se distribuyen proporcionalmente según el consumo de cada uno.
*   **Gestión de Propinas**: Soporte para porcentajes, montos fijos o lo que indique el recibo.
*   **Edición Manual**: ¿La IA falló en un precio? Toca cualquier item para corregirlo o añade los que falten.
*   **Exportable**: Descarga una imagen resumen limpia para enviarla por WhatsApp/Bizum al grupo.
*   **Mobile First**: Interfaz diseñada específicamente para usarse con una sola mano en el móvil.

## 🛠️ Tecnologías

Este proyecto está construido con un stack moderno y ligero:

*   **Frontend**: React 19 + TypeScript
*   **Estilos**: Tailwind CSS
*   **Inteligencia Artificial**: Google GenAI SDK (`@google/genai`)
*   **Gráficos**: Recharts
*   **Utilidades**: Lucide React (Iconos), html2canvas (Generación de imagen)

## 🚀 Cómo empezar

1. **Clona el repositorio**:
   ```bash
   git clone https://github.com/tu-usuario/billsplit-ai.git
   ```

2. **Instala las dependencias**:
   ```bash
   npm install
   ```

3. **Configura tu API Key**:
   Crea un archivo `.env` en la raíz y añade tu clave de Google Gemini:
   ```env
   API_KEY=tu_clave_de_gemini_aqui
   ```

4. **Ejecuta el proyecto**:
   ```bash
   npm start
   ```

## 📸 Uso

| 1. Escanea | 2. Asigna | 3. Divide |
|:---:|:---:|:---:|
| Sube la foto del ticket | Escribe "Juan pagó el vino" | Mira el gráfico final |

---

Hecho con ❤️ y mucha cafeína.
