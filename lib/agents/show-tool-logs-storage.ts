export const SHOW_TOOL_LOGS_STORAGE_KEY = "gigent:agents:showToolLogs"

export const SHOW_TOOL_LOGS_CHANGED_EVENT = "gigent:showToolLogs-changed"

export const readShowToolLogs = (): boolean => {
    if (typeof window === "undefined") {
        return false
    }
    try {
        return window.localStorage.getItem(SHOW_TOOL_LOGS_STORAGE_KEY) === "1"
    } catch {
        return false
    }
}

export const writeShowToolLogs = (value: boolean): void => {
    if (typeof window === "undefined") {
        return
    }
    try {
        if (value) {
            window.localStorage.setItem(SHOW_TOOL_LOGS_STORAGE_KEY, "1")
        } else {
            window.localStorage.removeItem(SHOW_TOOL_LOGS_STORAGE_KEY)
        }
        window.dispatchEvent(new Event(SHOW_TOOL_LOGS_CHANGED_EVENT))
    } catch {
        // ignore quota / private mode
    }
}
