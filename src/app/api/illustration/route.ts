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

        // Get OpenRouter API key from environment
        const openRouterApiKey = process.env.OPENROUTER_API_KEY;
        if (!openRouterApiKey)
        {
            return NextResponse.json(
                { error: "OpenRouter API key is not configured" },
                { status: 500 }
            );
        }

        // Step 1: Generate image prompt using OpenRouter API
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
        
        let openRouterResponse: Response;
        try
        {
            openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${openRouterApiKey}`,
                    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
                    "X-Title": "Referent Illustration"
                },
                body: JSON.stringify({
                    model: "deepseek/deepseek-chat",
                    messages: [
                        {
                            role: "system",
                            content: "You are a professional artist and illustrator. Create a detailed image generation prompt in English based on the article. The prompt should describe the visual concept, style, composition, and key elements of the article. Return ONLY the prompt text without any markdown formatting, explanations, or additional text. Do not use asterisks, bold text, or any formatting symbols. Just plain text description."
                        },
                        {
                            role: "user",
                            content: articleTitle 
                                ? `Create an image generation prompt based on this article:\n\nTitle: ${articleTitle}\n\nContent:\n${articleContent}`
                                : `Create an image generation prompt based on this article:\n\n${articleContent}`
                        }
                    ],
                    temperature: 0.7
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
                    error: "Произошла ошибка при генерации промпта. Пожалуйста, попробуйте позже.",
                    errorType: "API_ERROR"
                },
                { status: openRouterResponse.status }
            );
        }

        const openRouterData = await openRouterResponse.json();
        
        // Extract prompt from response
        let imagePrompt = openRouterData.choices?.[0]?.message?.content?.trim();
        
        if (!imagePrompt)
        {
            return NextResponse.json(
                { 
                    error: "Не удалось получить промпт для изображения. Пожалуйста, попробуйте еще раз.",
                    errorType: "API_ERROR"
                },
                { status: 500 }
            );
        }

        // Clean prompt from markdown formatting
        imagePrompt = imagePrompt
            // Remove markdown bold/italic markers
            .replace(/\*\*/g, "")
            .replace(/\*/g, "")
            .replace(/_/g, "")
            // Remove markdown headers
            .replace(/^#+\s*/gm, "")
            // Remove markdown list markers
            .replace(/^[-*+]\s+/gm, "")
            .replace(/^\d+\.\s+/gm, "")
            // Remove common prefixes like "Prompt for Image Generation:" or "Image prompt:"
            .replace(/^(prompt for image generation|image prompt|prompt):\s*/i, "")
            // Remove extra whitespace
            .replace(/\n{3,}/g, "\n\n")
            .trim();

        // Limit prompt length (Hugging Face has limits)
        const MAX_PROMPT_LENGTH = 500;
        if (imagePrompt.length > MAX_PROMPT_LENGTH)
        {
            imagePrompt = imagePrompt.substring(0, MAX_PROMPT_LENGTH).trim();
        }

        console.log("Generated image prompt:", imagePrompt.substring(0, 200) + "...");

        // Step 2: Generate image using Hugging Face Inference API
        const huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY;
        if (!huggingFaceApiKey)
        {
            return NextResponse.json(
                { error: "Hugging Face API key is not configured" },
                { status: 500 }
            );
        }

        // Use Stable Diffusion model for image generation
        const huggingFaceModel = "stabilityai/stable-diffusion-xl-base-1.0";
        // Try different URL formats for router API
        const urlFormats = [
            `https://router.huggingface.co/hf-inference/models/${huggingFaceModel}`,
            `https://router.huggingface.co/models/${huggingFaceModel}`,
            `https://api-inference.huggingface.co/models/${huggingFaceModel}`
        ];

        const imageController = new AbortController();
        const imageTimeoutId = setTimeout(() => imageController.abort(), 120000); // 2 minute timeout

        let huggingFaceResponse: Response | null = null;
        let lastError: any = null;
        
        // Try each URL format until one works
        for (const huggingFaceUrl of urlFormats)
        {
            try
            {
                console.log(`Trying URL: ${huggingFaceUrl}`);
                
                // Try with parameters first
                huggingFaceResponse = await fetch(huggingFaceUrl, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${huggingFaceApiKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        inputs: imagePrompt,
                        parameters: {
                            num_inference_steps: 50,
                            guidance_scale: 7.5
                        }
                    }),
                    signal: imageController.signal
                });

                // If successful or non-404 error, break
                if (huggingFaceResponse.ok || huggingFaceResponse.status !== 404)
                {
                    break;
                }
                
                // If 404, try simpler format without parameters
                console.log(`404 error, trying simpler format for ${huggingFaceUrl}`);
                huggingFaceResponse = await fetch(huggingFaceUrl, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${huggingFaceApiKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        inputs: imagePrompt
                    }),
                    signal: imageController.signal
                });

                // If still 404, try next URL
                if (huggingFaceResponse.status === 404)
                {
                    console.log(`Still 404, trying next URL format...`);
                    continue;
                }
                
                // If successful or non-404 error, break
                break;
            }
            catch (error)
            {
                lastError = error;
                console.log(`Error with ${huggingFaceUrl}:`, error);
                continue;
            }
        }

        clearTimeout(imageTimeoutId);
        
        if (!huggingFaceResponse)
        {
            if (lastError instanceof Error && lastError.name === "AbortError")
            {
                return NextResponse.json(
                    { 
                        error: "Превышено время ожидания генерации изображения. Попробуйте повторить попытку.",
                        errorType: "API_TIMEOUT"
                    },
                    { status: 408 }
                );
            }
            return NextResponse.json(
                { 
                    error: "Не удалось подключиться к API генерации изображений. Пожалуйста, попробуйте позже.",
                    errorType: "API_ERROR"
                },
                { status: 500 }
            );
        }

        if (!huggingFaceResponse.ok)
        {
            let errorText: string;
            let errorData: any;
            
            try
            {
                errorText = await huggingFaceResponse.text();
                // Try to parse as JSON
                try
                {
                    errorData = JSON.parse(errorText);
                }
                catch
                {
                    errorData = { error: errorText };
                }
            }
            catch
            {
                errorText = "Unknown error";
                errorData = {};
            }
            
            console.error("Hugging Face API error:", {
                status: huggingFaceResponse.status,
                statusText: huggingFaceResponse.statusText,
                error: errorData
            });
            
            // Check if model is loading
            if (huggingFaceResponse.status === 503)
            {
                const estimatedTime = errorData?.estimated_time || "несколько минут";
                return NextResponse.json(
                    { 
                        error: `Модель генерации изображений загружается. Ожидаемое время: ${estimatedTime}. Пожалуйста, подождите и попробуйте снова.`,
                        errorType: "API_ERROR"
                    },
                    { status: 503 }
                );
            }

            // Check for specific error messages
            const errorMessage = errorData?.error || errorData?.message || errorText || "Неизвестная ошибка";
            
            return NextResponse.json(
                { 
                    error: `Ошибка при генерации изображения: ${errorMessage}. Пожалуйста, попробуйте позже.`,
                    errorType: "API_ERROR"
                },
                { status: huggingFaceResponse.status }
            );
        }

        // Check content type
        const contentType = huggingFaceResponse.headers.get("content-type");
        
        if (!contentType || !contentType.startsWith("image/"))
        {
            // If not an image, try to read as JSON to see error
            const responseText = await huggingFaceResponse.text();
            let errorData: any;
            try
            {
                errorData = JSON.parse(responseText);
            }
            catch
            {
                errorData = { error: responseText };
            }
            
            console.error("Unexpected response type from Hugging Face:", {
                contentType,
                response: errorData
            });
            
            return NextResponse.json(
                { 
                    error: `Неожиданный формат ответа от API: ${errorData.error || errorData.message || "неизвестная ошибка"}`,
                    errorType: "API_ERROR"
                },
                { status: 500 }
            );
        }

        // Get image as blob
        const imageBlob = await huggingFaceResponse.blob();
        
        // Convert blob to base64
        const arrayBuffer = await imageBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString("base64");
        
        // Determine image format from content type
        const imageFormat = contentType.split("/")[1] || "png";
        const imageDataUrl = `data:image/${imageFormat};base64,${base64Image}`;

        return NextResponse.json({ 
            illustration: imageDataUrl,
            prompt: imagePrompt
        });
    }
    catch (error)
    {
        console.error("Error generating illustration:", error);
        return NextResponse.json(
            { 
                error: "Произошла непредвиденная ошибка. Пожалуйста, попробуйте позже.",
                errorType: "UNKNOWN_ERROR"
            },
            { status: 500 }
        );
    }
}

