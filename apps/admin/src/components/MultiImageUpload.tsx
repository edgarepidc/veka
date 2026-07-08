'use client';

import { useId, useRef, useState } from 'react';
import { imageExtensionFromMime, MAX_IMAGE_BYTES, resolveStorageImageUrl } from '@veka/shared';

import { createClient } from '@/lib/supabase/client';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

export function MultiImageUpload({
  bucket,
  buildPath,
  inputName = 'image_urls',
  label,
  hint,
}: {
  bucket: string;
  buildPath: (fileId: string, ext: string) => string;
  inputName?: string;
  label: string;
  hint?: string;
}) {
  const supabase = createClient();
  const baseId = useId().replace(/:/g, '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Solo imágenes (JPG, PNG, WebP, GIF).');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Cada imagen no puede superar 2 MB.');
      return;
    }

    const ext = imageExtensionFromMime(file.type);
    const fileId = `${baseId}-${Date.now()}`;
    const path = buildPath(fileId, ext);

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

    setPaths((current) => [...current, path]);
  }

  function removePath(path: string) {
    setPaths((current) => current.filter((item) => item !== path));
  }

  return (
    <div>
      <p className="text-sm font-medium text-muted">{label}</p>
      {hint ? <p className="mt-0.5 text-xs text-subtle">{hint}</p> : null}

      {paths.map((path) => (
        <input key={path} type="hidden" name={inputName} value={path} />
      ))}

      {paths.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-3">
          {paths.map((path) => {
            const displayUrl = resolveStorageImageUrl(SUPABASE_URL, path, bucket);
            return (
              <div key={path} className="relative rounded-xl border border-white/10 bg-white/5 p-2">
                {displayUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={displayUrl} alt="" className="h-20 w-28 object-cover rounded-lg" />
                ) : (
                  <div className="flex h-20 w-28 items-center justify-center text-xs text-subtle">Imagen</div>
                )}
                <button
                  type="button"
                  onClick={() => removePath(path)}
                  className="absolute -right-1 -top-1 rounded-full bg-red-500/90 px-1.5 text-[10px] text-white"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-3">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
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
          {uploading ? 'Subiendo…' : paths.length > 0 ? 'Agregar otra imagen' : 'Subir imágenes'}
        </button>
      </div>

      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
