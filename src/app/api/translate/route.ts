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
            // Use the parse API to get article content
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                           (request.headers.get("host") ? `http://${request.headers.get("host")}` : "http://localhost:3000");
            
            const parseResponse = await fetch(`${baseUrl}/api/parse`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ url })
            });

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
        else
        {
            return NextResponse.json(
                { error: "Either 'url' or 'content' is required" },
                { status: 400 }
            );
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

        // Call OpenRouter AI API
        const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
                "X-Title": "Referent Translator"
            },
            body: JSON.stringify({
                model: "deepseek/deepseek-chat",
                messages: [
                    {
                        role: "system",
                        content: "Ты профессиональный переводчик. Переведи следующий текст с английского языка на русский язык, сохраняя структуру и стиль оригинала."
                    },
                    {
                        role: "user",
                        content: articleTitle 
                            ? `Переведи следующую статью на русский язык:\n\nЗаголовок: ${articleTitle}\n\nСодержание:\n${articleContent}`
                            : `Переведи следующую статью на русский язык:\n\n${articleContent}`
                    }
                ],
                temperature: 0.3
            })
        });

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
        
        // Extract translation from response
        const translation = openRouterData.choices?.[0]?.message?.content;
        
        if (!translation)
        {
            return NextResponse.json(
                { error: "No translation received from API" },
                { status: 500 }
            );
        }

        return NextResponse.json({ translation });
    }
    catch (error)
    {
        console.error("Error translating article:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

