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
        className={`rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm cursor-pointer transition-colors ${
          isDragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:border-gray-400"
        } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <input {...getInputProps({ id })} />
        <i
          className="fas fa-image text-2xl text-gray-400 mb-2"
          aria-hidden="true"
        ></i>
        <p className="text-gray-700">
          {isDragActive
            ? "Drop the image here"
            : "Drop an image here, paste one with Ctrl+V (⌘V on a Mac), or click to choose a file"}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          PNG, JPEG, WebP or GIF, up to 8 MB.
        </p>
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
