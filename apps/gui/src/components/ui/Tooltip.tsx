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

        const EDGE_MARGIN_X = 28;
        const EDGE_MARGIN_Y = 16;
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

interface SummaryTooltipProps {
    content: string;
    children: React.ReactNode;
}

export const SummaryTooltip: React.FC<SummaryTooltipProps> = ({ content, children }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [placement, setPlacement] = useState<'above' | 'below'>('below');
    const [pos, setPos] = useState<{ left: number; top: number; arrowLeft: number; ready: boolean }>({
        left: 0,
        top: 0,
        arrowLeft: 0,
        ready: false,
    });

    const handleMouseEnter = () => {
        const container = containerRef.current;
        if (!container) return;
        const isTruncated = container.scrollHeight > container.clientHeight + 1 || content.length > 80;
        if (!isTruncated) return;
        timeoutRef.current = setTimeout(() => {
            reposition();
            setIsVisible(true);
        }, 300);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsVisible(false);
        setPos(p => ({ ...p, ready: false }));
    };

    const reposition = () => {
        const container = containerRef.current;
        const tooltip = tooltipRef.current;
        if (!container || !tooltip) return;

        const GAP = 8;
        const BUFFER = 28;

        const scrollAncestors: Element[] = [];
        let current: Element | null = container.parentElement;
        while (current && current !== document.body) {
            const style = window.getComputedStyle(current);
            const overflowY = style.overflowY;
            if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
                scrollAncestors.push(current);
            }
            current = current.parentElement;
        }

        const hostRect = container.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        for (const scrollEl of scrollAncestors) {
            const sRect = scrollEl.getBoundingClientRect();
            if (hostRect.bottom < sRect.top || hostRect.top > sRect.bottom) {
                setPos(p => ({ ...p, ready: false }));
                return;
            }
        }

        if (hostRect.bottom < 0 || hostRect.top > vh || hostRect.right < 0 || hostRect.left > vw) {
            setPos(p => ({ ...p, ready: false }));
            return;
        }

        const tooltipW = tooltip.offsetWidth || 260;
        const tooltipH = tooltip.offsetHeight || 44;

        const hostCenter = hostRect.left + hostRect.width / 2;
        let left = hostCenter - tooltipW / 2;
        left = Math.max(BUFFER, Math.min(vw - tooltipW - BUFFER, left));

        const rawArrowLeft = hostCenter - left;
        const arrowLeft = Math.max(14, Math.min(tooltipW - 14, rawArrowLeft));

        const spaceAbove = hostRect.top;
        const spaceBelow = vh - hostRect.bottom;
        let top: number;
        let place: 'above' | 'below';
        const fitsBelow = spaceBelow >= tooltipH + GAP + BUFFER;
        const fitsAbove = spaceAbove >= tooltipH + GAP + BUFFER;

        if (fitsBelow) {
            top = hostRect.bottom + GAP;
            place = 'below';
        } else if (fitsAbove) {
            top = hostRect.top - tooltipH - GAP;
            place = 'above';
        } else if (spaceBelow >= spaceAbove) {
            top = hostRect.bottom + GAP;
            place = 'below';
        } else {
            top = hostRect.top - tooltipH - GAP;
            place = 'above';
        }

        top = Math.max(BUFFER, Math.min(vh - tooltipH - BUFFER, top));

        setPos({ left, top, arrowLeft, ready: true });
        setPlacement(place);
    };

    useEffect(() => {
        if (!isVisible) return;

        const raf = window.requestAnimationFrame(reposition);

        const listenerOpts: AddEventListenerOptions = { passive: true };
        const onScroll = () => reposition();
        const onResize = () => reposition();

        window.addEventListener('scroll', onScroll, listenerOpts);
        window.addEventListener('resize', onResize, listenerOpts);
        scrollAncestors().forEach(el => el.addEventListener('scroll', onScroll, listenerOpts));

        const resizeObserver = new ResizeObserver(() => reposition());
        resizeObserver.observe(tooltipRef.current!);
        resizeObserver.observe(containerRef.current!);

        return () => {
            window.cancelAnimationFrame(raf);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onResize);
            scrollAncestors().forEach(el => el.removeEventListener('scroll', onScroll));
            resizeObserver.disconnect();
        };
    }, [isVisible]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    function scrollAncestors(): Element[] {
        const result: Element[] = [];
        let current: Element | null = containerRef.current?.parentElement ?? null;
        while (current && current !== document.body) {
            const style = window.getComputedStyle(current);
            const overflowY = style.overflowY;
            if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
                result.push(current);
            }
            current = current.parentElement;
        }
        return result;
    }

    return (
        <div
            ref={containerRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`group relative min-h-12 flex items-center ${LAYER.innerInset} p-2 rounded-xl ${BORDER.inner}`}
        >
            {children}
            {isVisible && content && createPortal(
                <div
                    ref={tooltipRef}
                    className={`pointer-events-none fixed z-[80] min-w-[180px] w-fit max-w-[420px] whitespace-pre-wrap rounded-lg ${BORDER.tooltip} ${LAYER.tooltipSurface} px-3 py-2 text-[11px] leading-relaxed shadow-xl animate-fade-in select-none`}
                    style={{
                        left: `${pos.left}px`,
                        top: `${pos.top}px`,
                        opacity: pos.ready ? 1 : 0,
                        transition: 'opacity 120ms ease-out',
                    }}
                    data-summary-tooltip
                >
                    {placement === 'above' && (
                        <div
                            className={`absolute -bottom-1.5 -translate-x-1/2 w-3 h-3 rotate-45 ${LAYER.tooltipArrowAbove}`}
                            style={{ left: `${pos.arrowLeft}px` }}
                            aria-hidden
                        />
                    )}
                    {placement === 'below' && (
                        <div
                            className={`absolute -top-1.5 -translate-x-1/2 w-3 h-3 rotate-45 ${LAYER.tooltipArrowBelow}`}
                            style={{ left: `${pos.arrowLeft}px` }}
                            aria-hidden
                        />
                    )}
                    {content}
                </div>,
                document.body
            )}
        </div>
    );
};
