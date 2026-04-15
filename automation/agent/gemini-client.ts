import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

export interface TestCasePreliminar {
    titulo: string;
    tipo: 'automatable' | 'manual';
    razon: string;
    prioridad: 'alta' | 'media' | 'baja';
    pasos: string[];
    resultado_esperado: string;
}

export interface AnalisisHU {
    historia_id: string | number;
    historia_titulo: string;
    nota?: string;
    casos: TestCasePreliminar[];
    generado_en: string;
}

export async function analizarHistoria(
    id: string | number,
    titulo: string,
    descripcion: string,
    criterios: string,
    nota?: string
): Promise<AnalisisHU> {

    const prompt = `
Eres un QA Engineer experto. Analiza la siguiente Historia de Usuario y genera casos de prueba preliminares.

HISTORIA ID: ${id}
${nota ? `NOTA DEL EQUIPO: ${nota}` : ''}
TÍTULO: ${titulo}
DESCRIPCIÓN: ${descripcion || 'Sin descripción'}
CRITERIOS DE ACEPTACIÓN: ${criterios || 'Sin criterios definidos'}

Genera entre 5 y 8 casos de prueba enfocándote en los más críticos: happy path, errores clave y seguridad básica. Omite variaciones menores o edge cases de baja prioridad. Para cada caso indica:
- Si es AUTOMATABLE (puede ejecutarse con Playwright: flujos UI, formularios, navegación, validaciones visuales)
- Si es MANUAL (requiere criterio humano: usabilidad, exploratorio, accesibilidad visual, datos sensibles)

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta, sin markdown, sin texto adicional:
{
  "casos": [
    {
      "titulo": "nombre descriptivo del caso",
      "tipo": "automatable" | "manual",
      "razon": "por qué es automatable o manual en una línea",
      "prioridad": "alta" | "media" | "baja",
      "pasos": ["paso 1", "paso 2", "paso 3"],
      "resultado_esperado": "qué debe ocurrir al final"
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return {
        historia_id: id,
        historia_titulo: titulo,
        nota,
        casos: parsed.casos,
        generado_en: new Date().toISOString()
    };
}
