import React from "react";

interface AlertProps
{
    variant?: "default" | "destructive";
    children: React.ReactNode;
    className?: string;
}

/**
 * Alert component for displaying error messages
 * @param variant - Alert variant (default or destructive)
 * @param children - Alert content
 * @param className - Additional CSS classes
 */
export function Alert({ variant = "default", children, className = "" }: AlertProps)
{
    const baseStyles = "rounded-lg border p-3 sm:p-4";
    const variantStyles = variant === "destructive"
        ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
        : "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300";

    return (
        <div className={`${baseStyles} ${variantStyles} ${className}`}>
            {children}
        </div>
    );
}

