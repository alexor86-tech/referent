import { NextRequest, NextResponse } from "next/server";
import { load } from "cheerio";

interface ParseResult
{
    date: string | null;
    title: string | null;
    content: string | null;
}

/**
 * Parse HTML content to extract article metadata
 * @param html - HTML content to parse
 * @returns Parsed article data
 */
function parseArticle(html: string): ParseResult
{
    const $ = load(html);
    let date: string | null = null;
    let title: string | null = null;
    let content: string | null = null;

    // Try to find title in various places
    const titleSelectors = [
        "article h1",
        ".post h1",
        ".content h1",
        "h1",
        "title",
        'meta[property="og:title"]'
    ];

    for (const selector of titleSelectors)
    {
        const element = $(selector).first();
        if (element.length)
        {
            const text = selector.startsWith("meta") 
                ? element.attr("content") 
                : element.text().trim();
            if (text && text.length > 0)
            {
                title = text;
                break;
            }
        }
    }

    // Try to find date in various formats
    const dateSelectors = [
        'time[datetime]',
        'time',
        '.date',
        '.published',
        '.post-date',
        '[class*="date"]',
        '[class*="time"]',
        'meta[property="article:published_time"]',
        'meta[name="date"]',
        'meta[name="publish-date"]'
    ];

    for (const selector of dateSelectors)
    {
        const element = $(selector).first();
        if (element.length)
        {
            date = element.attr("datetime") ||
                   element.attr("content") ||
                   element.text().trim() ||
                   null;
            if (date)
            {
                break;
            }
        }
    }

    /**
     * Clean text content from technical elements
     * @param text - Text to clean
     * @returns Cleaned text
     */
    const cleanText = (text: string): string =>
    {
        // Remove excessive whitespace
        return text.replace(/\s+/g, " ").trim();
    };

    /**
     * Check if text looks like article content (not CSS/JS)
     * @param text - Text to check
     * @returns True if text looks like article content
     */
    const isArticleContent = (text: string): boolean =>
    {
        // Check for CSS patterns
        if (text.includes(":host") || text.includes("::slotted") || text.includes("var(--"))
        {
            return false;
        }
        // Check for excessive curly braces (likely CSS/JS)
        const braceRatio = (text.match(/[{}]/g) || []).length / text.length;
        if (braceRatio > 0.05)
        {
            return false;
        }
        // Check for code-like patterns
        if (text.match(/[{};:]\s*$/m) && text.split("\n").length > 5)
        {
            return false;
        }
        return true;
    };

    // Try to find main content
    const contentSelectors = [
        "article",
        ".post",
        ".content",
        ".article-content",
        ".entry-content",
        "[role='article']",
        "main article",
        ".post-content",
        ".article-body",
        ".post-body"
    ];

    for (const selector of contentSelectors)
    {
        const element = $(selector).first();
        if (element.length)
        {
            // Clone to avoid modifying original
            const $clone = element.clone();
            
            // Remove all technical elements
            $clone.find("script, style, nav, header, footer, aside, .ad, .ads, code, pre, .code, .highlight, [class*='code'], [class*='syntax']").remove();
            
            // Remove elements with code-related classes
            $clone.find("[class*='css'], [class*='style'], [class*='script']").remove();
            
            const text = cleanText($clone.text());
            
            if (text.length > 200 && isArticleContent(text))
            {
                content = text;
                break;
            }
        }
    }

    // Fallback: try to find largest text block
    if (!content)
    {
        let bestContent: string | null = null;
        let maxScore = 0;

        $("div, section, main, article").each((_, el) =>
        {
            const $el = $(el);
            
            // Skip if contains code-related classes
            const className = $el.attr("class") || "";
            if (className.match(/code|syntax|highlight|css|style|script/i))
            {
                return;
            }

            // Clone and clean
            const $clone = $el.clone();
            $clone.find("script, style, nav, header, footer, aside, code, pre, [class*='code'], [class*='syntax']").remove();
            
            const text = cleanText($clone.text());
            
            if (text.length > 200 && isArticleContent(text))
            {
                // Score based on length and text quality
                const score = text.length;
                if (score > maxScore)
                {
                    maxScore = score;
                    bestContent = text;
                }
            }
        });

        if (bestContent)
        {
            content = bestContent;
        }
    }

    return {
        date: date || null,
        title: title || null,
        content: content || null
    };
}

export async function POST(request: NextRequest)
{
    try
    {
        const body = await request.json();
        const { url } = body;

        if (!url || typeof url !== "string")
        {
            return NextResponse.json(
                { error: "URL is required" },
                { status: 400 }
            );
        }

        // Fetch the HTML content
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        });

        if (!response.ok)
        {
            return NextResponse.json(
                { error: `Failed to fetch URL: ${response.statusText}` },
                { status: response.status }
            );
        }

        const html = await response.text();
        const result = parseArticle(html);

        return NextResponse.json(result);
    }
    catch (error)
    {
        console.error("Error parsing article:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

