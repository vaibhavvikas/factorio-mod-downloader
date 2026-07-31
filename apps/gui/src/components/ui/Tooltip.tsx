import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LAYER, BORDER } from '../../theme/layers';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
    delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
    content,
    children,
    className = '',
    disabled = false,
    delay = 250,
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties | null>(null);

    const calculateStyle = (): React.CSSProperties | null => {
        if (!triggerRef.current) return null;
        const rect = triggerRef.current.getBoundingClientRect();
        const tooltipEl = tooltipRef.current;

        const textLen = typeof content === 'string' ? content.length : 15;
        const estimatedW = Math.max(70, Math.min(300, textLen * 7 + 20));
        const tooltipW = tooltipEl && tooltipEl.offsetWidth ? tooltipEl.offsetWidth : estimatedW;
        const tooltipH = tooltipEl && tooltipEl.offsetHeight ? tooltipEl.offsetHeight : 26;

        const EDGE_MARGIN_X = 28; // Keep at least 28px away from left/right app window borders
        const EDGE_MARGIN_Y = 16; // Keep at least 16px away from top/bottom app window borders
        const buffer = 6;

        const spaceBelow = window.innerHeight - rect.bottom;
        let top: number;
        let isAbove = false;

        if (spaceBelow < tooltipH + buffer + EDGE_MARGIN_Y && rect.top > tooltipH + buffer + EDGE_MARGIN_Y) {
            top = rect.top - buffer;
            isAbove = true;
        } else {
            top = rect.bottom + buffer;
            isAbove = false;
        }

        if (isAbove) {
            top = Math.max(EDGE_MARGIN_Y + tooltipH, top);
        } else {
            top = Math.min(window.innerHeight - EDGE_MARGIN_Y - tooltipH, top);
        }

        const triggerCenter = rect.left + rect.width / 2;
        const halfW = tooltipW / 2;

        const minCenter = EDGE_MARGIN_X + halfW;
        const maxCenter = Math.max(minCenter, window.innerWidth - EDGE_MARGIN_X - halfW);
        const clampedCenter = Math.max(minCenter, Math.min(maxCenter, triggerCenter));

        return {
            position: 'fixed',
            left: `${clampedCenter}px`,
            top: `${top}px`,
            transform: isAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            zIndex: 99999,
        };
    };

    const handleMouseEnter = () => {
        if (disabled || !content) return;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        if (delay <= 0) {
            const initialStyle = calculateStyle();
            if (initialStyle) {
                setTooltipStyle(initialStyle);
                setIsVisible(true);
            }
        } else {
            timeoutRef.current = setTimeout(() => {
                const initialStyle = calculateStyle();
                if (initialStyle) {
                    setTooltipStyle(initialStyle);
                    setIsVisible(true);
                }
            }, delay);
        }
    };

    useLayoutEffect(() => {
        if (isVisible && tooltipRef.current) {
            const exactStyle = calculateStyle();
            if (exactStyle) {
                setTooltipStyle(exactStyle);
            }
        }
    }, [isVisible, content]);

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsVisible(false);
        setTooltipStyle(null);
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    return (
        <div
            ref={triggerRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`inline-flex shrink-0 ${className}`}
        >
            {children}
            {isVisible && !disabled && content && tooltipStyle && createPortal(
                <div
                    ref={tooltipRef}
                    style={tooltipStyle}
                    className={`pointer-events-none whitespace-nowrap rounded-lg ${BORDER.tooltip} ${LAYER.tooltipSurface} px-2.5 py-1 text-[10px] font-medium shadow-xl backdrop-blur-sm animate-fade-in select-none`}
                >
                    {content}
                </div>,
                document.body
            )}
        </div>
    );
};
