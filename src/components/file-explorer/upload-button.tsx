import { FolderUp, Upload } from 'lucide-react'
import { useRef } from 'react'

import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'

type UploadButtonProps = {
  disabled?: boolean
  onSelectFiles: (files: File[]) => void
  onSelectFolder: (files: File[]) => void
}

const directoryInputProps = {
  directory: '',
  webkitdirectory: '',
} as const

export function UploadButton({
  disabled,
  onSelectFiles,
  onSelectFolder,
}: UploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  function resetInput(input: HTMLInputElement | null) {
    if (input) {
      input.value = ''
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        multiple
        tabIndex={-1}
        onChange={(event) => {
          const files = event.target.files
          if (files?.length) {
            onSelectFiles(Array.from(files))
          }
          resetInput(fileInputRef.current)
        }}
      />

      <input
        ref={folderInputRef}
        type="file"
        className="sr-only"
        multiple
        tabIndex={-1}
        onChange={(event) => {
          const files = event.target.files
          if (files?.length) {
            onSelectFolder(Array.from(files))
          }
          resetInput(folderInputRef.current)
        }}
        {...directoryInputProps}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-border bg-card text-foreground hover:bg-accent h-8 rounded-sm px-2.5 font-normal"
            disabled={disabled}
          >
            <Upload className="size-4" />
            Upload
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
            <Upload className="size-4" />
            Upload files
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => folderInputRef.current?.click()}>
            <FolderUp className="size-4" />
            Upload folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
