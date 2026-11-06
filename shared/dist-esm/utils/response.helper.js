export function ok(data, meta = null) {
    return { success: true, data, meta, error: null };
}
export function okList(items, meta) {
    return { success: true, data: items, meta, error: null };
}
