'use client';

import { useRef, useState } from 'react';
import {
  imageExtensionFromMime,
  MAX_IMAGE_BYTES,
  resolveStorageImageUrl,
} from '@veka/shared';

import { createClient } from '@/lib/supabase/client';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

export function ImageUpload({
  bucket,
  buildPath,
  currentPath,
  inputName,
  label,
  hint,
  previewClassName = 'max-h-20 max-w-[200px] object-contain',
}: {
  bucket: string;
  buildPath: (ext: string) => string;
  currentPath?: string | null;
  inputName: string;
  label: string;
  hint?: string;
  previewClassName?: string;
}) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [storedPath, setStoredPath] = useState(currentPath ?? '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayUrl = resolveStorageImageUrl(SUPABASE_URL, storedPath, bucket);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten imágenes (JPG, PNG, WebP).');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('La imagen no puede superar 2 MB.');
      return;
    }

    const ext = imageExtensionFromMime(file.type);
    const path = buildPath(ext);

    setUploading(true);
    setError(null);

    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: file.type,
    });

    setUploading(false);

    if (uploadError) {
      setError(uploadError.message);
      return;
    }

    setStoredPath(path);
  }

  return (
    <div>
      <p className="text-sm font-medium text-muted">{label}</p>
      {hint ? <p className="mt-0.5 text-xs text-subtle">{hint}</p> : null}

      <input type="hidden" name={inputName} value={storedPath} />

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        {displayUrl ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={displayUrl} alt="" className={previewClassName} />
          </div>
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 text-xs text-subtle">
            Sin imagen
          </div>
        )}

        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="glass-btn-secondary w-fit"
          >
            {uploading ? 'Subiendo…' : storedPath ? 'Cambiar imagen' : 'Subir imagen'}
          </button>
          {storedPath ? (
            <button
              type="button"
              disabled={uploading}
              onClick={() => {
                setStoredPath('');
                setError(null);
              }}
              className="text-left text-xs text-subtle hover:text-red-300"
            >
              Quitar imagen
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
