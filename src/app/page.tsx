"use client";

import { useState, useRef, useEffect } from "react";
import { Alert } from "@/components/ui/alert";

type ActionType = "summary" | "theses" | "telegram" | "translate" | null;

type ErrorType = "PARSE_ERROR" | "API_TIMEOUT" | "API_ERROR" | "VALIDATION_ERROR" | "UNKNOWN_ERROR" | null;

export default function Home()
{
    const [url, setUrl] = useState<string>("");
    const [actionType, setActionType] = useState<ActionType>(null);
    const [result, setResult] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [processStatus, setProcessStatus] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [errorType, setErrorType] = useState<ErrorType>(null);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const resultRef = useRef<HTMLDivElement>(null);

    // Scroll to result block after successful generation
    useEffect(() =>
    {
        if (result && !isLoading && resultRef.current)
        {
            resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, [result, isLoading]);

    // Handle URL input change
    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>): void =>
    {
        setUrl(e.target.value);
    };

    // Handle clear button click
    const handleClear = (): void =>
    {
        setUrl("");
        setActionType(null);
        setResult("");
        setIsLoading(false);
        setProcessStatus("");
        setError(null);
        setErrorType(null);
        setCopySuccess(false);
    };

    // Handle copy button click
    const handleCopy = async (): Promise<void> =>
    {
        if (!result)
        {
            return;
        }

        try
        {
            await navigator.clipboard.writeText(result);
            setCopySuccess(true);
            setTimeout(() => {
                setCopySuccess(false);
            }, 2000);
        }
        catch (err)
        {
            console.error("Failed to copy text:", err);
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
        setError(null);
        setErrorType(null);
        setProcessStatus("Загружаю статью…");

        try
        {
            // Call API with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, 150000); // 2.5 minute timeout on client side

            try
            {
                let apiEndpoint: string;
                let resultKey: string;
                let errorMessage: string;
                let processMessage: string;

                // Determine API endpoint and result key based on action type
                switch (type)
                {
                    case "translate":
                        apiEndpoint = "/api/translate";
                        resultKey = "translation";
                        errorMessage = "Ошибка при переводе статьи";
                        processMessage = "Перевожу статью…";
                        break;
                    case "summary":
                        apiEndpoint = "/api/summary";
                        resultKey = "summary";
                        errorMessage = "Ошибка при генерации описания статьи";
                        processMessage = "Генерирую описание статьи…";
                        break;
                    case "theses":
                        apiEndpoint = "/api/theses";
                        resultKey = "theses";
                        errorMessage = "Ошибка при генерации тезисов";
                        processMessage = "Генерирую тезисы…";
                        break;
                    case "telegram":
                        apiEndpoint = "/api/telegram";
                        resultKey = "telegramPost";
                        errorMessage = "Ошибка при генерации поста для Telegram";
                        processMessage = "Создаю пост для Telegram…";
                        break;
                    default:
                        setIsLoading(false);
                        setProcessStatus("");
                        return;
                }

                setProcessStatus(processMessage);

                const response = await fetch(apiEndpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ url: url.trim() }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok)
                {
                    const errorData = await response.json();
                    const errorMessageFromApi = errorData.error || errorMessage;
                    const errorTypeValue = errorData.errorType || "UNKNOWN_ERROR";
                    
                    setError(errorMessageFromApi);
                    setErrorType(errorTypeValue as ErrorType);
                    setProcessStatus("");
                    setIsLoading(false);
                    return;
                }

                const data = await response.json();
                const resultValue = data[resultKey];
                
                if (!resultValue)
                {
                    throw new Error(`Результат не получен для действия "${type}"`);
                }

                setResult(resultValue);
                setProcessStatus("");
                setError(null);
                setErrorType(null);
            }
            catch (error)
            {
                clearTimeout(timeoutId);
                if (error instanceof Error && error.name === "AbortError")
                {
                    setError("Превышено время ожидания ответа. Запрос отменен.");
                    setErrorType("API_TIMEOUT");
                    setProcessStatus("");
                    setIsLoading(false);
                    return;
                }
                throw error;
            }
            finally
            {
                setIsLoading(false);
            }
        }
        catch (error)
        {
            setIsLoading(false);
            setProcessStatus("");
            setError("Произошла непредвиденная ошибка. Пожалуйста, попробуйте позже.");
            setErrorType("UNKNOWN_ERROR");
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
            <main className="flex w-full max-w-4xl flex-col items-center justify-center py-8 px-4 bg-white dark:bg-black sm:py-16 sm:px-8 md:px-16">
                <div className="w-full max-w-3xl">
                    <h1 className="mb-6 text-2xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50 text-center sm:text-3xl sm:mb-8 sm:leading-10">
                        Референт - переводчик с ИИ-обработкой
                    </h1>

                    {/* URL Input Field */}
                    <div className="mb-6 sm:mb-8">
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
                            placeholder="Введите URL статьи, например: https://example.com/article"
                            className="w-full px-4 py-3 rounded-lg border border-solid border-black/[.08] bg-background text-foreground placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-white/[.145] dark:bg-[#1a1a1a] text-sm sm:text-base"
                        />
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 px-1">
                            Укажите ссылку на англоязычную статью
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="mb-6 sm:mb-8 flex flex-col gap-3 sm:gap-4 sm:flex-row sm:flex-wrap">
                        <button
                            onClick={() => handleAction("translate")}
                            disabled={isLoading}
                            title="Перевести статью с английского на русский язык"
                            className={`w-full sm:flex-1 h-12 items-center justify-center rounded-lg px-4 sm:px-5 text-white font-medium text-sm sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                actionType === "translate" && isLoading
                                    ? "bg-orange-700 ring-2 ring-orange-400 ring-offset-2"
                                    : "bg-orange-600 hover:bg-orange-700"
                            }`}
                        >
                            Перевести
                        </button>
                        <button
                            onClick={() => handleAction("summary")}
                            disabled={isLoading}
                            title="Получить краткое описание содержания статьи"
                            className={`w-full sm:flex-1 h-12 items-center justify-center rounded-lg px-4 sm:px-5 text-white font-medium text-sm sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                actionType === "summary" && isLoading
                                    ? "bg-blue-700 ring-2 ring-blue-400 ring-offset-2"
                                    : "bg-blue-600 hover:bg-blue-700"
                            }`}
                        >
                            О чем статья?
                        </button>
                        <button
                            onClick={() => handleAction("theses")}
                            disabled={isLoading}
                            title="Сгенерировать основные тезисы статьи"
                            className={`w-full sm:flex-1 h-12 items-center justify-center rounded-lg px-4 sm:px-5 text-white font-medium text-sm sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                actionType === "theses" && isLoading
                                    ? "bg-green-700 ring-2 ring-green-400 ring-offset-2"
                                    : "bg-green-600 hover:bg-green-700"
                            }`}
                        >
                            Тезисы
                        </button>
                        <button
                            onClick={() => handleAction("telegram")}
                            disabled={isLoading}
                            title="Создать готовый пост для публикации в Telegram"
                            className={`w-full sm:flex-1 h-12 items-center justify-center rounded-lg px-4 sm:px-5 text-white font-medium text-sm sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                actionType === "telegram" && isLoading
                                    ? "bg-purple-700 ring-2 ring-purple-400 ring-offset-2"
                                    : "bg-purple-600 hover:bg-purple-700"
                            }`}
                        >
                            Пост для Telegram
                        </button>
                        <button
                            onClick={handleClear}
                            disabled={isLoading}
                            title="Очистить все поля и результаты"
                            className="w-full sm:w-auto h-12 px-4 sm:px-5 rounded-lg bg-gray-500 text-white font-medium text-sm sm:text-base transition-colors hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Очистить
                        </button>
                    </div>

                    {/* Process Status Block */}
                    {processStatus && (
                        <div className="mb-4 p-3 sm:p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                            <p className="text-sm text-blue-700 dark:text-blue-300 break-words">
                                {processStatus}
                            </p>
                        </div>
                    )}

                    {/* Error Alert Block */}
                    {error && (
                        <div className="mb-4">
                            <Alert variant="destructive">
                                <p className="text-sm font-medium break-words">{error}</p>
                            </Alert>
                        </div>
                    )}

                    {/* Result Display Block */}
                    <div ref={resultRef} className="w-full rounded-lg border-2 border-solid border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#1a1a1a] p-4 sm:p-6 min-h-[200px]">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
                            <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                                Результат
                            </h2>
                            {result && !isLoading && (
                                <button
                                    onClick={handleCopy}
                                    title="Копировать результат в буфер обмена"
                                    className="w-full sm:w-auto px-4 py-2 text-sm rounded-lg bg-gray-600 text-white font-medium transition-colors hover:bg-gray-700"
                                >
                                    {copySuccess ? "Скопировано!" : "Копировать"}
                                </button>
                            )}
                        </div>
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                <span className="ml-3 text-foreground text-sm sm:text-base">
                                    Генерация результата...
                                </span>
                            </div>
                        ) : result ? (
                            <div className="text-foreground whitespace-pre-wrap font-mono text-xs sm:text-sm overflow-auto break-words">
                                {result}
                            </div>
                        ) : !error ? (
                            <div className="text-gray-500 dark:text-gray-400 italic text-sm sm:text-base">
                                Результат появится здесь после выбора действия...
                            </div>
                        ) : null}
                    </div>
                </div>
            </main>
        </div>
    );
}
