import React, { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
    title?: string;
    description?: string;
}

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    title,
    description
}) => {
    return (
        <div className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl overflow-hidden ${className}`}>
            {(title || description) && (
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    {title && <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>}
                    {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
                </div>
            )}
            <div className="p-6">
                {children}
            </div>
        </div>
    );
};
