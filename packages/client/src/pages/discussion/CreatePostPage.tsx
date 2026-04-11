import { useNavigate, useParams } from 'react-router-dom';
import { useState, useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  Image01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useCreatePost } from '@/services/discussions';

const MAX_TITLE = 200;
const MAX_BODY = 10000;
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export default function CreatePostPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createPost = useCreatePost(boardId ?? '');

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const file of Array.from(incoming)) {
      if (files.length + newFiles.length >= MAX_FILES) break;
      if (file.size > MAX_FILE_SIZE) {
        setError(`${file.name} 超過 10MB 限制`);
        continue;
      }
      if (!file.type.startsWith('image/')) {
        setError(`${file.name} 不是圖片檔案`);
        continue;
      }
      newFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    setFiles((prev) => [...prev, ...newFiles]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  }

  function removeFile(index: number) {
    URL.revokeObjectURL(previews[index]);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('請輸入標題');
      return;
    }
    if (!body.trim()) {
      setError('請輸入內容');
      return;
    }

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('body', body.trim());
    formData.append('isAnonymous', String(isAnonymous));
    files.forEach((file) => formData.append('images', file));

    try {
      const post = await createPost.mutateAsync(formData);
      navigate(`/discussion/post/${post.id}`, { replace: true });
    } catch {
      setError('發佈失敗，請稍後再試。');
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate(-1)}
          aria-label="返回"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={20} />
        </Button>
        <h1 className="text-xl font-bold">發佈新帖文</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Title */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="post-title">標題</Label>
          <Input
            id="post-title"
            placeholder="輸入帖文標題"
            maxLength={MAX_TITLE}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <span className="text-right text-xs text-muted-foreground">
            {title.length}/{MAX_TITLE}
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="post-body">內容</Label>
          <Textarea
            id="post-body"
            placeholder="輸入帖文內容"
            maxLength={MAX_BODY}
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="resize-y"
          />
          <span className="text-right text-xs text-muted-foreground">
            {body.length}/{MAX_BODY}
          </span>
        </div>

        {/* Photo Upload */}
        <div className="flex flex-col gap-2">
          <Label>圖片</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border p-6 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            disabled={files.length >= MAX_FILES}
          >
            <HugeiconsIcon icon={Image01Icon} size={28} />
            <span className="text-sm">點擊或拖曳上載圖片</span>
            <span className="text-xs">
              最多{MAX_FILES}張，每張不超過10MB
            </span>
          </button>

          {/* Thumbnails */}
          {previews.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {previews.map((src, i) => (
                <div key={i} className="group relative">
                  <img
                    src={src}
                    alt={`上載圖片 ${i + 1}`}
                    className="h-20 w-20 rounded-md object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
                    aria-label="移除圖片"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Anonymous Toggle */}
        <div className="flex flex-col gap-2 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="anon-switch" className="cursor-pointer">
              匿名發佈
            </Label>
            <Switch
              id="anon-switch"
              checked={isAnonymous}
              onCheckedChange={setIsAnonymous}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            你的身份將不會顯示給其他業戶
          </p>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Submit */}
        <Button
          type="submit"
          className="h-11 w-full"
          disabled={createPost.isPending}
        >
          {createPost.isPending ? '發佈中...' : '發佈帖文'}
        </Button>
      </form>
    </div>
  );
}
