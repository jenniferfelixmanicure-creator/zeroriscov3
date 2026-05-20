import { OpenAI } from "openai";
import { logger } from "./logger";

// O Manus tem a biblioteca OpenAI pré-configurada para usar gpt-4.1-mini/nano
// Mas a estrutura é compatível com Grok (xAI) bastando trocar o base_url e a chave se necessário.
const client = new OpenAI();

const ZERO_RISCO_SYSTEM_PROMPT = `
Você é a Inteligência Artificial oficial da plataforma ZeroRisco, um aplicativo de mobilidade urbana de elite.
Sua missão é ser prestativa, eficiente e manter total fidelidade à marca ZeroRisco.

DIRETRIZES DE PERSONALIDADE:
1. Nunca mencione que você é um modelo de linguagem, Grok, OpenAI ou qualquer outra empresa. Você é a "IA ZeroRisco".
2. Use um tom profissional, mas acolhedor (Português do Brasil).
3. Se perguntarem sobre sua origem, você foi desenvolvida pela equipe de engenharia da ZeroRisco.

DIRETRIZES TÉCNICAS (ATENDIMENTO):
- Ajude passageiros e motoristas com dúvidas sobre corridas, pagamentos (Dinheiro/PIX direto) e segurança.
- Se houver um conflito, sugira o acionamento do suporte humano via painel.

DIRETRIZES TÉCNICAS (PRECIFICAÇÃO):
- Ao calcular preços, considere: Distância, Tempo, Clima e Demanda.
- O objetivo é um preço justo que garanta que o motorista aceite a corrida rapidamente.
`;

export async function askZeroRisco(prompt: string, context: string = "") {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini", // Pode ser substituído por 'grok-beta' se o usuário fornecer a chave xAI
      messages: [
        { role: "system", content: ZERO_RISCO_SYSTEM_PROMPT },
        { role: "user", content: `Contexto Atual: ${context}\n\nPergunta/Comando: ${prompt}` }
      ],
      temperature: 0.7,
    });

    return response.choices[0].message.content;
  } catch (error) {
    logger.error({ error }, "Erro ao consultar IA ZeroRisco");
    return "Desculpe, estou processando algumas informações. Posso te ajudar com outra coisa?";
  }
}

export async function calculateSmartPrice(data: {
  distance: number;
  duration: number;
  category: string;
  weather?: string;
  demandMultiplier?: number;
}) {
  try {
    const prompt = `
      Calcule o preço sugerido para uma corrida ZeroRisco:
      - Categoria: ${data.category}
      - Distância: ${data.distance}km
      - Tempo estimado: ${data.duration}min
      - Clima: ${data.weather || "Limpo"}
      - Multiplicador de Demanda Atual: ${data.demandMultiplier || 1.0}

      Retorne APENAS um objeto JSON com:
      {
        "suggestedPrice": number,
        "justification": "breve explicação do preço",
        "multiplier": number
      }
    `;

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "Você é o motor de precificação dinâmica da ZeroRisco. Retorne apenas JSON puro." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result;
  } catch (error) {
    logger.error({ error }, "Erro no cálculo de preço inteligente");
    return null;
  }
}
