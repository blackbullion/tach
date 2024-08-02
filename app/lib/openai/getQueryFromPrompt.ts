import OpenAI from 'openai'

const openai = new OpenAI()

type QueryResponse = {
  sql: string | null
  tokensUsed: number
}

type OpenAIApiError = Error & {
  response?: {
    status: number
    data: {
      error: {
        message: string
        type: string
        param?: string
        code?: string
      }
    }
  }
}

function extractQuery(text: string): string {
  const startDelimiter: string = "```sql";
  const endDelimiter: string = "```";

  const start: number = text.indexOf(startDelimiter);
  const end: number = text.indexOf(endDelimiter, start + startDelimiter.length);

  if (start !== -1 && end !== -1) {
    return text.substring(start + startDelimiter.length, end).trim();
  } else {
    return text.trim();
  }
}

export default async function getQueryFromPrompt(createTableSyntaxes: string[], prompt: string, blocklistText: string): Promise<QueryResponse> {
  const systemContent = `
    You are a tool for translating natural language questions about company data into SQL queries that only select data and never modify it.
    These MySQL create table or create view syntaxes are available to use: ${createTableSyntaxes.join(',\n')}
    The query will be executed directly against the database, so only return the query as plain text without any code blocks, backticks, or syntax indicators.
    ${blocklistText ? 'The generated query must never contain references to any of the following columns: ' + blocklistText : ''}
  `

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: prompt }
      ]
    })

    return {
      sql: extractQuery(completion.choices[0].message?.content ?? ''),
      tokensUsed: completion.usage?.total_tokens ?? 0
    }
  } catch (_err) {
    const error = _err as OpenAIApiError
    if (error.response) {
      console.error({
        status: error.response.status,
        error: error.response.data.error
      })
    } else {
      console.error(error.message)
    }
    throw error
  }
}
