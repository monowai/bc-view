import React from "react"
import { useDropzone } from "react-dropzone"
import { IMAGE_TYPES } from "./statementRows"

/** react-dropzone's form of the types the reader takes. */
const ACCEPTED: Record<string, string[]> = Object.fromEntries(
  IMAGE_TYPES.split(",").map((type) => [type, []]),
)

interface ImageDropZoneProps {
  id: string
  file: File | null
  /** The file came from the clipboard. */
  pasted: boolean
  disabled: boolean
  onChoose: (file: File | null) => void
  onRemove: () => void
}

/**
 * Where the image is chosen: click to pick a file, drop one on it, or paste
 * one (the step listens for paste). Once chosen, it names the image and
 * offers Remove.
 */
export default function ImageDropZone({
  id,
  file,
  pasted,
  disabled,
  onChoose,
  onRemove,
}: ImageDropZoneProps): React.ReactElement {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED,
    multiple: false,
    disabled,
    // A file of another type is passed on too: the reader says why it refuses it.
    onDrop: (accepted, rejected) =>
      onChoose(accepted[0] ?? rejected[0]?.file ?? null),
  })
  const size = file ? `${Math.max(1, Math.round(file.size / 1024))} KB` : ""

  return (
    <div>
      <div
        {...getRootProps()}
        data-testid="image-drop-zone"
        className={`flex items-center gap-4 rounded-lg border-2 border-dashed px-5 py-4 text-sm cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
          isDragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100/60"
        } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <input {...getInputProps({ id })} />
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white border border-gray-200 text-gray-500"
        >
          <i className="fas fa-image"></i>
        </span>
        <span className="min-w-0">
          <span className="block font-medium text-gray-900">
            {isDragActive ? "Drop the image here" : "Drop an image here"}
          </span>
          <span className="block text-gray-600 mt-0.5">
            or paste one with Ctrl+V (⌘V on a Mac), or click to choose a file.
            PNG, JPEG, WebP or GIF, up to 8 MB.
          </span>
        </span>
      </div>
      {file && (
        <div className="flex items-center justify-between gap-2 mt-2 text-sm text-gray-900">
          <span>
            {pasted
              ? `Pasted image chosen (${size}).`
              : `${file.name} (${size})`}
          </span>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label="Remove image"
            className="text-gray-600 underline disabled:opacity-60"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  )
}
