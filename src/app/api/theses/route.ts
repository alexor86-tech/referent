import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest)
{
    try
    {
        const body = await request.json();
        const { url, content } = body;

        // Get article content - either from provided content or parse from URL
        let articleContent: string = "";
        let articleTitle: string | null = null;

        if (content)
        {
            articleContent = content;
        }
        else if (url)
        {
            // Use the parse API to get article content with timeout
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                           (request.headers.get("host") ? `http://${request.headers.get("host")}` : "http://localhost:3000");
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            
            try
            {
                const parseResponse = await fetch(`${baseUrl}/api/parse`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ url }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!parseResponse.ok)
                {
                    const error = await parseResponse.json();
                    return NextResponse.json(
                        { 
                            error: "Не удалось загрузить статью по этой ссылке.",
                            errorType: "PARSE_ERROR"
                        },
                        { status: parseResponse.status }
                    );
                }

                const parseData = await parseResponse.json();
                
                if (!parseData.content)
                {
                    return NextResponse.json(
                        { 
                            error: "Не удалось загрузить статью по этой ссылке.",
                            errorType: "PARSE_ERROR"
                        },
                        { status: 400 }
                    );
                }

                articleContent = parseData.content;
                articleTitle = parseData.title || null;
            }
            catch (error)
            {
                clearTimeout(timeoutId);
                if (error instanceof Error && error.name === "AbortError")
                {
                    return NextResponse.json(
                        { 
                            error: "Не удалось загрузить статью по этой ссылке.",
                            errorType: "PARSE_ERROR"
                        },
                        { status: 408 }
                    );
                }
                throw error;
            }
        }
        else
        {
            return NextResponse.json(
                { error: "Either 'url' or 'content' is required" },
                { status: 400 }
            );
        }

        // Limit content length to avoid timeout (max 50000 characters)
        const MAX_CONTENT_LENGTH = 50000;
        if (articleContent.length > MAX_CONTENT_LENGTH)
        {
            articleContent = articleContent.substring(0, MAX_CONTENT_LENGTH) + "\n\n[... текст обрезан из-за ограничения длины ...]";
        }

        // Get API key from environment
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey)
        {
            return NextResponse.json(
                { error: "OpenRouter API key is not configured" },
                { status: 500 }
            );
        }

        // Call OpenRouter AI API with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout for theses
        
        let openRouterResponse: Response;
        try
        {
            openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
                    "X-Title": "Referent Theses"
                },
                body: JSON.stringify({
                    model: "deepseek/deepseek-chat",
                    messages: [
                        {
                            role: "system",
                            content: "Ты профессиональный аналитик текстов. Составь структурированные тезисы этой статьи в виде списка. Ответ должен быть на русском языке."
                        },
                        {
                            role: "user",
                            content: articleTitle 
                                ? `Составь структурированные тезисы этой статьи в виде списка:\n\nЗаголовок: ${articleTitle}\n\nСодержание:\n${articleContent}`
                                : `Составь структурированные тезисы этой статьи в виде списка:\n\n${articleContent}`
                        }
                    ],
                    temperature: 0.3
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
        }
        catch (error)
        {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === "AbortError")
            {
                return NextResponse.json(
                    { 
                        error: "Превышено время ожидания ответа от API. Статья может быть слишком длинной. Попробуйте сократить текст или повторить попытку.",
                        errorType: "API_TIMEOUT"
                    },
                    { status: 408 }
                );
            }
            throw error;
        }

        if (!openRouterResponse.ok)
        {
            const errorText = await openRouterResponse.text();
            console.error("OpenRouter API error:", errorText);
            return NextResponse.json(
                { 
                    error: "Произошла ошибка при обработке запроса. Пожалуйста, попробуйте позже.",
                    errorType: "API_ERROR"
                },
                { status: openRouterResponse.status }
            );
        }

        const openRouterData = await openRouterResponse.json();
        
        // Extract theses from response
        const theses = openRouterData.choices?.[0]?.message?.content;
        
        if (!theses)
        {
            return NextResponse.json(
                { 
                    error: "Не удалось получить тезисы. Пожалуйста, попробуйте еще раз.",
                    errorType: "API_ERROR"
                },
                { status: 500 }
            );
        }

        return NextResponse.json({ theses });
    }
    catch (error)
    {
        console.error("Error generating theses:", error);
        return NextResponse.json(
            { 
                error: "Произошла непредвиденная ошибка. Пожалуйста, попробуйте позже.",
                errorType: "UNKNOWN_ERROR"
            },
            { status: 500 }
        );
    }
}

