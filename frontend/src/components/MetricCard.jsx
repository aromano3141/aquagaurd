export default function MetricCard({ value, label, sublabel, gradient = 'default' }) {
    const gradientClass = {
        default: 'gradient-text',
        green: 'gradient-text-green',
        red: 'gradient-text-red',
        orange: 'gradient-text-orange',
    }[gradient] || 'gradient-text'

    return (
        <div className="rounded-2xl p-6 text-center backdrop-blur-xl border border-[var(--color-border)]
                    shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(79,172,254,0.05)]
                    hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(79,172,254,0.08)]
                    transition-all duration-300"
            style={{ background: 'linear-gradient(135deg, rgba(10,12,28,0.98), rgba(14,18,38,0.95))' }}>
            <div className={`text-4xl font-extrabold leading-tight mb-1 ${gradientClass}`}>
                {value}
            </div>
            <div className="text-xs font-medium uppercase tracking-widest text-[var(--color-text-dimmer)]">
                {label}
            </div>
            {sublabel && (
                <div className="text-[0.65rem] text-[var(--color-text-dimmest)] mt-1">
                    {sublabel}
                </div>
            )}
        </div>
    )
}
