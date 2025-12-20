"use client";

import { useState } from "react";

type ActionType = "summary" | "theses" | "telegram" | "translate" | null;

export default function Home()
{
    const [url, setUrl] = useState<string>("");
    const [actionType, setActionType] = useState<ActionType>(null);
    const [result, setResult] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // Handle URL input change
    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>): void =>
    {
        setUrl(e.target.value);
    };

    // Parse article from URL
    const handleParse = async (): Promise<void> =>
    {
        if (!url.trim())
        {
            alert("Пожалуйста, введите URL статьи");
            return;
        }

        setIsLoading(true);
        setResult("");

        try
        {
            const response = await fetch("/api/parse", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ url: url.trim() })
            });

            if (!response.ok)
            {
                const error = await response.json();
                throw new Error(error.error || "Ошибка при парсинге статьи");
            }

            const data = await response.json();
            setResult(JSON.stringify(data, null, 2));
        }
        catch (error)
        {
            setResult(`Ошибка: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`);
        }
        finally
        {
            setIsLoading(false);
        }
    };

    // Handle action button click
    const handleAction = async (type: ActionType): Promise<void> =>
    {
        if (!url.trim())
        {
            alert("Пожалуйста, введите URL статьи");
            return;
        }

        setActionType(type);
        setIsLoading(true);
        setResult("");

        try
        {
            if (type === "translate")
            {
                // Call translation API
                const response = await fetch("/api/translate", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ url: url.trim() })
                });

                if (!response.ok)
                {
                    const error = await response.json();
                    throw new Error(error.error || "Ошибка при переводе статьи");
                }

                const data = await response.json();
                setResult(data.translation || "Перевод не получен");
            }
            else
            {
                // TODO: Implement actual API call for other actions
                // For now, simulate loading
                setTimeout(() =>
                {
                    setIsLoading(false);
                    setResult(`Результат для действия "${type}" будет здесь...`);
                }, 1000);
            }
        }
        catch (error)
        {
            setIsLoading(false);
            setResult(`Ошибка: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
            <main className="flex w-full max-w-4xl flex-col items-center justify-center py-16 px-8 bg-white dark:bg-black sm:px-16">
                <div className="w-full max-w-3xl">
                    <h1 className="mb-8 text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50 text-center">
                        Референт - переводчик с ИИ-обработкой
                    </h1>

                    {/* URL Input Field */}
                    <div className="mb-8">
                        <label
                            htmlFor="article-url"
                            className="block mb-2 text-sm font-medium text-foreground"
                        >
                            URL англоязычной статьи
                        </label>
                        <input
                            id="article-url"
                            type="url"
                            value={url}
                            onChange={handleUrlChange}
                            placeholder="https://example.com/article"
                            className="w-full px-4 py-3 rounded-lg border border-solid border-black/[.08] bg-background text-foreground placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-white/[.145] dark:bg-[#1a1a1a]"
                        />
                    </div>

                    {/* Parse Button */}
                    <div className="mb-4">
                        <button
                            onClick={handleParse}
                            disabled={isLoading}
                            className="w-full h-12 items-center justify-center rounded-lg bg-gray-700 px-5 text-white font-medium transition-colors hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Парсить статью
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="mb-8 flex flex-col gap-4 sm:flex-row">
                        <button
                            onClick={() => handleAction("translate")}
                            disabled={isLoading}
                            className="flex-1 h-12 items-center justify-center rounded-lg bg-orange-600 px-5 text-white font-medium transition-colors hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Перевести
                        </button>
                        <button
                            onClick={() => handleAction("summary")}
                            disabled={isLoading}
                            className="flex-1 h-12 items-center justify-center rounded-lg bg-blue-600 px-5 text-white font-medium transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            О чем статья?
                        </button>
                        <button
                            onClick={() => handleAction("theses")}
                            disabled={isLoading}
                            className="flex-1 h-12 items-center justify-center rounded-lg bg-green-600 px-5 text-white font-medium transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Тезисы
                        </button>
                        <button
                            onClick={() => handleAction("telegram")}
                            disabled={isLoading}
                            className="flex-1 h-12 items-center justify-center rounded-lg bg-purple-600 px-5 text-white font-medium transition-colors hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Пост для Telegram
                        </button>
                    </div>

                    {/* Result Display Block */}
                    <div className="w-full rounded-lg border-2 border-solid border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#1a1a1a] p-6 min-h-[200px]">
                        <h2 className="mb-4 text-xl font-semibold text-foreground">
                            Результат
                        </h2>
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                <span className="ml-3 text-foreground">
                                    Генерация результата...
                                </span>
                            </div>
                        ) : result ? (
                            <div className="text-foreground whitespace-pre-wrap font-mono text-sm overflow-auto">
                                {result}
                            </div>
                        ) : (
                            <div className="text-gray-500 dark:text-gray-400 italic">
                                Результат появится здесь после выбора действия...
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
