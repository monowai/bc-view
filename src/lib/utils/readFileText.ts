/** A file's text, read with FileReader (which every browser and jsdom provide). */
export function readFileText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onabort = () => reject(new Error("File reading was aborted"))
    reader.onerror = () =>
      reject(reader.error ?? new Error("File reading failed"))
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.readAsText(file, "utf-8")
  })
}
