export default function LeakBadge({ severity, label }) {
    const styles = {
        high: 'bg-[rgba(255,71,87,0.15)] text-[#ff4757] border-[rgba(255,71,87,0.2)]',
        med: 'bg-[rgba(255,165,2,0.15)] text-[#ffa502] border-[rgba(255,165,2,0.2)]',
        low: 'bg-[rgba(46,213,115,0.15)] text-[#2ed573] border-[rgba(46,213,115,0.2)]',
    }

    return (
        <span className={`inline-block px-3.5 py-1 rounded-full text-xs font-semibold tracking-wide border ${styles[severity] || styles.low}`}>
            ● {label}
        </span>
    )
}
