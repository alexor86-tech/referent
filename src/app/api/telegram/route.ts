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
                        { error: error.error || "Failed to parse article" },
                        { status: parseResponse.status }
                    );
                }

                const parseData = await parseResponse.json();
                
                if (!parseData.content)
                {
                    return NextResponse.json(
                        { error: "Could not extract article content from URL" },
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
                        { error: "Timeout while parsing article. Please try again." },
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
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout for telegram post
        
        let openRouterResponse: Response;
        try
        {
            openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
                    "X-Title": "Referent Telegram"
                },
                body: JSON.stringify({
                    model: "deepseek/deepseek-chat",
                    messages: [
                        {
                            role: "system",
                            content: "Ты профессиональный копирайтер для социальных сетей. Создай пост для Telegram на основе этой статьи. Пост должен быть кратким, структурированным, с эмодзи, готовым для публикации. Ответ должен быть на русском языке."
                        },
                        {
                            role: "user",
                            content: articleTitle 
                                ? `Создай пост для Telegram на основе этой статьи:\n\nЗаголовок: ${articleTitle}\n\nСодержание:\n${articleContent}`
                                : `Создай пост для Telegram на основе этой статьи:\n\n${articleContent}`
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
                    { error: "Превышено время ожидания ответа от API. Статья может быть слишком длинной. Попробуйте сократить текст или повторить попытку." },
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
                { error: `OpenRouter API error: ${openRouterResponse.statusText}` },
                { status: openRouterResponse.status }
            );
        }

        const openRouterData = await openRouterResponse.json();
        
        // Extract telegram post from response
        const telegramPost = openRouterData.choices?.[0]?.message?.content;
        
        if (!telegramPost)
        {
            return NextResponse.json(
                { error: "No telegram post received from API" },
                { status: 500 }
            );
        }

        return NextResponse.json({ telegramPost });
    }
    catch (error)
    {
        console.error("Error generating telegram post:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

