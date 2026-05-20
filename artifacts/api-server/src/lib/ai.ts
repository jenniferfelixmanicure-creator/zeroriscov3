import { OpenAI } from "openai";
  import { logger } from "./logger";

  const client = new OpenAI({
    apiKey: process.env.GROK_API_KEY,
    baseURL: "https://api.x.ai/v1",
  });

  const ZERO_RISCO_SYSTEM_PROMPT = `Você é a Inteligência Artificial oficial da plataforma ZeroRisco, um aplicativo de mobilidade urbana de elite.
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
  - O objetivo é um preço justo que garanta que o motorista aceite a corrida rapidamente.`;

  export async function askZeroRisco(prompt: string, context: string = ""): Promise<string> {
    try {
      const response = await client.chat.completions.create({
        model: "grok-beta",
        messages: [
          { role: "system", content: ZERO_RISCO_SYSTEM_PROMPT },
          { role: "user", content: `Contexto Atual: ${context}\n\nPergunta/Comando: ${prompt}` },
        ],
        temperature: 0.7,
      });
      return response.choices[0].message.content ?? "Desculpe, não consegui processar sua mensagem.";
    } catch (error) {
      logger.error({ error }, "Erro ao consultar IA ZeroRisco");
      return "Desculpe, estou processando algumas informações. Posso te ajudar com outra coisa?";
    }
  }

  export interface CategoryPriceResult {
    categoryId: number;
    suggestedFare: number;
    justification: string;
  }

  // UMA única chamada de IA para calcular preços de TODAS as categorias simultaneamente
  export async function calculateSmartPricesForAll(data: {
    distanceKm: number;
    durationMin: number;
    weather: string;
    hour: number;
    categories: Array<{ id: number; name: string; baseFare: number }>;
  }): Promise<CategoryPriceResult[]> {
    const categoriesList = data.categories
      .map((c) => `- ID ${c.id}: ${c.name} (base R$ ${c.baseFare.toFixed(2)})`)
      .join("\n");

    const prompt = `Calcule o preço final sugerido para cada categoria:

  Dados da corrida:
  - Distância real: ${data.distanceKm.toFixed(1)} km
  - Duração estimada: ${data.durationMin} min
  - Clima: ${data.weather}
  - Horário: ${data.hour}h

  Categorias:
  ${categoriesList}

  Responda APENAS com JSON válido, sem markdown:
  [{"categoryId": 1, "suggestedFare": 12.50, "justification": "motivo curto"}]`;

    try {
      const response = await client.chat.completions.create({
        model: "grok-beta",
        messages: [
          { role: "system", content: "Você é o motor de precificação da IA ZeroRisco. Responda SOMENTE com JSON válido, sem markdown." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      });

      const raw = response.choices[0].message.content ?? "[]";
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("JSON não encontrado na resposta da IA");
      return JSON.parse(jsonMatch[0]) as CategoryPriceResult[];
    } catch (error) {
      logger.error({ error }, "IA falhou na precificação — usando tarifas base");
      return data.categories.map((c) => ({
        categoryId: c.id,
        suggestedFare: c.baseFare,
        justification: "Tarifa base ZeroRisco",
      }));
    }
  }
  