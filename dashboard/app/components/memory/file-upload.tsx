'use client';

import { Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { uploadFile } from '@/lib/api';

const ACCEPTED_TYPES = ['.txt', '.md', '.csv', '.pdf', '.docx'];

export function FileUpload() {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleFile = useCallback(
    async (file: File) => {
      setError('');
      setResult(null);
      setUploading(true);
      setProgress(30);

      try {
        setProgress(60);
        const data = (await uploadFile(file)) as { filename: string; chunks: number };
        setProgress(100);
        setResult(`Ingested "${data.filename}" — ${data.chunks} chunks created`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
        setTimeout(() => setProgress(0), 1000);
      }
    },
    [router],
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  return (
    <div className="space-y-4">
      <Card
        className={`transition-all ${
          dragOver ? 'border-primary' : 'border-dashed'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center gap-3 py-8">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">Drag and drop a file here, or click to select</p>
            <p className="text-xs text-muted-foreground">
              Supported: {ACCEPTED_TYPES.join(', ')} (max 50MB)
            </p>
          </div>
          <label>
            <Button variant="outline" size="sm" className="cursor-pointer" asChild>
              <span>Choose File</span>
            </Button>
            <input
              type="file"
              className="hidden"
              accept={ACCEPTED_TYPES.join(',')}
              onChange={handleFileInput}
              disabled={uploading}
            />
          </label>
        </CardContent>
      </Card>

      {uploading && <Progress value={progress} className="h-2" />}

      {result && <p className="text-sm text-primary">{result}</p>}

      {error && <p className="text-sm text-status-red">{error}</p>}
    </div>
  );
}
